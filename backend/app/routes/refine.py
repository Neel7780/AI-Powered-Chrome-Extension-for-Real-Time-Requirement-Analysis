from fastapi import APIRouter
from typing import Dict, Any, List, Union
from ..models.schemas import RefinementPayload, RequirementSet, QualityEvaluation
from ..services.requirement_engine import requirement_engine
from ..services.quality_evaluator import quality_evaluator
from ..services.llm_service import llm_service
from ..chains.refine_chain import build_refine_chain

router = APIRouter(tags=["Refinement"])

@router.post("/refine")
@router.post("/api/refine")
@router.post("/api/requirements/generate")
def refine_requirements(payload: RefinementPayload):
    """
    Generate REFINED requirements strictly based on confirmed stakeholder decisions.
    Unanswered items remain PENDING_CLARIFICATION with unquantified thresholds.
    """
    transcript_input = payload.transcript or payload.utterances or []
    clarifications_input = payload.clarifications or []
    
    # Handle parallel questions/responses array inputs (e.g. from popup or reference format)
    if not clarifications_input and payload.questions and payload.responses:
        for idx, (q, r) in enumerate(zip(payload.questions, payload.responses)):
            q_text = q if isinstance(q, str) else q.get("question", "")
            r_text = r if isinstance(r, str) else r.get("selectedResponse", "")
            clarifications_input.append({
                "id": f"q-{idx+1}",
                "question": q_text,
                "selectedResponse": r_text
            })

    # 1. Synthesize Baseline & Refined RequirementSets
    baseline_set, refined_set = requirement_engine.generate_requirements(
        transcript_input,
        clarifications_input,
        domain=payload.domain or "HR Tech"
    )

    # 2. Compute Quality Evaluations
    baseline_eval = quality_evaluator.evaluate_requirement_set(baseline_set)
    refined_eval = quality_evaluator.evaluate_requirement_set(refined_set)
    comparison = quality_evaluator.compare_quality(baseline_eval, refined_eval)

    # 3. Optional LangChain contextual synthesis
    llm_refined_text = None
    if llm_service.is_available():
        raw_text = transcript_input if isinstance(transcript_input, str) else "\n".join(
            f"{u.get('speaker', 'Speaker')}: {u.get('text', '')}" for u in transcript_input
        )
        q_str = "\n".join(f"- {c.get('question', '')}" for c in clarifications_input)
        r_str = "\n".join(f"- {c.get('selectedResponse', '')}" for c in clarifications_input)
        res, _ = llm_service.invoke_with_fallback(
            build_refine_chain,
            {"transcript": raw_text, "questions": q_str, "responses": r_str}
        )
        llm_refined_text = res

    eval_dict = {
        "baseline": baseline_eval.model_dump(),
        "refined": refined_eval.model_dump(),
        "comparison": comparison.model_dump()
    }

    return {
        "success": True,
        "baseline": baseline_set.model_dump(),
        "refined": refined_set.model_dump(),
        "evaluation": eval_dict,
        "metrics": refined_eval.model_dump(),
        "llm_refined_text": llm_refined_text,
        "data": {
            "baseline": baseline_set.model_dump(),
            "refined": refined_set.model_dump(),
            "evaluation": eval_dict
        }
    }
