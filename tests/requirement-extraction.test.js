const assert = require('assert');
const requirementGenerator = require('../server/services/requirement-generator');
const sampleTranscripts = require('../server/data/sample-transcripts.json');

console.log('--- Running Response-Driven Requirement Extraction Tests ---');

const resumeMeeting = sampleTranscripts[0];

// Test 1: Check Baseline Requirements
const { baseline: baselineReqs } = requirementGenerator.generateRequirements(
  resumeMeeting.utterances,
  [], // 0 clarifications
  resumeMeeting.domain
);
assert(baselineReqs.frs.length >= 4, 'Baseline should contain functional requirements');
assert(baselineReqs.nfrs.length >= 4, 'Baseline should contain non-functional requirements');
const perfBaseline = baselineReqs.nfrs.find(n => n.category === 'Performance');
assert(perfBaseline, 'Baseline should have performance requirement');
assert.strictEqual(perfBaseline.targetThreshold, 'Not slow / Ideally quick');
console.log('✓ Test 1 Passed: Baseline requirements generated with raw ambiguities');

// Test 2: When NO clarifications are answered, requirements remain PENDING_CLARIFICATION
const emptyClarifications = resumeMeeting.sampleClarifications.map(c => ({ ...c, selectedResponse: '' }));
const { refined: unclarifiedRefined } = requirementGenerator.generateRequirements(
  resumeMeeting.utterances,
  emptyClarifications,
  resumeMeeting.domain
);
const pendingNfr = unclarifiedRefined.nfrs.find(n => n.category === 'Performance');
assert.strictEqual(pendingNfr.status, 'PENDING_CLARIFICATION', 'Unanswered NFR should be marked PENDING_CLARIFICATION');
assert(pendingNfr.targetThreshold.includes('Unspecified'), 'Unanswered NFR should not invent default metrics');
console.log('✓ Test 2 Passed: Unanswered clarifications correctly keep requirements in PENDING state');

// Test 3: When clarifications ARE answered, requirements become RESOLVED with explicit numbers
const { refined: answeredRefined } = requirementGenerator.generateRequirements(
  resumeMeeting.utterances,
  resumeMeeting.sampleClarifications,
  resumeMeeting.domain
);

const resolvedPerf = answeredRefined.nfrs.find(n => n.category === 'Performance');
assert.strictEqual(resolvedPerf.status, 'RESOLVED', 'Answered NFR should be marked RESOLVED');
assert(resolvedPerf.targetThreshold.includes('1.5s'), 'Refined Performance should contain stakeholder latency SLO');

const resolvedFair = answeredRefined.nfrs.find(n => n.category.includes('Fairness'));
assert.strictEqual(resolvedFair.status, 'RESOLVED');
assert(resolvedFair.targetThreshold.includes('DIR') || resolvedFair.targetThreshold.includes('0.80'), 'Fairness should specify stakeholder DIR');
console.log('✓ Test 3 Passed: Stakeholder-answered clarifications produce formal RESOLVED requirements');

// Test 4: NFR Categorization Coverage
const categories = answeredRefined.nfrs.map(n => n.category);
assert(categories.includes('Performance'), 'Must contain Performance');
assert(categories.some(c => c.includes('Fairness')), 'Must contain Fairness');
assert(categories.some(c => c.includes('Accuracy')), 'Must contain Accuracy');
assert(categories.some(c => c.includes('Security')), 'Must contain Security');
assert(categories.some(c => c.includes('Explainability')), 'Must contain Explainability');
console.log('✓ Test 4 Passed: Comprehensive NFR categorization verified');

console.log('All Response-Driven Requirement Extraction Tests Passed!\n');
