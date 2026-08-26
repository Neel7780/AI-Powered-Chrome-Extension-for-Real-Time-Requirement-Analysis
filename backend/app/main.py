import logging
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse

from .config import settings
from .routes.analyze import router as analyze_router
from .routes.clarify import router as clarify_router
from .routes.refine import router as refine_router
from .routes.compare import router as compare_router
from .routes.questions import router as questions_router
from .routes.export import router as export_router
from .routes.session import router as session_router
from .services.llm_service import llm_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
)
logger = logging.getLogger("AIRequirementAnalyst")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for Chrome Extension & Local Development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(analyze_router)
app.include_router(clarify_router)
app.include_router(refine_router)
app.include_router(compare_router)
app.include_router(questions_router)
app.include_router(export_router)
app.include_router(session_router)

# Health & Status Endpoints
@app.get("/health")
@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "ai_engine": "LangChain + Gemini 2.5 Flash" if llm_service.is_available() else "Deterministic Rule Fallback",
        "llm_connected": llm_service.is_available(),
        "primary_model": settings.PRIMARY_MODEL,
        "available_models": settings.MODELS,
        "features": [
            "Real-Time Ambiguity Detection",
            "Targeted Clarification Question Generation",
            "Response-Driven Requirement Refinement",
            "NFR Categorization",
            "Deterministic Quality Evaluation (ISO 29148 Principles)",
            "Multi-Format Export (PDF, DOCX, TXT, JSON)"
        ]
    }

# Specific sample data route for Webapp compatibility
@app.get("/api/sample-data")
@app.get("/api/analyze/samples")
def get_sample_data():
    sample_path = settings.BASE_DIR / "server" / "data" / "sample-transcripts.json"
    if sample_path.exists():
        import json
        with open(sample_path, "r", encoding="utf-8") as f:
            return {"success": True, "data": json.load(f)}
    return {"success": False, "data": []}

# Catch-all 404 handler for API routes to avoid returning HTML
@app.api_route("/api/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def catch_all_api(request: Request, path_name: str):
    return JSONResponse(
        status_code=404,
        content={"success": False, "error": f"Unknown API endpoint: {request.method} /api/{path_name}"}
    )

# Serve Webapp Static Files
if settings.WEBAPP_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(settings.WEBAPP_DIR / "assets")), name="assets") if (settings.WEBAPP_DIR / "assets").exists() else None
    
    @app.get("/")
    async def serve_root():
        index_path = settings.WEBAPP_DIR / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
        return health_check()

    app.mount("/", StaticFiles(directory=str(settings.WEBAPP_DIR), html=True), name="webapp")
