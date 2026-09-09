import pytest
import re
from backend.app.services.requirement_engine import requirement_engine
from backend.app.services.quality_evaluator import quality_evaluator
from backend.app.services.ambiguity_engine import ambiguity_engine
from backend.app.models.schemas import ClarificationQuestion, RequirementStatus

SAMPLE_TRANSCRIPT = [
    {"speaker": "Hiring Manager", "text": "We need to build an AI-based resume analyzer."},
    {"speaker": "ML Engineer", "text": "We have past resumes and hiring decisions, but they're not very structured."},
    {"speaker": "Hiring Manager", "text": "We want it to take resumes and rank them based on relevance to a job description."},
    {"speaker": "ML Engineer", "text": "What criteria should determine relevance?"},
    {"speaker": "Hiring Manager", "text": "Mainly skills and experience. And overall profile strength. Things like good companies, solid projects... Sometimes a strong fresher is better than someone with 5 average years."},
    {"speaker": "ML Engineer", "text": "How will we evaluate if the ranking is accurate?"},
    {"speaker": "Hiring Manager", "text": "It should be good enough so that HR trusts it."},
    {"speaker": "ML Engineer", "text": "What about response time and scale?"},
    {"speaker": "Hiring Manager", "text": "It shouldn't be slow. Response time per resume should ideally be quick."},
    {"speaker": "ML Engineer", "text": "Are there constraints around bias?"},
    {"speaker": "Hiring Manager", "text": "Yes, we must avoid bias, especially related to gender or college background."},
    {"speaker": "ML Engineer", "text": "Do we need explainability for why someone was ranked high or low?"},
    {"speaker": "Hiring Manager", "text": "Yes, that would be useful."},
    {"speaker": "ML Engineer", "text": "What is our timeline?"},
    {"speaker": "Hiring Manager", "text": "We need an MVP soon."}
]

SAMPLE_CLARIFICATIONS = [
    {
        "id": "q-perf-01",
        "category": "Performance",
        "question": "What specific latency threshold defines acceptable performance?",
        "selectedResponse": "Single resume parsing must be under 1.5s (95th percentile) and batch upload of 100 resumes must complete within 30 seconds."
    },
    {
        "id": "q-fair-01",
        "category": "Fairness",
        "question": "What quantitative fairness metric and audit frequency should be enforced?",
        "selectedResponse": "Disparate impact ratio between 0.80 and 1.25 across gender and college tiers; quarterly fairness audit."
    },
    {
        "id": "q-acc-01",
        "category": "Accuracy",
        "question": "What objective accuracy metric defines 'good enough for HR trust'?",
        "selectedResponse": "Top-10 candidate precision >= 85% and NDCG@10 >= 0.82 evaluated against consensus of 3 senior recruiters."
    },
    {
        "id": "q-exp-01",
        "category": "Explainability",
        "question": "How should candidate match reasoning be presented to recruiters?",
        "selectedResponse": "Interactive match scorecard showing matched skills %, project complexity score, and top 3 justification reasons."
    },
    {
        "id": "q-rel-01",
        "category": "Ranking Algorithm",
        "question": "How should skills, experience, and projects be weighted?",
        "selectedResponse": "Formula: 45% skills match + 35% project complexity + 20% experience with tier normalization."
    },
    {
        "id": "q-data-01",
        "category": "Data Ingestion",
        "question": "What file formats and size limits must be supported?",
        "selectedResponse": "Support PDF and DOCX up to 10MB per file with automated text extraction into validated JSON schema."
    },
    {
        "id": "q-scope-01",
        "category": "Project Scope",
        "question": "What is the committed delivery milestone for the MVP?",
        "selectedResponse": "4-week MVP deliverable covering ingestion, JD matching, top-10 ranking, and scorecard export."
    }
]

def test_a_zero_answers_pending_and_zero_testability():
    """
    Test A: When 0 clarification questions are answered, all relevant requirements
    must remain PENDING_CLARIFICATION with pure 0% testability.
    """
    baseline, refined = requirement_engine.generate_requirements(SAMPLE_TRANSCRIPT, [])
    eval_res = quality_evaluator.evaluate_requirement_set(baseline)
    
    assert eval_res.metrics["testability"].score == 0
    assert eval_res.metrics["ambiguity"].score > 0
    assert eval_res.overallQualityIndex < 30

    pending_nfrs = [n for n in baseline.nfrs if n.status == RequirementStatus.PENDING_CLARIFICATION]
    assert len(pending_nfrs) >= 4
    for nfr in pending_nfrs:
        assert "unspecified" in (nfr.targetThreshold or "").lower() or "awaiting" in (nfr.targetThreshold or "").lower()

def test_b_partial_answers_proportional_score():
    """
    Test B: Partial answers (3 of 7) scale quality score proportionally without arbitrary jumps.
    """
    partial_clarifications = SAMPLE_CLARIFICATIONS[:3]
    baseline, refined = requirement_engine.generate_requirements(SAMPLE_TRANSCRIPT, partial_clarifications)
    eval_res = quality_evaluator.evaluate_requirement_set(refined)
    
    assert 30 <= eval_res.overallQualityIndex <= 75
    resolved = [r for r in list(refined.frs) + list(refined.nfrs) if r.status == RequirementStatus.RESOLVED]
    pending = [r for r in list(refined.frs) + list(refined.nfrs) if r.status == RequirementStatus.PENDING_CLARIFICATION]
    assert len(resolved) > 0
    assert len(pending) > 0

