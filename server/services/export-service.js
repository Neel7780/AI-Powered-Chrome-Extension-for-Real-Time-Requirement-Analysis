/**
 * Export Service
 * Generates comprehensive requirement specification documents and evaluation reports
 * in PDF, DOCX, TXT/Markdown, and JSON formats.
 */

const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType } = require('docx');

class ExportService {
  /**
   * Generate PDF Document buffer
   * @param {Object} data - { title, transcript, clarifications, baseline, refined, evaluation }
   * @returns {Promise<Buffer>}
   */
  async generatePDF(data) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        const title = data.title || 'AI-Powered Requirement Analysis & Quality Report';
        const evaluation = data.evaluation || {};
        const refined = data.refined || { frs: [], nfrs: [] };
        const baseline = data.baseline || { frs: [], nfrs: [] };
        const clarifications = data.clarifications || [];

        // Primary Colors
        const primaryColor = '#1e3a8a'; // Deep Indigo
        const secondaryColor = '#0d9488'; // Teal
        const darkGray = '#1f2937';
        const lightGray = '#4b5563';

        // --- Document Header ---
        doc.fontSize(20).fillColor(primaryColor).font('Helvetica-Bold').text(title, { align: 'left' });
        doc.fontSize(8.5).fillColor(lightGray).font('Helvetica').text(`Generated on: ${new Date().toLocaleString()} | Evaluation Informed by ISO/IEC/IEEE 29148 Principles | Demo Simulation`, { align: 'left' });
        doc.moveDown(0.8);

        // Header Divider
        doc.strokeColor(primaryColor).lineWidth(2).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(1);

        // --- Quality Index Banner ---
        const baselineOQI = evaluation.baseline?.overallQualityIndex ?? null;
        const refinedOQI = evaluation.refined?.overallQualityIndex ?? null;
        const delta = baselineOQI !== null && refinedOQI !== null ? refinedOQI - baselineOQI : null;
        const qualityLabel = value => value === null ? 'Not evaluated' : `${value}/100`;
        const deltaLabel = value => value === null ? 'Not evaluated' : `${value}%`;

        doc.rect(40, doc.y, 515, 55).fillAndStroke('#f0fdf4', '#16a34a');
        const boxY = doc.y + 12;
        doc.fillColor('#15803d').fontSize(14).font('Helvetica-Bold').text(`Quality Index Improvement: ${delta === null ? 'Not evaluated' : `+${delta} Points`} (${qualityLabel(baselineOQI)} -> ${qualityLabel(refinedOQI)})`, 55, boxY);
        doc.fontSize(9).font('Helvetica').fillColor('#166534').text(`Ambiguity: ${deltaLabel(evaluation.comparison?.delta?.ambiguityReduction ?? null)} | Testability: ${deltaLabel(evaluation.comparison?.delta?.testabilityGain ?? null)} | Completeness: ${deltaLabel(evaluation.comparison?.delta?.completenessGain ?? null)}`, 55, boxY + 20);
        doc.y = boxY + 50;
        doc.moveDown(1);

        // --- 1. Executive Summary ---
        doc.fontSize(14).fillColor(primaryColor).font('Helvetica-Bold').text('1. Executive Summary');
        doc.moveDown(0.4);
        doc.fontSize(10).fillColor(darkGray).font('Helvetica').text(
          'This report compares software requirements captured from a live stakeholder meeting before and after AI-assisted real-time clarification. By dynamically detecting ambiguous predicates and eliciting precise acceptance criteria during the discussion, requirement quality and testability improved significantly.'
        );
        doc.moveDown(1);

        // --- 2. Real-Time Clarification Log ---
        doc.fontSize(14).fillColor(primaryColor).font('Helvetica-Bold').text('2. Stakeholder Clarification Q&A Log');
        doc.moveDown(0.4);

        if (clarifications.length === 0) {
          doc.fontSize(10).fillColor(lightGray).font('Helvetica-Oblique').text('No clarification questions recorded.');
        } else {
          clarifications.forEach((c, idx) => {
            doc.fontSize(10).fillColor(secondaryColor).font('Helvetica-Bold').text(`[${c.category || 'Clarification'}] Q${idx + 1}: ${c.question}`);
            if (c.triggeredBy) {
              doc.fontSize(9).fillColor(lightGray).font('Helvetica-Oblique').text(`Triggered By: "${c.triggeredBy}"`);
            }
            doc.fontSize(9).fillColor('#065f46').font('Helvetica-Bold').text(`Stakeholder Response: ${c.selectedResponse}`);
            doc.moveDown(0.5);
          });
        }
        doc.moveDown(1);

