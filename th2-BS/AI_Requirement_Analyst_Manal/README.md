# Requirement Lens — AI-Powered Requirement Analysis

An independently implemented Chrome Extension + FastAPI application for
Take Home Assignment 2.

## Features

- Transcript paste/capture workflow
- Baseline Functional Requirements (FR)
- Baseline Non-Functional Requirements (NFR)
- Ambiguity detection
- AI clarification questions
- Stakeholder response collection
- Refined FR/NFR generation
- NFR categorization
- Before/after quality comparison
- Heuristic specificity/testability metrics
- TXT, PDF and DOCX export

The implementation follows the assignment's requested workflow while using a
separate project structure, naming scheme, prompt design, UI, state handling,
and export implementation.

## Setup

### Backend

```bash
cd backend
python -m venv .venv
```

Windows:
```bash
.venv\Scripts\activate
```

Linux/macOS:
```bash
source .venv/bin/activate
```

```bash
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and add your Gemini API key:

```text
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash
```

Start the API:

```bash
uvicorn app.main:app --reload --port 8000
```

### Chrome extension

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the `extension` folder.
5. Open the extension.

For the assignment demo, paste the supplied conversation into the transcript
box. The Zoom capture button is also included and attempts DOM-based reading
of transcript/caption elements; manual paste remains the fallback because
meeting-page DOM structures can change.

## Demo flow

1. Paste the assignment transcript.
2. Build baseline.
3. Find ambiguity + questions.
4. Enter stakeholder responses.
5. Generate refined requirements.
6. Compare before vs after.
7. Export TXT/PDF/DOCX.
