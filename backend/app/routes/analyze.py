from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Dict, Any
from ..models.schemas import TranscriptPayload, RequirementSet, QualityEvaluation
from ..services.requirement_engine import requirement_engine
from ..services.ambiguity_engine import ambiguity_engine
from ..services.quality_evaluator import quality_evaluator
from ..services.llm_service import llm_service
from ..chains.baseline_chain import build_baseline_chain

router = APIRouter(tags=["Analysis"])

class UtterancePayload(BaseModel):
    text: str
    speaker: Optional[str] = "Speaker"
    timestamp: Optional[str] = None

@router.post("/analyze")
@router.post("/api/analyze")
def analyze_transcript(payload: TranscriptPayload):
    """
    Generate the BASELINE requirements and detect ambiguities BEFORE clarification.
    CRITICAL: Does not use or assume stakeholder clarification answers.
    """
    raw_text = payload.transcript if isinstance(payload.transcript, str) else "\n".join(
        f"{u.get('speaker', 'Speaker')}: {u.get('text', '')}" for u in payload.transcript
    )

    # 1. Generate Baseline RequirementSet
    baseline_set, _ = requirement_engine.generate_requirements(
        payload.transcript,
        clarifications_raw=[],
        domain=payload.domain or "HR Tech"
    )

    # 2. Evaluate Baseline Quality
    baseline_metrics = quality_evaluator.evaluate_requirement_set(baseline_set)

    # 3. Detect Ambiguities via Rule Engine & LangChain
    ambiguities = []
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    for line in lines:
        flags, _ = ambiguity_engine.detect_ambiguities_rule_based(line)
        ambiguities.extend(flags)

    # 4. Optional LangChain contextual baseline synthesis
    llm_baseline_text = None
    if llm_service.is_available():
        res, _ = llm_service.invoke_with_fallback(
            build_baseline_chain,
            {"transcript": raw_text}
        )
        llm_baseline_text = res

    return {
        "success": True,
        "baseline": baseline_set.model_dump(),
        "ambiguities": [f.model_dump() for f in ambiguities],
        "metrics": baseline_metrics.model_dump(),
        "llm_baseline_text": llm_baseline_text
    }

@router.post("/api/analyze/utterance")
def analyze_single_utterance(payload: UtterancePayload):
    """
    Analyzes a single live utterance for real-time Chrome Extension / in-meeting HUD.
    """
    analysis = ambiguity_engine.analyze_utterance(payload.text)
    return {
        "success": True,
        "data": {
            "text": payload.text,
            "speaker": payload.speaker,
            "timestamp": payload.timestamp,
            "isAmbiguous": analysis.isAmbiguous,
            "ambiguityScore": analysis.ambiguityScore,
            "detectedFlags": [f.model_dump() for f in analysis.detectedFlags],
            "engine": analysis.engine
        }
    }
