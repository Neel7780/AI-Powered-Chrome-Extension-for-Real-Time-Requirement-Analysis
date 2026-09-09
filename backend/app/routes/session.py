import json
import logging
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..services.session_manager import session_manager

logger = logging.getLogger("AIRequirementAnalyst.SessionRouter")

router = APIRouter(tags=["Session"])

class StartSessionPayload(BaseModel):
    title: Optional[str] = "Live Meeting Session"
    domain: Optional[str] = "HR Tech"

class AddUtterancePayload(BaseModel):
    text: str
    speaker: Optional[str] = "Speaker"
    timestamp: Optional[str] = None

class AnswerClarificationPayload(BaseModel):
    clarificationId: str
    selectedResponse: str

class BulkSyncPayload(BaseModel):
    transcript: Optional[List[Dict[str, Any]]] = None
    clarifications: Optional[List[Dict[str, Any]]] = None
    domain: Optional[str] = None

@router.get("/api/session/state")
def get_session_state():
    """
    Returns current live synchronized session state.
    """
    return {
        "success": True,
        "data": session_manager.get_state()
    }

@router.post("/api/session/start")
async def start_session_endpoint(payload: StartSessionPayload):
    """
    Starts or restarts a meeting session and broadcasts to all clients.
    """
    state = session_manager.start_session(payload.title or "Live Meeting", payload.domain or "HR Tech")
    await session_manager.broadcast("SESSION_STARTED", state)
    return {
        "success": True,
        "data": state
    }

@router.post("/api/session/reset")
async def reset_session_endpoint():
    """
    Clears the session state and notifies all clients.
    """
    state = session_manager.reset_session()
    await session_manager.broadcast("SESSION_RESET", state)
    return {
        "success": True,
        "data": state
    }

@router.post("/api/session/finalize")
async def finalize_session_endpoint():
    """Publishes FR/NFR and quality results after transcript capture is complete."""
    state = session_manager.finalize_session()
    await session_manager.broadcast("SESSION_FINALIZED", state)
    return {
        "success": True,
        "data": state
    }

@router.post("/api/session/utterance")
async def add_session_utterance_endpoint(payload: AddUtterancePayload):
    """
    Appends a new utterance, runs AI ambiguity detection, generates clarification questions,
    and broadcasts state update to both Extension and Webapp.
    """
    state = session_manager.add_utterance(payload.text, payload.speaker or "Speaker", payload.timestamp)
    await session_manager.broadcast("UTTERANCE_ADDED", state)
    return {
        "success": True,
        "data": state
    }

@router.post("/api/session/clarify/answer")
async def answer_clarification_endpoint(payload: AnswerClarificationPayload):
    """
    Records a stakeholder answer and updates requirements & quality metrics on all clients.
    """
    state = session_manager.answer_clarification(payload.clarificationId, payload.selectedResponse)
    await session_manager.broadcast("CLARIFICATION_ANSWERED", state)
    return {
        "success": True,
        "data": state
    }

@router.post("/api/session/sync")
async def bulk_sync_session_endpoint(payload: BulkSyncPayload):
    """
    Bulk synchronizes transcript and clarifications (e.g. when loading sample presets).
    """
    state = session_manager.sync_bulk_state(payload.transcript, payload.clarifications, payload.domain)
    await session_manager.broadcast("SESSION_STATE_SYNC", state)
    return {
        "success": True,
        "data": state
    }

@router.websocket("/ws/session")
async def websocket_session_endpoint(websocket: WebSocket):
    """
    Real-time bidirectional WebSocket channel for live meeting syncing.
    """
    await session_manager.connect(websocket)
    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                msg = json.loads(raw_data)
                msg_type = msg.get("type", "")
                data = msg.get("data", {})

                if msg_type == "ADD_UTTERANCE":
                    state = session_manager.add_utterance(
                        data.get("text", ""),
                        data.get("speaker", "Speaker"),
                        data.get("timestamp")
                    )
                    await session_manager.broadcast("UTTERANCE_ADDED", state)

                elif msg_type == "ANSWER_CLARIFICATION":
                    state = session_manager.answer_clarification(
                        data.get("clarificationId", ""),
                        data.get("selectedResponse", "")
                    )
                    await session_manager.broadcast("CLARIFICATION_ANSWERED", state)

                elif msg_type == "START_SESSION":
                    state = session_manager.start_session(
                        data.get("title", "Live Meeting"),
                        data.get("domain", "HR Tech")
                    )
                    await session_manager.broadcast("SESSION_STARTED", state)

                elif msg_type == "RESET_SESSION":
                    state = session_manager.reset_session()
                    await session_manager.broadcast("SESSION_RESET", state)

                elif msg_type == "FINALIZE_SESSION":
                    state = session_manager.finalize_session()
                    await session_manager.broadcast("SESSION_FINALIZED", state)

                elif msg_type == "SYNC_STATE":
                    state = session_manager.sync_bulk_state(
                        data.get("transcript"),
                        data.get("clarifications"),
                        data.get("domain")
                    )
                    await session_manager.broadcast("SESSION_STATE_SYNC", state)

                elif msg_type == "GET_STATE":
                    await websocket.send_text(json.dumps({
                        "type": "SESSION_STATE_SYNC",
                        "data": session_manager.get_state()
                    }))

            except Exception as parse_err:
                logger.warning(f"Error handling WebSocket message: {parse_err}")

    except WebSocketDisconnect:
        session_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket exception: {e}")
        session_manager.disconnect(websocket)
