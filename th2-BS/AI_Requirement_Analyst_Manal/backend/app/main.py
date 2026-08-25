from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .ai import (
    GeminiService, build_baseline_prompt, build_clarification_prompt,
    build_refinement_prompt, build_comparison_prompt, extract_questions
)
from .exporters import write_docx, write_pdf, write_txt
from .metrics import evaluate
from .models import (
    TranscriptPayload, RefinementPayload, ComparisonPayload, ExportPayload
)

load_dotenv()

EXPORT_DIR = Path(__file__).resolve().parent.parent / "exports"
EXPORT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="AI Requirement Analyst",
    version="2.0.0",
    description="AI-assisted requirement analysis and clarification service.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_ai = None

def ai() -> GeminiService:
    global _ai
    if _ai is None:
        _ai = GeminiService()
    return _ai

@app.get("/")
def health():
    return {
        "service": "AI Requirement Analyst",
        "status": "running",
        "features": [
            "baseline extraction", "ambiguity detection", "clarification",
            "requirement refinement", "before-after evaluation",
            "TXT/PDF/DOCX export",
        ],
    }

@app.post("/analyze")
def analyze(payload: TranscriptPayload):
    result = ai().generate(build_baseline_prompt(payload.transcript))
    return {"baseline": result, "metrics": evaluate(result)}

@app.post("/clarify")
def clarify(payload: TranscriptPayload):
    result = ai().generate(build_clarification_prompt(payload.transcript))
    return {"analysis": result, "questions": extract_questions(result)}

@app.post("/refine")
def refine(payload: RefinementPayload):
    result = ai().generate(
        build_refinement_prompt(payload.transcript, payload.questions, payload.responses)
    )
    return {"refined": result, "metrics": evaluate(result)}

@app.post("/compare")
def compare(payload: ComparisonPayload):
    baseline_metrics = evaluate(payload.baseline)
    refined_metrics = evaluate(payload.refined)
    qualitative = ai().generate(
        build_comparison_prompt(payload.baseline, payload.refined)
    )
    return {
        "baseline_metrics": baseline_metrics,
        "refined_metrics": refined_metrics,
        "qualitative": qualitative,
    }

@app.post("/export/{kind}")
def export(kind: str, payload: ExportPayload):
    if kind == "txt":
        path, media = write_txt(payload, EXPORT_DIR), "text/plain"
    elif kind == "pdf":
        path, media = write_pdf(payload, EXPORT_DIR), "application/pdf"
    elif kind == "docx":
        path, media = (
            write_docx(payload, EXPORT_DIR),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
    else:
        raise HTTPException(status_code=404, detail="Supported formats: txt, pdf, docx")
    return FileResponse(path=path, media_type=media, filename=path.name)
