const express = require('express');
const router = express.Router();
const qualityEvaluator = require('../services/quality-evaluator');

// POST /api/evaluate/compare
router.post('/compare', (req, res) => {
  try {
    const { baseline, refined } = req.body;
    if (!baseline || !refined) {
      return res.status(400).json({ error: 'Both baseline and refined requirements sets are required' });
    }

    const baselineEval = qualityEvaluator.evaluateRequirementSet(baseline, false);
    const refinedEval = qualityEvaluator.evaluateRequirementSet(refined, true);
    const comparison = qualityEvaluator.compareQuality(baselineEval, refinedEval);

    res.json({
      success: true,
      data: {
        baseline: baselineEval,
        refined: refinedEval,
        comparison
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/evaluate/single
router.post('/single', (req, res) => {
  try {
    const { requirements, isClarified = false } = req.body;
    const result = qualityEvaluator.evaluateRequirementSet(requirements, isClarified);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
