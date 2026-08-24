/**
 * Ambiguity Detection Engine for Requirements Engineering
 * Identifies lexical vagueness, missing operational definitions, untestable criteria,
 * and underspecified NFR constraints in meeting transcripts.
 */

// Lexicon of ambiguous, vague, or subjective terms common in RE
const VAGUENESS_PATTERNS = [
  {
    pattern: /\b(good enough|good|trusts it|trust)\b/gi,
    category: 'VAGUENESS',
    severity: 'HIGH',
    explanation: 'Subjective trust/quality without quantifiable acceptance criteria (e.g., target accuracy, precision, recall).'
  },
  {
    pattern: /\b(solid|impactful|strong|top tier|great|impressive)\b/gi,
    category: 'VAGUENESS',
    severity: 'MEDIUM',
    explanation: 'Subjective qualitative adjectives lacking objective assessment criteria or scoring rubric.'
  },
  {
    pattern: /\b(relevance|relevant|profile strength|overall strength)\b/gi,
    category: 'INCOMPLETENESS',
    severity: 'HIGH',
    explanation: 'Undefined scoring dimension without mathematical weighting or feature definitions.'
  },
  {
    pattern: /\b(not strictly|sometimes|roughly|around|approximately|maybe|could be)\b/gi,
    category: 'WEAK_CONSTRAINT',
    severity: 'MEDIUM',
    explanation: 'Non-deterministic qualification that leads to inconsistent implementation logic.'
  },
  {
    pattern: /\b(not very structured|unstructured|raw|messy)\b/gi,
    category: 'INCOMPLETENESS',
    severity: 'HIGH',
    explanation: 'Data schema undefined; requires schema specification, parsing rules, and error handling for noisy input.'
  },
  {
    pattern: /\b(useful|nice to have|helpful|would be good)\b/gi,
    category: 'UNDERSPECIFIED_PRIORITY',
    severity: 'MEDIUM',
    explanation: 'Ambiguous prioritization and undefined functional scope or presentation format.'
  },
  {
    pattern: /\b(avoid bias|fair|fairness|unbiased|no discrimination)\b/gi,
    category: 'UNDERSPECIFIED_NFR',
    severity: 'CRITICAL',
    explanation: 'Ethical/Fairness requirement without explicit mathematical fairness metric (e.g., Disparate Impact, Demographic Parity).'
  },
  {
    pattern: /\b(shouldn'?t be slow|fast|slow|speedy|responsive|performant)\b/gi,
    category: 'UNDERSPECIFIED_NFR',
    severity: 'HIGH',
    explanation: 'Subjective performance descriptor without quantifiable latency SLO (e.g., p95 < 1.5s) or throughput bounds.'
  },
  {
    pattern: /\b(ideally quick|quick|instantly|real-?time)\b/gi,
    category: 'UNDERSPECIFIED_NFR',
    severity: 'HIGH',
    explanation: 'Missing specific response time threshold and concurrency/batch processing limits.'
  },
  {
    pattern: /\b(mvp soon|soon|asap|later|next phase)\b/gi,
    category: 'INCOMPLETENESS',
    severity: 'MEDIUM',
    explanation: 'Undefined milestone deadline, scope boundary, and release acceptance criteria.'
  },
  {
    pattern: /\b(user-?friendly|easy to use|seamless|intuitive)\b/gi,
    category: 'UNVERIFIABILITY',
    severity: 'MEDIUM',
    explanation: 'Subjective usability claim with no measurable usability benchmark (e.g., SUS score, task completion rate).'
  },
  {
    pattern: /\b(secure|safe|compliant|standard security)\b/gi,
    category: 'UNDERSPECIFIED_NFR',
    severity: 'CRITICAL',
    explanation: 'Broad security claim lacking explicit protocols (e.g., TLS 1.3, AES-256, SOC2, HIPAA, GDPR).'
  },
  {
    pattern: /\b(huge volume|lots of traffic|scalable|many users)\b/gi,
    category: 'UNDERSPECIFIED_NFR',
    severity: 'HIGH',
    explanation: 'Missing peak TPS (transactions per second), concurrent user limit, or auto-scaling bounds.'
  },
  {
    pattern: /\b(minimal|few errors|rarely|hardly ever)\b/gi,
    category: 'UNVERIFIABILITY',
    severity: 'HIGH',
    explanation: 'Subjective error/false positive rate without statistical error threshold (e.g., error rate < 0.1%).'
  }
];

class AmbiguityDetector {
  /**
   * Analyze a single utterance or statement for ambiguity
   * @param {string} text 
   * @param {string} speaker 
   * @param {string} timestamp 
   * @returns {Object} Analysis result
   */
  analyzeUtterance(text, speaker = 'Unknown', timestamp = '00:00') {
    if (!text || typeof text !== 'string') {
      return {
        text: '',
        speaker,
        timestamp,
        isAmbiguous: false,
        ambiguityScore: 0,
        detectedFlags: []
      };
    }

    const detectedFlags = [];
    let weightedScore = 0;

    for (const rule of VAGUENESS_PATTERNS) {
      const matches = [...text.matchAll(rule.pattern)];
      for (const match of matches) {
        const phrase = match[0];
        const startIndex = match.index;
        const endIndex = startIndex + phrase.length;

        let weight = 20;
        if (rule.severity === 'MEDIUM') weight = 25;
        if (rule.severity === 'HIGH') weight = 35;
        if (rule.severity === 'CRITICAL') weight = 45;

        weightedScore += weight;

        detectedFlags.push({
          phrase,
          category: rule.category,
          severity: rule.severity,
          explanation: rule.explanation,
          range: [startIndex, endIndex]
        });
      }
    }

    // Additional heuristics: Check for questions vs assertions
    const isQuestion = text.trim().endsWith('?');
    const isAmbiguous = detectedFlags.length > 0 && !isQuestion;
    const normalizedScore = isAmbiguous ? Math.min(100, Math.round(weightedScore)) : 0;

    return {
      text,
      speaker,
      timestamp,
      isAmbiguous,
      ambiguityScore: normalizedScore,
      detectedFlags,
      suggestedClarificationTarget: isAmbiguous ? this.deriveClarificationGoal(detectedFlags, text) : null
    };
  }

  /**
   * Analyze an entire transcript list of utterances
   * @param {Array<Object>} utterances 
   * @returns {Object} Full transcript ambiguity analysis
   */
  analyzeTranscript(utterances = []) {
    const analyzedUtterances = utterances.map(u => 
      this.analyzeUtterance(u.text, u.speaker, u.timestamp)
    );

    const ambiguousItems = analyzedUtterances.filter(u => u.isAmbiguous);
    const totalUtterances = analyzedUtterances.length;
    const totalFlags = analyzedUtterances.reduce((acc, u) => acc + u.detectedFlags.length, 0);

    const categoryBreakdown = {};
    const severityBreakdown = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };

    analyzedUtterances.forEach(u => {
      u.detectedFlags.forEach(flag => {
        categoryBreakdown[flag.category] = (categoryBreakdown[flag.category] || 0) + 1;
        severityBreakdown[flag.severity] = (severityBreakdown[flag.severity] || 0) + 1;
      });
    });

    const averageAmbiguityScore = totalUtterances > 0 
      ? Math.round(analyzedUtterances.reduce((acc, u) => acc + u.ambiguityScore, 0) / totalUtterances)
      : 0;

    // Overall transcript Ambiguity Index (0 - 100)
    // Reflects proportion of ambiguous stakeholder statements & severity
    const stakeholderUtterances = analyzedUtterances.filter(u => !u.text.trim().endsWith('?'));
    const ambiguousStakeholderCount = stakeholderUtterances.filter(u => u.isAmbiguous).length;
    const ambiguityRatio = stakeholderUtterances.length > 0 
      ? ambiguousStakeholderCount / stakeholderUtterances.length 
      : 0;
    
    const overallAmbiguityIndex = Math.min(100, Math.round(
      (ambiguityRatio * 60) + (Math.min(totalFlags, 10) * 4)
    ));

    return {
      totalUtterances,
      ambiguousUtterancesCount: ambiguousItems.length,
      ambiguityRatio: parseFloat(ambiguityRatio.toFixed(2)),
      overallAmbiguityIndex,
      averageAmbiguityScore,
      totalFlags,
      categoryBreakdown,
      severityBreakdown,
      utterances: analyzedUtterances,
      ambiguousItems
    };
  }

  /**
   * Derive a clarification goal based on detected ambiguity flags
   */
  deriveClarificationGoal(flags, text) {
    const categories = flags.map(f => f.category);
    if (categories.includes('UNDERSPECIFIED_NFR')) {
      if (/bias|gender|college|fair/i.test(text)) return 'Define mathematical fairness metric and demographic debiasing method.';
      if (/slow|fast|quick|response/i.test(text)) return 'Specify exact latency SLO (milliseconds/seconds) and throughput.';
      if (/secure|security|compliance/i.test(text)) return 'Specify security standards, encryption, and compliance requirements.';
    }
    if (categories.includes('INCOMPLETENESS')) {
      if (/relevance|skills|profile strength/i.test(text)) return 'Provide exact scoring formula and weightings for candidate ranking.';
      if (/structure|data/i.test(text)) return 'Define input data schemas, supported file formats, and parsing pipelines.';
      if (/mvp|soon/i.test(text)) return 'Specify MVP milestone timeframe and included features.';
    }
    if (categories.includes('VAGUENESS')) {
      if (/trust|good enough/i.test(text)) return 'Define quantitative accuracy/precision benchmark for human trust.';
      return 'Disambiguate subjective qualifiers into measurable acceptance criteria.';
    }
    return 'Clarify operational definitions and measurable acceptance thresholds.';
  }
}

module.exports = new AmbiguityDetector();
