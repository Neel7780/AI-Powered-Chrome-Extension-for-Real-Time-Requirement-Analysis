/**
 * Dynamic Requirement Engineering Quality Evaluation Engine
 * Uses pure mathematical ratios (0-100%) without artificial floors or caps.
 * 
 * Hybrid Architecture:
 * - Gemini performs contextual dialogue analysis and requirement refinement.
 * - Deterministic rule-based metrics provide reproducible, verifiable quality evaluation.
 */

class QualityEvaluator {
  /**
   * Evaluate a set of requirements (FRs and NFRs)
   * @param {Object} requirements - { frs: [], nfrs: [] }
   * @returns {Object} Comprehensive quality metrics report
   */
  evaluateRequirementSet(requirements = { frs: [], nfrs: [] }) {
    const frs = requirements.frs || [];
    const nfrs = requirements.nfrs || [];
    const allReqs = [...frs, ...nfrs];

    if (allReqs.length === 0) {
      return this.getEmptyEvaluation();
    }

    const totalCount = allReqs.length;
    const resolvedCount = allReqs.filter(r => r.status === 'RESOLVED').length;
    const pendingCount = totalCount - resolvedCount;

    // 1. Ambiguity Metric (0 - 100, Lower is Better)
    // Percentage of requirements that contain unresolved ambiguities or are pending clarification
    const ambiguityMetrics = this.calculateAmbiguity(allReqs);

    // 2. Completeness Metric (0 - 100, Higher is Better)
    // Percentage of identified requirement dimensions that have been fully resolved
    const completenessMetrics = this.calculateCompleteness(frs, nfrs);

    // 3. Verifiability / Testability Metric (0 - 100, Higher is Better)
    // Percentage of requirements with objective, testable acceptance criteria or quantified metrics
    const testabilityMetrics = this.calculateTestability(allReqs);

    // 4. Specificity / Measurability Metric (0 - 100, Higher is Better)
    // Percentage of requirements containing explicit numbers, units, or schemas (excluding "Unspecified")
    const specificityMetrics = this.calculateSpecificity(allReqs);

    // 5. Traceability Metric (0 - 100, Higher is Better)
    // Percentage of requirements with explicit traceability back to stakeholder statements or clarifications
    const traceabilityMetrics = this.calculateTraceability(allReqs);

    // 6. Overall Quality Index (OQI) - Weighted composite score
    // Pure arithmetic weighted average (0 - 100)
    // Weights: Completeness (25%), Verifiability (25%), Specificity (20%), Traceability (15%), Clarity/Unambiguity (15%)
    const clarityScore = Math.max(0, 100 - ambiguityMetrics.score);
    const overallQualityIndex = Math.round(
      (0.25 * completenessMetrics.score) +
      (0.25 * testabilityMetrics.score) +
      (0.20 * specificityMetrics.score) +
      (0.15 * traceabilityMetrics.score) +
      (0.15 * clarityScore)
    );

    // Quality Rating Tier
    let qualityTier = 'Poor';
    if (overallQualityIndex >= 80) qualityTier = 'Excellent';
    else if (overallQualityIndex >= 60) qualityTier = 'Good';
    else if (overallQualityIndex >= 40) qualityTier = 'Moderate';

    const isFullyRefined = overallQualityIndex >= 80;

    return {
      overallQualityIndex,
      qualityTier,
      isFullyRefined,
      requirementCount: {
        total: totalCount,
        frCount: frs.length,
        nfrCount: nfrs.length,
        resolvedCount,
        pendingCount
      },
      metrics: {
        ambiguity: ambiguityMetrics,
        completeness: completenessMetrics,
        testability: testabilityMetrics,
        specificity: specificityMetrics,
        traceability: traceabilityMetrics
      },
      radarScores: {
        completeness: completenessMetrics.score,
        testability: testabilityMetrics.score,
        specificity: specificityMetrics.score,
        traceability: traceabilityMetrics.score,
        clarity: clarityScore
      },
      summary: this.generateQualitySummary(overallQualityIndex, qualityTier, ambiguityMetrics, completenessMetrics, resolvedCount, totalCount)
    };
  }

