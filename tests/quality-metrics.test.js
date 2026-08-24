const assert = require('assert');
const qualityEvaluator = require('../server/services/quality-evaluator');
const requirementGenerator = require('../server/services/requirement-generator');
const sampleTranscripts = require('../server/data/sample-transcripts.json');

console.log('--- Running Dynamic Quality Metrics Tests ---');

const resumeMeeting = sampleTranscripts[0];

// Test 1: Evaluate Baseline Quality (No clarifications)
const { baseline } = requirementGenerator.generateRequirements(
  resumeMeeting.utterances,
  [],
  resumeMeeting.domain
);

const baselineEval = qualityEvaluator.evaluateRequirementSet(baseline);
console.log(`Baseline Overall Quality Index: ${baselineEval.overallQualityIndex}/100 (${baselineEval.qualityTier})`);
assert(baselineEval.overallQualityIndex <= 45, `Baseline quality should be poor/moderate without clarification (got ${baselineEval.overallQualityIndex})`);
assert(baselineEval.metrics.ambiguity.score >= 50, 'Baseline ambiguity score should be elevated');
assert(baselineEval.metrics.testability.score <= 45, 'Baseline testability score should be low');
console.log('✓ Test 1 Passed: Evaluated Baseline raw requirements');

// Test 2: Evaluate Partial Clarifications (e.g. only 2 answered)
const partialClarifications = [
  resumeMeeting.sampleClarifications[0], // Performance
  resumeMeeting.sampleClarifications[1]  // Fairness
];
const { refined: partialRefined } = requirementGenerator.generateRequirements(
  resumeMeeting.utterances,
  partialClarifications,
  resumeMeeting.domain
);
const partialEval = qualityEvaluator.evaluateRequirementSet(partialRefined);
console.log(`Partial Clarification Score: ${partialEval.overallQualityIndex}/100 (${partialEval.qualityTier})`);
assert(partialEval.overallQualityIndex > baselineEval.overallQualityIndex, 'Partial clarifications should score higher than baseline');
assert(partialEval.overallQualityIndex < 85, 'Partial clarifications should score lower than fully clarified');
console.log('✓ Test 2 Passed: Quality score scales proportionally with partial clarifications');

// Test 3: Evaluate Fully Clarified Requirements
const { refined: fullRefined } = requirementGenerator.generateRequirements(
  resumeMeeting.utterances,
  resumeMeeting.sampleClarifications,
  resumeMeeting.domain
);
const fullEval = qualityEvaluator.evaluateRequirementSet(fullRefined);
console.log(`Fully Clarified Score: ${fullEval.overallQualityIndex}/100 (${fullEval.qualityTier})`);
assert(fullEval.overallQualityIndex >= 85, `Full clarification should score Excellent (>=85, got ${fullEval.overallQualityIndex})`);
assert(fullEval.metrics.testability.score >= 80, 'Full testability should be high (>=80)');
assert(fullEval.metrics.ambiguity.score <= 25, 'Full ambiguity should be low (<=25)');
console.log('✓ Test 3 Passed: Fully clarified requirements achieve Excellent score');

// Test 4: Compare Quality Delta
const comparison = qualityEvaluator.compareQuality(baselineEval, fullEval);
console.log(`Quality Delta: +${comparison.delta.overallQualityIndex} points (+${comparison.percentageImprovement}% improvement)`);
assert(comparison.delta.overallQualityIndex >= 40, 'Should demonstrate major quality increase');
assert(comparison.delta.ambiguityReduction >= 40, 'Should demonstrate major ambiguity reduction');
console.log('✓ Test 4 Passed: Comparison metrics delta verified');

console.log('All Dynamic Quality Metrics Tests Passed!\n');
