const express = require('express');
const router = express.Router();
const requirementGenerator = require('../services/requirement-generator');

// POST /api/requirements/generate
router.post('/generate', async (req, res) => {
  try {
    const { utterances = [], clarifications = [], domain = 'HR Tech' } = req.body;

    const result = requirementGenerator.generateRequirements(utterances, clarifications, domain);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
