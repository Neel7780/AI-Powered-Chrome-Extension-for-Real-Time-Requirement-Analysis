console.log('====================================================');
console.log('🧪 RUNNING COMPREHENSIVE TEST SUITE');
console.log('====================================================\n');

try {
  require('./nlp-ambiguity.test.js');
  require('./requirement-extraction.test.js');
  require('./quality-metrics.test.js');
  require('./export.test.js');
} catch (err) {
  console.error('Test execution failed:', err);
  process.exit(1);
}
