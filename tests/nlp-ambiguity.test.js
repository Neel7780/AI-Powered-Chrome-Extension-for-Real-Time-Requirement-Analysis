const assert = require('assert');
const ambiguityDetector = require('../server/services/ambiguity-detector');
const sampleTranscripts = require('../server/data/sample-transcripts.json');

console.log('--- Running Ambiguity Detector Tests ---');

// Test 1: Identify ambiguous statements
const ambiguousUtterance = ambiguityDetector.analyzeUtterance('It should be good enough so that HR trusts it.');
assert.strictEqual(ambiguousUtterance.isAmbiguous, true, 'Should detect ambiguity in "good enough so that HR trusts it"');
assert(ambiguousUtterance.detectedFlags.length > 0, 'Should have detected flags');
console.log('✓ Test 1 Passed: Detected subjective trust phrase');

// Test 2: Identify non-ambiguous question
const questionUtterance = ambiguityDetector.analyzeUtterance('How are we defining relevance?');
assert.strictEqual(questionUtterance.isAmbiguous, false, 'Questions should not be marked as ambiguous requirements');
console.log('✓ Test 2 Passed: Handled question utterance');

// Test 3: Multiple ambiguous phrases
const multiAmbiguity = ambiguityDetector.analyzeUtterance('Things like good companies, solid projects, impactful work.');
assert.strictEqual(multiAmbiguity.isAmbiguous, true);
assert(multiAmbiguity.detectedFlags.length >= 2, 'Should detect multiple fuzzy adjectives');
console.log('✓ Test 3 Passed: Detected multiple fuzzy adjectives');

// Test 4: Analyze full transcript from PDF
const resumeMeeting = sampleTranscripts[0];
const fullTranscriptAnalysis = ambiguityDetector.analyzeTranscript(resumeMeeting.utterances);
assert(fullTranscriptAnalysis.totalUtterances >= 20, `Expected at least 20 utterances, got ${fullTranscriptAnalysis.totalUtterances}`);
assert(fullTranscriptAnalysis.ambiguousUtterancesCount >= 8, 'Expected at least 8 ambiguous utterances in sample');
assert(fullTranscriptAnalysis.overallAmbiguityIndex > 50, 'Overall ambiguity index for raw meeting should be elevated (>50)');
console.log(`✓ Test 4 Passed: Full transcript analysis (Ambiguity Index: ${fullTranscriptAnalysis.overallAmbiguityIndex}/100, Flags: ${fullTranscriptAnalysis.totalFlags})`);

console.log('All Ambiguity Detector Tests Passed!\n');
