from typing import List, Dict, Any, Union
from fastapi import APIRouter
from ..models.schemas import ClarifyRequest, TranscriptPayload, ClarificationQuestion, AmbiguityFlag
from ..services.ambiguity_engine import ambiguity_engine
from ..services.llm_service import llm_service
from ..chains.clarify_chain import build_clarify_chain

router = APIRouter(tags=["Clarification"])

@router.post("/clarify")
@router.post("/api/clarify")
def clarify_transcript(payload: Union[ClarifyRequest, TranscriptPayload, Dict[str, Any]]):
    """
    Identify vague statements and generate targeted clarification questions.
    """
    if isinstance(payload, (ClarifyRequest, TranscriptPayload)):
        transcript_data = payload.transcript
    elif isinstance(payload, dict):
        transcript_data = payload.get("transcript", "")
    else:
        transcript_data = ""

    raw_text = transcript_data if isinstance(transcript_data, str) else "\n".join(
        f"{u.get('speaker', 'Speaker')}: {u.get('text', '')}" for u in transcript_data
    )

    questions: List[ClarificationQuestion] = []
    ambiguities: List[AmbiguityFlag] = []

    # 1. Rule Engine question generation
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    for line in lines:
        flags, score = ambiguity_engine.detect_ambiguities_rule_based(line)
        if flags:
            ambiguities.extend(flags)
            q = ambiguity_engine.generate_fallback_question(line, flags)
            if ambiguity_engine.filter_duplicate_clarifications(questions, q):
                questions.append(q)

    # 2. LangChain contextual clarification chain
    llm_analysis = None
    if llm_service.is_available():
        res, model_used = llm_service.invoke_with_fallback(
            build_clarify_chain,
            {"transcript": raw_text}
        )
        llm_analysis = res

    return {
        "success": True,
        "analysis": llm_analysis,
        "ambiguities": [f.model_dump() for f in ambiguities],
        "questions": [q.model_dump() for q in questions]
    }
