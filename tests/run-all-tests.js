console.log('====================================================');
console.log('🧪 RUNNING COMPREHENSIVE TEST SUITE');
console.log('====================================================\n');

async function runAll() {
  try {
    require('./nlp-ambiguity.test.js');
    require('./requirement-extraction.test.js');
    require('./quality-metrics.test.js');
    require('./export.test.js');
    await require('./ai-integration.test.js');
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runAll();
