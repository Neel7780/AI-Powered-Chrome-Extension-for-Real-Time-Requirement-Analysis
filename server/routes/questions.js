const express = require('express');
const router = express.Router();
const aiService = require('../services/ai-service');
const ambiguityDetector = require('../services/ambiguity-detector');

// POST /api/questions/generate
router.post('/generate', async (req, res) => {
  try {
    const { text, detectedFlags } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text statement is required' });
    }

    let flags = detectedFlags;
    if (!flags) {
      const analysis = ambiguityDetector.analyzeUtterance(text);
      flags = analysis.detectedFlags;
    }

    const question = aiService.generateFallbackQuestion(text, flags);
    res.json({ success: true, data: question });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
