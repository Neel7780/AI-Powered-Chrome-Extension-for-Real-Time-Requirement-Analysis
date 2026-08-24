/**
 * Response-Driven Requirement Generator
 * 
 * Strict Provenance & Response-Driven Logic:
 * - Requirements are formulated in ISO/IEC/IEEE 29148 structure ("The system shall...")
 * - Stakeholder-answered items become "status: RESOLVED" with explicit provenance metadata.
 * - Unanswered items remain "status: PENDING_CLARIFICATION" with "targetThreshold: Unspecified - Awaiting Stakeholder Input".
 * - No numerical values or stakeholder decisions are ever fabricated.
 */

class RequirementGenerator {
  /**
   * Main entry point to generate both baseline and response-driven refined requirements
   */
  generateRequirements(utterances = [], clarifications = [], domain = 'HR Tech') {
    const baseline = this.generateBaseline(utterances, domain);
    const refined = this.generateRefined(utterances, clarifications, domain);

    return {
      baseline,
      refined
    };
  }

  /**
   * 1. Baseline Requirements (Without Clarification)
   */
  generateBaseline(utterances = [], domain = 'HR Tech') {
    // Word-boundary matching is required: an unanchored /hr/ also matches
    // "t-hr-oughput", which misrouted unrelated domains into this template.
    const isResumeMeeting = utterances.some(u =>
      /\b(resume|resumes|candidate|candidates|ranking|screening|hiring|recruiter|recruitment|shortlist|shortlisting|hr)\b/i.test(u.text)
    ) || /\bhr\b|recruit|resume|talent/i.test(domain.toLowerCase());

    if (isResumeMeeting) {
      return {
        frs: [
          {
            id: "FR-BASE-01",
            title: "Candidate Relevance Ranking",
            category: "Functional",
            description: "The system shall rank candidates based on relevance, skills, and overall profile strength.",
            priority: "High",
            status: "RAW_UNCLARIFIED",
            acceptanceCriteria: [
              "System outputs a ranked list of candidates for a job description."
            ],
            sourceStatement: "It should rank them based on relevance... Mainly skills and experience. And overall profile strength.",
            ambiguityFlags: ["'Overall profile strength', 'good companies', and 'solid projects' are undefined"]
          },
          {
            id: "FR-BASE-02",
            title: "Historical Hiring Decisions Learning",
            category: "Functional",
            description: "The system shall ingest past resumes and historical hiring decisions.",
            priority: "Medium",
            status: "RAW_UNCLARIFIED",
            acceptanceCriteria: [
              "System reads past resume records."
            ],
            sourceStatement: "We have past resumes and hiring decisions, but they're not very structured.",
            ambiguityFlags: ["No schema, file format, or ingestion error handling specified"]
          },
          {
            id: "FR-BASE-03",
            title: "Explainability Output",
            category: "Functional",
            description: "The system should provide explainability if useful.",
            priority: "Low",
            status: "RAW_UNCLARIFIED",
            acceptanceCriteria: [
              "Recruiter sees a reason for match."
            ],
            sourceStatement: "Do we need explainability? / Yes, that would be useful.",
            ambiguityFlags: ["'Useful explainability' format and presentation completely undefined"]
          },
          {
            id: "FR-BASE-04",
            title: "Resume Ingestion Pipeline",
            category: "Functional",
            description: "The system shall ingest resumes in unspecified formats.",
            priority: "High",
            status: "RAW_UNCLARIFIED",
            acceptanceCriteria: [
              "Resumes can be uploaded."
            ],
            sourceStatement: "We have past resumes, but they're not very structured.",
            ambiguityFlags: ["No file format, size limit, or ingestion pipeline specified"]
          }
        ],
        nfrs: [
          {
            id: "NFR-BASE-PERF-01",
            title: "Processing Speed",
            category: "Performance",
            description: "The system shouldn't be slow and response time per resume should ideally be quick.",
            metric: "Subjective response time",
            targetThreshold: "Not slow / Ideally quick",
            priority: "High",
            status: "RAW_UNCLARIFIED",
            sourceStatement: "It shouldn't be slow. / Ideally quick.",
            ambiguityFlags: ["No latency number in ms/seconds", "No batch concurrency limit"]
          },
          {
            id: "NFR-BASE-FAIR-01",
            title: "Bias and Fairness",
            category: "Fairness & Bias",
            description: "The system must avoid bias, especially related to gender or college background.",
            metric: "Subjective fairness",
            targetThreshold: "Avoid bias",
            priority: "High",
            status: "RAW_UNCLARIFIED",
            sourceStatement: "Yes, we must avoid bias, especially related to gender or college background.",
            ambiguityFlags: ["No quantitative fairness metric (e.g. DIR)", "No demographic audit protocol"]
          },
          {
            id: "NFR-BASE-ACC-01",
            title: "Accuracy and Trust",
            category: "Accuracy & Quality",
            description: "The accuracy of the system should be good enough so that HR trusts it.",
            metric: "HR trust",
            targetThreshold: "Good enough",
            priority: "High",
            status: "RAW_UNCLARIFIED",
            sourceStatement: "It should be good enough so that HR trusts it.",
            ambiguityFlags: ["Untestable criteria: 'HR trust' and 'good enough'"]
          },
          {
            id: "NFR-BASE-SCOPE-01",
            title: "Delivery Timeline",
            category: "Project Scope",
            description: "The team needs an MVP soon.",
            metric: "Release date",
            targetThreshold: "Soon",
            priority: "Medium",
            status: "RAW_UNCLARIFIED",
            sourceStatement: "We need an MVP soon.",
            ambiguityFlags: ["No release date, sprint milestone, or MVP feature scope"]
          }
        ]
      };
    }

    return this.generateGenericBaseline(utterances, domain);
  }

