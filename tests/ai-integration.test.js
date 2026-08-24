const assert = require('assert');
require('dotenv').config();
const aiService = require('../server/services/ai-service');

console.log('--- Running AI Service (Gemini / LLM) Integration Tests ---');

async function runAITests() {
  console.log(`Active AI engine: ${aiService.hasActiveAI ? 'Google Gemini LLM Connected' : 'Rule-Based Fallback'}`);

  // Test 1: Real-time utterance ambiguity detection with Gemini
  const liveUtterance = {
    text: 'It should be good enough so that HR trusts it.',
    speaker: 'Hiring Manager',
    timestamp: '01:22'
  };

  const analysis = await aiService.analyzeLiveUtterance(liveUtterance);
  assert(analysis, 'Analysis result should be returned');
  assert.strictEqual(analysis.isAmbiguous, true, 'Should detect ambiguity');
  console.log(`✓ Test 1 Passed: Utterance analyzed via ${analysis.aiSource} (Ambiguity Score: ${analysis.ambiguityScore}%)`);

  // Test 2: Verify candidate question generation
  assert(analysis.candidateQuestion, 'Candidate question should be generated for ambiguous statement');
  assert(analysis.candidateQuestion.suggestedOptions.length >= 3, 'Should provide at least 3 concrete options');
  console.log(`✓ Test 2 Passed: Generated clarification question: "${analysis.candidateQuestion.question}"`);

  console.log('All AI Integration Tests Passed!\n');
}

module.exports = runAITests().catch(err => {
  console.error('AI integration test failed:', err);
  process.exit(1);
});
