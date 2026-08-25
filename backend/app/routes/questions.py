from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from ..services.ambiguity_engine import ambiguity_engine

router = APIRouter(tags=["Questions"])

class QuestionGenerateRequest(BaseModel):
    text: Optional[str] = None
    statement: Optional[str] = None
    flags: Optional[List[Dict[str, Any]]] = None

@router.post("/api/questions/generate")
@router.post("/questions/generate")
def generate_realtime_question(payload: QuestionGenerateRequest):
    """
    Generates a targeted clarification question for a live utterance.
    """
    text = payload.text or payload.statement
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Missing required 'text' or 'statement' parameter")

    flags, _ = ambiguity_engine.detect_ambiguities_rule_based(text)
    question = ambiguity_engine.generate_fallback_question(text, flags)

    return {
        "success": True,
        "data": question.model_dump()
    }
