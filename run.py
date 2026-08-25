import uvicorn
import os
from backend.app.config import settings

if __name__ == "__main__":
    port = int(os.getenv("PORT", settings.PORT))
    host = os.getenv("HOST", settings.HOST)
    print(f"🚀 Starting {settings.PROJECT_NAME} v{settings.VERSION}")
    print(f"📡 Server running at http://localhost:{port}")
    print(f"📚 OpenAPI documentation available at http://localhost:{port}/docs")
    uvicorn.run("backend.app.main:app", host=host, port=port, reload=True)
