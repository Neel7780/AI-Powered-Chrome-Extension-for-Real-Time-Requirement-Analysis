const assert = require('assert');
const qualityEvaluator = require('../server/services/quality-evaluator');
const requirementGenerator = require('../server/services/requirement-generator');
const sampleTranscripts = require('../server/data/sample-transcripts.json');

console.log('--- Running Quality Metrics Evaluation Tests ---');

const resumeMeeting = sampleTranscripts[0];
const { baseline, refined } = requirementGenerator.generateRequirements(
  resumeMeeting.utterances,
  resumeMeeting.sampleClarifications,
  resumeMeeting.domain
);

// Evaluate Baseline
const baselineEval = qualityEvaluator.evaluateRequirementSet(baseline, false);
console.log(`Baseline Overall Quality Index: ${baselineEval.overallQualityIndex}/100 (${baselineEval.qualityTier})`);
assert(baselineEval.overallQualityIndex < 60, 'Baseline quality should be moderate/poor without clarification');
assert(baselineEval.metrics.ambiguity.score > 50, 'Baseline ambiguity score should be high');
assert(baselineEval.metrics.testability.score < 50, 'Baseline testability score should be low');
console.log('✓ Test 1 Passed: Evaluated Baseline quality');

// Evaluate Refined
const refinedEval = qualityEvaluator.evaluateRequirementSet(refined, true);
console.log(`Refined Overall Quality Index: ${refinedEval.overallQualityIndex}/100 (${refinedEval.qualityTier})`);
assert(refinedEval.overallQualityIndex >= 85, 'Refined quality should be excellent (>=85)');
assert(refinedEval.metrics.ambiguity.score <= 25, 'Refined ambiguity should be low (<=25)');
assert(refinedEval.metrics.testability.score >= 80, 'Refined testability should be high (>=80)');
assert(refinedEval.metrics.completeness.score >= 80, 'Refined completeness should be high (>=80)');
console.log('✓ Test 2 Passed: Evaluated Refined quality');

// Compare Quality
const comparison = qualityEvaluator.compareQuality(baselineEval, refinedEval);
console.log(`Quality Delta: +${comparison.delta.overallQualityIndex} points (+${comparison.percentageImprovement}% improvement)`);
assert(comparison.delta.overallQualityIndex > 30, 'Should demonstrate significant quality increase');
assert(comparison.delta.ambiguityReduction > 40, 'Should demonstrate major ambiguity reduction');
assert(comparison.keyFindings.length >= 4, 'Should provide key findings summary');
console.log('✓ Test 3 Passed: Quality comparison delta verified');

console.log('All Quality Metrics Tests Passed!\n');