  /**
   * Compare requirements generated Without Clarification vs With Clarification
   */
  compareQuality(baselineEval, refinedEval) {
    const delta = {
      overallQualityIndex: refinedEval.overallQualityIndex - baselineEval.overallQualityIndex,
      ambiguityReduction: baselineEval.metrics.ambiguity.score - refinedEval.metrics.ambiguity.score,
      completenessGain: refinedEval.metrics.completeness.score - baselineEval.metrics.completeness.score,
      testabilityGain: refinedEval.metrics.testability.score - baselineEval.metrics.testability.score,
      specificityGain: refinedEval.metrics.specificity.score - baselineEval.metrics.specificity.score,
      traceabilityGain: refinedEval.metrics.traceability.score - baselineEval.metrics.traceability.score
    };

    const percentageImprovement = baselineEval.overallQualityIndex > 0
      ? Math.round(((refinedEval.overallQualityIndex - baselineEval.overallQualityIndex) / baselineEval.overallQualityIndex) * 100)
      : 100;

    return {
      baseline: baselineEval,
      refined: refinedEval,
      delta,
      percentageImprovement,
      keyFindings: [
        `Overall Requirement Quality: ${baselineEval.overallQualityIndex}/100 (${baselineEval.qualityTier}) -> ${refinedEval.overallQualityIndex}/100 (${refinedEval.qualityTier}) [${delta.overallQualityIndex > 0 ? '+' : ''}${delta.overallQualityIndex} pts].`,
        `Ambiguity level: ${baselineEval.metrics.ambiguity.score}% in baseline vs ${refinedEval.metrics.ambiguity.score}% in refined (${delta.ambiguityReduction}% reduction).`,
        `Testability: ${baselineEval.metrics.testability.score}% in baseline vs ${refinedEval.metrics.testability.score}% in refined.`,
        `Resolution rate: ${refinedEval.requirementCount.resolvedCount} of ${refinedEval.requirementCount.total} requirements fully resolved.`
      ]
    };
  }

  // --- Pure Ratio Metric Calculators (No artificial floors/caps) ---

