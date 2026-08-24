const assert = require('assert');
const requirementGenerator = require('../server/services/requirement-generator');
const sampleTranscripts = require('../server/data/sample-transcripts.json');

console.log('--- Running Requirement Extraction & Refinement Tests ---');

const resumeMeeting = sampleTranscripts[0];
const { baseline, refined } = requirementGenerator.generateRequirements(
  resumeMeeting.utterances,
  resumeMeeting.sampleClarifications,
  resumeMeeting.domain
);

// Test 1: Check Baseline Requirements
assert(baseline.frs.length >= 4, 'Baseline should contain functional requirements');
assert(baseline.nfrs.length >= 4, 'Baseline should contain non-functional requirements');
const perfBaseline = baseline.nfrs.find(n => n.category === 'Performance');
assert(perfBaseline, 'Baseline should have performance requirement');
assert.strictEqual(perfBaseline.targetThreshold, 'Not slow / Ideally quick');
console.log('✓ Test 1 Passed: Baseline requirements generated with raw ambiguities');

// Test 2: Check Refined Requirements
assert(refined.frs.length >= 4, 'Refined should contain functional requirements');
assert(refined.nfrs.length >= 5, 'Refined should contain categorized NFRs');

const perfRefined = refined.nfrs.find(n => n.category === 'Performance');
assert(perfRefined, 'Refined should have Performance NFR');
assert(perfRefined.targetThreshold.includes('1.5s'), 'Refined Performance should contain concrete SLO < 1.5s');

const fairRefined = refined.nfrs.find(n => n.category.includes('Fairness'));
assert(fairRefined, 'Refined should have Fairness NFR');
assert(fairRefined.targetThreshold.includes('DIR') || fairRefined.targetThreshold.includes('0.80'), 'Fairness should specify DIR');

console.log('✓ Test 2 Passed: Refined requirements generated with formal metrics and SLOs');

// Test 3: NFR Categorization Coverage
const categories = refined.nfrs.map(n => n.category);
console.log('Categorized NFRs present:', categories);
assert(categories.includes('Performance'), 'Must contain Performance');
assert(categories.some(c => c.includes('Fairness')), 'Must contain Fairness');
assert(categories.some(c => c.includes('Accuracy')), 'Must contain Accuracy');
assert(categories.some(c => c.includes('Security')), 'Must contain Security');
assert(categories.some(c => c.includes('Explainability')), 'Must contain Explainability');
console.log('✓ Test 3 Passed: Comprehensive NFR categorization verified');

console.log('All Requirement Extraction Tests Passed!\n');
