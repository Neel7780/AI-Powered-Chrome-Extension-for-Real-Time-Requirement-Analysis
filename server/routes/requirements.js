const express = require('express');
const router = express.Router();
const aiService = require('../services/ai-service');

// POST /api/requirements/generate
router.post('/generate', async (req, res) => {
  try {
    const { utterances = [], clarifications = [], domain = 'HR Tech' } = req.body;

    const result = await aiService.generateRequirementsWithAI(utterances, clarifications, domain);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