        // --- 3. Functional Requirements (FR) ---
        doc.fontSize(14).fillColor(primaryColor).font('Helvetica-Bold').text('3. Refined Functional Requirements (FR)');
        doc.moveDown(0.4);

        refined.frs.forEach(fr => {
          doc.fontSize(11).fillColor('#1e40af').font('Helvetica-Bold').text(`${fr.id}: ${fr.title} [Priority: ${fr.priority || 'High'}]`);
          doc.fontSize(9).fillColor(darkGray).font('Helvetica').text(`Description: ${fr.description}`);
          if (fr.acceptanceCriteria && fr.acceptanceCriteria.length > 0) {
            doc.fontSize(9).fillColor('#374151').font('Helvetica-Bold').text('Acceptance Criteria:');
            fr.acceptanceCriteria.forEach(ac => {
              doc.fontSize(8.5).fillColor(darkGray).font('Helvetica').text(`  • ${ac}`);
            });
          }
          if (fr.verificationMethod) {
            doc.fontSize(8.5).fillColor('#4b5563').font('Helvetica-Oblique').text(`Verification Method: ${fr.verificationMethod}`);
          }
          doc.moveDown(0.6);
        });
        doc.moveDown(0.8);

        // --- 4. Categorized Non-Functional Requirements (NFR) ---
        doc.fontSize(14).fillColor(primaryColor).font('Helvetica-Bold').text('4. Categorized Non-Functional Requirements (NFR)');
        doc.moveDown(0.4);

        refined.nfrs.forEach(nfr => {
          doc.fontSize(11).fillColor('#0f766e').font('Helvetica-Bold').text(`${nfr.id}: ${nfr.title} (${nfr.category}) [Priority: ${nfr.priority || 'Critical'}]`);
          doc.fontSize(9).fillColor(darkGray).font('Helvetica').text(`Description: ${nfr.description}`);
          doc.fontSize(9).fillColor('#115e59').font('Helvetica-Bold').text(`Measurable Metric / Target: ${nfr.targetThreshold || nfr.metric}`);
          if (nfr.verificationMethod) {
            doc.fontSize(8.5).fillColor('#4b5563').font('Helvetica-Oblique').text(`Verification Method: ${nfr.verificationMethod}`);
          }
          doc.moveDown(0.6);
        });
        doc.moveDown(0.8);

        // --- 5. Quality Comparison Audit ---
        doc.addPage();
        doc.fontSize(14).fillColor(primaryColor).font('Helvetica-Bold').text('5. Quality Evaluation & Comparison Audit');
        doc.moveDown(0.6);

        const bMetrics = evaluation.baseline?.metrics || {};
        const rMetrics = evaluation.refined?.metrics || {};

        const metricScore = (side, metric) => evaluation[side]?.metrics?.[metric]?.score ?? null;
        const metricLabel = value => value === null ? 'Not evaluated' : `${value}%`;
        const metricDelta = (baseline, refined, lowerIsBetter = false) => {
          if (baseline === null || refined === null) return 'Not evaluated';
          const value = lowerIsBetter ? baseline - refined : refined - baseline;
          return `${value >= 0 ? '+' : ''}${value}%`;
        };
        const metricRows = [
          ['Evaluation Dimension', 'Without Clarification (Raw)', 'With Clarification (Refined)', 'Improvement'],
          ['Overall Quality Index', `${qualityLabel(baselineOQI)} (${evaluation.baseline?.qualityTier || 'Not evaluated'})`, `${qualityLabel(refinedOQI)} (${evaluation.refined?.qualityTier || 'Not evaluated'})`, delta === null ? 'Not evaluated' : `${delta >= 0 ? '+' : ''}${delta} pts`],
          ['Ambiguity (Lower is better)', metricLabel(metricScore('baseline', 'ambiguity')), metricLabel(metricScore('refined', 'ambiguity')), metricDelta(metricScore('baseline', 'ambiguity'), metricScore('refined', 'ambiguity'), true)],
          ['Completeness Coverage', metricLabel(metricScore('baseline', 'completeness')), metricLabel(metricScore('refined', 'completeness')), metricDelta(metricScore('baseline', 'completeness'), metricScore('refined', 'completeness'))],
          ['Testability / Verifiability', metricLabel(metricScore('baseline', 'testability')), metricLabel(metricScore('refined', 'testability')), metricDelta(metricScore('baseline', 'testability'), metricScore('refined', 'testability'))],
          ['Specificity & Measurability', metricLabel(metricScore('baseline', 'specificity')), metricLabel(metricScore('refined', 'specificity')), metricDelta(metricScore('baseline', 'specificity'), metricScore('refined', 'specificity'))],
          ['Traceability & Structure', metricLabel(metricScore('baseline', 'traceability')), metricLabel(metricScore('refined', 'traceability')), metricDelta(metricScore('baseline', 'traceability'), metricScore('refined', 'traceability'))]
        ];

