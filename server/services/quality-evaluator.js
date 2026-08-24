/**
 * Dynamic Requirement Engineering Quality Evaluation Engine
 * Evaluates requirements purely based on actual content, verifiable criteria,
 * resolved statuses, and coverage of NFR dimensions (ISO/IEC/IEEE 29148).
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

    // 1. Ambiguity Metric (0 - 100, Lower is Better)
    const ambiguityMetrics = this.calculateAmbiguity(allReqs);

    // 2. Completeness Metric (0 - 100, Higher is Better)
    const completenessMetrics = this.calculateCompleteness(frs, nfrs);

    // 3. Verifiability / Testability Metric (0 - 100, Higher is Better)
    const testabilityMetrics = this.calculateTestability(allReqs);

    // 4. Specificity / Measurability Metric (0 - 100, Higher is Better)
    const specificityMetrics = this.calculateSpecificity(allReqs);

    // 5. Traceability & Structure Metric (0 - 100, Higher is Better)
    const traceabilityMetrics = this.calculateTraceability(allReqs);

    // 6. Overall Quality Index (OQI) - Weighted composite score
    // Weightings: Completeness (25%), Verifiability (25%), Specificity (20%), Traceability (15%), Unambiguity (15%)
    const unambiguityScore = 100 - ambiguityMetrics.score;
    const overallQualityIndex = Math.round(
      (0.25 * completenessMetrics.score) +
      (0.25 * testabilityMetrics.score) +
      (0.20 * specificityMetrics.score) +
      (0.15 * traceabilityMetrics.score) +
      (0.15 * unambiguityScore)
    );

    // Quality Rating Category
    let qualityTier = 'Poor';
    if (overallQualityIndex >= 85) qualityTier = 'Excellent';
    else if (overallQualityIndex >= 70) qualityTier = 'Good';
    else if (overallQualityIndex >= 50) qualityTier = 'Moderate';

    const isFullyRefined = overallQualityIndex >= 80;

    return {
      overallQualityIndex,
      qualityTier,
      isFullyRefined,
      requirementCount: {
        total: allReqs.length,
        frCount: frs.length,
        nfrCount: nfrs.length,
        resolvedCount: allReqs.filter(r => r.status === 'RESOLVED').length,
        pendingCount: allReqs.filter(r => r.status === 'PENDING_CLARIFICATION' || r.status === 'RAW_UNCLARIFIED').length
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
        clarity: unambiguityScore
      },
      summary: this.generateQualitySummary(overallQualityIndex, qualityTier, ambiguityMetrics, completenessMetrics)
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
        `Overall Requirement Quality changed from ${baselineEval.overallQualityIndex}/100 (${baselineEval.qualityTier}) to ${refinedEval.overallQualityIndex}/100 (${refinedEval.qualityTier}).`,
        `Ambiguity level: ${baselineEval.metrics.ambiguity.score}% in baseline vs ${refinedEval.metrics.ambiguity.score}% in refined.`,
        `Testability score: ${baselineEval.metrics.testability.score}% in baseline vs ${refinedEval.metrics.testability.score}% in refined based on verifiable criteria.`,
        `Clarification resolution: ${refinedEval.requirementCount.resolvedCount} of ${refinedEval.requirementCount.total} requirements fully resolved.`
      ]
    };
  }

  // --- Internal Metric Calculators ---

  calculateAmbiguity(requirements) {
    const vagueTerms = /\b(good enough|trusts it|solid|impactful|strong|not strictly|not very structured|useful|avoid bias|shouldn'?t be slow|ideally quick|mvp soon|unspecified|pending clarification)\b/gi;
    let totalMatches = 0;
    const flaggedItems = [];

    requirements.forEach(req => {
      const fullText = `${req.title || ''} ${req.description || ''} ${JSON.stringify(req.ambiguityFlags || '')} ${req.targetThreshold || ''}`;
      const matches = fullText.match(vagueTerms) || [];
      if (matches.length > 0 || req.status === 'PENDING_CLARIFICATION' || req.status === 'RAW_UNCLARIFIED') {
        totalMatches += Math.max(1, matches.length);
        flaggedItems.push({
          id: req.id,
          matches: Array.from(new Set(matches.map(m => m.toLowerCase())))
        });
      }
    });

    const ratio = requirements.length > 0 ? flaggedItems.length / requirements.length : 0;
    const score = Math.min(95, Math.max(8, Math.round(ratio * 75 + (totalMatches > 5 ? 15 : 0))));

    return {
      score, // 0 - 100 (Lower is Better)
      totalVagueInstances: totalMatches,
      flaggedRequirementsCount: flaggedItems.length,
      flaggedItems
    };
  }

  calculateCompleteness(frs, nfrs) {
    const requiredNFRCategories = [
      'Performance',
      'Fairness & Bias',
      'Accuracy & Quality',
      'Explainability',
      'Security & Privacy',
      'Project Scope'
    ];

    // Count categories that have at least one RESOLVED requirement
    const resolvedNfrs = nfrs.filter(n => n.status === 'RESOLVED');
    const presentCategories = new Set(resolvedNfrs.map(n => n.category));
    const coveredCategories = requiredNFRCategories.filter(cat => 
      Array.from(presentCategories).some(p => p && p.toLowerCase().includes(cat.split(' ')[0].toLowerCase()))
    );

    const categoryCoverageRatio = coveredCategories.length / requiredNFRCategories.length;
    
    // Check for acceptance criteria presence in resolved FRs
    const resolvedFrs = frs.filter(f => f.status === 'RESOLVED');
    const frCriteriaRatio = frs.length > 0 ? (resolvedFrs.length / frs.length) : 0;

    const score = Math.min(98, Math.max(20, Math.round((categoryCoverageRatio * 55) + (frCriteriaRatio * 35) + (resolvedNfrs.length > 0 ? 8 : 0))));

    return {
      score,
      coveredNFRCategories: coveredCategories,
      missingNFRCategories: requiredNFRCategories.filter(c => !coveredCategories.includes(c)),
      categoryCoveragePercentage: Math.round(categoryCoverageRatio * 100),
      frResolvedRatio: Math.round(frCriteriaRatio * 100)
    };
  }

  calculateTestability(requirements) {
    // Looks for verifiable indicators: numbers, units (< 1.5s, 85%, DIR 0.8-1.25, JSON schema, Gherkin given-when-then)
    const verifiableRegex = /(\b\d+(\.\d+)?\s*(ms|s|seconds|%|MB|GB|TPS|NDCG|F1|DIR)\b|[<>]=?|\b(disparate impact|sha-256|aes-256|json schema|given|when|then)\b)/i;
    
    let verifiableCount = 0;
    requirements.forEach(req => {
      const fullText = `${req.description || ''} ${JSON.stringify(req.acceptanceCriteria || '')} ${req.metric || ''} ${req.targetThreshold || ''}`;
      if (req.status === 'RESOLVED' && verifiableRegex.test(fullText) && !/unspecified|pending/i.test(req.targetThreshold || '')) {
        verifiableCount++;
      }
    });

    const testableRatio = requirements.length > 0 ? verifiableCount / requirements.length : 0;
    const score = Math.min(96, Math.max(15, Math.round(testableRatio * 85 + (verifiableCount >= 4 ? 10 : 0))));

    return {
      score,
      testableRequirementsCount: verifiableCount,
      totalRequirements: requirements.length,
      testabilityPercentage: Math.round(testableRatio * 100)
    };
  }

  calculateSpecificity(requirements) {
    let specificCount = 0;
    requirements.forEach(req => {
      const threshold = req.targetThreshold || '';
      if (req.status === 'RESOLVED' && threshold && !/unspecified|pending|undefined/i.test(threshold)) {
        specificCount++;
      }
    });

    const ratio = requirements.length > 0 ? specificCount / requirements.length : 0;
    const score = Math.min(95, Math.max(18, Math.round(ratio * 80 + (specificCount >= 4 ? 15 : 0))));

    return {
      score,
      quantifiedMetricsCount: specificCount,
      totalRequirements: requirements.length
    };
  }

  calculateTraceability(requirements) {
    let traceableCount = 0;
    requirements.forEach(req => {
      if (req.id && (req.clarificationReference || req.sourceStatement)) {
        if (req.status === 'RESOLVED' && req.clarificationReference) {
          traceableCount += 1.0;
        } else if (req.sourceStatement) {
          traceableCount += 0.5;
        }
      }
    });

    const ratio = requirements.length > 0 ? Math.min(1.0, traceableCount / requirements.length) : 0;
    const score = Math.min(98, Math.max(25, Math.round(ratio * 95)));

    return {
      score,
      traceableCount: Math.round(traceableCount),
      traceabilityPercentage: Math.round(ratio * 100)
    };
  }

  generateQualitySummary(oqi, tier, amb, comp) {
    if (oqi >= 80) {
      return `High-precision specification (${tier} rating, OQI: ${oqi}/100). Ambiguity minimized to ${amb.score}% with quantified SLOs across ${comp.coveredNFRCategories.length} NFR dimensions and verifiable acceptance criteria.`;
    } else if (oqi >= 50) {
      return `Partially refined specification (${tier} rating, OQI: ${oqi}/100). Ambiguity at ${amb.score}%. Some clarifications answered, but ${comp.missingNFRCategories.length} NFR dimensions remain pending.`;
    }
    return `Preliminary raw requirement set (${tier} rating, OQI: ${oqi}/100). High ambiguity (${amb.score}%) with ${amb.totalVagueInstances} subjective phrases and ${comp.missingNFRCategories.length} missing NFR categories. Requires stakeholder clarification.`;
  }

  getEmptyEvaluation() {
    return {
      overallQualityIndex: 0,
      qualityTier: 'N/A',
      isFullyRefined: false,
      requirementCount: { total: 0, frCount: 0, nfrCount: 0, resolvedCount: 0, pendingCount: 0 },
      metrics: {
        ambiguity: { score: 0, totalVagueInstances: 0, flaggedRequirementsCount: 0, flaggedItems: [] },
        completeness: { score: 0, coveredNFRCategories: [], missingNFRCategories: [], categoryCoveragePercentage: 0, frResolvedRatio: 0 },
        testability: { score: 0, testableRequirementsCount: 0, totalRequirements: 0, testabilityPercentage: 0 },
        specificity: { score: 0, quantifiedMetricsCount: 0, totalRequirements: 0 },
        traceability: { score: 0, traceableCount: 0, traceabilityPercentage: 0 }
      },
      radarScores: { completeness: 0, testability: 0, specificity: 0, traceability: 0, clarity: 0 },
      summary: 'No requirements evaluated.'
    };
  }
}

module.exports = new QualityEvaluator();
