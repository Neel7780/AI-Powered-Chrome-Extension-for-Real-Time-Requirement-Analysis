/**
 * Real AI Service Layer powered by Google Gemini (@google/generative-ai)
 * with robust offline rule-based NLP Fallback Engine.
 * 
 * Implements:
 * - Real-time contextual ambiguity detection & question generation
 * - Response-driven requirement refinement strictly using stakeholder evidence
 * - Provenance metadata and traceability tracking
 * - Conflict detection for contradictory stakeholder answers
 * - Safe structured logging (without exposing secrets or private payloads)
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const ambiguityDetector = require('./ambiguity-detector');
const requirementGenerator = require('./requirement-generator');

class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || null;
    this.modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    this.initGemini();
  }

  initGemini(customKey = null) {
    const key = customKey || this.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (key) {
      this.genAI = new GoogleGenerativeAI(key);
      this.model = this.genAI.getGenerativeModel({
        model: this.modelName,
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

    const startTime = Date.now();

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
  "suggestedClarificationTarget": string (e.g. "Performance (Latency)", "Fairness (Bias Mitigation)", "Accuracy (Precision SLO)"),
  "candidateQuestion": {
    "id": "q-${Date.now()}",
    "category": string,
    "triggeredBy": "${text.replace(/"/g, '\\"')}",
    "question": string (concise, targeted question to establish quantitative criteria),
    "suggestedOptions": [string, string, string] (3 concrete, verifiable options e.g. ["< 1.5s (p95)", "< 3.0s", "Custom"]),
    "severity": "MEDIUM" | "HIGH" | "CRITICAL",
    "lifecycleStatus": "OPEN"
  }
}
If the statement is NOT ambiguous (or is a question), return isAmbiguous: false, ambiguityScore: 0, detectedFlags: [], candidateQuestion: null.`;

        const response = await this.model.generateContent(prompt);
        const responseText = response.response.text();
        const parsed = JSON.parse(responseText);

        if (parsed && typeof parsed.isAmbiguous === 'boolean') {
          const latencyMs = Date.now() - startTime;
          console.log(`[AI] provider=gemini model=${this.modelName} operation=ambiguity_detection latency=${latencyMs}ms status=success`);
          return {
            ...parsed,
            aiSource: this.modelName
          };
        }
      } catch (err) {
        console.warn(`[AI] provider=gemini operation=ambiguity_detection error="${err.message}" -> falling back to rule engine`);
      }
    }

    // Fallback to local rule engine
    const analysis = ambiguityDetector.analyzeUtterance(text, speaker, timestamp);
    let candidateQuestion = null;
    if (analysis.isAmbiguous) {
      candidateQuestion = this.generateFallbackQuestion(text, analysis.detectedFlags);
    }

    const latencyMs = Date.now() - startTime;
    console.log(`[AI] provider=rule_engine operation=ambiguity_detection latency=${latencyMs}ms status=fallback`);

    return {
      ...analysis,
      candidateQuestion,
      aiSource: 'rule-based-nlp-fallback'
    };
  }

  /**
   * Conflict Detection for Stakeholder Clarification Answers
   * Flags when a new stakeholder response conflicts with a previously given response
   */
  detectClarificationConflict(existingClarifications = [], updatedClarificationId, newAnswer) {
    if (!newAnswer || newAnswer.trim().length === 0) return { hasConflict: false };

    const target = existingClarifications.find(c => c.id === updatedClarificationId);
    if (!target) return { hasConflict: false };

    const existingAnswer = target.selectedResponse;
    if (existingAnswer && existingAnswer.trim().length > 0 && existingAnswer.trim() !== newAnswer.trim()) {
      return {
        hasConflict: true,
        clarificationId: updatedClarificationId,
        category: target.category,
        previousAnswer: existingAnswer.trim(),
        newAnswer: newAnswer.trim(),
        message: `Warning: Updated response "${newAnswer}" conflicts with previously specified "${existingAnswer}" for ${target.category}. Requirement will adopt latest confirmed input.`
      };
    }

    return { hasConflict: false };
  }

  /**
   * Duplicate Question Suppression
   */
  filterDuplicateClarifications(existingQuestions = [], newQuestion) {
    if (!newQuestion) return null;
    const exists = existingQuestions.some(eq => 
      eq.id === newQuestion.id || 
      (eq.category === newQuestion.category && eq.triggeredBy === newQuestion.triggeredBy) ||
      (eq.question && eq.question.toLowerCase() === newQuestion.question.toLowerCase())
    );
    return exists ? null : newQuestion;
  }

  /**
   * Synthesize baseline and response-driven refined requirements
   */
  async generateRequirementsWithAI(utterances = [], clarifications = [], domain = 'HR Tech') {
    // Always execute response-driven requirement generator to enforce strictly stakeholder-provenanced rules
    const result = requirementGenerator.generateRequirements(utterances, clarifications, domain);
    return result;
  }

  generateFallbackQuestion(text, detectedFlags) {
    const lower = text.toLowerCase();
    const id = `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    if (/slow|quick|fast|latency|speed/i.test(lower)) {
      return {
        id,
        category: 'Performance',
        triggeredBy: text,
        question: 'What is the required end-to-end response time / latency target for processing a single resume and batch uploads?',
        suggestedOptions: [
          'Single resume < 1.5s (p95); Batch of 100 < 30s',
          'Single resume < 3.0s (p95); Batch of 100 < 60s',
          'Single resume < 500ms real-time'
        ],
        severity: 'HIGH',
        lifecycleStatus: 'OPEN'
      };
    }

    if (/bias|fairness|gender|college|background/i.test(lower)) {
      return {
        id,
        category: 'Fairness & Bias',
        triggeredBy: text,
        question: 'What specific quantitative metric and demographic audit standard should govern bias mitigation across gender and colleges?',
        suggestedOptions: [
          'Disparate Impact Ratio 0.80 - 1.25 across gender & tier-1/2/3 colleges with PII redaction',
          'Demographic Parity Difference < 5% with automated PII masking',
          'Equal Opportunity Difference < 0.05 across protected groups'
        ],
        severity: 'CRITICAL',
        lifecycleStatus: 'OPEN'
      };
    }

    if (/trust|good enough|accuracy|reliable/i.test(lower)) {
      return {
        id,
        category: 'Accuracy & Quality',
        triggeredBy: text,
        question: 'What objective accuracy metric defines "good enough for HR trust" (e.g. Precision@10 >= 85%, NDCG >= 0.82)?',
        suggestedOptions: [
          'Top-10 Precision >= 85% and NDCG@10 >= 0.82 against senior human recruiter consensus test set',
          'Top-5 Match Recall >= 90% against validated historical hiring outcomes',
          'Candidate ranking ranking agreement with HR panel >= 80% Cohen Kappa'
        ],
        severity: 'HIGH',
        lifecycleStatus: 'OPEN'
      };
    }

    if (/explain|scorecard|why|reason/i.test(lower)) {
      return {
        id,
        category: 'Explainability',
        triggeredBy: text,
        question: 'How should candidate ranking explainability and skill matching scorecards be presented to HR recruiters?',
        suggestedOptions: [
          'Interactive scorecard showing matched skill %, project impact score, and top 3 positive/negative bullet reasons',
          'Visual radar chart comparing candidate profile against job description benchmarks',
          'Textual explanation summary with key qualification highlights'
        ],
        severity: 'MEDIUM',
        lifecycleStatus: 'OPEN'
      };
    }

    if (/solid|good companies|impactful|strong fresher|relevance/i.test(lower)) {
      return {
        id,
        category: 'Scoring Algorithm',
        triggeredBy: text,
        question: 'What weighting formula should calculate overall profile strength and rank candidates?',
        suggestedOptions: [
          '45% Skills & Technical Match + 35% Project Complexity & Impact + 20% Relevant Experience',
          '50% Verified Skills + 30% Past Company / Domain Relevance + 20% Education & Projects',
          'Equal weighting across Skills, Experience, and Project Impact'
        ],
        severity: 'HIGH',
        lifecycleStatus: 'OPEN'
      };
    }

    if (/soon|mvp|timeline|deadline/i.test(lower)) {
      return {
        id,
        category: 'Project Scope',
        triggeredBy: text,
        question: 'What is the target MVP delivery timeframe and essential scope boundary for initial release?',
        suggestedOptions: [
          '4-week MVP milestone covering PDF/DOCX ingestion, JD matching, top-10 ranking, and scorecard',
          '6-week MVP milestone with full ATS integration and bias audit dashboard',
          '2-week prototype with basic resume text extraction and skill keyword matching'
        ],
        severity: 'MEDIUM',
        lifecycleStatus: 'OPEN'
      };
    }

    return {
      id,
      category: 'Requirement Clarification',
      triggeredBy: text,
      question: `Please clarify the quantitative criteria or operational boundaries for: "${text}"`,
      suggestedOptions: [
        'Establish quantitative benchmark and acceptance criteria',
        'Defer to phase 2 backlog specification',
        'Use standard industry baseline standard'
      ],
      severity: 'MEDIUM',
      lifecycleStatus: 'OPEN'
    };
  }
}

module.exports = new AIService();