        metricRows.forEach((row, rIdx) => {
          const isHeader = rIdx === 0;
          doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
             .fontSize(isHeader ? 9.5 : 8.5)
             .fillColor(isHeader ? primaryColor : darkGray);

          const startX = 40;
          const widths = [150, 130, 140, 95];
          let currX = startX;

          row.forEach((cell, cIdx) => {
            doc.text(cell, currX, doc.y, { width: widths[cIdx], continued: cIdx < row.length - 1 });
            currX += widths[cIdx];
          });
          doc.moveDown(0.5);
        });

        doc.moveDown(1.5);
        doc.fontSize(10).fillColor(lightGray).font('Helvetica-Oblique').text('Generated automatically by AI Real-Time Requirement Engineering Extension.', { align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generate DOCX Document buffer
   * @param {Object} data 
   * @returns {Promise<Buffer>}
   */
  async generateDOCX(data) {
    const title = data.title || 'AI-Powered Requirement Analysis & Quality Report';
    const evaluation = data.evaluation || {};
    const refined = data.refined || { frs: [], nfrs: [] };
    const baseline = data.baseline || { frs: [], nfrs: [] };
    const clarifications = data.clarifications || [];

    const baselineOQI = evaluation.baseline?.overallQualityIndex ?? 0;
    const refinedOQI = evaluation.refined?.overallQualityIndex ?? 0;

    const sections = [];

    // Header & Title
    const titleParagraph = new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 }
    });

    const metaParagraph = new Paragraph({
      children: [
        new TextRun({ text: `Generated: ${new Date().toLocaleString()} | Standard: ISO/IEC/IEEE 29148`, italics: true, color: '666666' })
      ],
      spacing: { after: 300 }
    });

