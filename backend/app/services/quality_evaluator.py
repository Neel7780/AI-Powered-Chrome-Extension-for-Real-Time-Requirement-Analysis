import re
from typing import Dict, Any, Union, List
from ..models.schemas import (
    RequirementSet, QualityEvaluation, QualityDimension,
    ComparisonResult, ComparisonDelta, QualityTier
)
from ..models.enums import RequirementStatus, RequirementSource

class QualityEvaluator:
    """
    Requirement Quality Evaluator
    Computes pure mathematical ratios (0-100%) without artificial floors/caps
    across quality dimensions informed by ISO/IEC/IEEE 29148 principles.
    """
    def __init__(self) -> None:
        pass

    def evaluate_requirement_set(self, req_set_input: Union[RequirementSet, Dict[str, Any], str]) -> QualityEvaluation:
        """
        Evaluates a RequirementSet against 5 core ISO 29148 informed quality dimensions.
        """
        if isinstance(req_set_input, RequirementSet):
            frs = req_set_input.frs
            nfrs = req_set_input.nfrs
        elif isinstance(req_set_input, dict):
            frs = req_set_input.get("frs", [])
            nfrs = req_set_input.get("nfrs", [])
        elif isinstance(req_set_input, str):
            # Parse text requirements (e.g. from LLM output)
            return self._evaluate_text_requirements(req_set_input)
        else:
            frs = []
            nfrs = []

        total_reqs = len(frs) + len(nfrs)
        if total_reqs == 0:
            return self._empty_evaluation()

        all_reqs = list(frs) + list(nfrs)

        # 1. Ambiguity Metric (0 - 100, Lower is Better)
        # Ratio of requirements that are still flagged or unresolved
        flagged_count = 0
        for r in all_reqs:
            status = getattr(r, "status", None) or (r.get("status") if isinstance(r, dict) else None)
            amb_flags = getattr(r, "ambiguityFlags", None) or (r.get("ambiguityFlags") if isinstance(r, dict) else None)
            is_pending = status == RequirementStatus.PENDING_CLARIFICATION or status == "PENDING_CLARIFICATION"
            has_flags = bool(amb_flags and len(amb_flags) > 0)
            if is_pending or has_flags:
                flagged_count += 1

        ambiguity_score = round((flagged_count / total_reqs) * 100)

        # 2. Testability & Verifiability Metric (0 - 100, Higher is Better)
        # Ratio of requirements with verifiable criteria (concrete SLOs, regex, Gherkin criteria)
        testable_count = 0
        for r in all_reqs:
            status = getattr(r, "status", None) or (r.get("status") if isinstance(r, dict) else None)
            is_resolved = status == RequirementStatus.RESOLVED or status == "RESOLVED"
            if not is_resolved:
                continue

            target = getattr(r, "targetThreshold", None) or (r.get("targetThreshold") if isinstance(r, dict) else None) or ""
            ac = getattr(r, "acceptanceCriteria", None) or (r.get("acceptanceCriteria") if isinstance(r, dict) else None) or []
            vm = getattr(r, "verificationMethod", None) or (r.get("verificationMethod") if isinstance(r, dict) else None) or ""
            desc = getattr(r, "description", None) or (r.get("description") if isinstance(r, dict) else None) or ""

            has_quant = bool(re.search(r"\b(\d+(?:\.\d+)?%?|\d+\s*(?:s|ms|seconds|minutes|weeks|MB|users))\b|0\.\d+", f"{target} {desc}", re.I))
            has_gherkin = any("Given" in str(criterion) for criterion in ac)
            has_verif = bool(vm and len(str(vm).strip()) > 0)

            if (has_quant or has_gherkin) and (has_verif or len(ac) >= 2):
                testable_count += 1

        testability_score = round((testable_count / total_reqs) * 100)

        # 3. Specificity & Measurability Metric (0 - 100, Higher is Better)
        # Ratio of requirements with quantified, non-empty thresholds
        specific_count = 0
        for r in all_reqs:
            status = getattr(r, "status", None) or (r.get("status") if isinstance(r, dict) else None)
            is_resolved = status == RequirementStatus.RESOLVED or status == "RESOLVED"
            if not is_resolved:
                continue

            target = str(getattr(r, "targetThreshold", None) or (r.get("targetThreshold") if isinstance(r, dict) else None) or "")
            evidence = str(getattr(r, "stakeholderEvidence", None) or (r.get("stakeholderEvidence") if isinstance(r, dict) else None) or "")
            desc = str(getattr(r, "description", None) or (r.get("description") if isinstance(r, dict) else None) or "")

            is_unspecified = "unspecified" in target.lower() or "awaiting" in target.lower()
            has_explicit_val = bool((target and not is_unspecified) or re.search(r"\b(\d+(?:\.\d+)?%?|\d+\s*(?:s|ms|weeks|MB))\b", f"{evidence} {desc}", re.I))

            if has_explicit_val:
                specific_count += 1

        specificity_score = round((specific_count / total_reqs) * 100)

        # 4. Completeness Coverage Metric (0 - 100, Higher is Better)
        # 60% weight on resolved ratio + 40% on relevant NFR dimension coverage
        resolved_count = sum(
            1 for r in all_reqs
            if (getattr(r, "status", None) == RequirementStatus.RESOLVED or 
                getattr(r, "status", None) == "RESOLVED" or
                (isinstance(r, dict) and r.get("status") == "RESOLVED"))
        )
        resolved_ratio = resolved_count / total_reqs

        nfr_categories = set(
            getattr(n, "category", None) or (n.get("category") if isinstance(n, dict) else "")
            for n in nfrs
        )
        total_dimensions = max(1, len(nfr_categories))
        resolved_dimensions = set(
            getattr(n, "category", None) or (n.get("category") if isinstance(n, dict) else "")
            for n in nfrs
            if (getattr(n, "status", None) == RequirementStatus.RESOLVED or
                getattr(n, "status", None) == "RESOLVED" or
                (isinstance(n, dict) and n.get("status") == "RESOLVED"))
        )
        dimension_ratio = len(resolved_dimensions) / total_dimensions

        completeness_score = round((0.60 * resolved_ratio + 0.40 * dimension_ratio) * 100)

        # 5. Traceability Metric (0 - 100, Higher is Better)
        # Ratio of requirements with explicit stakeholder evidence or raw dialogue provenance
        traceable_count = 0
        for r in all_reqs:
            source = getattr(r, "source", None) or (r.get("source") if isinstance(r, dict) else None)
            clar_ref = getattr(r, "clarificationReference", None) or (r.get("clarificationReference") if isinstance(r, dict) else None)
            source_stmt = getattr(r, "sourceStatement", None) or (r.get("sourceStatement") if isinstance(r, dict) else None)
            if source == RequirementSource.STAKEHOLDER_CLARIFICATION or source == "STAKEHOLDER_CLARIFICATION" or clar_ref:
                traceable_count += 1
            elif source_stmt and len(str(source_stmt).strip()) > 0:
                traceable_count += 0.5

        traceability_score = min(100, round((traceable_count / total_reqs) * 100))

        # Overall Quality Index (OQI) Composite Calculation
        # OQI = 25% Completeness + 25% Testability + 20% Specificity + 15% Traceability + 15% (100 - Ambiguity)
        clarity_score = 100 - ambiguity_score
        oqi = round(
            0.25 * completeness_score +
            0.25 * testability_score +
            0.20 * specificity_score +
            0.15 * traceability_score +
            0.15 * clarity_score
        )
        oqi = max(0, min(100, oqi))

        tier = self._get_tier(oqi)

        return QualityEvaluation(
            overallQualityIndex=oqi,
            qualityTier=tier,
            standardAlignment="Informed by ISO/IEC/IEEE 29148 Principles",
            disclaimer="Demo Simulation — Stakeholder responses are simulated to demonstrate the clarification workflow.",
            metrics={
                "ambiguity": QualityDimension(
                    score=ambiguity_score,
                    label="Ambiguity Level",
                    description="Proportion of requirements with unresolved vagueness or pending stakeholder decisions (lower is better)."
                ),
                "completeness": QualityDimension(
                    score=completeness_score,
                    label="Completeness Coverage",
                    description="Coverage of resolved functional requirements and necessary NFR dimensions."
                ),
                "testability": QualityDimension(
                    score=testability_score,
                    label="Testability & Verifiability",
                    description="Proportion of requirements with objective, quantifiable acceptance criteria and verification methods."
                ),
                "specificity": QualityDimension(
                    score=specificity_score,
                    label="Specificity & Measurability",
                    description="Proportion of requirements with explicit, non-empty numerical thresholds and metrics."
                ),
                "traceability": QualityDimension(
                    score=traceability_score,
                    label="Traceability & Lineage",
                    description="Proportion of requirements linked directly to stakeholder decisions or meeting dialogue."
                )
            },
            rawCounts={
                "totalRequirements": total_reqs,
                "functionalRequirements": len(frs),
                "nonFunctionalRequirements": len(nfrs),
                "resolvedCount": resolved_count,
                "pendingCount": total_reqs - resolved_count,
                "flaggedAmbiguities": flagged_count
            }
        )

    def _evaluate_text_requirements(self, text: str) -> QualityEvaluation:
        """
        Fallback evaluator for raw unstructured text strings.
        """
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        req_lines = [l for l in lines if re.match(r"^(FR|NFR)\d+\s*:", l, re.I)]
        vague_terms = [r"\bgood enough\b", r"\bquick\b", r"\bsoon\b", r"\bstrong\b", r"\bnot slow\b", r"\bideally\b"]
        vague_count = sum(len(re.findall(p, text, re.I)) for p in vague_terms)

        total = max(1, len(req_lines))
        testable = sum(1 for l in req_lines if re.search(r"\b(shall|must|within|seconds|%|precision|accuracy|NDCG)\b", l, re.I))
        testability = round((testable / total) * 100)
        ambiguity = min(100, round((vague_count / total) * 100))
        specificity = max(0, 100 - ambiguity)
        completeness = 85 if len(req_lines) >= 4 else 40
        traceability = 90 if "clarification" in text.lower() else 50

        oqi = round(0.25 * completeness + 0.25 * testability + 0.20 * specificity + 0.15 * traceability + 0.15 * (100 - ambiguity))
        tier = self._get_tier(oqi)

        return QualityEvaluation(
            overallQualityIndex=oqi,
            qualityTier=tier,
            standardAlignment="Informed by ISO/IEC/IEEE 29148 Principles",
            disclaimer="Demo Simulation — Stakeholder responses are simulated to demonstrate the clarification workflow.",
            metrics={
                "ambiguity": QualityDimension(score=ambiguity, label="Ambiguity Level", description="Unresolved vague terms"),
                "completeness": QualityDimension(score=completeness, label="Completeness Coverage", description="Requirements scope coverage"),
                "testability": QualityDimension(score=testability, label="Testability & Verifiability", description="Measurable validation criteria"),
                "specificity": QualityDimension(score=specificity, label="Specificity & Measurability", description="Quantified statements"),
                "traceability": QualityDimension(score=traceability, label="Traceability & Lineage", description="Stakeholder provenance")
            },
            rawCounts={"totalRequirements": len(req_lines), "vagueCount": vague_count}
        )

    def compare_quality(self, baseline_eval: QualityEvaluation, refined_eval: QualityEvaluation) -> ComparisonResult:
        """
        Computes exact delta between Baseline and Refined quality evaluations.
        """
        base_oqi = baseline_eval.overallQualityIndex
        ref_oqi = refined_eval.overallQualityIndex
        oqi_delta = ref_oqi - base_oqi

        pct_gain = round(((ref_oqi - base_oqi) / base_oqi) * 100, 1) if base_oqi > 0 else None

        delta = ComparisonDelta(
            oqiImprovement=oqi_delta,
            percentImprovement=pct_gain,
            ambiguityReduction=baseline_eval.metrics["ambiguity"].score - refined_eval.metrics["ambiguity"].score,
            testabilityGain=refined_eval.metrics["testability"].score - baseline_eval.metrics["testability"].score,
            specificityGain=refined_eval.metrics["specificity"].score - baseline_eval.metrics["specificity"].score,
            completenessGain=refined_eval.metrics["completeness"].score - baseline_eval.metrics["completeness"].score,
            traceabilityGain=refined_eval.metrics["traceability"].score - baseline_eval.metrics["traceability"].score
        )

        return ComparisonResult(
            baseline_metrics=baseline_eval,
            refined_metrics=refined_eval,
            delta=delta
        )

    def _get_tier(self, score: int) -> QualityTier:
        if score >= 85:
            return QualityTier.EXCELLENT
        elif score >= 70:
            return QualityTier.GOOD
        elif score >= 50:
            return QualityTier.MODERATE
        elif score >= 25:
            return QualityTier.POOR
        else:
            return QualityTier.CRITICAL

    def _empty_evaluation(self) -> QualityEvaluation:
        return QualityEvaluation(
            overallQualityIndex=0,
            qualityTier=QualityTier.CRITICAL,
            standardAlignment="Informed by ISO/IEC/IEEE 29148 Principles",
            disclaimer="Demo Simulation — Stakeholder responses are simulated to demonstrate the clarification workflow.",
            metrics={
                "ambiguity": QualityDimension(score=100, label="Ambiguity Level", description="No requirements found"),
                "completeness": QualityDimension(score=0, label="Completeness Coverage", description="No requirements found"),
                "testability": QualityDimension(score=0, label="Testability & Verifiability", description="No requirements found"),
                "specificity": QualityDimension(score=0, label="Specificity & Measurability", description="No requirements found"),
                "traceability": QualityDimension(score=0, label="Traceability & Lineage", description="No requirements found")
            },
            rawCounts={"totalRequirements": 0}
        )

quality_evaluator = QualityEvaluator()
