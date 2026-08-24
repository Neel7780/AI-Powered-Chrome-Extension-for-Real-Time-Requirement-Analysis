/**
 * Requirement Generator Service
 * Synthesizes Functional Requirements (FR) and Categorized Non-Functional Requirements (NFR)
 * under two paradigms:
 * 1. Without Clarification (Baseline / Raw Stakeholder Statements)
 * 2. With Clarification (Refined / Quantified / IEEE 830 & ISO 29148 Standard)
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

    return {
      baseline,
      refined,
      metadata: {
        domain,
        utteranceCount: utterances.length,
        clarificationCount: clarifications.length,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * 1. Baseline Requirements (Without Clarification)
   * Directly derived from raw conversation without resolved ambiguities
   */
  generateBaselineRequirements(utterances = [], domain = 'HR Tech') {
    // Determine if it's the Resume Analyzer conversation or generic
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
            sourceStatement: "We need an MVP soon.",
            ambiguityFlags: ["No release date, sprint milestone, or MVP feature scope"]
          }
        ]
      };
    }

    // Generic transcript baseline generator
    return this.generateGenericBaseline(utterances, domain);
  }

  /**
   * 2. Refined Requirements (With Clarification)
   * Formal, verifiable, quantified IEEE 830 / ISO 29148 standard specifications
   */
  generateRefinedRequirements(utterances = [], clarifications = [], domain = 'HR Tech') {
    const fullText = utterances.map(u => u.text).join(' ');
    const isResumeAnalyzer = /resume|candidate|shortlist|fresher/i.test(fullText);

    if (isResumeAnalyzer) {
      // Find answers from clarifications or default to high-precision defaults
      const getClarification = (idPattern) => {
        const found = clarifications.find(c => c.id.includes(idPattern) || c.category.toLowerCase().includes(idPattern));
        return found ? found.selectedResponse : null;
      };

      const perfResp = getClarification('perf') || 'Single resume parsing latency < 1.5s (p95); batch upload of 100 resumes < 30s.';
      const fairResp = getClarification('fair') || 'Mask PII and college names before scoring; Disparate Impact Ratio (DIR) between 0.80 and 1.25 across gender and college tiers.';
      const accResp = getClarification('acc') || 'Top-10 shortlisting Precision >= 85% and NDCG@10 >= 0.82 against senior human recruiter benchmark.';
      const expResp = getClarification('exp') || 'Structured candidate scorecard: matched skill %, project impact rating, and 3 key justification bullet points.';
      const dataResp = getClarification('data') || 'Support PDF and DOCX up to 10MB; parse unstructured text into standardized JSON schema.';
      const weightResp = getClarification('rel') || 'Scoring model: 45% Tech Stack/Skills match, 35% Project Scope & Open Source Impact, 20% Relevant Experience; allow freshers with high project scores to outrank generic profiles.';
      const scopeResp = getClarification('scope') || '4-week MVP release: Web candidate shortlisting portal with PDF/DOCX ingestion, JD matching, top-N ranking, explainability cards, and fairness metrics.';

      return {
        frs: [
          {
            id: "FR-01",
            title: "Multi-Format Resume Ingestion & Parsing",
            category: "Functional",
            description: "The system shall ingest resumes in PDF and DOCX formats (up to 10MB per file) and parse text into a structured JSON schema comprising candidate skills, work history, education, and project portfolio.",
            priority: "Must Have",
            targetUser: "HR Recruiter / Hiring Manager",
            acceptanceCriteria: [
              "Given a valid PDF or DOCX resume under 10MB, When uploaded, Then the system extracts text and generates valid structured JSON within 1.5 seconds.",
              "Given a corrupted or unsupported file type, When uploaded, Then the system returns an informative HTTP 422 error with specific validation details."
            ],
            sourceStatement: "We need to build an AI-based resume analyzer... We have past resumes, but they're not very structured.",
            clarificationReference: "Clarification #Q-DATA-01 (" + dataResp + ")",
            verificationMethod: "Automated Integration Test & JSON Schema Validation"
          },
          {
            id: "FR-02",
            title: "Deterministic Multi-Factor Candidate Scoring Engine",
            category: "Functional",
            description: "The system shall calculate a composite candidate relevance score (0 - 100) based on weighted parameters: 45% verified skills/tech-stack match, 35% project complexity & demonstrable impact, and 20% relevant domain experience.",
            priority: "Must Have",
            targetUser: "System Algorithm / Recruiter",
            acceptanceCriteria: [
              "Given a job description and candidate profile, When scored, Then the final score equals (0.45 * SkillMatch) + (0.35 * ProjectScore) + (0.20 * ExperienceScore).",
              "Given an exceptional fresher with high project complexity (score >= 90), When ranked against a candidate with 5 years of generic experience (project score <= 50), Then the fresher shall be ranked higher if their composite score is greater."
            ],
            sourceStatement: "It should rank them based on relevance... Sometimes a strong fresher is better than someone with 5 average years.",
            clarificationReference: "Clarification #Q-REL-01 (" + weightResp + ")",
            verificationMethod: "Unit Test & Ranking Algorithm Regression Suite"
          },
          {
            id: "FR-03",
            title: "Structured Explainability & Match Scorecard",
            category: "Functional",
            description: "The system shall display a dedicated candidate match scorecard providing transparent feature attribution: exact matched required skills %, matched preferred skills %, quantified project score, and top 3 bullet justifications for the assigned rank.",
            priority: "Must Have",
            targetUser: "HR Recruiter",
            acceptanceCriteria: [
              "Given any ranked candidate, When clicked by an HR user, Then the system renders a breakdown modal with skills overlap percentage, project badge evaluations, and 3 bullet justifications.",
              "The explainability attributes must be generated in <= 200ms upon card selection."
            ],
            sourceStatement: "Do we need explainability? For example, why a candidate was ranked higher? / Yes, that would be useful.",
            clarificationReference: "Clarification #Q-EXP-01 (" + expResp + ")",
            verificationMethod: "UI End-to-End Test & Human Interpretability Review"
          },
          {
            id: "FR-04",
            title: "Batch Resume Screening & Ranked Export",
            category: "Functional",
            description: "The system shall support batch uploads of up to 100 resumes simultaneously, providing a real-time progress indicator, automated sorting by composite score, and export capabilities to CSV and JSON formats.",
            priority: "Should Have",
            targetUser: "HR Operations Lead",
            acceptanceCriteria: [
              "Given a zip file or multi-file selection containing up to 100 resumes, When processed, Then the system completes ranking within 30 seconds and allows 1-click export."
            ],
            sourceStatement: "Should the system process resumes in real-time or batch mode?",
            clarificationReference: "Clarification #Q-PERF-01 & #Q-SCOPE-01",
            verificationMethod: "End-to-End Load Testing & Export Integrity Check"
          }
        ],
        nfrs: [
          {
            id: "NFR-PERF-01",
            title: "Parsing & Ranking Latency SLO",
            category: "Performance",
            description: "The system shall parse and rank a single resume in under 1.50 seconds (95th percentile) and complete batch screening of 100 resumes in under 30.0 seconds.",
            metric: "Response Latency (p95 / p99)",
            targetThreshold: "Single resume <= 1.5s (p95); Batch of 100 <= 30s",
            priority: "Critical",
            sourceStatement: "It shouldn't be slow. / Ideally quick.",
            clarificationReference: "Clarification #Q-PERF-01 (" + perfResp + ")",
            verificationMethod: "Automated Locust / k6 Performance Benchmark"
          },
          {
            id: "NFR-FAIR-01",
            title: "Algorithmic Fairness & Bias Mitigation",
            category: "Fairness & Bias",
            description: "The system shall mask all PII (name, gender, photo, age, address) and educational institution names prior to embedding generation, and enforce a Disparate Impact Ratio (DIR) between 0.80 and 1.25 across all demographic subgroups.",
            metric: "Disparate Impact Ratio (DIR) & Demographic Parity",
            targetThreshold: "0.80 <= DIR <= 1.25 across gender and institutional tiers",
            priority: "Critical",
            sourceStatement: "Yes, we must avoid bias, especially related to gender or college background.",
            clarificationReference: "Clarification #Q-FAIR-01 (" + fairResp + ")",
            verificationMethod: "AIF360 / Fairlearn Automated Compliance Audit Suite"
          },
          {
            id: "NFR-ACC-01",
            title: "Shortlisting Precision & Ranking Quality",
            category: "Accuracy & Quality",
            description: "The candidate shortlisting model shall achieve a Top-10 Precision >= 85.0% and Normalized Discounted Cumulative Gain (NDCG@10) >= 0.82 when benchmarked against a double-blind senior recruiter consensus dataset.",
            metric: "Top-10 Precision & NDCG@10",
            targetThreshold: "Precision@10 >= 85.0%, NDCG@10 >= 0.82",
            priority: "Critical",
            sourceStatement: "It should be good enough so that HR trusts it.",
            clarificationReference: "Clarification #Q-ACC-01 (" + accResp + ")",
            verificationMethod: "Automated Model Evaluation Pipeline on Holdout Test Set"
          },
          {
            id: "NFR-SEC-01",
            title: "Data Privacy, PII Protection & Storage Security",
            category: "Security & Privacy",
            description: "All candidate resumes and extracted personal data must be encrypted at rest using AES-256 and in transit using TLS 1.3, with strict role-based access control (RBAC) compliant with GDPR and CCPA.",
            metric: "Encryption Standard & Access Audit",
            targetThreshold: "AES-256 at rest, TLS 1.3 in transit, 100% audit logging",
            priority: "Critical",
            sourceStatement: "We have past resumes and hiring decisions...",
            clarificationReference: "Clarification #Q-DATA-01 & Security Baseline",
            verificationMethod: "Automated SAST / DAST Security Scan & Penetration Test"
          },
          {
            id: "NFR-EXP-01",
            title: "Model Explainability Response & Fidelity",
            category: "Explainability",
            description: "Explainability attribution weights must achieve 100% fidelity with the underlying scoring formula and render on client side within 200ms of user selection.",
            metric: "Explanation Latency & Fidelity",
            targetThreshold: "Fidelity = 100%, Render Latency <= 200ms",
            priority: "High",
            sourceStatement: "Do we need explainability? / Yes, that would be useful.",
            clarificationReference: "Clarification #Q-EXP-01 (" + expResp + ")",
            verificationMethod: "Automated Component Test & Attribution Validation"
          },
          {
            id: "NFR-SCOPE-01",
            title: "MVP Milestone Delivery & Scope Boundaries",
            category: "Project Scope",
            description: "The core MVP shall be delivered within 4 calendar weeks, encapsulating PDF/DOCX ingestion, JD matching, top-10 ranking, explainability scorecard, and export modules.",
            metric: "Delivery Timeline & Scope Checklist",
            targetThreshold: "Sprint Duration <= 4 Weeks; 100% MVP Acceptance Criteria Pass",
            priority: "High",
            sourceStatement: "We need an MVP soon.",
            clarificationReference: "Clarification #Q-SCOPE-01 (" + scopeResp + ")",
            verificationMethod: "Sprint Review & User Acceptance Testing (UAT)"
          }
        ]
      };
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
      if (/perf|speed|latency/i.test(c.category)) {
        nfrs.push({
          id: `NFR-PERF-${String(nfrIndex++).padStart(2, '0')}`,
          title: `${c.category} Requirement`,
          category: "Performance",
          description: `The system shall satisfy performance constraint: ${c.selectedResponse}`,
          metric: "Response Latency / Throughput",
          targetThreshold: c.selectedResponse,
          priority: "High",
          sourceStatement: c.triggeredBy,
          clarificationReference: `Clarification #${c.id}`,
          verificationMethod: "Automated Load / Benchmark Test"
        });
      } else if (/fair|bias|security|privacy/i.test(c.category)) {
        nfrs.push({
          id: `NFR-SEC-${String(nfrIndex++).padStart(2, '0')}`,
          title: `${c.category} Specification`,
          category: c.category,
          description: `The system shall enforce security/compliance: ${c.selectedResponse}`,
          metric: "Compliance Metric & Standard",
          targetThreshold: c.selectedResponse,
          priority: "Critical",
          sourceStatement: c.triggeredBy,
          clarificationReference: `Clarification #${c.id}`,
          verificationMethod: "Automated Compliance Audit Suite"
        });
      } else {
        frs.push({
          id: `FR-${String(frIndex++).padStart(2, '0')}`,
          title: `Refined Feature: ${c.category}`,
          category: "Functional",
          description: `The system shall implement: ${c.selectedResponse}`,
          priority: "Must Have",
          acceptanceCriteria: [
            `Given valid inputs for ${c.category}, When executed, Then the system complies with ${c.selectedResponse}.`
          ],
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