  calculateAmbiguity(requirements) {
    if (requirements.length === 0) return { score: 0, totalVagueInstances: 0, flaggedCount: 0, flaggedItems: [] };

    const vagueRegex = /\b(good enough|trusts it|trust|solid|impactful|strong|not strictly|not very structured|useful|avoid bias|shouldn'?t be slow|ideally quick|mvp soon|unspecified|pending clarification|raw_unclarified)\b/gi;
    let totalMatches = 0;
    const flaggedItems = [];

    requirements.forEach(req => {
      const fullText = `${req.title || ''} ${req.description || ''} ${JSON.stringify(req.ambiguityFlags || '')} ${req.targetThreshold || ''} ${req.status || ''}`;
      const matches = fullText.match(vagueRegex) || [];
      const isUnresolved = req.status === 'PENDING_CLARIFICATION' || req.status === 'RAW_UNCLARIFIED' || (req.ambiguityFlags && req.ambiguityFlags.length > 0);
      
      if (matches.length > 0 || isUnresolved) {
        totalMatches += Math.max(1, matches.length);
        flaggedItems.push({
          id: req.id,
          matches: Array.from(new Set(matches.map(m => m.toLowerCase())))
        });
      }
    });

    // Pure mathematical ratio of flagged requirements to total requirements
    const ratio = flaggedItems.length / requirements.length;
    const score = Math.round(ratio * 100);

    return {
      score, // 0 - 100 (Lower is Better)
      totalVagueInstances: totalMatches,
      flaggedCount: flaggedItems.length,
      flaggedItems
    };
  }

  calculateCompleteness(frs, nfrs) {
    const allReqs = [...frs, ...nfrs];
    if (allReqs.length === 0) return { score: 0, resolvedRatio: 0, categoryCoveragePercentage: 0 };

    // 1. Requirement Resolution Ratio: (Resolved Requirements / Total Requirements)
    const resolvedReqs = allReqs.filter(r => r.status === 'RESOLVED');
    const resolutionRatio = resolvedReqs.length / allReqs.length;

    // 2. Dynamic Relevant NFR Dimension Coverage:
    // Identify all unique NFR categories present in this specific project
    const presentCategories = Array.from(new Set(nfrs.map(n => n.category).filter(Boolean)));
    const resolvedCategories = Array.from(new Set(
      nfrs.filter(n => n.status === 'RESOLVED').map(n => n.category).filter(Boolean)
    ));

    const categoryCoverageRatio = presentCategories.length > 0
      ? resolvedCategories.length / presentCategories.length
      : resolutionRatio;

    // Pure weighted average: 60% requirement resolution ratio + 40% relevant category coverage ratio
    const score = Math.round((0.60 * resolutionRatio + 0.40 * categoryCoverageRatio) * 100);

    return {
      score, // 0 - 100
      presentCategories,
      resolvedCategories,
      categoryCoveragePercentage: Math.round(categoryCoverageRatio * 100),
      resolvedCount: resolvedReqs.length,
      totalCount: allReqs.length,
      resolvedRatio: Math.round(resolutionRatio * 100)
    };
  }

  calculateTestability(requirements) {
    if (requirements.length === 0) return { score: 0, testableCount: 0, totalCount: 0, testabilityPercentage: 0 };

    // Testable indicators: explicit numbers, units (< 1.5s, 85%, DIR 0.80, 200ms, 10MB), Gherkin Given-When-Then criteria
    const testablePattern = /(\b\d+(\.\d+)?\s*(ms|s|seconds|%|MB|GB|TPS|NDCG|F1|DIR|weeks|months)\b|[<>]=?|\b(disparate impact|sha-256|aes-256|tls 1\.3|json schema|given|when|then)\b)/i;
    
    let testableCount = 0;
    requirements.forEach(req => {
      const fullText = `${req.description || ''} ${JSON.stringify(req.acceptanceCriteria || '')} ${req.metric || ''} ${req.targetThreshold || ''}`;
      const isResolved = req.status === 'RESOLVED';
      const isExplicitlyUnspecified = /unspecified|pending clarification|raw_unclarified/i.test(req.targetThreshold || '') || /pending/i.test(req.status || '');

      if (isResolved && !isExplicitlyUnspecified && testablePattern.test(fullText)) {
        testableCount++;
      }
    });

    // Pure mathematical ratio: (testable / total) * 100
    const ratio = testableCount / requirements.length;
    const score = Math.round(ratio * 100);

    return {
      score, // 0 - 100
      testableCount,
      totalCount: requirements.length,
      testabilityPercentage: score
    };
  }

  calculateSpecificity(requirements) {
    if (requirements.length === 0) return { score: 0, specificCount: 0, totalCount: 0 };

    let specificCount = 0;
    requirements.forEach(req => {
      const threshold = req.targetThreshold || '';
      const isResolved = req.status === 'RESOLVED';
      const isUnspecified = /unspecified|pending|raw_unclarified|undefined/i.test(threshold);

      if (isResolved && threshold.trim().length > 0 && !isUnspecified) {
        specificCount++;
      } else if (isResolved && req.acceptanceCriteria && req.acceptanceCriteria.length >= 2) {
        // FRs with multi-step concrete Gherkin criteria also count towards specificity
        specificCount++;
      }
    });

    // Pure mathematical ratio: (specific / total) * 100
    const ratio = specificCount / requirements.length;
    const score = Math.round(ratio * 100);

    return {
      score, // 0 - 100
      specificCount,
      totalCount: requirements.length
    };
  }

  calculateTraceability(requirements) {
    if (requirements.length === 0) return { score: 0, traceableCount: 0, totalCount: 0 };

    let traceableWeight = 0;
    requirements.forEach(req => {
      if (req.status === 'RESOLVED' && req.clarificationReference) {
        traceableWeight += 1.0; // Fully traceable to explicit clarification
      } else if (req.sourceStatement) {
        traceableWeight += 0.5; // Partially traceable to raw dialogue quote
      }
    });

    // Pure mathematical ratio
    const ratio = Math.min(1.0, traceableWeight / requirements.length);
    const score = Math.round(ratio * 100);

    return {
      score, // 0 - 100
      traceableCount: Math.round(traceableWeight),
      totalCount: requirements.length
    };
  }

  generateQualitySummary(oqi, tier, amb, comp, resolved, total) {
    if (oqi >= 80) {
      return `High-precision specification (${tier} rating, OQI: ${oqi}/100). ${resolved} of ${total} requirements resolved with verifiable SLOs and unambiguous acceptance criteria.`;
    } else if (oqi >= 40) {
      return `Partially clarified specification (${tier} rating, OQI: ${oqi}/100). ${resolved} of ${total} requirements resolved. ${total - resolved} requirements remain pending stakeholder clarification.`;
    }
    return `Baseline raw specification (${tier} rating, OQI: ${oqi}/100). High ambiguity (${amb.score}%). 0 of ${total} requirements resolved. Stakeholder clarification required.`;
  }

  getEmptyEvaluation() {
    return {
      overallQualityIndex: 0,
      qualityTier: 'N/A',
      isFullyRefined: false,
      requirementCount: { total: 0, frCount: 0, nfrCount: 0, resolvedCount: 0, pendingCount: 0 },
      metrics: {
        ambiguity: { score: 0, totalVagueInstances: 0, flaggedCount: 0, flaggedItems: [] },
        completeness: { score: 0, presentCategories: [], resolvedCategories: [], categoryCoveragePercentage: 0, resolvedRatio: 0 },
        testability: { score: 0, testableCount: 0, totalCount: 0, testabilityPercentage: 0 },
        specificity: { score: 0, specificCount: 0, totalCount: 0 },
        traceability: { score: 0, traceableCount: 0, totalCount: 0 }
      },
      radarScores: { completeness: 0, testability: 0, specificity: 0, traceability: 0, clarity: 0 },
      summary: 'No requirements evaluated.'
    };
  }
}

module.exports = new QualityEvaluator();
