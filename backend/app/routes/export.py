import json
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse, PlainTextResponse
from ..models.schemas import ExportPayload
from ..services.export_service import export_service
from ..config import settings

router = APIRouter(tags=["Export"])

@router.post("/export/{kind}")
@router.post("/api/export/{kind}")
def export_report(kind: str, payload: ExportPayload):
    """
    Exports comprehensive requirement specification and quality audit reports
    in PDF, DOCX, TXT/Markdown, or JSON formats.
    """
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    kind_lower = kind.lower()

    if kind_lower == "pdf":
        target = settings.EXPORTS_DIR / f"requirements_report_{stamp}.pdf"
        export_service.generate_pdf(payload, target)
        return FileResponse(
            path=str(target),
            media_type="application/pdf",
            filename=target.name
        )

    elif kind_lower in ["docx", "doc"]:
        target = settings.EXPORTS_DIR / f"requirements_report_{stamp}.docx"
        export_service.generate_docx(payload, target)
        return FileResponse(
            path=str(target),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=target.name
        )

    elif kind_lower in ["txt", "md", "markdown", "text"]:
        md_text = export_service.generate_markdown(payload)
        target = settings.EXPORTS_DIR / f"requirements_report_{stamp}.md"
        target.write_text(md_text, encoding="utf-8")
        return PlainTextResponse(content=md_text, media_type="text/markdown")

    elif kind_lower in ["json"]:
        json_data = export_service.generate_json(payload)
        target = settings.EXPORTS_DIR / f"requirements_report_{stamp}.json"
        target.write_text(json.dumps(json_data, indent=2), encoding="utf-8")
        return json_data

    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported export format '{kind}'. Supported formats: pdf, docx, txt, markdown, json"
        )
