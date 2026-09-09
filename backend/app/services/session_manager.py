import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional, Set
from fastapi import WebSocket

from ..models.schemas import (
    Utterance, ClarificationQuestion, RequirementSet, QualityEvaluation,
    AmbiguityFlag, RequirementStatus
)
from .ambiguity_engine import ambiguity_engine
from .requirement_engine import requirement_engine
from .quality_evaluator import quality_evaluator
from .llm_service import llm_service
from .database import db_manager

logger = logging.getLogger("AIRequirementAnalyst.SessionManager")

class SessionManager:
    """
    Manages shared, real-time meeting sessions between the Web Dashboard,
    Chrome Extension Sidepanel, Popup, and in-meeting HUD.
    Persists all sessions, transcripts, and clarification decisions into SQLite database.
    """
    def __init__(self) -> None:
        self.active_connections: Set[WebSocket] = set()
        
        # Check if an active meeting exists in SQLite, or create one
        active_id = db_manager.get_active_meeting_id()
        if active_id:
            full_meet = db_manager.get_meeting_full(active_id)
            if full_meet:
                self._load_from_dict(full_meet)
            else:
                self._init_fresh_session()
        else:
            self._init_fresh_session()

    def _init_fresh_session(self, title: str = "Live Meeting Session", domain: str = "HR Tech") -> None:
        mid = db_manager.create_meeting(title, domain)
        self.session_id = mid
        self.session_title = title
        self.domain = domain
        self.transcript = []
        self.clarifications = []
        self.baseline = {"frs": [], "nfrs": []}
        self.refined = {"frs": [], "nfrs": []}
        self.evaluation = {}
        self.is_active = True
        self.is_finalized = False
        self.created_at = datetime.now().isoformat()
        self.updated_at = datetime.now().isoformat()

    def _load_from_dict(self, d: Dict[str, Any]) -> None:
        self.session_id = d["id"]
        self.session_title = d["title"]
        self.domain = d["domain"]
        self.transcript = d["transcript"]
        self.clarifications = d["clarifications"]
        self.baseline = d.get("baseline", {"frs": [], "nfrs": []})
        self.refined = d.get("refined", {"frs": [], "nfrs": []})
        self.evaluation = d.get("evaluation", {})
        self.is_active = d.get("isActive", True)
        self.is_finalized = d.get("isFinalized", False)
        self.created_at = d.get("createdAt", datetime.now().isoformat())
        self.updated_at = d.get("updatedAt", datetime.now().isoformat())
        if self.transcript and (not self.baseline.get("frs")):
            self._recalculate()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")
        await websocket.send_text(json.dumps({
            "type": "SESSION_STATE_SYNC",
            "data": self.get_state()
        }))

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message_type: str, data: Any) -> None:
        """Broadcasts real-time events to all connected clients."""
        if not self.active_connections:
            return

        payload = json.dumps({"type": message_type, "data": data})
        dead_connections = set()
        for conn in self.active_connections:
            try:
                await conn.send_text(payload)
            except Exception as e:
                logger.warning(f"Error sending message to WebSocket client: {e}")
                dead_connections.add(conn)

        for dead in dead_connections:
            self.disconnect(dead)

    def get_state(self) -> Dict[str, Any]:
        """Returns full synchronized state for the active meeting."""
        return {
            "sessionId": self.session_id,
            "sessionTitle": self.session_title,
            "domain": self.domain,
            "isActive": self.is_active,
            "isFinalized": self.is_finalized,
            "transcript": self.transcript,
            "clarifications": self.clarifications,
            "baseline": self.baseline,
            "refined": self.refined,
            "evaluation": self.evaluation,
            "stats": {
                "transcriptCount": len(self.transcript),
                "clarificationCount": len(self.clarifications),
                "resolvedCount": sum(1 for c in self.clarifications if c.get("selectedResponse")),
                "ambiguityCount": sum(len(u.get("detectedFlags", [])) for u in self.transcript),
                "overallQualityIndex": self.evaluation.get("refined", {}).get("overallQualityIndex", 0) if self.transcript else 0
            },
            "createdAt": self.created_at,
            "updatedAt": self.updated_at
        }

    def start_session(self, title: str = "Live Meeting", domain: str = "HR Tech") -> Dict[str, Any]:
        """Starts a BRAND NEW isolated meeting session in the database."""
        self._init_fresh_session(title=title, domain=domain)
        self._recalculate()
        return self.get_state()

    def reset_session(self) -> Dict[str, Any]:
        """Resets the current meeting session to a clean slate."""
        mid = db_manager.create_meeting(self.session_title or "Live Meeting", self.domain or "HR Tech")
        self.session_id = mid
        self.transcript = []
        self.clarifications = []
        self.baseline = {"frs": [], "nfrs": []}
        self.refined = {"frs": [], "nfrs": []}
        self.evaluation = {}
        self.is_active = True
        self.is_finalized = False
        self.updated_at = datetime.now().isoformat()
        self._recalculate()
        return self.get_state()

    def finalize_session(self) -> Dict[str, Any]:
        """Finalizes the meeting session and persists status."""
        self.is_active = False
        self.is_finalized = True
        self.updated_at = datetime.now().isoformat()
        db_manager.finalize_meeting(self.session_id)
        self._recalculate()
        return self.get_state()

    def _is_ui_noise(self, text: str) -> bool:
        if not text or len(text.strip()) < 3:
            return True
        lower = text.lower()
        ui_keywords = [
            "turn off microphone", "turn on microphone", "turn off camera", "turn on camera",
            "turn on captions", "turn off captions", "share screen", "raise hand", "leave call",
            "meeting details", "host controls", "open the hover tray", "backgrounds and effects",
            "audio settings", "video settings", "show more info", "send a reaction",
            "(ctrl + d)", "(ctrl + e)", "(ctrl + alt + h)", "(c or shift + c)",
            "frame_person", "visual_effects", "keyboard_arrow_", "more_vert"
        ]
        return any(kw in lower for kw in ui_keywords)

    def add_utterance(self, text: str, speaker: str = "Speaker", timestamp: Optional[str] = None) -> Dict[str, Any]:
        """
        Adds utterance, detects ambiguities in real time, generates clarification questions,
        persists to SQLite, and recalculates the requirements board & quality scores.
        """
        if not text or not text.strip() or self._is_ui_noise(text):
            return self.get_state()

        time_str = timestamp or datetime.now().strftime("%H:%M:%S")

        # 1. Analyze utterance with Ambiguity Engine
        analysis = ambiguity_engine.analyze_utterance(text)
        flags_data = [f.model_dump() for f in analysis.detectedFlags]

        # 2. Persist Utterance to SQLite
        row_id = db_manager.add_utterance(
            self.session_id,
            speaker,
            text.strip(),
            time_str,
            analysis.isAmbiguous,
            analysis.ambiguityScore,
            flags_data
        )

        utterance_obj = {
            "id": f"u-{row_id}",
            "speaker": speaker,
            "text": text.strip(),
            "timestamp": time_str,
            "isAmbiguous": analysis.isAmbiguous,
            "ambiguityScore": analysis.ambiguityScore,
            "detectedFlags": flags_data,
            "engine": analysis.engine
        }
        self.transcript.append(utterance_obj)

        # 3. If ambiguous, generate targeted clarification question live
        if analysis.isAmbiguous and flags_data:
            q = ambiguity_engine.generate_fallback_question(text, analysis.detectedFlags)
            
            # Check duplicate question suppression
            existing_objs = [ClarificationQuestion(**c) for c in self.clarifications]
            if ambiguity_engine.filter_duplicate_clarifications(existing_objs, q):
                q_dict = q.model_dump()
                self.clarifications.append(q_dict)
                # Persist Clarification Question to SQLite
                db_manager.add_clarification(
                    self.session_id,
                    q.id,
                    q.category,
                    q.question,
                    text.strip(),
                    q.suggestedOptions or q.options or [],
                    "HIGH"
                )

        self.updated_at = datetime.now().isoformat()
        self._recalculate()
        return self.get_state()

    def answer_clarification(self, clarification_id: str, selected_response: str) -> Dict[str, Any]:
        """
        Records a stakeholder decision for a clarification question in SQLite and recomputes requirements.
        """
        for c in self.clarifications:
            if c.get("id") == clarification_id:
                c["selectedResponse"] = selected_response.strip()
                break

        db_manager.update_clarification_response(self.session_id, clarification_id, selected_response.strip())
        self.updated_at = datetime.now().isoformat()
        self._recalculate()
        return self.get_state()

    def sync_bulk_state(
        self,
        transcript: Optional[List[Dict[str, Any]]] = None,
        clarifications: Optional[List[Dict[str, Any]]] = None,
        domain: Optional[str] = None
    ) -> Dict[str, Any]:
        """Bulk synchronizes state (e.g. when loading a preset scenario)."""
        if transcript is not None:
            self.transcript = transcript
        if clarifications is not None:
            self.clarifications = clarifications
        if domain is not None:
            self.domain = domain

        self.is_active = True
        self.is_finalized = False
        self.updated_at = datetime.now().isoformat()
        self._recalculate()
        return self.get_state()

    def list_meetings(self) -> List[Dict[str, Any]]:
        """Returns list of meetings from SQLite database."""
        return db_manager.list_meetings()

    def switch_meeting(self, meeting_id: str) -> Dict[str, Any]:
        """Switches active session to a historical meeting stored in SQLite."""
        full_meet = db_manager.get_meeting_full(meeting_id)
        if not full_meet:
            return self.get_state()
        db_manager.set_active_meeting(meeting_id)
        self._load_from_dict(full_meet)
        return self.get_state()

    def delete_meeting(self, meeting_id: str) -> bool:
        """Deletes a meeting from SQLite. If active, initializes a fresh one."""
        deleted = db_manager.delete_meeting(meeting_id)
        if deleted and meeting_id == self.session_id:
            self._init_fresh_session()
            self._recalculate()
        return deleted

    def _recalculate(self) -> None:
        """
        Recomputes Baseline, Refined Requirements, and Quality Evaluations.
        Persists requirement cache in SQLite.
        """
        if not self.transcript:
            self.baseline = {"frs": [], "nfrs": []}
            self.refined = {"frs": [], "nfrs": []}
            self.evaluation = {}
            db_manager.save_requirements_cache(self.session_id, self.baseline, self.refined, self.evaluation)
            return

        base_set, ref_set = requirement_engine.generate_requirements(
            self.transcript,
            self.clarifications,
            domain=self.domain
        )

        base_eval = quality_evaluator.evaluate_requirement_set(base_set)
        ref_eval = quality_evaluator.evaluate_requirement_set(ref_set)
        comparison = quality_evaluator.compare_quality(base_eval, ref_eval)

        self.baseline = base_set.model_dump()
        self.refined = ref_set.model_dump()
        self.evaluation = {
            "baseline": base_eval.model_dump(),
            "refined": ref_eval.model_dump(),
            "comparison": comparison.model_dump()
        }

        # Cache in SQLite database
        db_manager.save_requirements_cache(self.session_id, self.baseline, self.refined, self.evaluation)

session_manager = SessionManager()
