import pytest
from backend.app.services.requirement_engine import requirement_engine
from backend.app.services.quality_evaluator import quality_evaluator
from backend.app.models.schemas import RequirementStatus
from backend.app.routes.questions import generate_realtime_question, QuestionGenerateRequest
from fastapi import HTTPException

def test_r1_questions_generate_validation():
    """
    Test R1: Missing text returns 400 Bad Request instead of unhandled error.
    """
    with pytest.raises(HTTPException) as exc_info:
        generate_realtime_question(QuestionGenerateRequest(text=""))
    assert exc_info.value.status_code == 400

    res = generate_realtime_question(QuestionGenerateRequest(text="It shouldn't be slow."))
    assert res["success"] is True
    assert res["data"]["category"] == "Performance"

def test_r2_answered_clarifications_resolve_only_supported_slots():
    """
    Test R2: Seven answered clarifications resolve only their supported requirement slots.
    """
    sample_clarifications = [
        {"id": "q-perf-01", "category": "Performance", "selectedResponse": "Single resume < 1.5s (p95)"},
        {"id": "q-fair-01", "category": "Fairness", "selectedResponse": "DIR 0.80 - 1.25"},
        {"id": "q-acc-01", "category": "Accuracy", "selectedResponse": "Precision >= 85%"},
        {"id": "q-exp-01", "category": "Explainability", "selectedResponse": "Interactive match scorecard"},
        {"id": "q-rel-01", "category": "Ranking Algorithm", "selectedResponse": "Formula: 45% skills + 35% projects + 20% experience"},
        {"id": "q-data-01", "category": "Data Ingestion", "selectedResponse": "PDF and DOCX up to 10MB"},
        {"id": "q-scope-01", "category": "Project Scope", "selectedResponse": "4-week MVP"}
    ]
    baseline, refined = requirement_engine.generate_requirements([], sample_clarifications, "HR Tech")
    all_reqs = list(refined.frs) + list(refined.nfrs)
    pending = [r for r in all_reqs if r.status == RequirementStatus.PENDING_CLARIFICATION]
    assert len(pending) == 3
    assert len(all_reqs) == 10

    eval_res = quality_evaluator.evaluate_requirement_set(refined)
    assert eval_res.overallQualityIndex >= 65
    assert eval_res.metrics["ambiguity"].score > 0

def test_r3_no_cross_slot_leakage():
    """
    Test R3: One clarification answer does not resolve unrelated requirement slots.
    """
    single_clar = [
        {"id": "q-perf-01", "category": "Performance", "selectedResponse": "Single resume < 1.5s (p95)"}
    ]
    baseline, refined = requirement_engine.generate_requirements([], single_clar, "HR Tech")
    
    perf = next(n for n in refined.nfrs if n.id == "NFR-PERF-01")
    fair = next(n for n in refined.nfrs if n.id == "NFR-FAIR-01")
    
    assert perf.status == RequirementStatus.RESOLVED
    assert fair.status == RequirementStatus.PENDING_CLARIFICATION

def test_r4_word_boundary_safe_domain():
    """
    Test R4: Non-HR domain does not accidentally match HR template on substring collision.
    """
    baseline, refined = requirement_engine.generate_requirements(
        [{"speaker": "Lead", "text": "We need high throughput for crypto ledger."}],
        [],
        domain="Fintech"
    )
    assert any(r.id == "FR-GEN-01" for r in baseline.frs)

def test_r5_generic_refiner_requires_real_answer():
    """
    Test R5: Generic requirements only resolve when an actual non-empty answer is provided.
    """
    empty_clar = [{"id": "q-1", "question": "What SLA?", "selectedResponse": "   "}]
    baseline, refined = requirement_engine.generate_requirements(
        [{"speaker": "Lead", "text": "Core workflow."}],
        empty_clar,
        domain="Fintech"
    )
    assert refined.frs[0].status == RequirementStatus.PENDING_CLARIFICATION
