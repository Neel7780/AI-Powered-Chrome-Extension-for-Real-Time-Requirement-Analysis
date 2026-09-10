/**
 * Browser-compatible NLP Engine & Ambiguity Detector for Chrome Extension
 */

const EXT_VAGUENESS_PATTERNS = [
  {
    pattern: /\b(good enough|good|trusts it|trust)\b/gi,
    category: 'VAGUENESS',
    severity: 'HIGH',
    explanation: 'Subjective trust/quality without quantifiable acceptance criteria.'
  },
  {
    pattern: /\b(solid|impactful|strong|top tier|great|impressive)\b/gi,
    category: 'VAGUENESS',
    severity: 'MEDIUM',
    explanation: 'Subjective qualitative adjectives lacking objective assessment criteria.'
  },
  {
    pattern: /\b(mainly|good companies|solid projects|strong fresher|overall profile strength)\b/gi,
    category: 'INCOMPLETENESS',
    severity: 'HIGH',
    explanation: 'Undefined scoring formula, weights, tier normalization, and project complexity heuristics.'
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
    explanation: 'Data schema undefined; requires schema specification and parsing rules.'
  },
  {
    pattern: /\b(useful|nice to have|helpful|would be good)\b/gi,
    category: 'UNDERSPECIFIED_PRIORITY',
    severity: 'MEDIUM',
    explanation: 'Ambiguous prioritization and undefined functional scope.'
  },
  {
    pattern: /\b(avoid bias|fair|fairness|unbiased|no discrimination)\b/gi,
    category: 'UNDERSPECIFIED_NFR',
    severity: 'CRITICAL',
    explanation: 'Ethical/Fairness requirement without explicit mathematical fairness metric (e.g. Disparate Impact).'
  },
  {
    pattern: /\b(shouldn'?t be slow|fast|slow|speedy|responsive|performant)\b/gi,
    category: 'UNDERSPECIFIED_NFR',
    severity: 'HIGH',
    explanation: 'Subjective performance descriptor without quantifiable latency SLO (e.g. p95 < 1.5s).'
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
    explanation: 'Undefined milestone deadline and release acceptance criteria.'
  },
  {
    pattern: /\b(user-?friendly|easy to use|seamless|intuitive)\b/gi,
    category: 'UNVERIFIABILITY',
    severity: 'MEDIUM',
    explanation: 'Subjective usability claim with no measurable benchmark.'
  },
  {
    pattern: /\b(secure|safe|compliant|standard security)\b/gi,
    category: 'UNDERSPECIFIED_NFR',
    severity: 'CRITICAL',
    explanation: 'Broad security claim lacking explicit protocols (e.g. TLS 1.3, AES-256, SOC2).'
  }
];

class ClientNLPEngine {
  analyzeUtterance(text, speaker = 'Speaker', timestamp = '00:00') {
    if (!text || typeof text !== 'string') {
      return { text: '', speaker, timestamp, isAmbiguous: false, ambiguityScore: 0, detectedFlags: [] };
    }

    const detectedFlags = [];
    let weightedScore = 0;

    for (const rule of EXT_VAGUENESS_PATTERNS) {
      const matches = [...text.matchAll(rule.pattern)];
      for (const match of matches) {
        const phrase = match[0];
        let weight = 25;
        if (rule.severity === 'HIGH') weight = 35;
        if (rule.severity === 'CRITICAL') weight = 45;
        weightedScore += weight;

        detectedFlags.push({
          phrase,
          category: rule.category,
          severity: rule.severity,
          explanation: rule.explanation,
          range: [match.index, match.index + phrase.length]
        });
      }
    }

    const isQuestion = text.trim().endsWith('?');
    const isAmbiguous = detectedFlags.length > 0 && !isQuestion;
    const ambiguityScore = isAmbiguous ? Math.min(100, Math.round(weightedScore)) : 0;

    let candidateQuestion = null;
    if (isAmbiguous) {
      candidateQuestion = this.generateClarificationQuestion(text, detectedFlags);
    }

    return {
      text,
      speaker,
      timestamp,
      isAmbiguous,
      ambiguityScore,
      detectedFlags,
      candidateQuestion
    };
  }

  generateClarificationQuestion(text, flags) {
    const textLower = text.toLowerCase();

    if (textLower.includes('slow') || textLower.includes('quick') || textLower.includes('fast') || textLower.includes('latency')) {
      return {
        id: 'q-cat-perf',
        category: 'Performance',
        triggeredBy: text,
        question: 'What specific latency threshold (SLO) defines acceptable performance for resume parsing and ranking?',
        suggestedOptions: [
          'Single resume parsing < 1.50s (p95) and batch of 100 resumes < 30.0s',
          'Single resume < 500ms real-time latency with Redis caching',
          'Asynchronous processing with webhook notification within 5.0 seconds'
        ],
        severity: 'HIGH'
      };
    }

    if (textLower.includes('bias') || textLower.includes('gender') || textLower.includes('college') || textLower.includes('fair')) {
      return {
        id: 'q-cat-fair',
        category: 'Fairness',
        triggeredBy: text,
        question: 'What quantitative fairness metric and audit frequency should be enforced to prevent demographic bias?',
        suggestedOptions: [
          'Disparate Impact Ratio 0.80 - 1.25 across gender and college tiers with automated PII masking',
          'Demographic Parity Difference < 0.05 with blind evaluation mode',
          'Equalized Odds True Positive Rate difference < 0.04 across demographics'
        ],
        severity: 'CRITICAL'
      };
    }

    if (textLower.includes('trust') || textLower.includes('good enough') || textLower.includes('accuracy')) {
      return {
        id: 'q-cat-acc',
        category: 'Accuracy',
        triggeredBy: text,
        question: 'What objective accuracy metric defines "good enough for HR trust" (e.g. Precision@10 >= 85%, NDCG >= 0.82)?',
        suggestedOptions: [
          'Ranking Precision@10 >= 85.0% and NDCG@10 >= 0.82 on verified recruiter test set',
          'Top-5 Match Accuracy >= 90.0% with Human-in-the-Loop review',
          'F1-Score >= 0.80 across all technical skill categories'
        ],
        severity: 'HIGH'
      };
    }

    if (textLower.includes('mainly') || textLower.includes('solid') || textLower.includes('impactful') || textLower.includes('relevance') || textLower.includes('fresher') || textLower.includes('companies') || textLower.includes('formula') || textLower.includes('weight')) {
      return {
        id: 'q-cat-ranking',
        category: 'Ranking Algorithm',
        triggeredBy: text,
        question: 'How should skills, experience, project complexity, and fresher profiles be weighted?',
        suggestedOptions: [
          'Multi-factor formula: 45% skills match + 35% project complexity + 20% experience with tier normalization',
          'Equal weighting: 33.3% Skills + 33.3% Experience + 33.3% Projects',
          'Skills-first model: 60% Verified Skills + 40% Project Portfolio'
        ],
        severity: 'HIGH'
      };
    }

    if (textLower.includes('explain') || textLower.includes('why') || textLower.includes('useful') || textLower.includes('justification') || textLower.includes('breakdown')) {
      return {
        id: 'q-cat-exp',
        category: 'Explainability',
        triggeredBy: text,
        question: 'How should candidate match reasoning and scoring factors be presented to recruiters?',
        suggestedOptions: [
          'Interactive candidate scorecard showing matched skills %, project impact score, and top 3 justification reasons',
          'SHAP/LIME feature importance waterfall chart rendered in < 500ms',
          'Bullet-point summary highlighting matched job description criteria'
        ],
        severity: 'MEDIUM'
      };
    }

    return {
      id: 'q-cat-gen',
      category: flags[0]?.category || 'General Clarification',
      triggeredBy: text,
      question: 'Could you specify concrete measurable acceptance criteria and constraints for this requirement?',
      suggestedOptions: [
        'Establish quantitative SLO threshold',
        'Define pass/fail acceptance criterion',
        'Schedule stakeholder review checkpoint'
      ],
      severity: 'MEDIUM'
    };
  }
}

// Attach to window or export
if (typeof window !== 'undefined') {
  window.ClientNLPEngine = new ClientNLPEngine();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = new ClientNLPEngine();
}
