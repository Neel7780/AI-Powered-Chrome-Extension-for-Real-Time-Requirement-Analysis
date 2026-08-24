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

    if (textLower.includes('slow') || textLower.includes('quick') || textLower.includes('fast')) {
      return {
        id: `q-${Date.now()}-perf`,
        category: 'Performance',
        triggeredBy: text,
        question: 'What is the required response latency target (e.g. p95 < 1.5s) and throughput for single vs batch processing?',
        suggestedOptions: [
          'Single resume < 1.5s (p95), batch of 100 < 30s',
          'Single resume < 500ms, batch of 500 < 2 minutes',
          'Sub-second real-time streaming response'
        ],
        severity: 'HIGH'
      };
    }

    if (textLower.includes('bias') || textLower.includes('gender') || textLower.includes('college') || textLower.includes('fair')) {
      return {
        id: `q-${Date.now()}-fair`,
        category: 'Fairness & Bias',
        triggeredBy: text,
        question: 'How should algorithmic bias be measured and mitigated (e.g. Disparate Impact Ratio in [0.80, 1.25], PII masking)?',
        suggestedOptions: [
          'Mask PII and college names before scoring + enforce Disparate Impact Ratio (DIR) in [0.80, 1.25]',
          'Demographic parity post-processing calibration',
          'Blind resume parsing with adversarial debiasing layers'
        ],
        severity: 'CRITICAL'
      };
    }

    if (textLower.includes('trust') || textLower.includes('good enough') || textLower.includes('accuracy')) {
      return {
        id: `q-${Date.now()}-acc`,
        category: 'Accuracy & Quality',
        triggeredBy: text,
        question: 'What objective accuracy metric defines "good enough for HR trust" (e.g. Precision@10 >= 85%, NDCG >= 0.82)?',
        suggestedOptions: [
          'Top-10 Precision >= 85% and NDCG@10 >= 0.82 compared to senior recruiter consensus',
          'F1-Score >= 90% across shortlisted candidates',
          'Mean Reciprocal Rank (MRR) >= 0.75 on historical test sets'
        ],
        severity: 'HIGH'
      };
    }

    if (textLower.includes('solid') || textLower.includes('impactful') || textLower.includes('relevance') || textLower.includes('fresher')) {
      return {
        id: `q-${Date.now()}-rel`,
        category: 'Scoring & Weighting',
        triggeredBy: text,
        question: 'What exact formula or weightings should balance skills, project complexity, and years of experience?',
        suggestedOptions: [
          '45% Tech stack match, 35% Project impact, 20% Relevant experience',
          '50% Skills match, 50% Verified project complexity with fresher bonus',
          'Semantic embedding cosine similarity with 3-tier company filter'
        ],
        severity: 'HIGH'
      };
    }

    if (textLower.includes('explain') || textLower.includes('why') || textLower.includes('useful')) {
      return {
        id: `q-${Date.now()}-exp`,
        category: 'Explainability',
        triggeredBy: text,
        question: 'What explainability format should be rendered for HR users (e.g., feature attribution breakdown)?',
        suggestedOptions: [
          'Structured scorecard: matched skills %, project rating, and 3 key justification bullets',
          'Interactive SHAP feature importance chart with highlighted JD keywords',
          'Side-by-side JD vs candidate qualification comparison table'
        ],
        severity: 'MEDIUM'
      };
    }

    return {
      id: `q-${Date.now()}-gen`,
      category: flags[0]?.category || 'General',
      triggeredBy: text,
      question: `Could you clarify the specific measurable criteria or threshold for "${text}"?`,
      suggestedOptions: [
        'Specify concrete numerical threshold or SLO',
        'Define structured standard or data schema',
        'Establish automated pass/fail acceptance rule'
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
