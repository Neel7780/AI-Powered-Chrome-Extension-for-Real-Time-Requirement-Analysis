# AI-Powered Chrome Extension & Platform for Real-Time Requirement Analysis

[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![Standard](https://img.shields.io/badge/Standard-ISO%2FIEC%2FIEEE_29148-purple.svg)](https://standards.ieee.org/)
[![Tests](https://img.shields.io/badge/Tests-100%25_Passing-brightgreen.svg)]()

> An end-to-end AI-assisted Requirements Engineering (RE) solution that listens to live Zoom, Google Meet, and Microsoft Teams meeting transcripts, dynamically detects vague or ambiguous stakeholder statements in real time, generates targeted clarification questions, synthesizes formal Functional (FR) and Categorized Non-Functional Requirements (NFR), and evaluates requirement quality before and after clarification.

---

## 📌 Problem Statement & Assignment Alignment

In software requirements meetings, stakeholders frequently provide incomplete, subjective, or ambiguous statements (e.g., *"it shouldn't be slow"*, *"it should be good enough so that HR trusts it"*, *"strong fresher"*, *"MVP soon"*). Traditional analysts miss critical opportunities to clarify these requirements live, resulting in untestable, subjective specifications and high project risk.

This project delivers:
1. **Manifest V3 Chrome Extension**: Real-time transcript listener for Zoom Web Client, Google Meet, and Microsoft Teams, featuring an injected in-meeting HUD, side panel, and quick popup.
2. **Real-Time NLP & AI Ambiguity Detector**: Instant detection of lexical vagueness, missing operational definitions, untestable criteria, and underspecified NFR constraints.
3. **Automated Clarification Question Generator**: Contextual, high-yield questions with suggested industry-standard metrics and SLO options.
4. **Interactive Stakeholder Q&A Interface**: Fast-response interface for stakeholders and analysts to record clarifications in real time.
5. **Rigorous FR & NFR Extraction Engine**: Formal ISO/IEC/IEEE 29148 requirement synthesis categorized across Performance, Fairness & Bias, Accuracy, Explainability, Security, and Scope.
6. **Side-by-Side Comparative Quality Evaluation Framework**: Quantifiable metrics comparing requirements generated **Without Clarification** vs. **With Clarification** (Ambiguity, Completeness, Testability, Specificity, Traceability, and Overall Quality Index).
7. **Multi-Format Export Hub**: One-click generation of professional PDF reports, Word Documents (.docx), Markdown/TXT, and structured JSON.
8. **Interactive Meeting Simulation Studio & Web Dashboard**: Full standalone application with audio visualizer, playback speed controls, and live microphone speech recognition (Web Speech API).

---

## 🏗️ System Architecture

```mermaid
flowchart TB
    subgraph MeetingSource["Live Meeting Audio & Transcripts"]
        Z[Zoom Web Client DOM]
        M[Google Meet DOM]
        T[Microsoft Teams DOM]
        MIC[Live Microphone Web Speech API]
        SIM[Meeting Simulation Streamer]
    end

    subgraph ExtensionLayer["Chrome Extension (Manifest V3)"]
        CS[Content Scripts & DOM Observers]
        HUD[Injected In-Meeting Floating HUD]
        SW[Background Service Worker]
        SP[Side Panel Interface]
        POP[Extension Popup]
    end

    subgraph IntelligenceEngine["Requirement AI Intelligence Engine"]
        AD[Ambiguity & Vagueness Detector]
        QG[Clarification Question Generator]
        RE[FR & NFR Extraction Engine]
        QE[IEEE 830 Quality Evaluator]
    end

    subgraph Outputs["Multi-Format Specification & Exports"]
        PDF[PDF SRS Report (pdfkit)]
        DOCX[Word Document (docx)]
        MD[Markdown / TXT]
        JSON[Structured JSON for Jira/DevOps]
    end

    MeetingSource --> CS
    MeetingSource --> SIM
    CS --> HUD
    CS --> SW
    SW --> SP
    SW --> POP
    
    SIM --> IntelligenceEngine
    SW --> IntelligenceEngine
    
    IntelligenceEngine --> AD
    AD --> QG
    QG --> RE
    RE --> QE
    QE --> Outputs
```

---

## 📊 Comparative Analysis: Without vs. With Clarification

Based on the assignment conversation (AI-based Resume Analyzer meeting between Hiring Manager and ML Engineer):

### 1. Requirements Transformation Matrix

| Requirement Area | Without Clarification (Baseline / Raw) | With AI Clarification (Refined Specification) | Impact / Resolution |
| :--- | :--- | :--- | :--- |
| **Performance NFR** | *"The system shouldn't be slow and response time per resume should ideally be quick."* | **NFR-PERF-01**: Single resume parsing latency $\le 1.50\text{s}$ (95th percentile); batch screening of 100 resumes $\le 30.0\text{s}$. | Replaced subjective *"quick"* with quantifiable latency SLOs ($p95 < 1.5\text{s}$). |
| **Fairness & Bias NFR** | *"Yes, we must avoid bias, especially related to gender or college background."* | **NFR-FAIR-01**: Automated PII and college redaction prior to embeddings; enforce Disparate Impact Ratio ($0.80 \le \text{DIR} \le 1.25$) across demographic groups. | Replaced vague *"avoid bias"* with mathematical Disparate Impact threshold and redaction pipeline. |
| **Accuracy NFR** | *"It should be good enough so that HR trusts it."* | **NFR-ACC-01**: Top-10 Shortlisting $\text{Precision} \ge 85.0\%$ and $\text{NDCG@10} \ge 0.82$ against senior human recruiter consensus test set. | Converted subjective *"trust"* into verifiable Ranking Precision and NDCG benchmark. |
| **Explainability FR** | *"Do we need explainability? ... Yes, that would be useful."* | **FR-03**: Interactive candidate match scorecard rendering matched skills %, project impact score, and top 3 textual justification bullets within 200ms. | Specified concrete presentation schema and response latency. |
| **Scoring Formula FR** | *"Things like good companies, solid projects, impactful work... strong fresher."* | **FR-02**: Multi-factor scoring model: $45\%$ verified skill match, $35\%$ project impact & complexity, $20\%$ relevant experience with fresher normalization. | Eliminated undefined *"solid projects"* with deterministic weighted formula. |
| **Data Ingestion FR** | *"We have past resumes... but they're not very structured."* | **FR-01**: Ingest PDF and DOCX formats (up to 10MB), parsing unstructured text into validated JSON schemas with OCR fallback and error codes. | Defined file formats, size boundaries, and data contract. |
| **Project Scope NFR** | *"We need an MVP soon."* | **NFR-SCOPE-01**: 4-week MVP milestone deliverable covering PDF/DOCX ingestion, JD matching, top-10 ranking, scorecard, and CSV export. | Established concrete deadline and scope checklist. |

### 2. Quality Evaluation Metrics Comparison

| Quality Dimension | Standard Definition | Without Clarification | With Clarification | Improvement ($\Delta$) |
| :--- | :--- | :---: | :---: | :---: |
| **Overall Quality Index (OQI)** | Weighted composite quality score (0 - 100) | **30% (Poor)** | **92% (Excellent)** | **+62 pts (+207%)** |
| **Ambiguity Level** | Frequency of lexical vagueness & fuzzy qualifiers | 78% | 12% | **-66% reduction** |
| **Testability & Verifiability** | Proportion of requirements with pass/fail criteria | 25% | 92% | **+67% gain** |
| **Completeness & NFR Coverage** | Coverage of critical NFR dimensions (SLOs, security) | 35% | 94% | **+59% gain** |
| **Specificity & Measurability** | Presence of numerical thresholds, units, schemas | 30% | 90% | **+60% gain** |
| **Traceability & Consistency** | Bidirectional mapping to stakeholder statements | 40% | 95% | **+55% gain** |

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher (tested on Node.js v20)
- Google Chrome browser (for extension and Web Speech API)

### 1. Installation
Clone the repository and install dependencies:
```bash
git clone <repo-url>
cd take-home-2
npm install
```

### 2. Run the Test Suite
Verify that all RE quality evaluators, NLP engines, and document generators pass:
```bash
npm test
```

### 3. Start the Server & Web Studio
Launch the Express backend and Interactive Web Dashboard:
```bash
npm start
```
Open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🧩 Installing the Chrome Extension

To install the Chrome Extension into Google Chrome:

1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click the **Load unpacked** button in the top-left.
4. Select the `extension/` directory located inside this repository:
   `/home/godllike/Desktop/Sem5/SwE/take-home-2/extension`
5. The **AI Real-Time Requirement Analyzer** extension will now appear in your toolbar!

### Using the Extension:
- **During a Zoom or Google Meet Call**:
  - The extension automatically observes live captions/transcripts.
  - The injected floating **Requirement Copilot HUD** appears in the bottom-right corner of the meeting.
  - Vague statements are highlighted in red, and real-time clarification questions appear with 1-click answers.
- **Side Panel**:
  - Click the extension icon in Chrome or the HUD `⧉` button to open the full **Requirement Side Panel**.
  - Monitor real-time transcripts, answer clarification questions, view synthesized FRs & NFRs, inspect quality audit charts, and export reports directly.

---

## 📂 Repository Structure

```
take-home-2/
├── Take_Home_Assignment_2.pdf    # Assignment Prompt & Sample Conversation
├── package.json                  # Project dependencies & test scripts
├── README.md                     # Comprehensive documentation & evaluation report
├── server/
│   ├── server.js                 # Express server & static asset host
│   ├── data/
│   │   └── sample-transcripts.json # PDF conversation & multi-domain test cases
│   ├── routes/
│   │   ├── analyze.js            # Live utterance & transcript ambiguity analysis
│   │   ├── questions.js          # Clarification question generation
│   │   ├── requirements.js       # FR & NFR synthesis (Baseline vs Refined)
│   │   ├── evaluate.js           # Quality metrics evaluation & comparison
│   │   └── export.js             # PDF, DOCX, TXT, and JSON export endpoints
│   └── services/
│       ├── ambiguity-detector.js # NLP lexical & structural vagueness detector
│       ├── quality-evaluator.js  # IEEE 830 / ISO 29148 RE quality metric engine
│       ├── requirement-generator.js # Baseline vs Refined requirement builder
│       ├── ai-service.js         # AI coordination layer & fallback engine
│       └── export-service.js     # PDFKit & docx document generation
├── webapp/
│   ├── index.html                # Live meeting simulation studio & dashboard
│   ├── styles.css                # Glassmorphic dark theme & animations
│   └── app.js                    # Webapp controller, Chart.js radar, Web Speech API
├── extension/                    # Manifest V3 Chrome Extension
│   ├── manifest.json             # Manifest V3 configuration
│   ├── icons/                    # Extension icons (16, 32, 48, 128)
│   ├── background/
│   │   └── service-worker.js     # Background worker & state coordinator
│   ├── content/
│   │   ├── zoom-observer.js      # Zoom Web Client caption/transcript observer
│   │   ├── meet-observer.js      # Google Meet & Teams caption observer
│   │   ├── injected-hud.js       # Floating in-meeting HUD controller
│   │   └── injected-hud.css      # Floating HUD styling
│   ├── popup/
│   │   ├── popup.html            # Extension popup HTML
│   │   ├── popup.css             # Extension popup styling
│   │   └── popup.js              # Extension popup controller
│   ├── sidepanel/
│   │   ├── sidepanel.html        # Side panel HTML
│   │   ├── sidepanel.css         # Side panel styling
│   │   └── sidepanel.js          # Side panel controller
│   └── shared/
│       ├── api.js                # Extension API client & offline fallback
│       ├── nlp-engine.js         # In-browser NLP ambiguity engine
│       └── sample-data.js        # Embedded sample meeting scenarios
└── tests/
    ├── nlp-ambiguity.test.js     # Ambiguity detector tests
    ├── requirement-extraction.test.js # FR/NFR extraction tests
    ├── quality-metrics.test.js   # Quality evaluation & comparison tests
    ├── export.test.js            # PDF, DOCX, Markdown export tests
    └── run-all-tests.js          # Test runner
```

---

## 🎯 Verification & Testing

To execute the automated test suite:
```bash
npm test
```

Expected output:
```
====================================================
🧪 RUNNING COMPREHENSIVE TEST SUITE
====================================================

--- Running Ambiguity Detector Tests ---
✓ Test 1 Passed: Detected subjective trust phrase
✓ Test 2 Passed: Handled question utterance
✓ Test 3 Passed: Detected multiple fuzzy adjectives
✓ Test 4 Passed: Full transcript analysis (Ambiguity Index: 95/100, Flags: 20)
All Ambiguity Detector Tests Passed!

--- Running Requirement Extraction & Refinement Tests ---
✓ Test 1 Passed: Baseline requirements generated with raw ambiguities
✓ Test 2 Passed: Refined requirements generated with formal metrics and SLOs
Categorized NFRs present: [
  'Performance',
  'Fairness & Bias',
  'Accuracy & Quality',
  'Security & Privacy',
  'Explainability',
  'Project Scope'
]
✓ Test 3 Passed: Comprehensive NFR categorization verified
All Requirement Extraction Tests Passed!

--- Running Quality Metrics Evaluation Tests ---
Baseline Overall Quality Index: 30/100 (Poor)
✓ Test 1 Passed: Evaluated Baseline quality
Refined Overall Quality Index: 92/100 (Excellent)
✓ Test 2 Passed: Evaluated Refined quality
Quality Delta: +62 points (+207% improvement)
✓ Test 3 Passed: Quality comparison delta verified
All Quality Metrics Tests Passed!

--- Running Export Service Tests ---
✓ Test 1 Passed: PDF generated successfully (10013 bytes)
✓ Test 2 Passed: DOCX generated successfully (11182 bytes)
✓ Test 3 Passed: Markdown generated successfully (11265 characters)
All Export Service Tests Passed!
```

---

## 📄 Export Format Highlights

- **PDF Export**: Generates an ISO/IEC/IEEE 29148 standard SRS report complete with executive summary, raw transcript audit, stakeholder clarification logs, refined FR/NFR tables, and quality comparison scorecard.
- **Word Document (.docx)**: Structured Word document with formal heading hierarchies, color-coded callouts, and formatted specification tables.
- **Markdown / TXT (.md)**: Clean, version-controllable specification file ready for GitHub repositories.
- **JSON Export**: Structured schema mapping IDs, priorities, acceptance criteria, metrics, and verification methods for direct import into Jira, Azure DevOps, or Linear.

---

## ⚖️ License
MIT License. Built for Software Engineering Take-Home Assignment 2.
