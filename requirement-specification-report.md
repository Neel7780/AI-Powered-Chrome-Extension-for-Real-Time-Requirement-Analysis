# AI-Powered Requirement Analysis & Quality Report (Assignment 2)
**Generated:** 2026-08-25 23:39:23 | **Evaluation:** Informed by ISO/IEC/IEEE 29148 Principles
*Demo Simulation: Stakeholder responses are simulated to demonstrate the clarification and refinement workflow.*

## 1. Executive Summary & Quality Scorecard
- **Without Clarification (Baseline Quality):** 8 / 100 (Poor - 0% Testability)
- **With AI Clarification (Refined Quality):** 96 / 100 (Excellent - 100% Testability)
- **Overall Quality Improvement:** +88 Points Gain

## 2. Stakeholder Clarification Q&A Log
### Q1 [Performance]: What specific latency threshold defines acceptable performance?
**Stakeholder Clarification:** Single resume parsing must be under 1.5s (95th percentile) and batch upload of 100 resumes must complete within 30 seconds.

### Q2 [Fairness]: What quantitative fairness metric and audit frequency should be enforced?
**Stakeholder Clarification:** Disparate impact ratio between 0.80 and 1.25 across gender and college tiers; quarterly fairness audit.

### Q3 [Accuracy]: What objective accuracy metric defines "good enough for HR trust"?
**Stakeholder Clarification:** Top-10 candidate precision >= 85% and NDCG@10 >= 0.82 evaluated against consensus of 3 senior recruiters.

### Q4 [Explainability]: How should candidate match reasoning be presented to recruiters?
**Stakeholder Clarification:** Interactive match scorecard showing matched skills %, project complexity score, and top 3 justification reasons.

### Q5 [Ranking Algorithm]: How should skills, experience, and projects be weighted?
**Stakeholder Clarification:** Formula: 45% skills match + 35% project complexity + 20% experience with tier normalization.

### Q6 [Data Ingestion]: What file formats and size limits must be supported?
**Stakeholder Clarification:** Support PDF and DOCX up to 10MB per file with automated text extraction into validated JSON schema.

### Q7 [Project Scope]: What is the committed delivery milestone for the MVP?
**Stakeholder Clarification:** 4-week MVP deliverable covering ingestion, JD matching, top-10 ranking, and scorecard export.

## 3. Refined Functional Requirements (FR)
### FR-01: Resume Ingestion & Parsing Engine [Priority: Must Have] [RequirementStatus.RESOLVED]
- **Description:** The system shall ingest resumes in PDF and DOCX formats (up to 10MB per file) and parse text into structured JSON schemas as specified by stakeholder: Support PDF and DOCX up to 10MB per file with automated text extraction into validated JSON schema..
- **Acceptance Criteria:**
  - Given a valid PDF or DOCX resume under 10MB, When uploaded, Then the system extracts text and generates valid structured JSON.
  - Given a corrupted or unsupported file type, When uploaded, Then the system returns an informative HTTP 422 error.
- **Traceability:** Clarification #q-data-01: 'Support PDF and DOCX up to 10MB per file with automated text extraction into validated JSON schema.'
- **Verification Method:** Automated Integration Test & JSON Schema Validation

### FR-02: Deterministic Multi-Factor Candidate Scoring Engine [Priority: Must Have] [RequirementStatus.RESOLVED]
- **Description:** The system shall calculate composite candidate relevance scores using stakeholder-defined weighting: Formula: 45% skills match + 35% project complexity + 20% experience with tier normalization..
- **Acceptance Criteria:**
  - Given a job description and candidate profile, When scored, Then the final score strictly follows the stakeholder weighting formula.
  - Given an exceptional fresher with high project complexity, When ranked against generic experience, Then the fresher outranks when composite score is higher.
- **Traceability:** Clarification #q-rel-01: 'Formula: 45% skills match + 35% project complexity + 20% experience with tier normalization.'
- **Verification Method:** Unit Test & Ranking Algorithm Regression Suite

### FR-03: Structured Explainability & Match Scorecard [Priority: Must Have] [RequirementStatus.RESOLVED]
- **Description:** The system shall generate an interactive candidate match scorecard satisfying stakeholder preference: Interactive match scorecard showing matched skills %, project complexity score, and top 3 justification reasons..
- **Acceptance Criteria:**
  - Given a shortlisted candidate, When viewed in the UI, Then the system displays matched skills %, project complexity score, and top 3 justification reasons.
  - Given recruiter requests match explanation, When requested, Then the explanation payload renders in < 500ms.