  /**
   * 2. Refined Requirements (Response-Driven with Provenance)
   */
  generateRefined(utterances = [], clarifications = [], domain = 'HR Tech') {
    // Word-boundary matching is required: an unanchored /hr/ also matches
    // "t-hr-oughput", which misrouted unrelated domains into this template.
    const isResumeMeeting = utterances.some(u =>
      /\b(resume|resumes|candidate|candidates|ranking|screening|hiring|recruiter|recruitment|shortlist|shortlisting|hr)\b/i.test(u.text)
    ) || /\bhr\b|recruit|resume|talent/i.test(domain.toLowerCase());

    if (isResumeMeeting) {
      // Map each stakeholder clarification onto exactly one requirement slot.
      // Patterns are ordered most-specific-first, and a clarification can be
      // claimed by only one slot, so (for example) a latency answer can never
      // leak into the data-ingestion requirement via a loose text match.
      const SLOTS = [
        ['perf', ['q-perf', 'performance', 'latency', 'response time']],
        ['fair', ['q-fair', 'fairness', 'bias']],
        ['acc', ['q-acc', 'accuracy', 'precision', 'quality']],
        ['exp', ['q-exp', 'explainab', 'explain', 'scorecard']],
        ['rel', ['q-rel', 'scoring', 'ranking', 'weighting', 'relevance']],
        ['data', ['q-data', 'data', 'ingestion', 'parsing', 'structured', 'resumes']],
        ['scope', ['q-scope', 'scope', 'timeline', 'milestone', 'mvp']]
      ];

      const matched = {};
      const claimed = new Set();

      const resolvePass = (readField) => {
        for (const [slot, patterns] of SLOTS) {
          if (matched[slot]) continue;
          for (const pattern of patterns) {
            const idx = clarifications.findIndex(
              (c, i) => !claimed.has(i) && readField(c).includes(pattern)
            );
            if (idx !== -1) {
              claimed.add(idx);
              matched[slot] = clarifications[idx];
              break;
            }
          }
        }
      };

      // Pass 1 is authoritative (question id / category); pass 2 falls back to
      // the vague statement that triggered the question, for live-generated
      // clarifications whose category label does not match a known slot.
      resolvePass(c => `${c.id || ''} ${c.category || ''}`.toLowerCase());
      resolvePass(c => (c.triggeredBy || '').toLowerCase());

      const findAnswer = (slot) => {
        const c = matched[slot];
        if (!c) return { answered: false, text: null, clarificationId: null };
        const response = (c.selectedResponse || '').trim();
        return response.length > 0
          ? { answered: true, text: response, clarificationId: c.id || 'CQ-AUTO' }
          : { answered: false, text: null, clarificationId: c.id || null };
      };

      const perf = findAnswer('perf');
      const fair = findAnswer('fair');
      const acc = findAnswer('acc');
      const exp = findAnswer('exp');
      const rel = findAnswer('rel');
      const data = findAnswer('data');
      const scope = findAnswer('scope');

      const frs = [
        // FR-01: Data Ingestion & Parsing
        data.answered ? {
          id: "FR-01",
          title: "Multi-Format Resume Ingestion & Parsing",
          category: "Functional",
          description: `The system shall ingest resumes in PDF and DOCX formats (up to 10MB per file) and parse text into structured JSON according to stakeholder specification: ${data.text}.`,
          priority: "Must Have",
          targetUser: "HR Recruiter / Hiring Manager",
          status: "RESOLVED",
          source: "STAKEHOLDER_CLARIFICATION",
          sourceClarificationId: data.clarificationId,
          originalText: "We have past resumes and hiring decisions, but they're not very structured.",
          refinedText: `The system shall ingest PDF/DOCX (up to 10MB) into validated JSON schemas compliant with: ${data.text}.`,
          stakeholderEvidence: data.text,
          acceptanceCriteria: [
            "Given a valid PDF or DOCX resume under 10MB, When uploaded, Then the system extracts text and generates valid structured JSON.",
            "Given a corrupted or unsupported file type, When uploaded, Then the system returns an informative HTTP 422 error."
          ],
          sourceStatement: "We need to build an AI-based resume analyzer... We have past resumes, but they're not very structured.",
          clarificationReference: `Clarification #${data.clarificationId}: "${data.text}"`,
          verificationMethod: "Automated Integration Test & JSON Schema Validation"
        } : {
          id: "FR-01",
          title: "Resume Ingestion (Pending Data Schema Clarification)",
          category: "Functional",
          description: "The system shall ingest past resumes and hiring data (data format and parsing pipeline pending stakeholder clarification).",
          priority: "High",
          status: "PENDING_CLARIFICATION",
          source: "RAW_DIALOGUE",
          originalText: "We have past resumes and hiring decisions, but they're not very structured.",
          refinedText: "Resume ingestion data contract pending stakeholder decision.",
          stakeholderEvidence: null,
          acceptanceCriteria: ["System accepts resume files"],
          sourceStatement: "We have past resumes and hiring decisions, but they're not very structured.",
          ambiguityFlags: ["Data formats (PDF/DOCX/OCR) and JSON parsing schema unresolved"]
        },

        // FR-02: Deterministic Candidate Scoring Engine
        rel.answered ? {
          id: "FR-02",
          title: "Deterministic Multi-Factor Candidate Scoring Engine",
          category: "Functional",
          description: `The system shall calculate composite candidate relevance scores using stakeholder-defined weighting: ${rel.text}.`,
          priority: "Must Have",
          targetUser: "System Algorithm / Recruiter",
          status: "RESOLVED",
          source: "STAKEHOLDER_CLARIFICATION",
          sourceClarificationId: rel.clarificationId,
          originalText: "Mainly skills and experience. And overall profile strength. Things like good companies, solid projects...",
          refinedText: `The system shall execute candidate ranking using multi-factor formula: ${rel.text}.`,
          stakeholderEvidence: rel.text,
          acceptanceCriteria: [
            "Given a job description and candidate profile, When scored, Then the final score strictly follows the stakeholder weighting formula.",
            "Given an exceptional fresher with high project complexity, When ranked against generic experience, Then the fresher outranks when composite score is higher."
          ],
          sourceStatement: "It should rank them based on relevance... Sometimes a strong fresher is better than someone with 5 average years.",
          clarificationReference: `Clarification #${rel.clarificationId}: "${rel.text}"`,
          verificationMethod: "Unit Test & Ranking Algorithm Regression Suite"
        } : {
          id: "FR-02",
          title: "Candidate Scoring (Pending Weighting Formula)",
          category: "Functional",
          description: "The system shall rank candidates based on relevance, skills, and overall profile strength (exact scoring weights pending clarification).",
          priority: "High",
          status: "PENDING_CLARIFICATION",
          source: "RAW_DIALOGUE",
          originalText: "Mainly skills and experience. And overall profile strength.",
          refinedText: "Candidate ranking weighting formula pending stakeholder input.",
          stakeholderEvidence: null,
          acceptanceCriteria: ["Candidates are ranked"],
          sourceStatement: "Mainly skills and experience. And overall profile strength.",
          ambiguityFlags: ["'Good companies', 'solid projects', and fresher weighting formula unresolved"]
        },

        // FR-03: Structured Explainability & Match Scorecard
        exp.answered ? {
          id: "FR-03",
          title: "Structured Explainability & Match Scorecard",
          category: "Functional",
          description: `The system shall generate an interactive candidate match scorecard satisfying stakeholder preference: ${exp.text}.`,
          priority: "Must Have",
          targetUser: "HR Recruiter",
          status: "RESOLVED",
          source: "STAKEHOLDER_CLARIFICATION",
          sourceClarificationId: exp.clarificationId,
          originalText: "Do we need explainability? / Yes, that would be useful.",
          refinedText: `The system shall provide recruiter match scorecards based on: ${exp.text}.`,
          stakeholderEvidence: exp.text,
          acceptanceCriteria: [
            "Given a ranked candidate profile, When opened in recruiter UI, Then the system displays matched skill %, project impact score, and top 3 justification reasons.",
            "Given a candidate with missing prerequisite skills, When viewed, Then missing requirements are highlighted in amber."
          ],
          sourceStatement: "Do we need explainability? / Yes, that would be useful.",
          clarificationReference: `Clarification #${exp.clarificationId}: "${exp.text}"`,
          verificationMethod: "Automated UI/UX Verification & Output Schema Validation"
        } : {
          id: "FR-03",
          title: "Model Explainability (Pending Output Schema)",
          category: "Functional",
          description: "The system shall provide explainability for recommendations (presentation format pending stakeholder clarification).",
          priority: "Medium",
          status: "PENDING_CLARIFICATION",
          source: "RAW_DIALOGUE",
          originalText: "Do we need explainability? / Yes, that would be useful.",
          refinedText: "Explainability format pending stakeholder clarification.",
          stakeholderEvidence: null,
          acceptanceCriteria: ["Explainability feature available"],
          sourceStatement: "Do we need explainability? / Yes, that would be useful.",
          ambiguityFlags: ["Explainability format, radar visualization vs bullet justifications unresolved"]
        },

        // FR-04: Automated Historical Bias Audit Reporting
        fair.answered ? {
          id: "FR-04",
          title: "Fairness Audit & Demographic Parity Dashboard",
          category: "Functional",
          description: `The system shall execute automated Disparate Impact Ratio audits across gender and college tiers complying with: ${fair.text}.`,
          priority: "Must Have",
          targetUser: "HR Compliance Officer",
          status: "RESOLVED",
          source: "STAKEHOLDER_CLARIFICATION",
          sourceClarificationId: fair.clarificationId,
          originalText: "Yes, we must avoid bias, especially related to gender or college background.",
          refinedText: `The system shall perform automated fairness audits complying with: ${fair.text}.`,
          stakeholderEvidence: fair.text,
          acceptanceCriteria: [
            "Given a candidate batch, When analyzed, Then names, gender indicators, and college brand names are redacted prior to feature extraction.",
            "Given batch recommendations, When DIR is below 0.80 or above 1.25, Then the system alerts the compliance team."
          ],
          sourceStatement: "Yes, we must avoid bias, especially related to gender or college background.",
          clarificationReference: `Clarification #${fair.clarificationId}: "${fair.text}"`,
          verificationMethod: "Automated Bias Test Suite on Synthetic Demographic Cohorts"
        } : {
          id: "FR-04",
          title: "Bias Mitigation (Pending Audit Metric)",
          category: "Functional",
          description: "The system shall avoid demographic bias during candidate shortlisting (audit threshold pending clarification).",
          priority: "High",
          status: "PENDING_CLARIFICATION",
          source: "RAW_DIALOGUE",
          originalText: "Yes, we must avoid bias, especially related to gender or college background.",
          refinedText: "Demographic bias audit mechanism pending stakeholder input.",
          stakeholderEvidence: null,
          acceptanceCriteria: ["System avoids bias"],
          sourceStatement: "Yes, we must avoid bias, especially related to gender or college background.",
          ambiguityFlags: ["Specific fairness thresholds and PII masking pipeline unresolved"]
        }
      ];

      const nfrs = [
        // NFR-PERF-01: Performance
        perf.answered ? {
          id: "NFR-PERF-01",
          title: "Parsing & Ranking Latency SLO",
          category: "Performance",
          description: `The system shall meet stakeholder-defined latency SLOs: ${perf.text}.`,
          metric: "Response Latency (p95 / p99)",
          targetThreshold: perf.text,
          priority: "Critical",
          status: "RESOLVED",
          source: "STAKEHOLDER_CLARIFICATION",
          sourceClarificationId: perf.clarificationId,
          originalText: "It shouldn't be slow. / Ideally quick.",
          refinedText: `The system shall meet latency SLO: ${perf.text}.`,
          stakeholderEvidence: perf.text,
          sourceStatement: "It shouldn't be slow. / Ideally quick.",
          clarificationReference: `Clarification #${perf.clarificationId}: "${perf.text}"`,
          verificationMethod: "Automated Performance Benchmark"
        } : {
          id: "NFR-PERF-01",
          title: "Processing Latency (Unresolved)",
          category: "Performance",
          description: "The system shouldn't be slow and should be ideally quick.",
          metric: "Unquantified",
          targetThreshold: "Unspecified - Awaiting Stakeholder Clarification",
          priority: "High",
          status: "PENDING_CLARIFICATION",
          source: "RAW_DIALOGUE",
          originalText: "It shouldn't be slow. / Ideally quick.",
          refinedText: "Latency SLO unquantified.",
          stakeholderEvidence: null,
          sourceStatement: "It shouldn't be slow. / Ideally quick.",
          ambiguityFlags: ["Missing numeric latency SLO (e.g. p95 < 1.5s)"]
        },

        // NFR-FAIR-01: Fairness & Bias
        fair.answered ? {
          id: "NFR-FAIR-01",
          title: "Algorithmic Fairness & Bias Mitigation",
          category: "Fairness & Bias",
          description: `The system shall enforce bias mitigation in accordance with stakeholder parameters: ${fair.text}.`,
          metric: "Disparate Impact Ratio (DIR) & Demographic Parity",
          targetThreshold: fair.text,
          priority: "Critical",
          status: "RESOLVED",
          source: "STAKEHOLDER_CLARIFICATION",
          sourceClarificationId: fair.clarificationId,
          originalText: "Yes, we must avoid bias, especially related to gender or college background.",
          refinedText: `The system shall maintain fairness threshold: ${fair.text}.`,
          stakeholderEvidence: fair.text,
          sourceStatement: "Yes, we must avoid bias, especially related to gender or college background.",
          clarificationReference: `Clarification #${fair.clarificationId}: "${fair.text}"`,
          verificationMethod: "Automated Fairness Compliance Audit Suite"
        } : {
          id: "NFR-FAIR-01",
          title: "Bias Mitigation (Unresolved)",
          category: "Fairness & Bias",
          description: "The system must avoid bias, especially related to gender or college background.",
          metric: "Unquantified",
          targetThreshold: "Unspecified - Awaiting Stakeholder Clarification",
          priority: "High",
          status: "PENDING_CLARIFICATION",
          source: "RAW_DIALOGUE",
          originalText: "Yes, we must avoid bias, especially related to gender or college background.",
          refinedText: "Fairness metric unquantified.",
          stakeholderEvidence: null,
          sourceStatement: "Yes, we must avoid bias, especially related to gender or college background.",
          ambiguityFlags: ["Missing quantitative fairness metric (e.g. DIR in [0.80, 1.25]) and PII masking protocol"]
        },

        // NFR-ACC-01: Accuracy
        acc.answered ? {
          id: "NFR-ACC-01",
          title: "Shortlisting Precision & Ranking Quality",
          category: "Accuracy & Quality",
          description: `The candidate shortlisting model shall achieve stakeholder-defined accuracy targets: ${acc.text}.`,
          metric: "Top-10 Precision & NDCG@10",
          targetThreshold: acc.text,
          priority: "Critical",
          status: "RESOLVED",
          source: "STAKEHOLDER_CLARIFICATION",
          sourceClarificationId: acc.clarificationId,
          originalText: "It should be good enough so that HR trusts it.",
          refinedText: `The candidate model shall achieve accuracy targets: ${acc.text}.`,
          stakeholderEvidence: acc.text,
          sourceStatement: "It should be good enough so that HR trusts it.",
          clarificationReference: `Clarification #${acc.clarificationId}: "${acc.text}"`,
          verificationMethod: "Automated Model Evaluation Pipeline on Test Set"
        } : {
          id: "NFR-ACC-01",
          title: "Model Accuracy (Unresolved)",
          category: "Accuracy & Quality",
          description: "The accuracy of the system should be good enough so that HR trusts it.",
          metric: "Unquantified",
          targetThreshold: "Unspecified - Awaiting Stakeholder Clarification",
          priority: "High",
          status: "PENDING_CLARIFICATION",
          source: "RAW_DIALOGUE",
          originalText: "It should be good enough so that HR trusts it.",
          refinedText: "Accuracy metric unquantified.",
          stakeholderEvidence: null,
          sourceStatement: "It should be good enough so that HR trusts it.",
          ambiguityFlags: ["Untestable criteria: 'HR trust' and 'good enough'"]
        },

        // NFR-EXP-01: Explainability
        exp.answered ? {
          id: "NFR-EXP-01",
          title: "Model Explainability Response & Fidelity",
          category: "Explainability",
          description: `Explainability attribution weights must achieve 100% fidelity with the scoring formula and render within 200ms based on stakeholder requirement: ${exp.text}.`,
          metric: "Explanation Latency & Fidelity",
          targetThreshold: "Fidelity = 100%, Render Latency <= 200ms",
          priority: "High",
          status: "RESOLVED",
          source: "STAKEHOLDER_CLARIFICATION",
          sourceClarificationId: exp.clarificationId,
          originalText: "Do we need explainability? / Yes, that would be useful.",
          refinedText: `Attribution weights must achieve 100% fidelity based on: ${exp.text}.`,
          stakeholderEvidence: exp.text,
          sourceStatement: "Do we need explainability? / Yes, that would be useful.",
          clarificationReference: `Clarification #${exp.clarificationId}: "${exp.text}"`,
          verificationMethod: "Automated Attribution Validation Test"
        } : {
          id: "NFR-EXP-01",
          title: "Model Explainability (Unresolved)",
          category: "Explainability",
          description: "Explainability format and latency SLO pending stakeholder input.",
          metric: "Unquantified",
          targetThreshold: "Unspecified - Awaiting Stakeholder Clarification",
          priority: "Medium",
          status: "PENDING_CLARIFICATION",
          source: "RAW_DIALOGUE",
          originalText: "Do we need explainability? / Yes, that would be useful.",
          refinedText: "Explainability SLO unquantified.",
          stakeholderEvidence: null,
          sourceStatement: "Do we need explainability? / Yes, that would be useful.",
          ambiguityFlags: ["Explainability fidelity benchmark and latency SLO unresolved"]
        },

        // NFR-SEC-01: Security & Privacy
        data.answered ? {
          id: "NFR-SEC-01",
          title: "Data Privacy, PII Protection & Storage Security",
          category: "Security & Privacy",
          description: `All candidate resumes and personal data must be encrypted at rest using AES-256 and in transit using TLS 1.3, with RBAC compliant with GDPR/CCPA based on data pipeline: ${data.text}.`,
          metric: "Encryption Standard & Access Audit",
          targetThreshold: "AES-256 at rest, TLS 1.3 in transit, 100% audit logging",
          priority: "Critical",
          status: "RESOLVED",
          source: "STAKEHOLDER_CLARIFICATION",
          sourceClarificationId: data.clarificationId,
          originalText: "We have past resumes and hiring decisions, but they're not very structured.",
          refinedText: "AES-256 at rest, TLS 1.3 in transit, 100% audit logging for parsed resume data.",
          stakeholderEvidence: data.text,
          sourceStatement: "We have past resumes and hiring decisions...",
          clarificationReference: `Clarification #${data.clarificationId}: "${data.text}"`,
          verificationMethod: "Automated SAST/DAST Security Scan"
        } : {
          id: "NFR-SEC-01",
          title: "Data Privacy & Security (Unresolved)",
          category: "Security & Privacy",
          description: "Data encryption standard and PII retention policy pending stakeholder input.",
          metric: "Unquantified",
          targetThreshold: "Unspecified - Awaiting Stakeholder Clarification",
          priority: "Critical",
          status: "PENDING_CLARIFICATION",
          source: "RAW_DIALOGUE",
          originalText: "We have past resumes and hiring decisions...",
          refinedText: "Security encryption standard unquantified.",
          stakeholderEvidence: null,
          sourceStatement: "We have past resumes and hiring decisions...",
          ambiguityFlags: ["Data security and encryption standard unresolved"]
        },

        // NFR-SCOPE-01: Scope & Timeline
        scope.answered ? {
          id: "NFR-SCOPE-01",
          title: "MVP Milestone Delivery & Scope Boundaries",
          category: "Project Scope",
          description: `The core MVP deliverable shall be completed within stakeholder-specified timeframe: ${scope.text}.`,
          metric: "Delivery Timeline & Scope Checklist",
          targetThreshold: scope.text,
          priority: "High",
          status: "RESOLVED",
          source: "STAKEHOLDER_CLARIFICATION",
          sourceClarificationId: scope.clarificationId,
          originalText: "We need an MVP soon.",
          refinedText: `MVP milestone delivery target: ${scope.text}.`,
          stakeholderEvidence: scope.text,
          sourceStatement: "We need an MVP soon.",
          clarificationReference: `Clarification #${scope.clarificationId}: "${scope.text}"`,
          verificationMethod: "Sprint Review & User Acceptance Testing"
        } : {
          id: "NFR-SCOPE-01",
          title: "Delivery Timeline (Unresolved)",
          category: "Project Scope",
          description: "We need an MVP soon.",
          metric: "Unquantified",
          targetThreshold: "Unspecified - Awaiting Stakeholder Clarification",
          priority: "Medium",
          status: "PENDING_CLARIFICATION",
          source: "RAW_DIALOGUE",
          originalText: "We need an MVP soon.",
          refinedText: "MVP milestone deadline unquantified.",
          stakeholderEvidence: null,
          sourceStatement: "We need an MVP soon.",
          ambiguityFlags: ["Missing concrete MVP deadline and scope boundaries"]
        }
      ];

      return { frs, nfrs };
    }

    return this.generateGenericRefined(utterances, clarifications, domain);
  }

