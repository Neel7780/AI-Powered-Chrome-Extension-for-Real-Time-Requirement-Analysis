import re
import uuid
import logging
from typing import List, Dict, Any, Optional, Tuple
from ..models.schemas import AmbiguityFlag, AmbiguityAnalysisResult, ClarificationQuestion
from .llm_service import llm_service
from ..chains.clarify_chain import build_clarify_chain

logger = logging.getLogger("AIRequirementAnalyst.AmbiguityEngine")

# Comprehensive dictionary of fuzzy predicates and subjective heuristics
AMBIGUITY_RULES = [
    {
        "patterns": [r"\bgood enough\b", r"\btrust(?:s|ed|ing)?\b"],
        "category": "Accuracy",
        "severity": "High",
        "reason": "Subjective acceptance threshold without quantitative accuracy, precision, or NDCG benchmarks.",
        "suggestedSLO": "Ranking Precision@10 >= 85.0% and NDCG@10 >= 0.82 on verified recruiter test set",
        "options": [
            "Ranking Precision@10 >= 85.0% and NDCG@10 >= 0.82 on verified recruiter test set",
            "Top-5 Match Accuracy >= 90.0% with Human-in-the-Loop review",
            "F1-Score >= 0.80 across all technical skill categories"
        ]
    },
    {
        "patterns": [r"\b(?:not|shouldn't be)\s+slow\b", r"\bquick\b", r"\bfast\b", r"\breal-?time\b"],
        "category": "Performance",
        "severity": "High",
        "reason": "Vague temporal adjective with unspecified latency, throughput, or concurrency constraints.",
        "suggestedSLO": "Single resume parsing < 1.50s (p95) and batch of 100 resumes < 30.0s",
        "options": [
            "Single resume parsing < 1.50s (p95) and batch of 100 resumes < 30.0s",
            "Single resume < 500ms real-time latency with Redis caching",
            "Asynchronous processing with webhook notification within 5.0 seconds"
        ]
    },
    {
        "patterns": [r"\bavoid bias\b", r"\bfair(?:ness)?\b", r"\bgender\b", r"\bcollege background\b"],
        "category": "Fairness",
        "severity": "Critical",
        "reason": "High-risk compliance requirement missing explicit Disparate Impact Ratio or demographic parity metrics.",
        "suggestedSLO": "Disparate Impact Ratio 0.80 - 1.25 across gender and college tiers with automated PII masking",
        "options": [
            "Disparate Impact Ratio 0.80 - 1.25 across gender and college tiers with automated PII masking",
            "Demographic Parity Difference < 0.05 with blind evaluation mode",
            "Equalized Odds True Positive Rate difference < 0.04 across demographics"
        ]
    },
    {
        "patterns": [r"\bexplainability\b", r"\buseful\b", r"\bwhy\b", r"\bjustification\b", r"\bbreakdown\b"],
        "category": "Explainability",
        "severity": "Medium",
        "reason": "Unspecified explainability presentation schema, factor breakdown, and latency budget.",
        "suggestedSLO": "Interactive candidate scorecard showing matched skills %, project impact score, and top 3 justification reasons",
        "options": [
            "Interactive candidate scorecard showing matched skills %, project impact score, and top 3 justification reasons",
            "SHAP/LIME feature importance waterfall chart rendered in < 500ms",
            "Bullet-point summary highlighting matched job description criteria"
        ]
    },
    {
        "patterns": [r"\bmainly\b", r"\bgood companies\b", r"\bsolid projects\b", r"\bstrong fresher\b", r"\boverall profile strength\b"],
        "category": "Ranking Algorithm",
        "severity": "High",
        "reason": "Undefined scoring formula, weights, tier normalization, and project complexity heuristics.",
        "suggestedSLO": "Multi-factor formula: 45% skills match + 35% project complexity + 20% experience with tier normalization",
        "options": [
            "Multi-factor formula: 45% skills match + 35% project complexity + 20% experience with tier normalization",
            "Equal weighting: 33.3% Skills + 33.3% Experience + 33.3% Projects",
            "Skills-first model: 60% Verified Skills + 40% Project Portfolio"
        ]
    },
    {
        "patterns": [r"\bpast resumes\b", r"\bnot (?:very )?structured\b", r"\bdata\b"],
        "category": "Data Contract",
        "severity": "Medium",
        "reason": "Unspecified file formats, max payload size, OCR capabilities, and structured JSON parsing schema.",
        "suggestedSLO": "Support PDF and DOCX up to 10MB per file with automated text extraction into validated JSON schema",
        "options": [
            "Support PDF and DOCX up to 10MB per file with automated text extraction into validated JSON schema",
            "Support PDF, DOCX, and scanned PNG/JPG with OCR up to 25MB",
            "Standard PDF-only ingestion up to 5MB"
        ]
    },
    {
        "patterns": [r"\bsoon\b", r"\bmvp\b", r"\btimeline\b", r"\basap\b"],
        "category": "Project Scope",
        "severity": "Medium",
        "reason": "Ambiguous delivery timeline without committed calendar milestones or MVP sprint boundaries.",
        "suggestedSLO": "4-week MVP deliverable covering ingestion, JD matching, top-10 ranking, and scorecard export",
        "options": [
            "4-week MVP deliverable covering ingestion, JD matching, top-10 ranking, and scorecard export",
            "2-week prototype with core ranking engine followed by 4-week UI integration",
            "6-week enterprise release with full bias audit and analytics dashboard"
        ]
    }
]

