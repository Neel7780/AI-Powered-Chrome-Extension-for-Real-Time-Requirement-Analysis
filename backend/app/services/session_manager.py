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

logger = logging.getLogger("AIRequirementAnalyst.SessionManager")

class SessionManager:
    """
    Manages shared, real-time meeting sessions between the Web Dashboard,
    Chrome Extension Sidepanel, Popup, and in-meeting HUD.
    Synchronizes transcript feeds, AI clarification questions, stakeholder responses,
    requirements boards, and quality metrics in real-time via WebSockets & REST.
    """
    def __init__(self) -> None:
        self.session_id: str = "live-meeting-session"
        self.session_title: str = "Live Requirement Elicitation Session"
        self.domain: str = "HR Tech"
        self.transcript: List[Dict[str, Any]] = []
        self.clarifications: List[Dict[str, Any]] = []
        self.baseline: Dict[str, Any] = {"frs": [], "nfrs": []}
        self.refined: Dict[str, Any] = {"frs": [], "nfrs": []}
        self.evaluation: Dict[str, Any] = {}
        self.is_active: bool = False
        self.created_at: str = datetime.now().isoformat()
        self.updated_at: str = datetime.now().isoformat()
        
        # Active WebSocket connections (Webapp, Sidepanel, Popup, Meeting HUD)
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")
        # Send initial full state immediately upon connection
        await websocket.send_text(json.dumps({
            "type": "SESSION_STATE_SYNC",
            "data": self.get_state()
        }))

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message_type: str, data: Any) -> None:
        """
        Broadcasts real-time events to all connected clients.
        """
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
        """
        Returns full synchronized state.
        """
        return {
            "sessionId": self.session_id,
            "sessionTitle": self.session_title,
            "domain": self.domain,
            "isActive": self.is_active,
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
                "overallQualityIndex": 0 if not self.transcript else self.evaluation.get("refined", {}).get("overallQualityIndex", 8)
            },
            "createdAt": self.created_at,
            "updatedAt": self.updated_at
        }

    def start_session(self, title: str = "Live Meeting", domain: str = "HR Tech") -> Dict[str, Any]:
        self.session_title = title
        self.domain = domain
        self.transcript = []
        self.clarifications = []
        self.is_active = True
        self.created_at = datetime.now().isoformat()
        self.updated_at = datetime.now().isoformat()
        self._recalculate()
        return self.get_state()

    def reset_session(self) -> Dict[str, Any]:
        self.transcript = []
        self.clarifications = []
        self.is_active = False
        self.updated_at = datetime.now().isoformat()
        self._recalculate()
        return self.get_state()

    def add_utterance(self, text: str, speaker: str = "Speaker", timestamp: Optional[str] = None) -> Dict[str, Any]:
        """
        Adds utterance, detects ambiguities in real time, generates clarification questions,
        and recalculates the requirement board & quality scores.
        """
        if not text or not text.strip():
            return self.get_state()

        time_str = timestamp or datetime.now().strftime("%H:%M:%S")

        # 1. Analyze utterance with Ambiguity Engine
        analysis = ambiguity_engine.analyze_utterance(text)
        flags_data = [f.model_dump() for f in analysis.detectedFlags]

        utterance_obj = {
            "id": f"u-{len(self.transcript)+1}",
            "speaker": speaker,
            "text": text.strip(),
            "timestamp": time_str,
            "isAmbiguous": analysis.isAmbiguous,
            "ambiguityScore": analysis.ambiguityScore,
            "detectedFlags": flags_data,
            "engine": analysis.engine
        }
        self.transcript.append(utterance_obj)

        # 2. If ambiguous, generate targeted clarification question
        if analysis.isAmbiguous and flags_data:
            q = ambiguity_engine.generate_fallback_question(text, analysis.detectedFlags)
            
            # Check duplicate question suppression
            existing_objs = [ClarificationQuestion(**c) for c in self.clarifications]
            if ambiguity_engine.filter_duplicate_clarifications(existing_objs, q):
                self.clarifications.append(q.model_dump())

        self.updated_at = datetime.now().isoformat()
        self._recalculate()
        return self.get_state()

    def answer_clarification(self, clarification_id: str, selected_response: str) -> Dict[str, Any]:
        """
        Records a stakeholder decision for a clarification question and updates requirement refinement.
        """
        for c in self.clarifications:
            if c.get("id") == clarification_id:
                c["selectedResponse"] = selected_response.strip()
                break

        self.updated_at = datetime.now().isoformat()
        self._recalculate()
        return self.get_state()

    def sync_bulk_state(
        self,
        transcript: Optional[List[Dict[str, Any]]] = None,
        clarifications: Optional[List[Dict[str, Any]]] = None,
        domain: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Bulk synchronizes state (e.g. when loading a preset scenario).
        """
        if transcript is not None:
            self.transcript = transcript
        if clarifications is not None:
            self.clarifications = clarifications
        if domain is not None:
            self.domain = domain

        self.is_active = True
        self.updated_at = datetime.now().isoformat()
        self._recalculate()
        return self.get_state()

    def _recalculate(self) -> None:
        """
        Recomputes Baseline, Refined Requirements, and Quality Evaluations.
        """
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

session_manager = SessionManager()
