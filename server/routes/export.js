const express = require('express');
const router = express.Router();
const exportService = require('../services/export-service');

// POST /api/export/pdf
router.post('/pdf', async (req, res) => {
  try {
    const data = req.body;
    const pdfBuffer = await exportService.generatePDF(data);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="requirement-specification-report.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/export/docx
router.post('/docx', async (req, res) => {
  try {
    const data = req.body;
    const docxBuffer = await exportService.generateDOCX(data);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="requirement-specification-report.docx"');
    res.send(docxBuffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/export/txt
router.post('/txt', (req, res) => {
  try {
    const data = req.body;
    const markdown = exportService.generateMarkdown(data);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="requirement-specification-report.txt"');
    res.send(markdown);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/export/json
router.post('/json', (req, res) => {
  try {
    const data = req.body;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="requirement-specification.json"');
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
