/**
 * Regression Test Suite
 * Locks in defects found during the end-to-end system audit so they cannot
 * silently reappear. Each test names the original failure mode.
 *
 * - Test R1: /api/questions/generate handler resolves a real AI service method
 * - Test R2: Every answered clarification maps onto a requirement slot (FR-02)
 * - Test R3: A clarification is never claimed by two different slots
 * - Test R4: Domain routing is word-boundary safe ("throughput" is not "hr")
 * - Test R5: Generic refiner requires an answer, not just an open question
 * - Test R6: Live (self-generated) clarifications fully resolve the spec
 */

const assert = require('assert');
const requirementGenerator = require('../server/services/requirement-generator');
const qualityEvaluator = require('../server/services/quality-evaluator');
const ambiguityDetector = require('../server/services/ambiguity-detector');
const aiService = require('../server/services/ai-service');
const questionsRouter = require('../server/routes/questions');
const sampleTranscripts = require('../server/data/sample-transcripts.json');

const resumeMeeting = sampleTranscripts.find(s => s.id === 'resume-analyzer-assignment');

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

async function runRegressionTests() {
  console.log('\n--- Running Regression Suite (Post-Audit Defect Locks) ---');

  // =======================================================================
  // TEST R1: Questions route called a method that did not exist -> always 500
  // =======================================================================
  console.log('\n[Test R1] Questions route resolves a real AI service method...');
  assert.strictEqual(
    typeof aiService.generateFallbackQuestion, 'function',
    'aiService.generateFallbackQuestion must exist'
  );
  assert.strictEqual(
    aiService.generateRealTimeQuestion, undefined,
    'generateRealTimeQuestion never existed; nothing may reference it'
  );

  // Drive the real Express handler with a mock req/res pair.
  const generateRoute = questionsRouter.stack
    .filter(l => l.route)
    .find(l => l.route.path === '/generate' && l.route.methods.post);
  assert(generateRoute, 'POST /generate route must be registered');
  const handler = generateRoute.route.stack[0].handle;

  const r1Res = mockRes();
  await handler({ body: { text: "It shouldn't be slow." } }, r1Res);
  assert.strictEqual(r1Res.statusCode, 200, `Route must return 200, got ${r1Res.statusCode}`);
  assert.strictEqual(r1Res.body.success, true, 'Route must report success');
  assert(r1Res.body.data && r1Res.body.data.question, 'Route must return a generated question');
  assert.strictEqual(r1Res.body.data.category, 'Performance', 'Latency statement must yield a Performance question');

  const r1Bad = mockRes();
  await handler({ body: {} }, r1Bad);
  assert.strictEqual(r1Bad.statusCode, 400, 'Missing text must return 400, not 500');
  console.log('✓ Test R1 Passed: Questions route returns 200 with a real question (previously 500 on every call).');

  // =======================================================================
  // TEST R2: `findAnswer(a) || findAnswer(b)` was dead code -- the returned
  // object is always truthy, so fallback patterns never ran and FR-02 stayed
  // PENDING even though q-rel-01 ("Functional Scoring") was answered.
  // =======================================================================
  console.log('\n[Test R2] Every answered clarification resolves its requirement...');
  const { refined: fullRefined } = requirementGenerator.generateRequirements(
    resumeMeeting.utterances,
    resumeMeeting.sampleClarifications,
    resumeMeeting.domain
  );
  const allFull = [...fullRefined.frs, ...fullRefined.nfrs];
  const stillPending = allFull.filter(r => r.status !== 'RESOLVED');
  assert.strictEqual(
    stillPending.length, 0,
    `All requirements must resolve when all 7 clarifications are answered; pending: ${stillPending.map(r => r.id).join(', ')}`
  );

  const fr02 = fullRefined.frs.find(r => r.id === 'FR-02');
  assert.strictEqual(fr02.status, 'RESOLVED', 'FR-02 must resolve from the "Functional Scoring" clarification');
  assert.strictEqual(fr02.sourceClarificationId, 'q-rel-01', 'FR-02 must trace to q-rel-01');
  assert(
    fr02.stakeholderEvidence.includes('45%'),
    'FR-02 must carry the verbatim stakeholder weighting formula'
  );

  const evalFull = qualityEvaluator.evaluateRequirementSet(fullRefined);
  assert.strictEqual(evalFull.metrics.ambiguity.score, 0, 'Zero pending requirements means zero ambiguity');
  console.log(`✓ Test R2 Passed: ${allFull.length}/${allFull.length} requirements resolved, OQI ${evalFull.overallQualityIndex} (FR-02 previously stuck PENDING at OQI 92).`);

  // =======================================================================
  // TEST R3: Loose substring patterns could let one clarification satisfy two
  // unrelated slots (e.g. a latency answer resolving data ingestion).
  // =======================================================================
  console.log('\n[Test R3] One clarification is never reused across unrelated slots...');
  const onlyPerf = [{
    id: 'q-perf-01',
    category: 'Performance',
    triggeredBy: 'Response time per resume should ideally be quick for 100 resumes.',
    selectedResponse: 'Single resume < 1.5s (p95)'
  }];
  const { refined: refinedR3 } = requirementGenerator.generateRequirements(
    resumeMeeting.utterances,
    onlyPerf,
    resumeMeeting.domain
  );
  const perfR3 = refinedR3.nfrs.find(n => n.category === 'Performance');
  const dataR3 = refinedR3.frs.find(f => f.id === 'FR-01');
  const secR3 = refinedR3.nfrs.find(n => n.id === 'NFR-SEC-01');

  assert.strictEqual(perfR3.status, 'RESOLVED', 'The performance NFR must adopt the answer');
  assert.strictEqual(
    dataR3.status, 'PENDING_CLARIFICATION',
    'FR-01 must stay pending: the word "resumes" in a latency answer is not data-schema evidence'
  );
  assert.strictEqual(secR3.status, 'PENDING_CLARIFICATION', 'NFR-SEC-01 must stay pending for the same reason');
  const resolvedR3 = [...refinedR3.frs, ...refinedR3.nfrs].filter(r => r.status === 'RESOLVED');
  assert.strictEqual(resolvedR3.length, 1, `Exactly 1 requirement may resolve from 1 answer, got ${resolvedR3.length}`);
  console.log('✓ Test R3 Passed: 1 answer resolves exactly 1 requirement; no cross-slot evidence leakage.');

  // =======================================================================
  // TEST R4: /hr/i matched "t-hr-oughput", routing a fintech fraud meeting
  // into the resume template and emitting candidate-scoring requirements.
  // =======================================================================
  console.log('\n[Test R4] Domain routing is word-boundary safe...');
  const fintech = sampleTranscripts.find(s => s.id === 'fintech-fraud-meeting');
  assert(fintech, 'fintech-fraud-meeting sample must exist');
  assert(
    fintech.utterances.some(u => /throughput/i.test(u.text)),
    'Sample must still contain the "throughput" utterance this test guards'
  );

  const { refined: refinedFintech } = requirementGenerator.generateRequirements(
    fintech.utterances,
    fintech.sampleClarifications,
    fintech.domain
  );
  const fintechIds = [...refinedFintech.frs, ...refinedFintech.nfrs].map(r => r.id);
  assert(
    !fintechIds.includes('FR-02'),
    'A fraud-detection meeting must not emit the resume candidate-scoring requirement'
  );
  assert(
    fintechIds.some(id => id.startsWith('FR-GEN')),
    'Non-HR domains must route to the generic requirement template'
  );

  // The genuine resume meeting must still be detected.
  assert(
    fullRefined.frs.some(r => r.id === 'FR-01'),
    'The resume meeting must still route to the resume-specific template'
  );
  console.log('✓ Test R4 Passed: Fintech meeting routes generically; resume meeting still routes correctly.');

  // =======================================================================
  // TEST R5: Generic refiner marked its FR RESOLVED whenever a clarification
  // merely existed, even with zero stakeholder answers.
  // =======================================================================
  console.log('\n[Test R5] Generic refiner requires an actual answer...');
  const genericUtterances = [{ speaker: 'PM', text: 'The dashboard should feel snappy.', timestamp: '00:01' }];
  const unansweredGeneric = [{ id: 'q-x-01', category: 'Performance', triggeredBy: 'snappy', selectedResponse: '' }];

  const { refined: refinedR5 } = requirementGenerator.generateRequirements(
    genericUtterances, unansweredGeneric, 'Logistics'
  );
  const genFr = refinedR5.frs.find(f => f.id === 'FR-GEN-01');
  assert.strictEqual(
    genFr.status, 'PENDING_CLARIFICATION',
    'An open, unanswered question is not stakeholder evidence'
  );
  assert.strictEqual(genFr.stakeholderEvidence, null, 'No evidence may be fabricated');
  assert.strictEqual(genFr.source, 'RAW_DIALOGUE', 'Source must remain RAW_DIALOGUE until answered');

  const { refined: refinedR5b } = requirementGenerator.generateRequirements(
    genericUtterances,
    [{ ...unansweredGeneric[0], selectedResponse: 'p95 render < 200ms' }],
    'Logistics'
  );
  const genFrB = refinedR5b.frs.find(f => f.id === 'FR-GEN-01');
  assert.strictEqual(genFrB.status, 'RESOLVED', 'An answered clarification must resolve the requirement');
  assert.strictEqual(genFrB.stakeholderEvidence, 'p95 render < 200ms', 'Evidence must be the verbatim answer');
  console.log('✓ Test R5 Passed: Generic requirements resolve only on a real stakeholder answer.');

  // =======================================================================
  // TEST R6: Full live path -- the detector generates its own questions (no
  // pre-baked sample clarifications) and the spec must fully resolve.
  // =======================================================================
  console.log('\n[Test R6] Live self-generated clarification path resolves fully...');
  const liveClarifications = [];
  for (const u of resumeMeeting.utterances) {
    const analysis = ambiguityDetector.analyzeUtterance(u.text, u.speaker, u.timestamp);
    if (!analysis.isAmbiguous) continue;
    const candidate = aiService.generateFallbackQuestion(u.text, analysis.detectedFlags);
    if (aiService.filterDuplicateClarifications(liveClarifications, candidate)) {
      liveClarifications.push(candidate);
    }
  }
  assert(liveClarifications.length >= 6, `Live run must generate >=6 questions, got ${liveClarifications.length}`);
  assert(
    liveClarifications.some(c => c.category === 'Explainability'),
    'Live run must recognise the explainability statement ("would be useful")'
  );

  // Stakeholder adopts the first suggested option for each generated question.
  const liveAnswered = liveClarifications.map(c => ({ ...c, selectedResponse: c.suggestedOptions[0] }));
  const { refined: refinedLive } = requirementGenerator.generateRequirements(
    resumeMeeting.utterances, liveAnswered, resumeMeeting.domain
  );
  const liveAll = [...refinedLive.frs, ...refinedLive.nfrs];
  const livePending = liveAll.filter(r => r.status !== 'RESOLVED');
  assert.strictEqual(
    livePending.length, 0,
    `Live path must resolve every requirement; pending: ${livePending.map(r => r.id).join(', ')}`
  );

  const evalLive = qualityEvaluator.evaluateRequirementSet(refinedLive);
  assert(evalLive.overallQualityIndex >= 80, `Live refined OQI must be Excellent, got ${evalLive.overallQualityIndex}`);

  // And with those same questions unanswered, nothing may resolve.
  const { refined: refinedLiveRaw } = requirementGenerator.generateRequirements(
    resumeMeeting.utterances,
    liveClarifications.map(c => ({ ...c, selectedResponse: '' })),
    resumeMeeting.domain
  );
  const rawResolved = [...refinedLiveRaw.frs, ...refinedLiveRaw.nfrs].filter(r => r.status === 'RESOLVED');
  assert.strictEqual(rawResolved.length, 0, 'Unanswered live questions must resolve nothing');
  console.log(`✓ Test R6 Passed: Live path resolved ${liveAll.length}/${liveAll.length} at OQI ${evalLive.overallQualityIndex}; unanswered resolves 0.`);

  console.log('\n====================================================');
  console.log('🎉 ALL REGRESSION TESTS (R1 - R6) PASSED 100%!');
  console.log('====================================================\n');
}

module.exports = runRegressionTests();
