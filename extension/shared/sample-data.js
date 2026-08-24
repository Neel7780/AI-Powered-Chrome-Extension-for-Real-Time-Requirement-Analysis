/**
 * Embedded Sample Meeting Transcripts for Extension Demonstration
 */
const EXT_SAMPLE_TRANSCRIPTS = [
  {
    id: "resume-analyzer-assignment",
    title: "AI Resume Analyzer Meeting (Assignment PDF)",
    domain: "HR Tech / AI Recruitment",
    utterances: [
      { speaker: "Hiring Manager", text: "We need to build an AI-based resume analyzer that can automatically shortlist candidates for our software engineering roles.", timestamp: "00:05" },
      { speaker: "ML Engineer", text: "Okay. How should the system decide which candidates to shortlist?", timestamp: "00:12" },
      { speaker: "Hiring Manager", text: "It should rank them based on relevance to the job description.", timestamp: "00:18" },
      { speaker: "ML Engineer", text: "How are we defining relevance?", timestamp: "00:24" },
      { speaker: "Hiring Manager", text: "Mainly skills and experience. And overall profile strength.", timestamp: "00:30" },
      { speaker: "ML Engineer", text: "What does overall profile strength include?", timestamp: "00:36" },
      { speaker: "Hiring Manager", text: "Things like good companies, solid projects, impactful work.", timestamp: "00:42" },
      { speaker: "ML Engineer", text: "Should we prioritize years of experience?", timestamp: "00:49" },
      { speaker: "Hiring Manager", text: "Yes, but not strictly. Sometimes a strong fresher is better than someone with 5 average years.", timestamp: "00:56" },
      { speaker: "ML Engineer", text: "Do we have historical hiring data to train the system?", timestamp: "01:03" },
      { speaker: "Hiring Manager", text: "We have past resumes and hiring decisions, but they're not very structured.", timestamp: "01:10" },
      { speaker: "ML Engineer", text: "How accurate should the system be?", timestamp: "01:16" },
      { speaker: "Hiring Manager", text: "It should be good enough so that HR trusts it.", timestamp: "01:22" },
      { speaker: "ML Engineer", text: "Do we need explainability? For example, why a candidate was ranked higher?", timestamp: "01:29" },
      { speaker: "Hiring Manager", text: "Yes, that would be useful.", timestamp: "01:34" },
      { speaker: "ML Engineer", text: "Are there any constraints regarding bias or fairness?", timestamp: "01:40" },
      { speaker: "Hiring Manager", text: "Yes, we must avoid bias, especially related to gender or college background.", timestamp: "01:47" },
      { speaker: "ML Engineer", text: "Should the system process resumes in real-time or batch mode?", timestamp: "01:54" },
      { speaker: "Hiring Manager", text: "It shouldn't be slow.", timestamp: "02:00" },
      { speaker: "ML Engineer", text: "What is the expected response time per resume?", timestamp: "02:06" },
      { speaker: "Hiring Manager", text: "Ideally quick.", timestamp: "02:11" },
      { speaker: "ML Engineer", text: "What is the timeline for delivery?", timestamp: "02:17" },
      { speaker: "Hiring Manager", text: "We need an MVP soon.", timestamp: "02:22" }
    ],
    sampleClarifications: [
      {
        id: "q-perf-01",
        category: "Performance",
        question: "What is the precise latency threshold for single resume parsing and batch screening?",
        triggeredBy: "It shouldn't be slow / Ideally quick",
        selectedResponse: "Single resume parsing must be under 1.5s (95th percentile) and batch upload of 100 resumes must complete within 30 seconds."
      },
      {
        id: "q-fair-01",
        category: "Fairness & Bias",
        question: "How should bias mitigation be enforced and measured across gender and educational background?",
        triggeredBy: "Yes, we must avoid bias, especially related to gender or college background.",
        selectedResponse: "Anonymize PII and college names before scoring; enforce Disparate Impact Ratio (DIR) between 0.80 and 1.25 across gender and college tiers."
      },
      {
        id: "q-acc-01",
        category: "Accuracy & Quality",
        question: "What quantifiable accuracy metric defines 'good enough for HR trust' for candidate shortlisting?",
        triggeredBy: "It should be good enough so that HR trusts it.",
        selectedResponse: "Top-10 shortlisting Precision >= 85% and NDCG@10 >= 0.82 evaluated against blind human recruiter consensus."
      },
      {
        id: "q-exp-01",
        category: "Explainability",
        question: "What specific explainability format is required for why a candidate is ranked or disqualified?",
        triggeredBy: "Yes, that would be useful.",
        selectedResponse: "Provide a structured breakdown for each candidate: matched required skills %, matched preferred skills %, quantified project score, and 3 bullet justifications for ranking."
      },
      {
        id: "q-data-01",
        category: "Data & Functional",
        question: "What resume file formats, parsing schemas, and unstructured historical data cleanup methods must be supported?",
        triggeredBy: "We have past resumes and hiring decisions, but they're not very structured.",
        selectedResponse: "Support PDF and DOCX up to 10MB; parse unstructured text into standardized JSON schema; run automated data cleaning on historical logs."
      },
      {
        id: "q-rel-01",
        category: "Functional Scoring",
        question: "How should 'profile strength' (good companies, solid projects) and freshers vs experienced candidates be weighted?",
        triggeredBy: "Things like good companies, solid projects, impactful work / strong fresher",
        selectedResponse: "Weighting formula: 45% Skill Match & Tech Stack, 35% Project Impact & Scope, 20% Relevant Experience; allow freshers with high project scores to outrank generic profiles."
      },
      {
        id: "q-scope-01",
        category: "Project Scope",
        question: "What is the concrete deadline and core scope for the 'MVP soon' deliverable?",
        triggeredBy: "We need an MVP soon.",
        selectedResponse: "MVP delivery in 4 weeks: Web portal supporting PDF/DOCX ingestion, JD matching, top-N ranking with explainability cards, and fairness metrics."
      }
    ]
  }
];

if (typeof window !== 'undefined') {
  window.EXT_SAMPLE_TRANSCRIPTS = EXT_SAMPLE_TRANSCRIPTS;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EXT_SAMPLE_TRANSCRIPTS;
}
