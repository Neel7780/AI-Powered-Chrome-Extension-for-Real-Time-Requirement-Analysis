const express = require('express');
const router = express.Router();
const aiService = require('../services/ai-service');
const ambiguityDetector = require('../services/ambiguity-detector');
const sampleTranscripts = require('../data/sample-transcripts.json');

// POST /api/analyze/utterance
router.post('/utterance', async (req, res) => {
  try {
    const { text, speaker, timestamp, customApiKey, provider } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required for analysis' });
    }

    const result = await aiService.analyzeLiveUtterance({
      text,
      speaker,
      timestamp,
      customApiKey,
      provider
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/analyze/transcript
router.post('/transcript', async (req, res) => {
  try {
    const { utterances } = req.body;
    if (!utterances || !Array.isArray(utterances)) {
      return res.status(400).json({ error: 'Utterances array is required' });
    }

    const analysis = ambiguityDetector.analyzeTranscript(utterances);
    res.json({ success: true, data: analysis });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analyze/samples
router.get('/samples', (req, res) => {
  res.json({ success: true, data: sampleTranscripts });
});

module.exports = router;
