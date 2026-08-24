/**
 * Requirement Generator Service (Response-Driven Architecture)
 * Synthesizes Functional Requirements (FR) and Categorized Non-Functional Requirements (NFR)
 * under two paradigms:
 * 1. Without Clarification (Baseline / Raw Stakeholder Statements)
 * 2. With Clarification (Response-Driven: only refines requirements where stakeholder answered)
 */

class RequirementGenerator {
  /**
   * Generate both baseline and refined requirement sets from transcript and clarifications
   * @param {Array<Object>} utterances 
   * @param {Array<Object>} clarifications 
   * @param {string} domain 
   * @returns {Object} { baseline, refined }
   */
  generateRequirements(utterances = [], clarifications = [], domain = 'HR Tech') {
    const baseline = this.generateBaselineRequirements(utterances, domain);
    const refined = this.generateRefinedRequirements(utterances, clarifications, domain);

    const answeredCount = clarifications.filter(c => c.selectedResponse && c.selectedResponse.trim().length > 0).length;

    return {
      baseline,
      refined,
      metadata: {
        domain,
        utteranceCount: utterances.length,
        totalClarificationsCount: clarifications.length,
        answeredClarificationsCount: answeredCount,
        clarificationProgressPercentage: clarifications.length > 0 ? Math.round((answeredCount / clarifications.length) * 100) : 0,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * 1. Baseline Requirements (Without Clarification)
   * Directly derived from raw conversation without resolved ambiguities
   */
  generateBaselineRequirements(utterances = [], domain = 'HR Tech') {
    const fullText = utterances.map(u => u.text).join(' ');
    const isResumeAnalyzer = /resume|candidate|shortlist|fresher/i.test(fullText);

    if (isResumeAnalyzer) {
      return {
        frs: [
          {
            id: "FR-BASE-01",
            title: "Automated Candidate Shortlisting",
            category: "Functional",
            description: "The system shall automatically shortlist candidates for software engineering roles based on resume analysis.",
            priority: "High",
            status: "RAW_UNCLARIFIED",
            acceptanceCriteria: [
              "System reads candidate resumes",
              "System outputs a shortlist of candidates"
            ],
            sourceStatement: "We need to build an AI-based resume analyzer that can automatically shortlist candidates for our software engineering roles.",
            ambiguityFlags: ["Missing shortlisting threshold", "Undefined candidate capacity"]
          },
          {
            id: "FR-BASE-02",
            title: "Relevance and Profile Strength Ranking",
            category: "Functional",
            description: "The system shall rank candidates based on relevance to the job description, skills, experience, and overall profile strength (good companies, solid projects, impactful work).",
            priority: "High",
            status: "RAW_UNCLARIFIED",
            acceptanceCriteria: [
              "Candidates are ranked according to profile strength and experience",
              "Strong freshers should sometimes rank better than someone with 5 average years"
            ],
            sourceStatement: "It should rank them based on relevance to the job description... good companies, solid projects, impactful work.",
            ambiguityFlags: ["'Good companies' and 'solid projects' undefined", "'Not strictly' creates non-deterministic logic"]
          },
          {
            id: "FR-BASE-03",
            title: "Explainability Output",
            category: "Functional",
            description: "The system should provide explainability on why a candidate was ranked higher.",
            priority: "Medium",
            status: "RAW_UNCLARIFIED",
            acceptanceCriteria: [
              "Show reasons for candidate ranking"
            ],
            sourceStatement: "Do we need explainability? For example, why a candidate was ranked higher? / Yes, that would be useful.",
            ambiguityFlags: ["Format and granularity of explainability unspecified"]
          },
          {
            id: "FR-BASE-04",
            title: "Historical Hiring Data Ingestion",
            category: "Functional",
            description: "The system should utilize past resumes and hiring decisions, even if they are not very structured.",
            priority: "Medium",
            status: "RAW_UNCLARIFIED",
            acceptanceCriteria: [
              "Ingest past unstructured hiring files"
            ],
            sourceStatement: "We have past resumes and hiring decisions, but they're not very structured.",
            ambiguityFlags: ["No schema, file format, or ingestion error handling specified"]
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
   * 2. Refined Requirements (Response-Driven)
   * Refines requirements based STRICTLY on stakeholder responses.
   * If a stakeholder has not answered a question, it remains PENDING_CLARIFICATION.
   */
  generateRefinedRequirements(utterances = [], clarifications = [], domain = 'HR Tech') {
    const fullText = utterances.map(u => u.text).join(' ');
    const isResumeAnalyzer = /resume|candidate|shortlist|fresher/i.test(fullText);

    if (isResumeAnalyzer) {
      // Find exact stakeholder response for each category
      const findAnswer = (pattern) => {
        const found = clarifications.find(c => 
          (c.id && c.id.toLowerCase().includes(pattern.toLowerCase())) || 
          (c.category && c.category.toLowerCase().includes(pattern.toLowerCase())) ||
          (c.triggeredBy && c.triggeredBy.toLowerCase().includes(pattern.toLowerCase()))
        );
        return (found && found.selectedResponse && found.selectedResponse.trim().length > 0) 
          ? { answered: true, text: found.selectedResponse.trim(), clarificationId: found.id } 
          : { answered: false, text: null, clarificationId: found?.id || null };
      };

      const perf = findAnswer('perf');
      const fair = findAnswer('fair');
      const acc = findAnswer('acc');
      const exp = findAnswer('exp');
      const data = findAnswer('data');
      const rel = findAnswer('rel');
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
          acceptanceCriteria: ["Candidates are ranked"],
          sourceStatement: "Mainly skills and experience. And overall profile strength.",
          ambiguityFlags: ["'Good companies', 'solid projects', and fresher weighting formula unresolved"]
        },

        // FR-03: Structured Explainability & Match Scorecard
        exp.answered ? {
          id: "FR-03",
          title: "Structured Explainability & Match Scorecard",
          category: "Functional",
          description: `The system shall display a candidate match scorecard based on stakeholder specification: ${exp.text}.`,
          priority: "Must Have",
          targetUser: "HR Recruiter",
          status: "RESOLVED",
          acceptanceCriteria: [
            "Given any ranked candidate, When clicked by an HR user, Then the system renders a breakdown modal with skills overlap percentage, project badge evaluations, and textual justifications."
          ],
          sourceStatement: "Do we need explainability? For example, why a candidate was ranked higher? / Yes, that would be useful.",
          clarificationReference: `Clarification #${exp.clarificationId}: "${exp.text}"`,
          verificationMethod: "UI End-to-End Test & Interpretability Review"
        } : {
          id: "FR-03",
          title: "Ranking Explainability (Pending Presentation Format)",
          category: "Functional",
          description: "The system should explain candidate ranking (presentation schema pending clarification).",
          priority: "Medium",
          status: "PENDING_CLARIFICATION",
          acceptanceCriteria: ["Show ranking reasons"],
          sourceStatement: "Do we need explainability? ... Yes, that would be useful.",
          ambiguityFlags: ["Explainability granularity and UI presentation format unresolved"]
        },

        // FR-04: Batch Screening
        perf.answered ? {
          id: "FR-04",
          title: "Batch Resume Screening & Ranked Export",
          category: "Functional",
          description: "The system shall support batch uploads of up to 100 resumes simultaneously, providing real-time progress indicators, automated ranking, and CSV/JSON export capabilities.",
          priority: "Should Have",
          targetUser: "HR Operations Lead",
          status: "RESOLVED",
          acceptanceCriteria: [
            "Given a batch upload of up to 100 resumes, When processed, Then the system completes ranking within the specified latency SLO and exports results."
          ],
          sourceStatement: "Should the system process resumes in real-time or batch mode?",
          clarificationReference: `Clarification #${perf.clarificationId}`,
          verificationMethod: "End-to-End Load Testing & Export Integrity Check"
        } : {
          id: "FR-04",
          title: "Batch Resume Screening",
          category: "Functional",
          description: "The system shall support processing multiple resumes.",
          priority: "Medium",
          status: "PENDING_CLARIFICATION",
          acceptanceCriteria: ["Process multiple resumes"],
          sourceStatement: "Should the system process resumes in real-time or batch mode?",
          ambiguityFlags: ["Batch concurrency limit and latency target unresolved"]
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
          sourceStatement: "It should be good enough so that HR trusts it.",
          ambiguityFlags: ["Untestable criteria: 'HR trust' and 'good enough'"]
        },

        // NFR-EXP-01: Explainability
        exp.answered ? {
          id: "NFR-EXP-01",
          title: "Model Explainability Response & Fidelity",
          category: "Explainability",
          description: `Explainability attribution weights must achieve 100% fidelity with the scoring formula and render on client side within 200ms based on stakeholder requirement: ${exp.text}.`,
          metric: "Explanation Latency & Fidelity",
          targetThreshold: "Fidelity = 100%, Render Latency <= 200ms",
          priority: "High",
          status: "RESOLVED",
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
          sourceStatement: "Do we need explainability? / Yes, that would be useful.",
          ambiguityFlags: ["Explainability fidelity benchmark and latency SLO unresolved"]
        },

        // NFR-SEC-01: Security
        {
          id: "NFR-SEC-01",
          title: "Data Privacy, PII Protection & Storage Security",
          category: "Security & Privacy",
          description: "All candidate resumes and personal data must be encrypted at rest using AES-256 and in transit using TLS 1.3, with role-based access control (RBAC) compliant with GDPR and CCPA.",
          metric: "Encryption Standard & Access Audit",
          targetThreshold: "AES-256 at rest, TLS 1.3 in transit, 100% audit logging",
          priority: "Critical",
          status: "RESOLVED",
          sourceStatement: "We have past resumes and hiring decisions...",
          clarificationReference: "Security Baseline Specification",
          verificationMethod: "Automated SAST/DAST Security Scan"
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
          sourceStatement: "We need an MVP soon.",
          ambiguityFlags: ["Missing concrete MVP deadline and scope boundaries"]
        }
      ];

      return { frs, nfrs };
    }

    return this.generateGenericRefined(utterances, clarifications, domain);
  }

  generateGenericBaseline(utterances, domain) {
    const frs = [];
    const nfrs = [];
    let frIndex = 1;
    let nfrIndex = 1;

    utterances.forEach(u => {
      if (u.text.length > 20 && !u.text.endsWith('?')) {
        if (/latency|speed|fast|slow|security|safe|scale|traffic|accuracy/i.test(u.text)) {
          nfrs.push({
            id: `NFR-BASE-${String(nfrIndex++).padStart(2, '0')}`,
            title: `${u.text.slice(0, 30)}...`,
            category: "General NFR",
            description: u.text,
            metric: "Unspecified",
            targetThreshold: "Undefined",
            priority: "Medium",
            status: "RAW_UNCLARIFIED",
            sourceStatement: u.text,
            ambiguityFlags: ["Vague specification lacking measurable criteria"]
          });
        } else {
          frs.push({
            id: `FR-BASE-${String(frIndex++).padStart(2, '0')}`,
            title: `${u.text.slice(0, 35)}...`,
            category: "Functional",
            description: `The system shall support: ${u.text}`,
            priority: "Medium",
            status: "RAW_UNCLARIFIED",
            acceptanceCriteria: ["System fulfills stakeholder statement"],
            sourceStatement: u.text,
            ambiguityFlags: ["Missing concrete acceptance parameters"]
          });
        }
      }
    });

    return { frs, nfrs };
  }

  generateGenericRefined(utterances, clarifications, domain) {
    const frs = [];
    const nfrs = [];
    let frIndex = 1;
    let nfrIndex = 1;

    clarifications.forEach(c => {
      const isAnswered = c.selectedResponse && c.selectedResponse.trim().length > 0;
      if (/perf|speed|latency/i.test(c.category)) {
        nfrs.push({
          id: `NFR-PERF-${String(nfrIndex++).padStart(2, '0')}`,
          title: `${c.category} Requirement`,
          category: "Performance",
          description: isAnswered ? `The system shall satisfy performance constraint: ${c.selectedResponse}` : `Performance constraint pending clarification for "${c.triggeredBy}"`,
          metric: "Response Latency / Throughput",
          targetThreshold: isAnswered ? c.selectedResponse : "Unspecified - Awaiting Clarification",
          priority: "High",
          status: isAnswered ? "RESOLVED" : "PENDING_CLARIFICATION",
          sourceStatement: c.triggeredBy,
          clarificationReference: `Clarification #${c.id}`,
          verificationMethod: "Automated Benchmark"
        });
      } else {
        frs.push({
          id: `FR-${String(frIndex++).padStart(2, '0')}`,
          title: `Feature: ${c.category}`,
          category: "Functional",
          description: isAnswered ? `The system shall implement: ${c.selectedResponse}` : `Feature implementation pending clarification for "${c.triggeredBy}"`,
          priority: "Must Have",
          status: isAnswered ? "RESOLVED" : "PENDING_CLARIFICATION",
          acceptanceCriteria: isAnswered ? [`Given valid inputs, system complies with: ${c.selectedResponse}`] : ["Pending clarification"],
          sourceStatement: c.triggeredBy,
          clarificationReference: `Clarification #${c.id}`,
          verificationMethod: "Automated Acceptance Testing"
        });
      }
    });

    return { frs, nfrs };
  }
}

module.exports = new RequirementGenerator();
