/**
 * Real AI Service Layer powered by Google Gemini (@google/generative-ai)
 * with robust offline rule-based NLP Fallback Engine.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const ambiguityDetector = require('./ambiguity-detector');
const qualityEvaluator = require('./quality-evaluator');

class AIService {
  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || null;
    this.initGemini();
  }

  initGemini(customKey = null) {
    const key = customKey || this.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (key) {
      this.genAI = new GoogleGenerativeAI(key);
      // Use gemini-2.5-flash (standard in recent labs) with fallback to gemini-1.5-flash
      this.model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      });
      this.hasActiveAI = true;
    } else {
      this.genAI = null;
      this.model = null;
      this.hasActiveAI = false;
    }
  }

  /**
   * Real-time Utterance Ambiguity Analysis using Gemini LLM
   */
  async analyzeLiveUtterance(payload) {
    const { text, speaker = 'Speaker', timestamp = '00:00', customApiKey } = payload;
    if (customApiKey) this.initGemini(customApiKey);

    // If Gemini is available, query Gemini LLM
    if (this.hasActiveAI && this.model) {
      try {
        const prompt = `You are a Senior Requirements Engineer and NLP Analyst analyzing live meeting transcripts for Software Requirements Engineering (ISO/IEC/IEEE 29148).
Analyze this live statement from "${speaker}": "${text}".

Detect any lexical vagueness, subjective adjectives ("good enough", "fast", "solid", "trust", "strong", "impactful", "quick", "soon"), missing operational metrics, untestable criteria, or underspecified Non-Functional Requirements (NFRs like Latency, Fairness, Accuracy, Security).

Return a strict JSON object with this exact structure:
{
  "text": "${text.replace(/"/g, '\\"')}",
  "speaker": "${speaker}",
  "timestamp": "${timestamp}",
  "isAmbiguous": boolean (true if statement contains unquantified claims or fuzzy adjectives and is NOT a question),
  "ambiguityScore": number (0 to 100),
  "detectedFlags": [
    {
      "phrase": string (exact substring matched),
      "category": "VAGUENESS" | "INCOMPLETENESS" | "UNDERSPECIFIED_NFR" | "UNVERIFIABILITY",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "explanation": string
    }
  ],
  "suggestedClarificationTarget": string or null,
  "candidateQuestion": {
    "id": "q-${Date.now()}",
    "category": string (e.g. "Performance", "Fairness & Bias", "Accuracy", "Explainability", "Data Schema", "Scope"),
    "triggeredBy": "${text.replace(/"/g, '\\"')}",
    "question": string (precise engineering question asking for verifiable metric or formula),
    "suggestedOptions": [string, string, string] (3 distinct quantifiable SLO/metric choices),
    "severity": "HIGH" | "CRITICAL"
  } (or null if isAmbiguous is false)
}`;

        const result = await this.model.generateContent(prompt);
        const responseText = result.response.text();
        const parsed = JSON.parse(responseText);

        if (parsed && typeof parsed.isAmbiguous === 'boolean') {
          return {
            ...parsed,
            aiSource: 'gemini-2.5-flash'
          };
        }
      } catch (err) {
        console.warn('[AIService] Gemini API call fallback to rule engine:', err.message);
      }
    }

    // Fallback to local rule engine
    const analysis = ambiguityDetector.analyzeUtterance(text, speaker, timestamp);
    let candidateQuestion = null;
    if (analysis.isAmbiguous) {
      candidateQuestion = this.generateFallbackQuestion(text, analysis.detectedFlags);
    }

    return {
      ...analysis,
      candidateQuestion,
      aiSource: 'rule-based-nlp-fallback'
    };
  }

  /**
   * Synthesize baseline and response-driven refined requirements using Gemini LLM
   */
  async generateRequirementsWithAI(utterances = [], clarifications = [], domain = 'HR Tech') {
    if (this.hasActiveAI && this.model && utterances.length > 0) {
      try {
        const answeredClarifications = clarifications.filter(c => c.selectedResponse && c.selectedResponse.trim().length > 0);
        const unansweredClarifications = clarifications.filter(c => !c.selectedResponse || c.selectedResponse.trim().length === 0);

        const prompt = `You are a Principal Software Requirements Engineer following ISO/IEC/IEEE 29148.
Given this meeting transcript and stakeholder clarifications:

TRANSCRIPT:
${utterances.map(u => `${u.speaker}: ${u.text}`).join('\n')}

STAKEHOLDER CLARIFICATIONS LOG:
- Explicitly Answered by Stakeholder:
${answeredClarifications.length > 0 ? answeredClarifications.map(c => `[${c.category}] Q: ${c.question} -> Stakeholder Answer: "${c.selectedResponse}" (Triggered by: "${c.triggeredBy}")`).join('\n') : 'NONE (Stakeholder has not answered any clarifications yet)'}

- Unanswered Clarifications (Pending):
${unansweredClarifications.length > 0 ? unansweredClarifications.map(c => `[${c.category}] Q: ${c.question} -> UNRESOLVED (Triggered by: "${c.triggeredBy}")`).join('\n') : 'NONE'}

TASK:
Generate two complete requirement sets:
1. "baseline" (Without Clarification): Raw, unclarified requirements derived directly from stakeholder quotes, keeping subjective qualifiers and noting ambiguity flags.
2. "refined" (With Clarification):
   CRITICAL RULE:
   - For aspects where the stakeholder EXPLICITLY answered: Formulate rigorous, unambiguous IEEE 830 / ISO 29148 requirements with concrete numerical SLOs, Given-When-Then acceptance criteria, and explicit formulas provided by the stakeholder.
   - For aspects where the stakeholder DID NOT answer: Do NOT invent arbitrary metrics. Mark them with status: "PENDING_CLARIFICATION", targetThreshold: "Unspecified - Awaiting Stakeholder Input", and keep ambiguity flags present.

Return a strict JSON object:
{
  "baseline": {
    "frs": [
      {
        "id": "FR-BASE-01",
        "title": string,
        "category": "Functional",
        "description": string,
        "priority": "High" | "Medium",
        "acceptanceCriteria": [string],
        "sourceStatement": string,
        "ambiguityFlags": [string]
      }
    ],
    "nfrs": [
      {
        "id": "NFR-BASE-PERF-01",
        "title": string,
        "category": "Performance" | "Fairness & Bias" | "Accuracy & Quality" | "Security & Privacy" | "Explainability" | "Project Scope",
        "description": string,
        "metric": string,
        "targetThreshold": string,
        "priority": "High" | "Medium",
        "sourceStatement": string,
        "ambiguityFlags": [string]
      }
    ]
  },
  "refined": {
    "frs": [
      {
        "id": "FR-01",
        "title": string,
        "category": "Functional",
        "description": string,
        "priority": "Must Have" | "Should Have" | "Could Have",
        "targetUser": string,
        "acceptanceCriteria": [string],
        "sourceStatement": string,
        "clarificationReference": string,
        "verificationMethod": string,
        "status": "RESOLVED" | "PENDING_CLARIFICATION"
      }
    ],
    "nfrs": [
      {
        "id": "NFR-PERF-01",
        "title": string,
        "category": "Performance" | "Fairness & Bias" | "Accuracy & Quality" | "Security & Privacy" | "Explainability" | "Project Scope",
        "description": string,
        "metric": string,
        "targetThreshold": string,
        "priority": "Critical" | "High" | "Medium",
        "sourceStatement": string,
        "clarificationReference": string,
        "verificationMethod": string,
        "status": "RESOLVED" | "PENDING_CLARIFICATION"
      }
    ]
  }
}`;

        const result = await this.model.generateContent(prompt);
        const responseText = result.response.text();
        const parsed = JSON.parse(responseText);

        if (parsed.baseline && parsed.refined) {
          return {
            baseline: parsed.baseline,
            refined: parsed.refined,
            metadata: {
              domain,
              utteranceCount: utterances.length,
              clarificationCount: clarifications.length,
              answeredClarificationsCount: answeredClarifications.length,
              aiSource: 'gemini-2.5-flash',
              generatedAt: new Date().toISOString()
            }
          };
        }
      } catch (err) {
        console.warn('[AIService] Gemini requirements generation fallback:', err.message);
      }
    }

    // Fallback to response-driven requirement generator
    const requirementGenerator = require('./requirement-generator');
    return requirementGenerator.generateRequirements(utterances, clarifications, domain);
  }

  generateFallbackQuestion(text, detectedFlags = []) {
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
}

module.exports = new AIService();