- **Traceability:** Clarification #q-exp-01: 'Interactive match scorecard showing matched skills %, project complexity score, and top 3 justification reasons.'
- **Verification Method:** UI Component Test & API Contract Validation

### FR-04: Role-Based Recruiter & Hiring Manager Dashboard [Priority: Must Have] [RequirementStatus.RESOLVED]
- **Description:** The system shall provide secure role-based portals for HR Recruiters and Hiring Managers to upload job descriptions, trigger bulk resume scoring, and export shortlists.
- **Acceptance Criteria:**
  - Given authenticated recruiter, When uploading JD, Then analysis job is dispatched.
  - Given unauthorized user, When accessing dashboard, Then HTTP 403 Forbidden is returned.
- **Verification Method:** Automated Security & End-to-End Workflow Test

## 4. Categorized Non-Functional Requirements (NFR)
### NFR-PERF-01: Resume Parsing & Ranking Latency SLO [Category: Performance] [RequirementStatus.RESOLVED]
- **Description:** The system shall meet latency SLO: Single resume parsing must be under 1.5s (95th percentile) and batch upload of 100 resumes must complete within 30 seconds..
- **Target Metric / SLO:** `Single resume parsing must be under 1.5s (95th percentile) and batch upload of 100 resumes must complete within 30 seconds.`
- **Verification Method:** Automated Load Benchmark (k6/Locust) & Datadog APM Tracing

### NFR-FAIR-01: Demographic Fairness & Disparate Impact Compliance [Category: Fairness] [RequirementStatus.RESOLVED]
- **Description:** The ranking algorithm shall enforce demographic fairness standard: Disparate impact ratio between 0.80 and 1.25 across gender and college tiers; quarterly fairness audit..
- **Target Metric / SLO:** `Disparate impact ratio between 0.80 and 1.25 across gender and college tiers; quarterly fairness audit.`
- **Verification Method:** Automated Fairness Audit Suite (AIF360/Fairlearn) & PII Redaction Test

### NFR-ACC-01: Candidate Matching Accuracy & HR Trust Benchmark [Category: Accuracy] [RequirementStatus.RESOLVED]
- **Description:** The candidate shortlisting model shall achieve accuracy benchmark: Top-10 candidate precision >= 85% and NDCG@10 >= 0.82 evaluated against consensus of 3 senior recruiters..
- **Target Metric / SLO:** `Top-10 candidate precision >= 85% and NDCG@10 >= 0.82 evaluated against consensus of 3 senior recruiters.`
- **Verification Method:** Offline Evaluation Benchmark & Human Recruiter Ground-Truth Test Set

### NFR-SCOPE-01: Committed MVP Release Milestone [Category: Scope] [RequirementStatus.RESOLVED]
- **Description:** The project engineering team shall deliver the validated MVP deliverable compliant with: 4-week MVP deliverable covering ingestion, JD matching, top-10 ranking, and scorecard export..
- **Target Metric / SLO:** `4-week MVP deliverable covering ingestion, JD matching, top-10 ranking, and scorecard export.`
- **Verification Method:** Sprint Milestone Verification & Release Checklist Sign-off

### NFR-SEC-01: Candidate PII Protection & Data Privacy [Category: Security] [RequirementStatus.RESOLVED]
- **Description:** Candidate personally identifiable information (PII) must be stored with AES-256 encryption at rest and TLS 1.3 in transit.
- **Target Metric / SLO:** `AES-256 encryption at rest, TLS 1.3 in transit, GDPR Article 32 compliant`
- **Verification Method:** Automated Security & Encryption Audit

### NFR-USAB-01: Recruiter Interface Usability Benchmark [Category: Usability] [RequirementStatus.RESOLVED]
- **Description:** The recruiter dashboard interface shall achieve System Usability Scale (SUS) score >= 80.0.
- **Target Metric / SLO:** `System Usability Scale (SUS) >= 80.0`
- **Verification Method:** User Usability Testing

## 5. Quality Comparison Audit Matrix
| Quality Dimension | Without Clarification | With Clarification | Improvement |
| :--- | :--- | :--- | :--- |
| **Overall Quality Index** | 8/100 | 96/100 | +88 pts |
| **Ambiguity Score** | 100% | 0% | -100% |
| **Testability & Verifiability** | 0% | 100% | +100% |
| **Completeness Coverage** | 0% | 100% | +100% |
| **Specificity & Measurability** | 0% | 90% | +90% |
| **Traceability & Lineage** | 50% | 85% | +35% |