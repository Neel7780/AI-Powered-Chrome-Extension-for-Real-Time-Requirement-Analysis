from fastapi import APIRouter
from typing import Dict, Any, Union
from ..models.schemas import ComparisonPayload, RequirementSet, QualityEvaluation
from ..services.quality_evaluator import quality_evaluator
from ..services.llm_service import llm_service
from ..chains.comparison_chain import build_comparison_chain

router = APIRouter(tags=["Comparison"])

@router.post("/compare")
@router.post("/api/compare")
def compare_specifications(payload: ComparisonPayload):
    """
    Compares Baseline vs. Refined specifications across ISO 29148 quality dimensions.
    """
    baseline_eval = quality_evaluator.evaluate_requirement_set(payload.baseline)
    refined_eval = quality_evaluator.evaluate_requirement_set(payload.refined)
    comp_result = quality_evaluator.compare_quality(baseline_eval, refined_eval)

    qualitative_audit = None
    if llm_service.is_available():
        base_str = str(payload.baseline)
        ref_str = str(payload.refined)
        res, _ = llm_service.invoke_with_fallback(
            build_comparison_chain,
            {"baseline": base_str, "refined": ref_str}
        )
        qualitative_audit = res

    return {
        "success": True,
        "baseline_metrics": baseline_eval.model_dump(),
        "refined_metrics": refined_eval.model_dump(),
        "delta": comp_result.delta.model_dump(),
        "qualitative": qualitative_audit
    }

@router.post("/evaluate")
@router.post("/api/evaluate")
@router.post("/api/evaluate/compare")
def evaluate_endpoint(payload: Dict[str, Any]):
    """
    Evaluates baseline & refined sets and returns comparative scorecard.
    """
    baseline = payload.get("baseline", {})
    refined = payload.get("refined", {})

    baseline_eval = quality_evaluator.evaluate_requirement_set(baseline)
    refined_eval = quality_evaluator.evaluate_requirement_set(refined)
    comparison = quality_evaluator.compare_quality(baseline_eval, refined_eval)

    return {
        "success": True,
        "data": {
            "baseline": baseline_eval.model_dump(),
            "refined": refined_eval.model_dump(),
            "comparison": comparison.model_dump()
        }
    }