class AmbiguityEngine:
    def __init__(self) -> None:
        pass

    def detect_ambiguities_rule_based(self, text: str) -> Tuple[List[AmbiguityFlag], int]:
        """
        Deterministic rule-based ambiguity extraction with 100% offline resilience.
        """
        flags: List[AmbiguityFlag] = []
        lower = text.lower()

        # Questions themselves are not ambiguous requirements
        is_question = bool(re.search(r"\?\s*$", text.strip()) or re.match(r"^(who|what|when|where|why|how|is|are|do|does|can|could|should|would)\b", text.strip(), re.I))

        for rule in AMBIGUITY_RULES:
            matched_phrase = None
            for pattern in rule["patterns"]:
                match = re.search(pattern, lower)
                if match:
                    matched_phrase = match.group(0)
                    break
            
            if matched_phrase:
                flags.append(AmbiguityFlag(
                    phrase=matched_phrase,
                    category=rule["category"],
                    severity=rule["severity"],
                    reason=rule["reason"],
                    suggestedSLO=rule["suggestedSLO"]
                ))

        if not flags:
            score = 10 if is_question else 0
        else:
            base_score = len(flags) * 25
            has_critical = any(f.severity == "Critical" for f in flags)
            has_high = any(f.severity == "High" for f in flags)
            if has_critical:
                base_score += 25
            elif has_high:
                base_score += 15
            score = min(100, max(20, base_score))

        return flags, score

    def analyze_utterance(self, text: str) -> AmbiguityAnalysisResult:
        """
        Hybrid ambiguity analyzer:
        Combines LangChain contextual LLM analysis with deterministic rule fallback.
        """
        # Run deterministic rules
        rule_flags, rule_score = self.detect_ambiguities_rule_based(text)
        
        # If LLM is available, invoke contextual clarification chain
        if llm_service.is_available():
            try:
                res, model_used = llm_service.invoke_with_fallback(
                    build_clarify_chain,
                    {"transcript": text}
                )
                if res and len(res.strip()) > 0:
                    return AmbiguityAnalysisResult(
                        isAmbiguous=len(rule_flags) > 0 or "AMBIGUOUS" in res.upper(),
                        ambiguityScore=rule_score if rule_flags else 65,
                        detectedFlags=rule_flags,
                        engine=f"LangChain ({model_used})"
                    )
            except Exception as e:
                logger.warning(f"LangChain clarify chain execution failed: {e} -> fallback to rules")

        return AmbiguityAnalysisResult(
            isAmbiguous=len(rule_flags) > 0,
            ambiguityScore=rule_score,
            detectedFlags=rule_flags,
            engine="Deterministic-Rule-Engine"
        )

    def generate_fallback_question(self, text: str, flags: Optional[List[AmbiguityFlag]] = None) -> ClarificationQuestion:
        """
        Generates a targeted clarification question for a statement.
        """
        lower = text.lower()
        q_id = f"cq-{uuid.uuid4().hex[:6]}"

        if re.search(r"slow|quick|fast|response|latency|time", lower):
            return ClarificationQuestion(
                id=q_id,
                category="Performance",
                question="What specific latency threshold (SLO) defines acceptable performance for resume parsing and ranking?",
                triggeredBy=text,
                suggestedOptions=[
                    "Single resume < 1.50s (p95) and batch of 100 resumes < 30.0s",
                    "Single resume < 500ms real-time latency with Redis caching",
                    "Asynchronous processing with webhook notification within 5.0 seconds"
                ]
            )
        elif re.search(r"bias|fair|gender|college|background", lower):
            return ClarificationQuestion(
                id=q_id,
                category="Fairness",
                question="What quantitative fairness metric and audit frequency should be enforced to prevent demographic bias?",
                triggeredBy=text,
                suggestedOptions=[
                    "Disparate Impact Ratio 0.80 - 1.25 across gender and college tiers with automated PII masking",
                    "Demographic Parity Difference < 0.05 with blind evaluation mode",
                    "Equalized Odds True Positive Rate difference < 0.04 across demographics"
                ]
            )
        elif re.search(r"good enough|trust|accuracy|relevant", lower):
            return ClarificationQuestion(
                id=q_id,
                category="Accuracy",
                question="What objective accuracy metric defines 'good enough for HR trust' (e.g. Precision@10 >= 85%, NDCG >= 0.82)?",
                triggeredBy=text,
                suggestedOptions=[
                    "Ranking Precision@10 >= 85.0% and NDCG@10 >= 0.82 on verified recruiter test set",
                    "Top-5 Match Accuracy >= 90.0% with Human-in-the-Loop review",
                    "F1-Score >= 0.80 across all technical skill categories"
                ]
            )
        elif re.search(r"explain|scorecard|breakdown|justification|useful|why|reason", lower):
            return ClarificationQuestion(
                id=q_id,
                category="Explainability",
                question="How should candidate match reasoning and scoring factors be presented to recruiters?",
                triggeredBy=text,
                suggestedOptions=[
                    "Interactive candidate scorecard showing matched skills %, project impact score, and top 3 justification reasons",
                    "SHAP/LIME feature importance waterfall chart rendered in < 500ms",
                    "Bullet-point summary highlighting matched job description criteria"
                ]
            )
        elif re.search(r"solid|projects|companies|strength|formula|fresher|weight", lower):
            return ClarificationQuestion(
                id=q_id,
                category="Ranking Algorithm",
                question="How should skills, experience, project complexity, and fresher profiles be weighted?",
                triggeredBy=text,
                suggestedOptions=[
                    "Multi-factor formula: 45% skills match + 35% project complexity + 20% experience with tier normalization",
                    "Equal weighting: 33.3% Skills + 33.3% Experience + 33.3% Projects",
                    "Skills-first model: 60% Verified Skills + 40% Project Portfolio"
                ]
            )
        elif re.search(r"resumes|data|format|structured|pdf|docx", lower):
            return ClarificationQuestion(
                id=q_id,
                category="Data Ingestion",
                question="What file formats, file size limits, and structured schema validations must be supported?",
                triggeredBy=text,
                suggestedOptions=[
                    "Support PDF and DOCX up to 10MB per file with automated text extraction into validated JSON schema",
                    "Support PDF, DOCX, and scanned PNG/JPG with OCR up to 25MB",
                    "Standard PDF-only ingestion up to 5MB"
                ]
            )
        elif re.search(r"soon|mvp|timeline|deadline|asap", lower):
            return ClarificationQuestion(
                id=q_id,
                category="Project Scope",
                question="What is the committed delivery milestone and functional scope for the MVP release?",
                triggeredBy=text,
                suggestedOptions=[
                    "4-week MVP deliverable covering ingestion, JD matching, top-10 ranking, and scorecard export",
                    "2-week prototype with core ranking engine followed by 4-week UI integration",
                    "6-week enterprise release with full bias audit and analytics dashboard"
                ]
            )
        else:
            return ClarificationQuestion(
                id=q_id,
                category="General Clarification",
                question=f"Could you specify concrete measurable criteria or constraints for: '{text}'?",
                triggeredBy=text,
                suggestedOptions=[
                    "Establish quantitative SLO threshold",
                    "Define pass/fail acceptance criterion",
                    "Schedule stakeholder review checkpoint"
                ]
            )

    def filter_duplicate_clarifications(self, existing: List[ClarificationQuestion], new_q: ClarificationQuestion) -> bool:
        """
        Returns True if new_q is unique and should be added; False if it is a duplicate.
        """
        for ex in existing:
            # Same category and triggered by similar statement
            if ex.category == new_q.category:
                if ex.triggeredBy and new_q.triggeredBy and (
                    ex.triggeredBy.lower() in new_q.triggeredBy.lower() or 
                    new_q.triggeredBy.lower() in ex.triggeredBy.lower()
                ):
                    return False
            # Same question text
            if ex.question.strip().lower() == new_q.question.strip().lower():
                return False
        return True

    def detect_clarification_conflict(self, existing: List[ClarificationQuestion], question_id: str, new_answer: str) -> Optional[str]:
        """
        Detects contradictory stakeholder decisions.
        """
        for ex in existing:
            if ex.id == question_id and ex.selectedResponse:
                prev = ex.selectedResponse.strip().lower()
                curr = new_answer.strip().lower()
                if prev != curr:
                    # Check for conflicting numbers
                    num_prev = re.findall(r"\b\d+(?:\.\d+)?\b", prev)
                    num_curr = re.findall(r"\b\d+(?:\.\d+)?\b", curr)
                    if num_prev and num_curr and num_prev != num_curr:
                        return f"Contradiction detected: previous answer specified '{ex.selectedResponse}' while updated answer specifies '{new_answer}'. Overriding with latest confirmed stakeholder decision."
        return None

ambiguity_engine = AmbiguityEngine()
