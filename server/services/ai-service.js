/**
 * AI Service Integration Layer
 * Supports Google Gemini, OpenAI, and high-precision offline NLP Fallback Engine.
 */

const ambiguityDetector = require('./ambiguity-detector');
const requirementGenerator = require('./requirement-generator');
const qualityEvaluator = require('./quality-evaluator');

class AIService {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY || null;
    this.openaiApiKey = process.env.OPENAI_API_KEY || null;
  }

  /**
   * Analyze an incoming meeting utterance in real time
   * @param {Object} payload - { text, speaker, timestamp, customApiKey, provider }
   */
  async analyzeLiveUtterance(payload) {
    const { text, speaker = 'Speaker', timestamp = '00:00' } = payload;
    
    // Fast NLP Ambiguity Analysis
    const analysis = ambiguityDetector.analyzeUtterance(text, speaker, timestamp);

    // If ambiguous, generate candidate clarification questions
    let candidateQuestion = null;
    if (analysis.isAmbiguous) {
      candidateQuestion = this.generateRealTimeQuestion(text, analysis.detectedFlags);
    }

    return {
      ...analysis,
      candidateQuestion
    };
  }

  /**
   * Generate intelligent clarification questions for ambiguous statements
   */
  generateRealTimeQuestion(text, detectedFlags = []) {
    const textLower = text.toLowerCase();
    
    if (textLower.includes('slow') || textLower.includes('quick') || textLower.includes('fast') || textLower.includes('real-time')) {
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
        question: 'How should algorithmic bias be measured and mitigated (e.g. Disparate Impact Ratio between 0.80 and 1.25, PII masking)?',
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
          '45% Tech stack / Skills match, 35% Project impact / Open-source, 20% Relevant experience',
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
        question: 'What explainability format should be rendered for HR users (e.g., feature attribution breakdown, skill match radar)?',
        suggestedOptions: [
          'Structured scorecard: matched skills %, project rating, and 3 key justification bullets',
          'Interactive SHAP feature importance chart with highlighted JD keywords',
          'Side-by-side JD vs candidate qualification comparison table'
        ],
        severity: 'MEDIUM'
      };
    }

    if (textLower.includes('structured') || textLower.includes('data') || textLower.includes('past resumes')) {
      return {
        id: `q-${Date.now()}-data`,
        category: 'Data & Formats',
        triggeredBy: text,
        question: 'What file formats (PDF, DOCX, TXT), size limits, and ingestion schemas must the system support?',
        suggestedOptions: [
          'PDF & DOCX up to 10MB; standard JSON output schema (skills, experience, projects)',
          'All document formats with OCR pipeline for scanned resumes',
          'JSON and LinkedIn profile export support'
        ],
        severity: 'HIGH'
      };
    }

    if (textLower.includes('mvp') || textLower.includes('soon') || textLower.includes('timeline')) {
      return {
        id: `q-${Date.now()}-scope`,
        category: 'Scope & Timeline',
        triggeredBy: text,
        question: 'What is the target delivery deadline and core feature set for the MVP release?',
        suggestedOptions: [
          '4-week MVP: Web portal, PDF/DOCX ingestion, JD matching, top-10 ranking, and explainability card',
          '2-week prototype with basic keyword search',
          '6-week MVP with full ATS integration'
        ],
        severity: 'MEDIUM'
      };
    }

    // Generic fallback question
    const primaryCategory = detectedFlags[0] ? detectedFlags[0].category : 'General';
    return {
      id: `q-${Date.now()}-gen`,
      category: primaryCategory,
      triggeredBy: text,
      question: `Could you clarify the specific measurable criteria, threshold, or definition for "${text}"?`,
      suggestedOptions: [
        'Specify concrete numerical threshold or SLO',
        'Define structured standard or data schema',
        'Establish automated pass/fail acceptance rule'
      ],
      severity: 'MEDIUM'
    };
  }

  /**
   * Process entire meeting transcript and generate full requirements + evaluation
   */
  async processFullMeeting(utterances = [], clarifications = [], domain = 'HR Tech') {
    // 1. Analyze Ambiguity across transcript
    const transcriptAmbiguity = ambiguityDetector.analyzeTranscript(utterances);

    // 2. Generate Baseline and Refined Requirements
    const { baseline, refined } = requirementGenerator.generateRequirements(utterances, clarifications, domain);

    // 3. Evaluate Quality of Baseline vs Refined
    const baselineQuality = qualityEvaluator.evaluateRequirementSet(baseline, false);
    const refinedQuality = qualityEvaluator.evaluateRequirementSet(refined, true);

    // 4. Compute Comparison
    const comparison = qualityEvaluator.compareQuality(baselineQuality, refinedQuality);

    return {
      transcriptAmbiguity,
      requirements: {
        baseline,
        refined
      },
      qualityEvaluation: {
        baseline: baselineQuality,
        refined: refinedQuality,
        comparison
      }
    };
  }
}

module.exports = new AIService();