    // Executive Summary
    const execHeading = new Paragraph({ text: '1. Executive Summary', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } });
    const execText = new Paragraph({
      text: 'This Software Requirements Specification (SRS) report presents requirements analyzed from a live stakeholder discussion. Real-time AI clarification resolved ambiguities, introduced quantifiable service level objectives (SLOs), and increased requirement testability.',
      spacing: { after: 200 }
    });

    // Clarification Q&A
    const clarHeading = new Paragraph({ text: '2. Stakeholder Clarification Q&A Log', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } });
    const clarParagraphs = clarifications.map(c => new Paragraph({
      children: [
        new TextRun({ text: `[${c.category || 'Clarification'}] Q: ${c.question}\n`, bold: true }),
        new TextRun({ text: `Triggered by: "${c.triggeredBy}"\n`, italics: true, color: '555555' }),
        new TextRun({ text: `Selected Specification: ${c.selectedResponse}\n`, bold: true, color: '006633' })
      ],
      spacing: { after: 150 }
    }));

    // Functional Requirements
    const frHeading = new Paragraph({ text: '3. Functional Requirements (FR)', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } });
    const frParagraphs = refined.frs.map(fr => new Paragraph({
      children: [
        new TextRun({ text: `${fr.id}: ${fr.title} [${fr.priority || 'High'}]\n`, bold: true, color: '003399' }),
        new TextRun({ text: `Description: ${fr.description}\n` }),
        new TextRun({ text: `Acceptance Criteria: ${(fr.acceptanceCriteria || []).join(' | ')}\n`, italics: true }),
        new TextRun({ text: `Verification: ${fr.verificationMethod || 'Automated Test'}\n`, color: '444444' })
      ],
      spacing: { after: 150 }
    }));

    // Non-Functional Requirements
    const nfrHeading = new Paragraph({ text: '4. Categorized Non-Functional Requirements (NFR)', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } });
    const nfrParagraphs = refined.nfrs.map(nfr => new Paragraph({
      children: [
        new TextRun({ text: `${nfr.id}: ${nfr.title} (${nfr.category}) [${nfr.priority || 'Critical'}]\n`, bold: true, color: '006666' }),
        new TextRun({ text: `Description: ${nfr.description}\n` }),
        new TextRun({ text: `Quantified Threshold: ${nfr.targetThreshold || nfr.metric}\n`, bold: true, color: '003300' }),
        new TextRun({ text: `Verification: ${nfr.verificationMethod || 'Benchmark'}\n`, color: '444444' })
      ],
      spacing: { after: 150 }
    }));

    // Quality Comparison
    const qualHeading = new Paragraph({ text: '5. Quality Evaluation & Comparison Audit', heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } });
    const qualSummary = new Paragraph({
      children: [
        new TextRun({ text: `Baseline Score (Without Clarification): ${baselineOQI}/100\n`, bold: true, color: 'CC0000' }),
        new TextRun({ text: `Refined Score (With AI Clarification): ${refinedOQI}/100\n`, bold: true, color: '009900' }),
        new TextRun({ text: `Quality Delta: +${refinedOQI - baselineOQI} Points improvement across testability, completeness, and precision.`, italics: true })
      ],
      spacing: { after: 200 }
    });

    const doc = new Document({
      sections: [{
        children: [
          titleParagraph,
          metaParagraph,
          execHeading,
          execText,
          clarHeading,
          ...clarParagraphs,
          frHeading,
          ...frParagraphs,
          nfrHeading,
          ...nfrParagraphs,
          qualHeading,
          qualSummary
        ]
      }]
    });

    return await Packer.toBuffer(doc);
  }

  /**
   * Generate Plain Text / Markdown Report
   * @param {Object} data 
   * @returns {string}
   */
  generateMarkdown(data) {
    const title = data.title || 'AI-Powered Requirement Analysis & Quality Report';
    const evaluation = data.evaluation || {};
    const refined = data.refined || { frs: [], nfrs: [] };
    const baseline = data.baseline || { frs: [], nfrs: [] };
    const clarifications = data.clarifications || [];

    const baselineOQI = evaluation.baseline?.overallQualityIndex ?? 0;
    const refinedOQI = evaluation.refined?.overallQualityIndex ?? 0;

    let md = `# ${title}\n`;
    md += `**Generated:** ${new Date().toLocaleString()} | **Evaluation:** Informed by ISO/IEC/IEEE 29148 Principles\n`;
    md += `*Demo Simulation: Stakeholder responses are simulated to demonstrate the clarification and refinement workflow.*\n\n`;
    md += `## 1. Executive Summary & Quality Scorecard\n\n`;
      md += `- **Without Clarification (Baseline Quality):** ${baselineOQI === 0 ? 'Not evaluated' : `${baselineOQI} / 100`} (${evaluation.baseline?.qualityTier || 'Not evaluated'})\n`;
      md += `- **With AI Clarification (Refined Quality):** ${refinedOQI === 0 ? 'Not evaluated' : `${refinedOQI} / 100`} (${evaluation.refined?.qualityTier || 'Not evaluated'})\n`;
      md += `- **Overall Quality Improvement:** ${baselineOQI === 0 || refinedOQI === 0 ? 'Not evaluated' : `+${refinedOQI - baselineOQI} Points`}\n`;
      md += `- **Ambiguity Reduction:** ${evaluation.comparison?.delta?.ambiguityReduction === undefined ? 'Not evaluated' : `-${evaluation.comparison?.delta?.ambiguityReduction}%`}\n`;
      md += `- **Testability Gain:** ${evaluation.comparison?.delta?.testabilityGain === undefined ? 'Not evaluated' : `+${evaluation.comparison?.delta?.testabilityGain}%`}\n\n`;

    md += `## 2. Stakeholder Clarification Q&A Log\n\n`;
    clarifications.forEach((c, idx) => {
      md += `### Q${idx + 1} [${c.category}]: ${c.question}\n`;
      if (c.triggeredBy) md += `> **Triggered Statement:** "${c.triggeredBy}"\n`;
      md += `**Stakeholder Clarification:** ${c.selectedResponse}\n\n`;
    });

    md += `## 3. Refined Functional Requirements (FR)\n\n`;
    refined.frs.forEach(fr => {
      md += `### ${fr.id}: ${fr.title} [Priority: ${fr.priority || 'High'}]\n`;
      md += `- **Description:** ${fr.description}\n`;
      if (fr.acceptanceCriteria) {
        md += `- **Acceptance Criteria:**\n`;
        fr.acceptanceCriteria.forEach(ac => md += `  - ${ac}\n`);
      }
      if (fr.clarificationReference) md += `- **Traceability:** ${fr.clarificationReference}\n`;
      if (fr.verificationMethod) md += `- **Verification Method:** ${fr.verificationMethod}\n`;
      md += `\n`;
    });

    md += `## 4. Categorized Non-Functional Requirements (NFR)\n\n`;
    refined.nfrs.forEach(nfr => {
      md += `### ${nfr.id}: ${nfr.title} [Category: ${nfr.category}] [Priority: ${nfr.priority || 'Critical'}]\n`;
      md += `- **Description:** ${nfr.description}\n`;
      md += `- **Target Metric / Threshold:** \`${nfr.targetThreshold || nfr.metric}\`\n`;
      if (nfr.clarificationReference) md += `- **Traceability:** ${nfr.clarificationReference}\n`;
      if (nfr.verificationMethod) md += `- **Verification Method:** ${nfr.verificationMethod}\n`;
      md += `\n`;
    });

    md += `## 5. Quality Comparison Audit Matrix\n\n`;
    md += `| Evaluation Dimension | Without Clarification | With Clarification | Improvement |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
      md += `| **Overall Quality Index** | ${baselineOQI === 0 ? 'Not evaluated' : `${baselineOQI}/100`} | ${refinedOQI === 0 ? 'Not evaluated' : `${refinedOQI}/100`} | ${baselineOQI === 0 || refinedOQI === 0 ? 'Not evaluated' : `+${refinedOQI - baselineOQI} pts`} |\n`;
      md += `| **Ambiguity Score** | ${evaluation.baseline?.metrics?.ambiguity?.score === undefined ? 'Not evaluated' : `${evaluation.baseline?.metrics?.ambiguity?.score}%`} | ${evaluation.refined?.metrics?.ambiguity?.score === undefined ? 'Not evaluated' : `${evaluation.refined?.metrics?.ambiguity?.score}%`} | ${evaluation.baseline?.metrics?.ambiguity?.score === undefined || evaluation.refined?.metrics?.ambiguity?.score === undefined ? 'Not evaluated' : `-${(evaluation.baseline?.metrics?.ambiguity?.score || 0) - (evaluation.refined?.metrics?.ambiguity?.score || 0)}%`} |\n`;
      md += `| **Completeness Coverage** | ${evaluation.baseline?.metrics?.completeness?.score === undefined ? 'Not evaluated' : `${evaluation.baseline?.metrics?.completeness?.score}%`} | ${evaluation.refined?.metrics?.completeness?.score === undefined ? 'Not evaluated' : `${evaluation.refined?.metrics?.completeness?.score}%`} | ${evaluation.baseline?.metrics?.completeness?.score === undefined || evaluation.refined?.metrics?.completeness?.score === undefined ? 'Not evaluated' : `+${(evaluation.refined?.metrics?.completeness?.score || 0) - (evaluation.baseline?.metrics?.completeness?.score || 0)}%`} |\n`;
      md += `| **Testability & Verifiability** | ${evaluation.baseline?.metrics?.testability?.score === undefined ? 'Not evaluated' : `${evaluation.baseline?.metrics?.testability?.score}%`} | ${evaluation.refined?.metrics?.testability?.score === undefined ? 'Not evaluated' : `${evaluation.refined?.metrics?.testability?.score}%`} | ${evaluation.baseline?.metrics?.testability?.score === undefined || evaluation.refined?.metrics?.testability?.score === undefined ? 'Not evaluated' : `+${(evaluation.refined?.metrics?.testability?.score || 0) - (evaluation.baseline?.metrics?.testability?.score || 0)}%`} |\n`;
      md += `| **Specificity & Measurability** | ${evaluation.baseline?.metrics?.specificity?.score === undefined ? 'Not evaluated' : `${evaluation.baseline?.metrics?.specificity?.score}%`} | ${evaluation.refined?.metrics?.specificity?.score === undefined ? 'Not evaluated' : `${evaluation.refined?.metrics?.specificity?.score}%`} | ${evaluation.baseline?.metrics?.specificity?.score === undefined || evaluation.refined?.metrics?.specificity?.score === undefined ? 'Not evaluated' : `+${(evaluation.refined?.metrics?.specificity?.score || 0) - (evaluation.baseline?.metrics?.specificity?.score || 0)}%`} |\n`;

    return md;
  }
}

module.exports = new ExportService();
