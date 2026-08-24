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

    const baselineEval = qualityEvaluator.evaluateRequirementSet(baseline);
    const refinedEval = qualityEvaluator.evaluateRequirementSet(refined);
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
    const { requirements } = req.body;
    const result = qualityEvaluator.evaluateRequirementSet(requirements);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
