import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root or current directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
ENV_PATH = PROJECT_ROOT / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

class Settings:
    PROJECT_NAME: str = "AI-Powered Real-Time Requirement Analysis Platform"
    VERSION: str = "2.0.0"
    DESCRIPTION: str = "LangChain & FastAPI assisted real-time meeting ambiguity detection, requirement refinement, and ISO/IEC/IEEE 29148 informed quality evaluation."
    
    # API Keys: Support both GOOGLE_API_KEY and GEMINI_API_KEY (matching Lab 2 / Lab 3 and assignment specs)
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY") or ""
    
    # Model Configurations
    PRIMARY_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    FALLBACK_MODELS: list[str] = [
        os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-1.5-flash"
    ]
    # Deduplicate while preserving order
    MODELS: list[str] = list(dict.fromkeys(FALLBACK_MODELS))
    
    # Server Settings
    PORT: int = int(os.getenv("PORT", "3000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    
    # Directories
    BASE_DIR: Path = PROJECT_ROOT
    EXPORTS_DIR: Path = PROJECT_ROOT / "exports"
    WEBAPP_DIR: Path = PROJECT_ROOT / "webapp"

settings = Settings()
settings.EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
