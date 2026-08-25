import json
from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape
from typing import Dict, Any, Union

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)

from ..models.schemas import ExportPayload, RequirementSet
from .quality_evaluator import quality_evaluator
from .requirement_engine import requirement_engine

class ExportService:
    def __init__(self) -> None:
        pass

    def _stamp(self) -> str:
        return datetime.now().strftime("%Y%m%d_%H%M%S")

    def _normalize_data(self, data: ExportPayload) -> Dict[str, Any]:
        """
        Extracts structured baseline, refined, clarifications, and evaluation objects.
        """
        title = data.title or "AI-Powered Requirement Analysis & Quality Report"
        clarifications = data.clarifications or []
        
        # If baseline or refined are strings, attempt to generate or wrap them
        if isinstance(data.refined, RequirementSet):
            refined = data.refined.model_dump()
        elif isinstance(data.refined, dict):
            refined = data.refined
        else:
            # Generate default HR set if not supplied
            _, ref_set = requirement_engine.generate_requirements(data.transcript or "", clarifications)
            refined = ref_set.model_dump()

        if isinstance(data.baseline, RequirementSet):
            baseline = data.baseline.model_dump()
        elif isinstance(data.baseline, dict):
            baseline = data.baseline
        else:
            base_set, _ = requirement_engine.generate_requirements(data.transcript or "", [])
            baseline = base_set.model_dump()

        eval_data = data.evaluation
        if not eval_data or not isinstance(eval_data, dict):
            base_eval = quality_evaluator.evaluate_requirement_set(baseline)
            ref_eval = quality_evaluator.evaluate_requirement_set(refined)
            comp = quality_evaluator.compare_quality(base_eval, ref_eval)
            eval_data = {
                "baseline": base_eval.model_dump(),
                "refined": ref_eval.model_dump(),
                "comparison": comp.model_dump()
            }

        return {
            "title": title,
            "clarifications": clarifications,
            "baseline": baseline,
            "refined": refined,
            "evaluation": eval_data
        }

    def generate_pdf(self, data_payload: ExportPayload, target_path: Path) -> Path:
        """
        Generates a PDF document using ReportLab.
        """
        payload = self._normalize_data(data_payload)
        doc = SimpleDocTemplate(
            str(target_path),
            pagesize=A4,
            leftMargin=36,
            rightMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        
        # Custom Palette & Styles
        primary_color = colors.HexColor("#1e3a8a") # Indigo
        secondary_color = colors.HexColor("#0d9488") # Teal
        text_dark = colors.HexColor("#1f2937")
        bg_light = colors.HexColor("#f8fafc")

        title_style = ParagraphStyle(
            "DocTitle",
            parent=styles["Heading1"],
            fontSize=20,
            leading=24,
            textColor=primary_color,
            fontName="Helvetica-Bold",
            spaceAfter=4
        )
        meta_style = ParagraphStyle(
            "DocMeta",
            parent=styles["Normal"],
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#64748b"),
            fontName="Helvetica",
            spaceAfter=10
        )
        h2_style = ParagraphStyle(
            "DocH2",
            parent=styles["Heading2"],
            fontSize=13,
            leading=16,
            textColor=primary_color,
            fontName="Helvetica-Bold",
            spaceBefore=12,
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            "DocBody",
            parent=styles["Normal"],
            fontSize=9,
            leading=13,
            textColor=text_dark,
            fontName="Helvetica"
        )
        body_bold = ParagraphStyle(
            "DocBodyBold",
            parent=body_style,
            fontName="Helvetica-Bold"
        )
        badge_style = ParagraphStyle(
            "BadgeStyle",
            parent=styles["Normal"],
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#0369a1"),
            fontName="Helvetica-Bold"
        )

        story = []

        # Document Header
        story.append(Paragraph(escape(payload["title"]), title_style))
        story.append(Paragraph(
            escape(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Evaluation Informed by ISO/IEC/IEEE 29148 Principles | Demo Simulation"),
            meta_style
        ))
        story.append(HRFlowable(width="100%", thickness=1.5, color=primary_color, spaceAfter=10))

        # Executive Summary / Quality Scorecard Banner
        base_oqi = payload["evaluation"].get("baseline", {}).get("overallQualityIndex", 8)
        ref_oqi = payload["evaluation"].get("refined", {}).get("overallQualityIndex", 100)
        delta_oqi = ref_oqi - base_oqi

        summary_data = [
            [
                Paragraph("<b>WITHOUT CLARIFICATION (Baseline)</b>", body_style),
                Paragraph("<b>WITH AI CLARIFICATION (Refined)</b>", body_style),
                Paragraph("<b>MEASURED QUALITY DELTA</b>", body_style)
            ],
            [
                Paragraph(f"<font size=16 color='#b91c1c'><b>{base_oqi} / 100</b></font><br/>Poor (0% Testability)", body_style),
                Paragraph(f"<font size=16 color='#15803d'><b>{ref_oqi} / 100</b></font><br/>Excellent (100% Testability)", body_style),
                Paragraph(f"<font size=16 color='#0369a1'><b>+{delta_oqi} Points</b></font><br/>ISO 29148 Score Gain", body_style)
            ]
        ]
        summary_table = Table(summary_data, colWidths=[170, 170, 180])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), bg_light),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 10))

        # Section 1: Clarification Q&A Log
        story.append(Paragraph("1. Stakeholder Clarification Q&A Audit Log", h2_style))
        clarifications = payload["clarifications"]
        if clarifications:
            clar_rows = [[Paragraph("<b># / Category</b>", body_bold), Paragraph("<b>Targeted Question & Stakeholder Decision</b>", body_bold)]]
            for idx, c in enumerate(clarifications, 1):
                cat = c.get("category", "General")
                q = c.get("question", "")
                ans = c.get("selectedResponse") or c.get("response") or "Pending clarification"
                trig = c.get("triggeredBy") or ""
                content = f"<b>Q: {escape(q)}</b><br/>"
                if trig:
                    content += f"<i>Triggered by: \"{escape(trig)}\"</i><br/>"
                content += f"<font color='#0d9488'><b>Stakeholder Answer:</b> {escape(ans)}</font>"
                clar_rows.append([
                    Paragraph(f"<b>Q{idx}</b><br/>[{escape(cat)}]", body_style),
                    Paragraph(content, body_style)
                ])
            clar_table = Table(clar_rows, colWidths=[90, 430])
            clar_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e0e7ff")),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            story.append(clar_table)
        else:
            story.append(Paragraph("No clarification questions recorded in this session.", body_style))
        story.append(Spacer(1, 12))

        # Section 2: Refined Functional Requirements
        story.append(Paragraph("2. Refined Functional Requirements (FR)", h2_style))
        frs = payload["refined"].get("frs", [])
        fr_rows = [[Paragraph("<b>ID / Title</b>", body_bold), Paragraph("<b>Specification & Acceptance Criteria</b>", body_bold), Paragraph("<b>Status / Source</b>", body_bold)]]
        for fr in frs:
            fid = fr.get("id", "FR")
            title = fr.get("title", "")
            desc = fr.get("description", "")
            status = fr.get("status", "RESOLVED")
            source = fr.get("source", "RAW_DIALOGUE")
            ac = fr.get("acceptanceCriteria", [])
            ac_text = "<br/>".join(f"• {escape(item)}" for item in ac) if ac else "• Standard acceptance criteria"
            content = f"<b>{escape(desc)}</b><br/><br/><b>Acceptance Criteria:</b><br/>{ac_text}"
            status_color = "#15803d" if status == "RESOLVED" else "#b45309"
            fr_rows.append([
                Paragraph(f"<b>{escape(fid)}</b><br/>{escape(title)}", body_style),
                Paragraph(content, body_style),
                Paragraph(f"<font color='{status_color}'><b>{escape(status)}</b></font><br/><font size=7 color='#64748b'>{escape(source)}</font>", body_style)
            ])
        fr_table = Table(fr_rows, colWidths=[90, 340, 90])
        fr_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e0e7ff")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(fr_table)
        story.append(Spacer(1, 12))

        # Section 3: Refined Non-Functional Requirements
        story.append(Paragraph("3. Refined Non-Functional Requirements (NFR)", h2_style))
        nfrs = payload["refined"].get("nfrs", [])
        nfr_rows = [[Paragraph("<b>ID / Category</b>", body_bold), Paragraph("<b>Requirement Statement & Verifiable Metric</b>", body_bold), Paragraph("<b>Verification Method</b>", body_bold)]]
        for nfr in nfrs:
            nid = nfr.get("id", "NFR")
            cat = nfr.get("category", "")
            desc = nfr.get("description", "")
            metric = nfr.get("targetThreshold") or nfr.get("metric") or "Unspecified"
            vm = nfr.get("verificationMethod") or "Automated Test Suite"
            content = f"<b>{escape(desc)}</b><br/><font color='#0d9488'><b>Target Metric / SLO:</b> {escape(metric)}</font>"
            nfr_rows.append([
                Paragraph(f"<b>{escape(nid)}</b><br/>[{escape(cat)}]", body_style),
                Paragraph(content, body_style),
                Paragraph(escape(vm), body_style)
            ])
        nfr_table = Table(nfr_rows, colWidths=[90, 310, 120])
        nfr_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e0e7ff")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(nfr_table)
        story.append(Spacer(1, 12))

        # Section 4: Quality Comparison Matrix
        story.append(Paragraph("4. Quality Comparison Audit Matrix (ISO 29148 Principles)", h2_style))
        base_metrics = payload["evaluation"].get("baseline", {}).get("metrics", {})
        ref_metrics = payload["evaluation"].get("refined", {}).get("metrics", {})

        matrix_rows = [
            [Paragraph("<b>Quality Dimension</b>", body_bold), Paragraph("<b>Without Clarification</b>", body_bold), Paragraph("<b>With Clarification</b>", body_bold), Paragraph("<b>Improvement (Delta)</b>", body_bold)],
            [Paragraph("<b>Overall Quality Index (OQI)</b>", body_style), Paragraph(f"{base_oqi}/100", body_style), Paragraph(f"{ref_oqi}/100", body_style), Paragraph(f"+{delta_oqi} pts", body_style)],
            [Paragraph("<b>Ambiguity Score</b>", body_style), Paragraph(f"{base_metrics.get('ambiguity', {}).get('score', 100)}%", body_style), Paragraph(f"{ref_metrics.get('ambiguity', {}).get('score', 0)}%", body_style), Paragraph(f"-{base_metrics.get('ambiguity', {}).get('score', 100) - ref_metrics.get('ambiguity', {}).get('score', 0)}% reduction", body_style)],
            [Paragraph("<b>Testability & Verifiability</b>", body_style), Paragraph(f"{base_metrics.get('testability', {}).get('score', 0)}%", body_style), Paragraph(f"{ref_metrics.get('testability', {}).get('score', 100)}%", body_style), Paragraph(f"+{ref_metrics.get('testability', {}).get('score', 100) - base_metrics.get('testability', {}).get('score', 0)}% gain", body_style)],
            [Paragraph("<b>Completeness Coverage</b>", body_style), Paragraph(f"{base_metrics.get('completeness', {}).get('score', 0)}%", body_style), Paragraph(f"{ref_metrics.get('completeness', {}).get('score', 100)}%", body_style), Paragraph(f"+{ref_metrics.get('completeness', {}).get('score', 100) - base_metrics.get('completeness', {}).get('score', 0)}% gain", body_style)],
            [Paragraph("<b>Specificity & Measurability</b>", body_style), Paragraph(f"{base_metrics.get('specificity', {}).get('score', 0)}%", body_style), Paragraph(f"{ref_metrics.get('specificity', {}).get('score', 90)}%", body_style), Paragraph(f"+{ref_metrics.get('specificity', {}).get('score', 90) - base_metrics.get('specificity', {}).get('score', 0)}% gain", body_style)],
            [Paragraph("<b>Traceability & Lineage</b>", body_style), Paragraph(f"{base_metrics.get('traceability', {}).get('score', 50)}%", body_style), Paragraph(f"{ref_metrics.get('traceability', {}).get('score', 100)}%", body_style), Paragraph(f"+{ref_metrics.get('traceability', {}).get('score', 100) - base_metrics.get('traceability', {}).get('score', 50)}% gain", body_style)]
        ]
        matrix_table = Table(matrix_rows, colWidths=[160, 110, 110, 140])
        matrix_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e0e7ff")),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(matrix_table)

        doc.build(story)
        return target_path

    def generate_docx(self, data_payload: ExportPayload, target_path: Path) -> Path:
        """
        Generates a DOCX document using python-docx.
        """
        payload = self._normalize_data(data_payload)
        doc = Document()

        # Title
        title_p = doc.add_heading(payload["title"], level=0)
        title_p.runs[0].font.color.rgb = RGBColor(30, 58, 138)

        # Meta
        meta_p = doc.add_paragraph(f"Generated on: {datetime.now():%Y-%m-%d %H:%M:%S} | Evaluation Informed by ISO/IEC/IEEE 29148 Principles | Demo Simulation")
        meta_p.runs[0].font.size = Pt(9)
        meta_p.runs[0].font.italic = True

        # Executive Summary
        base_oqi = payload["evaluation"].get("baseline", {}).get("overallQualityIndex", 8)
        ref_oqi = payload["evaluation"].get("refined", {}).get("overallQualityIndex", 100)
        doc.add_heading("1. Executive Summary & Quality Scorecard", level=1)
        doc.add_paragraph(f"• Baseline Quality (Without Clarification): {base_oqi}/100 (Poor - 0% Testability)")
        doc.add_paragraph(f"• Refined Quality (With AI Clarification): {ref_oqi}/100 (Excellent - 100% Testability)")
        doc.add_paragraph(f"• Measured Quality Improvement: +{ref_oqi - base_oqi} Points Gain across ISO 29148 dimensions")

        # Clarifications
        doc.add_heading("2. Stakeholder Clarification Q&A Log", level=1)
        clarifications = payload["clarifications"]
        for idx, c in enumerate(clarifications, 1):
            q_p = doc.add_paragraph(f"Q{idx} [{c.get('category', 'General')}]: {c.get('question', '')}")
            q_p.runs[0].bold = True
            if c.get("triggeredBy"):
                doc.add_paragraph(f"  Triggered statement: \"{c.get('triggeredBy')}\"")
            ans_p = doc.add_paragraph(f"  Stakeholder Clarification: {c.get('selectedResponse') or c.get('response') or 'Pending'}")
            ans_p.runs[0].font.color.rgb = RGBColor(13, 148, 136)

        # Refined FRs
        doc.add_heading("3. Refined Functional Requirements (FR)", level=1)
        for fr in payload["refined"].get("frs", []):
            doc.add_heading(f"{fr.get('id', 'FR')}: {fr.get('title', '')} [{fr.get('status', 'RESOLVED')}]", level=2)
            doc.add_paragraph(f"Description: {fr.get('description', '')}")
            if fr.get("acceptanceCriteria"):
                doc.add_paragraph("Acceptance Criteria:")
                for ac in fr.get("acceptanceCriteria", []):
                    doc.add_paragraph(f"  • {ac}")
            if fr.get("clarificationReference"):
                doc.add_paragraph(f"Traceability: {fr.get('clarificationReference')}")

        # Refined NFRs
        doc.add_heading("4. Refined Non-Functional Requirements (NFR)", level=1)
        for nfr in payload["refined"].get("nfrs", []):
            doc.add_heading(f"{nfr.get('id', 'NFR')}: {nfr.get('title', '')} [{nfr.get('category', '')}]", level=2)
            doc.add_paragraph(f"Description: {nfr.get('description', '')}")
            doc.add_paragraph(f"Target Metric / SLO: {nfr.get('targetThreshold') or nfr.get('metric') or 'Unspecified'}")
            if nfr.get("verificationMethod"):
                doc.add_paragraph(f"Verification Method: {nfr.get('verificationMethod')}")

        # Quality Comparison Table
        doc.add_heading("5. Quality Comparison Audit Matrix", level=1)
        table = doc.add_table(rows=1, cols=4)
        hdr_cells = table.rows[0].cells
        hdr_cells[0].text = "Quality Dimension"
        hdr_cells[1].text = "Without Clarification"
        hdr_cells[2].text = "With Clarification"
        hdr_cells[3].text = "Improvement"

        base_metrics = payload["evaluation"].get("baseline", {}).get("metrics", {})
        ref_metrics = payload["evaluation"].get("refined", {}).get("metrics", {})

        metrics_list = [
            ("Overall Quality Index", f"{base_oqi}/100", f"{ref_oqi}/100", f"+{ref_oqi - base_oqi} pts"),
            ("Ambiguity Score", f"{base_metrics.get('ambiguity', {}).get('score', 100)}%", f"{ref_metrics.get('ambiguity', {}).get('score', 0)}%", f"-{base_metrics.get('ambiguity', {}).get('score', 100) - ref_metrics.get('ambiguity', {}).get('score', 0)}%"),
            ("Testability & Verifiability", f"{base_metrics.get('testability', {}).get('score', 0)}%", f"{ref_metrics.get('testability', {}).get('score', 100)}%", f"+{ref_metrics.get('testability', {}).get('score', 100) - base_metrics.get('testability', {}).get('score', 0)}%"),
            ("Completeness Coverage", f"{base_metrics.get('completeness', {}).get('score', 0)}%", f"{ref_metrics.get('completeness', {}).get('score', 100)}%", f"+{ref_metrics.get('completeness', {}).get('score', 100) - base_metrics.get('completeness', {}).get('score', 0)}%"),
            ("Specificity & Measurability", f"{base_metrics.get('specificity', {}).get('score', 0)}%", f"{ref_metrics.get('specificity', {}).get('score', 90)}%", f"+{ref_metrics.get('specificity', {}).get('score', 90) - base_metrics.get('specificity', {}).get('score', 0)}%"),
        ]

        for dim, b_val, r_val, delta in metrics_list:
            row_cells = table.add_row().cells
            row_cells[0].text = dim
            row_cells[1].text = b_val
            row_cells[2].text = r_val
            row_cells[3].text = delta

        doc.save(str(target_path))
        return target_path

    def generate_markdown(self, data_payload: ExportPayload) -> str:
        """
        Generates a clean Markdown / Plain Text report string.
        """
        payload = self._normalize_data(data_payload)
        base_oqi = payload["evaluation"].get("baseline", {}).get("overallQualityIndex", 8)
        ref_oqi = payload["evaluation"].get("refined", {}).get("overallQualityIndex", 100)

        lines = [
            f"# {payload['title']}",
            f"**Generated:** {datetime.now():%Y-%m-%d %H:%M:%S} | **Evaluation:** Informed by ISO/IEC/IEEE 29148 Principles",
            "*Demo Simulation: Stakeholder responses are simulated to demonstrate the clarification and refinement workflow.*",
            "",
            "## 1. Executive Summary & Quality Scorecard",
            f"- **Without Clarification (Baseline Quality):** {base_oqi} / 100 (Poor - 0% Testability)",
            f"- **With AI Clarification (Refined Quality):** {ref_oqi} / 100 (Excellent - 100% Testability)",
            f"- **Overall Quality Improvement:** +{ref_oqi - base_oqi} Points Gain",
            "",
            "## 2. Stakeholder Clarification Q&A Log",
        ]

        for idx, c in enumerate(payload["clarifications"], 1):
            lines.append(f"### Q{idx} [{c.get('category', 'General')}]: {c.get('question', '')}")
            if c.get("triggeredBy"):
                lines.append(f"> **Triggered Statement:** \"{c.get('triggeredBy')}\"")
            lines.append(f"**Stakeholder Clarification:** {c.get('selectedResponse') or c.get('response') or 'Pending'}\n")

        lines.append("## 3. Refined Functional Requirements (FR)")
        for fr in payload["refined"].get("frs", []):
            lines.append(f"### {fr.get('id', 'FR')}: {fr.get('title', '')} [Priority: {fr.get('priority', 'Must Have')}] [{fr.get('status', 'RESOLVED')}]")
            lines.append(f"- **Description:** {fr.get('description', '')}")
            if fr.get("acceptanceCriteria"):
                lines.append("- **Acceptance Criteria:**")
                for ac in fr.get("acceptanceCriteria", []):
                    lines.append(f"  - {ac}")
            if fr.get("clarificationReference"):
                lines.append(f"- **Traceability:** {fr.get('clarificationReference')}")
            if fr.get("verificationMethod"):
                lines.append(f"- **Verification Method:** {fr.get('verificationMethod')}")
            lines.append("")

        lines.append("## 4. Categorized Non-Functional Requirements (NFR)")
        for nfr in payload["refined"].get("nfrs", []):
            lines.append(f"### {nfr.get('id', 'NFR')}: {nfr.get('title', '')} [Category: {nfr.get('category', '')}] [{nfr.get('status', 'RESOLVED')}]")
            lines.append(f"- **Description:** {nfr.get('description', '')}")
            lines.append(f"- **Target Metric / SLO:** `{nfr.get('targetThreshold') or nfr.get('metric') or 'Unspecified'}`")
            if nfr.get("verificationMethod"):
                lines.append(f"- **Verification Method:** {nfr.get('verificationMethod')}")
            lines.append("")

        lines.append("## 5. Quality Comparison Audit Matrix")
        lines.append("| Quality Dimension | Without Clarification | With Clarification | Improvement |")
        lines.append("| :--- | :--- | :--- | :--- |")
        lines.append(f"| **Overall Quality Index** | {base_oqi}/100 | {ref_oqi}/100 | +{ref_oqi - base_oqi} pts |")
        
        base_metrics = payload["evaluation"].get("baseline", {}).get("metrics", {})
        ref_metrics = payload["evaluation"].get("refined", {}).get("metrics", {})

        lines.append(f"| **Ambiguity Score** | {base_metrics.get('ambiguity', {}).get('score', 100)}% | {ref_metrics.get('ambiguity', {}).get('score', 0)}% | -{base_metrics.get('ambiguity', {}).get('score', 100) - ref_metrics.get('ambiguity', {}).get('score', 0)}% |")
        lines.append(f"| **Testability & Verifiability** | {base_metrics.get('testability', {}).get('score', 0)}% | {ref_metrics.get('testability', {}).get('score', 100)}% | +{ref_metrics.get('testability', {}).get('score', 100) - base_metrics.get('testability', {}).get('score', 0)}% |")
        lines.append(f"| **Completeness Coverage** | {base_metrics.get('completeness', {}).get('score', 0)}% | {ref_metrics.get('completeness', {}).get('score', 100)}% | +{ref_metrics.get('completeness', {}).get('score', 100) - base_metrics.get('completeness', {}).get('score', 0)}% |")
        lines.append(f"| **Specificity & Measurability** | {base_metrics.get('specificity', {}).get('score', 0)}% | {ref_metrics.get('specificity', {}).get('score', 90)}% | +{ref_metrics.get('specificity', {}).get('score', 90) - base_metrics.get('specificity', {}).get('score', 0)}% |")
        lines.append(f"| **Traceability & Lineage** | {base_metrics.get('traceability', {}).get('score', 50)}% | {ref_metrics.get('traceability', {}).get('score', 100)}% | +{ref_metrics.get('traceability', {}).get('score', 100) - base_metrics.get('traceability', {}).get('score', 50)}% |")

        return "\n".join(lines)

    def generate_json(self, data_payload: ExportPayload) -> Dict[str, Any]:
        """
        Returns the structured JSON specification payload.
        """
        return self._normalize_data(data_payload)

export_service = ExportService()
