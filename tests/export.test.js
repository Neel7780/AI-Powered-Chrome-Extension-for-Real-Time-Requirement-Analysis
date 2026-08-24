const assert = require('assert');
const exportService = require('../server/services/export-service');
const qualityEvaluator = require('../server/services/quality-evaluator');
const requirementGenerator = require('../server/services/requirement-generator');
const sampleTranscripts = require('../server/data/sample-transcripts.json');

console.log('--- Running Export Service Tests ---');

async function runExportTests() {
  const resumeMeeting = sampleTranscripts[0];
  const { baseline, refined } = requirementGenerator.generateRequirements(
    resumeMeeting.utterances,
    resumeMeeting.sampleClarifications,
    resumeMeeting.domain
  );

  const baselineEval = qualityEvaluator.evaluateRequirementSet(baseline);
  const refinedEval = qualityEvaluator.evaluateRequirementSet(refined);
  const comparison = qualityEvaluator.compareQuality(baselineEval, refinedEval);

  const payload = {
    title: resumeMeeting.title,
    clarifications: resumeMeeting.sampleClarifications,
    baseline,
    refined,
    evaluation: {
      baseline: baselineEval,
      refined: refinedEval,
      comparison
    }
  };

  // Test 1: PDF Export
  const pdfBuffer = await exportService.generatePDF(payload);
  assert(pdfBuffer instanceof Buffer, 'PDF export should return a Buffer');
  assert(pdfBuffer.length > 1000, `PDF buffer length should be substantial (got ${pdfBuffer.length} bytes)`);
  console.log(`✓ Test 1 Passed: PDF generated successfully (${pdfBuffer.length} bytes)`);

  // Test 2: DOCX Export
  const docxBuffer = await exportService.generateDOCX(payload);
  assert(docxBuffer instanceof Buffer, 'DOCX export should return a Buffer');
  assert(docxBuffer.length > 1000, `DOCX buffer length should be substantial (got ${docxBuffer.length} bytes)`);
  console.log(`✓ Test 2 Passed: DOCX generated successfully (${docxBuffer.length} bytes)`);

  // Test 3: Markdown / TXT Export
  const markdown = exportService.generateMarkdown(payload);
  assert(typeof markdown === 'string', 'Markdown export should return a string');
  assert(markdown.includes('## 1. Executive Summary'), 'Markdown should include Executive Summary section');
  assert(markdown.includes('NFR-PERF-01'), 'Markdown should include refined NFRs');
  console.log(`✓ Test 3 Passed: Markdown generated successfully (${markdown.length} characters)`);

  console.log('All Export Service Tests Passed!\n');
}

module.exports = runExportTests().catch(err => {
  console.error('Export test failed:', err);
  process.exit(1);
});