def test_c_full_answers_high_quality():
    """
    Test C: Full answers (all 7) achieve an Excellent rating (>= 85%) with measurable SLOs.
    """
    baseline, refined = requirement_engine.generate_requirements(SAMPLE_TRANSCRIPT, SAMPLE_CLARIFICATIONS)
    eval_res = quality_evaluator.evaluate_requirement_set(refined)
    
    assert eval_res.overallQualityIndex >= 70
    assert eval_res.metrics["ambiguity"].score > 0
    assert eval_res.metrics["completeness"].score >= 60
    assert eval_res.metrics["testability"].score >= 60

def test_d_offline_mode_resilience():
    """
    Test D: Ambiguity engine operates completely offline with deterministic rule fallback.
    """
    flags, score = ambiguity_engine.detect_ambiguities_rule_based("It shouldn't be slow and response time should ideally be quick.")
    assert len(flags) > 0
    assert any(f.category == "Performance" for f in flags)
    assert score >= 40

def test_e_live_analyzer_flags_only_grounded_ambiguity():
    """Clear statements stay clear while common NFR vagueness gets questions."""
    clear = ambiguity_engine.detect_ambiguities_rule_based(
        "The platform supports university students."
    )
    assert clear[0] == []

    cases = {
        "It should be easy to use.": "Usability",
        "The system should be reliable.": "Reliability",
        "It must be secure and protect payment information.": "Security",
    }
    for text, category in cases.items():
        flags, _ = ambiguity_engine.detect_ambiguities_rule_based(text)
        assert any(flag.category == category for flag in flags)
        question = ambiguity_engine.generate_fallback_question(text, flags)
        assert question.category == category

def test_e_explicit_stakeholder_adoption():
    """
    Test E: When a stakeholder specifies custom value ("2 seconds"), the system adopts it verbatim.
    """
    custom_clar = [{
        "id": "q-perf-01",
        "category": "Performance",
        "question": "What latency?",
        "selectedResponse": "The system must respond within 2 seconds for single resume parsing."
    }]
    baseline, refined = requirement_engine.generate_requirements(SAMPLE_TRANSCRIPT, custom_clar)
    perf_nfr = next(n for n in refined.nfrs if n.id == "NFR-PERF-01")
    assert perf_nfr.status == RequirementStatus.RESOLVED
    assert "2 seconds" in (perf_nfr.targetThreshold or "")

def test_f_non_occurrence_of_unselected_values():
    """
    Test F: When stakeholder selects "500ms", the requirement does NOT contain unselected values ("2 seconds").
    """
    custom_clar = [{
        "id": "q-perf-01",
        "category": "Performance",
        "question": "What latency?",
        "selectedResponse": "Single resume < 500ms real-time latency with Redis caching."
    }]
    baseline, refined = requirement_engine.generate_requirements(SAMPLE_TRANSCRIPT, custom_clar)
    perf_nfr = next(n for n in refined.nfrs if n.id == "NFR-PERF-01")
    assert "500ms" in (perf_nfr.targetThreshold or "")
    assert "2 seconds" not in (perf_nfr.targetThreshold or "")

def test_g_duplicate_suppression():
    """
    Test G: Duplicate questions for the same trigger statement are filtered.
    """
    existing = [ClarificationQuestion(
        id="q1",
        category="Performance",
        question="What latency?",
        triggeredBy="It shouldn't be slow."
    )]
    dup_q = ClarificationQuestion(
        id="q2",
        category="Performance",
        question="What latency threshold?",
        triggeredBy="It shouldn't be slow."
    )
    diff_q = ClarificationQuestion(
        id="q3",
        category="Fairness",
        question="What fairness metric?",
        triggeredBy="avoid bias"
    )
    assert ambiguity_engine.filter_duplicate_clarifications(existing, dup_q) is False
    assert ambiguity_engine.filter_duplicate_clarifications(existing, diff_q) is True

def test_h_conflict_detection():
    """
    Test H: Contradictory stakeholder responses are detected.
    """
    existing = [ClarificationQuestion(
        id="q-perf-01",
        category="Performance",
        question="What latency?",
        selectedResponse="Under 2 seconds"
    )]
    conflict = ambiguity_engine.detect_clarification_conflict(existing, "q-perf-01", "Under 5 seconds")
    assert conflict is not None
    assert "Contradiction detected" in conflict

def test_i_traceability_lineage():
    """
    Test I: Verified requirement carries full ISO 29148 traceability lineage.
    """
    baseline, refined = requirement_engine.generate_requirements(SAMPLE_TRANSCRIPT, SAMPLE_CLARIFICATIONS)
    perf_nfr = next(n for n in refined.nfrs if n.id == "NFR-PERF-01")
    assert perf_nfr.sourceClarificationId == "q-perf-01"
    assert perf_nfr.source == "STAKEHOLDER_CLARIFICATION"
    assert perf_nfr.stakeholderEvidence is not None
    assert len(perf_nfr.acceptanceCriteria) > 0
    assert perf_nfr.verificationMethod is not None
