console.log('====================================================');
console.log('🧪 RUNNING COMPREHENSIVE TEST SUITE');
console.log('====================================================\n');

async function runAll() {
  try {
    require('./nlp-ambiguity.test.js');
    require('./requirement-extraction.test.js');
    require('./quality-metrics.test.js');
    require('./quality-hardening.test.js');
    await require('./regression.test.js');
    await require('./export.test.js');
    await require('./ai-integration.test.js');

    console.log('====================================================');
    console.log('✅ ALL TEST SUITES PASSED');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runAll();