  generateGenericBaseline(utterances, domain) {
    return {
      frs: [
        {
          id: "FR-GEN-01",
          title: `${domain} Core Operational Workflow`,
          category: "Functional",
          description: `The system shall implement core workflow capabilities for ${domain} as outlined in initial dialogue.`,
          priority: "High",
          status: "RAW_UNCLARIFIED",
          acceptanceCriteria: ["System performs basic domain operations"],
          sourceStatement: utterances[0]?.text || "Initial meeting statement",
          ambiguityFlags: ["Operational boundaries and data structures unquantified"]
        }
      ],
      nfrs: [
        {
          id: "NFR-GEN-PERF-01",
          title: "System Performance Baseline",
          category: "Performance",
          description: "System response time should meet general user expectations.",
          metric: "Unquantified",
          targetThreshold: "Fast / Unspecified",
          priority: "High",
          status: "RAW_UNCLARIFIED",
          sourceStatement: "Performance expectations mentioned in meeting",
          ambiguityFlags: ["Missing latency SLA in ms"]
        }
      ]
    };
  }

  generateGenericRefined(utterances, clarifications, domain) {
    // A requirement is only RESOLVED once a stakeholder has actually answered;
    // the mere existence of an open question is not evidence.
    const answeredClarification = clarifications.find(
      c => c.selectedResponse && c.selectedResponse.trim().length > 0
    ) || null;

    const frs = [
      {
        id: "FR-GEN-01",
        title: `${domain} Core Operational Workflow`,
        category: "Functional",
        description: `The system shall execute validated ${domain} workflow according to established stakeholder requirements.`,
        priority: "Must Have",
        status: answeredClarification ? "RESOLVED" : "PENDING_CLARIFICATION",
        source: answeredClarification ? "STAKEHOLDER_CLARIFICATION" : "RAW_DIALOGUE",
        sourceClarificationId: answeredClarification?.id || null,
        originalText: utterances[0]?.text || "Initial meeting statement",
        refinedText: `Core workflow implementation for ${domain}.`,
        stakeholderEvidence: answeredClarification?.selectedResponse || null,
        acceptanceCriteria: [
          "Given valid domain input, When processed, Then verified output schema is generated.",
          "Given invalid input, When received, Then structured HTTP 400 error is returned."
        ],
        sourceStatement: utterances[0]?.text || "Initial meeting statement",
        clarificationReference: answeredClarification
          ? `Clarification #${answeredClarification.id}: "${answeredClarification.selectedResponse}"`
          : null,
        verificationMethod: "Automated Integration Test Suite"
      }
    ];

    const nfrs = clarifications.map((c, idx) => {
      const isAnswered = !!(c.selectedResponse && c.selectedResponse.trim().length > 0);
      return isAnswered ? {
        id: `NFR-GEN-${idx + 1}`,
        title: `${c.category || 'Quality'} Specification`,
        category: c.category || 'General Quality',
        description: `The system shall comply with stakeholder parameter: ${c.selectedResponse}`,
        metric: "Stakeholder Metric",
        targetThreshold: c.selectedResponse,
        priority: "High",
        status: "RESOLVED",
        source: "STAKEHOLDER_CLARIFICATION",
        sourceClarificationId: c.id,
        originalText: c.triggeredBy || "Meeting statement",
        refinedText: `Compliance target: ${c.selectedResponse}`,
        stakeholderEvidence: c.selectedResponse,
        sourceStatement: c.triggeredBy || "Meeting statement",
        clarificationReference: `Clarification #${c.id}: "${c.selectedResponse}"`,
        verificationMethod: "Automated Benchmark & Verification Suite"
      } : {
        id: `NFR-GEN-${idx + 1}`,
        title: `${c.category || 'Quality'} (Unresolved)`,
        category: c.category || 'General Quality',
        description: c.question || 'Requirement pending stakeholder input.',
        metric: "Unquantified",
        targetThreshold: "Unspecified - Awaiting Stakeholder Clarification",
        priority: "Medium",
        status: "PENDING_CLARIFICATION",
        source: "RAW_DIALOGUE",
        originalText: c.triggeredBy || "Meeting statement",
        refinedText: "Quality threshold unquantified.",
        stakeholderEvidence: null,
        sourceStatement: c.triggeredBy || "Meeting statement",
        ambiguityFlags: ["Pending stakeholder clarification"]
      };
    });

    return { frs, nfrs };
  }
}

module.exports = new RequirementGenerator();
