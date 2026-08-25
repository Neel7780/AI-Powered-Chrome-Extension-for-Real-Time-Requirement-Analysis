/**
 * Web Application Main Controller
 * AI Real-Time Requirement Analysis & Evaluation Studio
 * Synchronized with Chrome Extension via WebSocket session state.
 */

// State
let allSampleScenarios = [];
let currentScenario = null;
let simulationIndex = 0;
let isSimPlaying = false;
let simIntervalTimer = null;
let isMicListening = false;
let speechRecognitionInstance = null;

let activeTranscript = [];
let activeClarifications = [];
let currentRequirements = null;
let currentEvaluation = null;
let activeReqFilter = 'all';

let radarChart = null;
let sessionSocket = null;
let isApplyingSync = false;

document.addEventListener('DOMContentLoaded', async () => {
  initRadarChart();
  initSessionSync();
  await loadScenarioData();
  setupEventListeners();
});

// 1. WebSocket Real-Time Synchronization with Extension & Backend
function initSessionSync() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${location.host}/ws/session`;
  try {
    sessionSocket = new WebSocket(wsUrl);
    sessionSocket.onopen = () => console.log('🔗 [Webapp] WebSocket session connected.');
    sessionSocket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.data) {
          applyIncomingSessionState(msg.data);
        }
      } catch (e) {
        console.error('Error parsing session sync:', e);
      }
    };
    sessionSocket.onclose = () => {
      setTimeout(initSessionSync, 2000);
    };
  } catch (e) {
    console.warn('WebSocket init failed:', e);
  }
}

function applyIncomingSessionState(state) {
  if (!state || isApplyingSync) return;
  isApplyingSync = true;

  try {
    activeTranscript = state.transcript || [];
    activeClarifications = state.clarifications || [];

    if (state.baseline && state.refined && (state.refined.frs?.length > 0 || state.refined.nfrs?.length > 0)) {
      currentRequirements = {
        baseline: state.baseline,
        refined: state.refined
      };
    }
    if (state.evaluation && Object.keys(state.evaluation).length > 0) {
      currentEvaluation = state.evaluation;
    }

    renderFeedFromTranscript();
    updateAmbiguityMetrics();
    renderClarificationsHub();
    renderRequirementsBoard();
    renderTransformationDiff();
    updateQualityEvaluationDisplay();
  } finally {
    isApplyingSync = false;
  }
}

function renderFeedFromTranscript() {
  const feed = document.getElementById('transcript-feed-area');
  if (!feed) return;

  if (activeTranscript.length === 0) {
    feed.innerHTML = `
      <div class="feed-placeholder" id="feed-placeholder">
        <div class="placeholder-icon">💬</div>
        <h3>Meeting Room Ready</h3>
        <p>Click <strong>Play (▶)</strong> to simulate the live meeting or activate <strong>Live Mic</strong>.</p>
      </div>
    `;
    return;
  }

  feed.innerHTML = '';
  activeTranscript.forEach(u => renderUtteranceBubble(u));
}

// 2. Fetch Sample Transcripts from Server
async function loadScenarioData() {
  try {
    const res = await fetch('/api/sample-data');
    const json = await res.json();
    if (json.success && json.data) {
      allSampleScenarios = json.data;
    }
  } catch (e) {
    console.warn('Backend offline, using fallback sample scenarios');
  }

  if (!allSampleScenarios || allSampleScenarios.length === 0) {
    allSampleScenarios = [{
      id: 'resume-analyzer-assignment',
      title: 'AI Resume Analyzer (Prof. Supplied Meeting)',
      domain: 'HR Tech',
      utterances: [
        { speaker: "Hiring Manager", text: "We need to build an AI-based resume analyzer.", timestamp: "00:05" },
        { speaker: "ML Engineer", text: "We have past resumes and hiring decisions, but they're not very structured.", timestamp: "00:15" },
        { speaker: "Hiring Manager", text: "We want it to take resumes and rank them based on relevance to a job description.", timestamp: "00:25" },
        { speaker: "ML Engineer", text: "What criteria should determine relevance?", timestamp: "00:35" },
        { speaker: "Hiring Manager", text: "Mainly skills and experience. And overall profile strength. Things like good companies, solid projects... Sometimes a strong fresher is better than someone with 5 average years.", timestamp: "00:50" },
        { speaker: "ML Engineer", text: "How will we evaluate if the ranking is accurate?", timestamp: "01:05" },
        { speaker: "Hiring Manager", text: "It should be good enough so that HR trusts it.", timestamp: "01:15" },
        { speaker: "ML Engineer", text: "What about response time and scale?", timestamp: "01:25" },
        { speaker: "Hiring Manager", text: "It shouldn't be slow. Response time per resume should ideally be quick.", timestamp: "01:35" },
        { speaker: "ML Engineer", text: "Are there constraints around bias?", timestamp: "01:45" },
        { speaker: "Hiring Manager", text: "Yes, we must avoid bias, especially related to gender or college background.", timestamp: "01:55" },
        { speaker: "ML Engineer", text: "Do we need explainability for why someone was ranked high or low?", timestamp: "02:05" },
        { speaker: "Hiring Manager", text: "Yes, that would be useful.", timestamp: "02:15" },
        { speaker: "ML Engineer", text: "What is our timeline?", timestamp: "02:25" },
        { speaker: "Hiring Manager", text: "We need an MVP soon.", timestamp: "02:35" }
      ],
      sampleClarifications: [
        { id: "q-perf-01", category: "Performance", question: "What specific latency threshold defines acceptable performance?", selectedResponse: "Single resume parsing must be under 1.5s (95th percentile) and batch upload of 100 resumes must complete within 30 seconds." },
        { id: "q-fair-01", category: "Fairness", question: "What quantitative fairness metric and audit frequency should be enforced?", selectedResponse: "Disparate impact ratio between 0.80 and 1.25 across gender and college tiers; quarterly fairness audit." },
        { id: "q-acc-01", category: "Accuracy", question: "What objective accuracy metric defines 'good enough for HR trust'?", selectedResponse: "Top-10 candidate precision >= 85% and NDCG@10 >= 0.82 evaluated against consensus of 3 senior recruiters." },
        { id: "q-exp-01", category: "Explainability", question: "How should candidate match reasoning be presented to recruiters?", selectedResponse: "Interactive match scorecard showing matched skills %, project complexity score, and top 3 justification reasons." },
        { id: "q-rel-01", category: "Ranking Algorithm", question: "How should skills, experience, and projects be weighted?", selectedResponse: "Formula: 45% skills match + 35% project complexity + 20% experience with tier normalization." },
        { id: "q-data-01", category: "Data Ingestion", question: "What file formats and size limits must be supported?", selectedResponse: "Support PDF and DOCX up to 10MB per file with automated text extraction into validated JSON schema." },
        { id: "q-scope-01", category: "Project Scope", question: "What is the committed delivery milestone for the MVP?", selectedResponse: "4-week MVP deliverable covering ingestion, JD matching, top-10 ranking, and scorecard export." }
      ]
    }];
  }

  selectScenario('resume-analyzer-assignment');
}

function selectScenario(scenarioId) {
  stopSimulation();
  resetMeetingState();

  if (scenarioId === 'custom') {
    document.getElementById('custom-drawer').style.display = 'block';
    return;
  } else {
    document.getElementById('custom-drawer').style.display = 'none';
  }

  currentScenario = allSampleScenarios.find(s => s.id === scenarioId) || allSampleScenarios[0];
  if (currentScenario) {
    document.getElementById('meeting-stream-desc').innerText = currentScenario.title;
  }
}

// 3. Setup Event Listeners
function setupEventListeners() {
  document.getElementById('scenario-select').addEventListener('change', (e) => {
    selectScenario(e.target.value);
  });

  document.getElementById('btn-play-pause').addEventListener('click', togglePlaySimulation);
  document.getElementById('btn-step-next').addEventListener('click', stepSimulation);
  document.getElementById('btn-instant-load').addEventListener('click', loadEntireMeetingInstantly);
  document.getElementById('btn-reset-meeting').addEventListener('click', resetMeetingState);

  document.getElementById('btn-mic-toggle').addEventListener('click', toggleMicListening);

  document.getElementById('btn-send-manual-line').addEventListener('click', sendManualLine);
  document.getElementById('manual-line-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendManualLine();
  });

  document.getElementById('btn-apply-custom').addEventListener('click', applyCustomTranscript);
  document.getElementById('btn-close-custom').addEventListener('click', () => {
    document.getElementById('custom-drawer').style.display = 'none';
    document.getElementById('scenario-select').value = currentScenario?.id || 'resume-analyzer-assignment';
  });

  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const view = btn.getAttribute('data-view');
      document.getElementById(`view-${view}`)?.classList.add('active');
    });
  });

  document.getElementById('btn-clarify-all-smart').addEventListener('click', autoClarifyAll);

  document.querySelectorAll('.req-subtab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.req-subtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeReqFilter = tab.getAttribute('data-filter');
      renderRequirementsBoard();
    });
  });

  const exportDropdownBtn = document.getElementById('btn-export-dropdown-toggle');
  const exportMenu = document.getElementById('export-menu');
  exportDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => exportMenu.classList.remove('show'));

  document.getElementById('btn-export-pdf').addEventListener('click', () => exportSpecification('pdf'));
  document.getElementById('btn-export-docx').addEventListener('click', () => exportSpecification('docx'));
  document.getElementById('btn-export-md').addEventListener('click', () => exportSpecification('txt'));
  document.getElementById('btn-export-json').addEventListener('click', () => exportSpecification('json'));
}

// Simulation Controls
function togglePlaySimulation() {
  if (isSimPlaying) {
    stopSimulation();
  } else {
    startSimulation();
  }
}

function startSimulation() {
  if (!currentScenario || !currentScenario.utterances) return;
  isSimPlaying = true;
  document.getElementById('btn-play-pause').innerHTML = '<span>⏸</span> Pause';
  document.getElementById('btn-play-pause').classList.add('active');

  simIntervalTimer = setInterval(() => {
    if (simulationIndex >= currentScenario.utterances.length) {
      stopSimulation();
      return;
    }
    const u = currentScenario.utterances[simulationIndex];
    processNewUtterance(u.text, u.speaker, u.timestamp);
    simulationIndex++;
  }, 1800);
}

function stopSimulation() {
  isSimPlaying = false;
  clearInterval(simIntervalTimer);
  const btn = document.getElementById('btn-play-pause');
  if (btn) {
    btn.innerHTML = '<span>▶</span> Play Stream';
    btn.classList.remove('active');
  }
}

function stepSimulation() {
  if (!currentScenario || !currentScenario.utterances) return;
  if (simulationIndex < currentScenario.utterances.length) {
    const u = currentScenario.utterances[simulationIndex];
    processNewUtterance(u.text, u.speaker, u.timestamp);
    simulationIndex++;
  }
}

async function loadEntireMeetingInstantly() {
  stopSimulation();
  if (!currentScenario || !currentScenario.utterances) return;

  resetMeetingState();
  const utterances = currentScenario.utterances;
  simulationIndex = utterances.length;

  for (const u of utterances) {
    await processNewUtterance(u.text, u.speaker, u.timestamp);
  }
}

async function resetMeetingState() {
  stopSimulation();
  stopMic();
  simulationIndex = 0;
  activeTranscript = [];
  activeClarifications = [];
  currentRequirements = null;
  currentEvaluation = null;

  try {
    await fetch('/api/session/reset', { method: 'POST' });
  } catch {}

  document.getElementById('transcript-feed-area').innerHTML = `
    <div class="feed-placeholder" id="feed-placeholder">
      <div class="placeholder-icon">💬</div>
      <h3>Meeting Room Ready</h3>
      <p>Click <strong>Play (▶)</strong> to simulate the live meeting or activate <strong>Live Mic</strong>.</p>
    </div>
  `;

  document.getElementById('ambiguity-strip-text').innerText = '0 Ambiguous Statements Detected';
  document.getElementById('ambiguity-index-chip').innerText = 'Ambiguity: 0%';
  document.getElementById('count-clarify-tab').innerText = '0';
  document.getElementById('count-req-tab').innerText = '0';

  renderClarificationsHub();
  renderRequirementsBoard();
  renderTransformationDiff();
  resetEvaluationDisplay();
}

// Utterance Processing & Ambiguity Analysis
async function processNewUtterance(text, speaker = 'Participant', timestamp = '00:00') {
  if (!text || !text.trim()) return;

  const placeholder = document.getElementById('feed-placeholder');
  if (placeholder) placeholder.remove();

  // Sync to Backend Session API
  try {
    const res = await fetch('/api/session/utterance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speaker, timestamp })
    });
    const json = await res.json();
    if (json.success && json.data) {
      applyIncomingSessionState(json.data);
      return;
    }
  } catch (e) {
    // Offline local fallback
  }

  let analysis = localAnalyzeUtterance(text, speaker, timestamp);
  activeTranscript.push(analysis);
  renderUtteranceBubble(analysis);

  if (analysis.candidateQuestion) {
    const exists = activeClarifications.some(c => c.question === analysis.candidateQuestion.question || c.triggeredBy === text);
    if (!exists) {
      activeClarifications.push({
        ...analysis.candidateQuestion,
        selectedResponse: null
      });
      renderClarificationsHub();
    }
  }

  updateAmbiguityMetrics();
  await synthesizeAndEvaluateRequirements();
}

function renderUtteranceBubble(u) {
  const feed = document.getElementById('transcript-feed-area');
  if (!feed) return;

  const bubble = document.createElement('div');
  bubble.className = `utterance-bubble ${u.isAmbiguous ? 'ambiguous' : ''}`;

  let displayText = escapeHtml(u.text);
  if (u.detectedFlags && u.detectedFlags.length > 0) {
    u.detectedFlags.forEach(f => {
      if (!f.phrase) return;
      displayText = displayText.replace(
        new RegExp(`(${escapeRegex(escapeHtml(f.phrase))})`, 'gi'),
        '<span class="highlight-vague">$1</span>'
      );
    });
  }

  const isHM = (u.speaker || '').toLowerCase().includes('hiring') || (u.speaker || '').toLowerCase().includes('manager');
  const isEng = (u.speaker || '').toLowerCase().includes('engineer') || (u.speaker || '').toLowerCase().includes('architect');

  let avatarClass = '';
  if (isHM) avatarClass = 'hm';
  if (isEng) avatarClass = 'eng';

  bubble.innerHTML = `
    <div class="u-top">
      <div class="u-speaker-wrap">
        <div class="u-avatar ${avatarClass}">${escapeHtml((u.speaker || 'S')[0])}</div>
        <span class="u-speaker">${escapeHtml(u.speaker || 'Participant')}</span>
      </div>
      <span class="u-time">${escapeHtml(u.timestamp || '00:00')}</span>
    </div>
    <div class="u-body">${displayText}</div>
    ${u.detectedFlags && u.detectedFlags.length > 0 ? `
      <div class="u-flags-row">
        ${u.detectedFlags.map(f => `<span class="flag-chip">${escapeHtml(f.category)}: ${escapeHtml(f.severity || 'Medium')}</span>`).join('')}
      </div>
    ` : ''}
  `;

  feed.appendChild(bubble);
  feed.scrollTop = feed.scrollHeight;
}

function updateAmbiguityMetrics() {
  const ambiguousItems = activeTranscript.filter(u => u.isAmbiguous || (u.detectedFlags && u.detectedFlags.length > 0));
  const countEl = document.getElementById('ambiguity-strip-text');
  const chipEl = document.getElementById('ambiguity-index-chip');

  if (countEl) countEl.innerText = `${ambiguousItems.length} Ambiguous Statements Detected`;
  const ratio = activeTranscript.length > 0 ? Math.round((ambiguousItems.length / activeTranscript.length) * 100) : 0;
  if (chipEl) chipEl.innerText = `Ambiguity: ${ratio}%`;
}

// Clarification Q&A Hub
function renderClarificationsHub() {
  const container = document.getElementById('clarification-cards-container');
  const tabCount = document.getElementById('count-clarify-tab');
  if (tabCount) tabCount.innerText = activeClarifications.length;

  const total = activeClarifications.length;
  const answered = activeClarifications.filter(c => c.selectedResponse && c.selectedResponse.trim().length > 0).length;
  const pending = total - answered;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  const progressLabel = document.getElementById('clarify-progress-label');
  const progressBar = document.getElementById('clarify-progress-bar');
  const pendingSub = document.getElementById('clarify-pending-sub');
  if (progressLabel) progressLabel.innerText = `${answered} / ${total} Resolved (${pct}%)`;
  if (progressBar) progressBar.style.width = `${pct}%`;
  if (pendingSub) pendingSub.innerText = `${pending} requirements still pending stakeholder clarification`;

  if (!container) return;

  if (activeClarifications.length === 0) {
    container.innerHTML = `
      <div class="empty-clarify-state">
        <div class="empty-icon">💡</div>
        <h4>No Clarifications Pending</h4>
        <p>As speakers make vague statements in the meeting, AI-generated clarification cards will appear here.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = activeClarifications.map((c, idx) => {
    const isAnswered = !!(c.selectedResponse && c.selectedResponse.trim().length > 0);
    const options = c.suggestedOptions || c.options || [];
    const cid = c.id || `q-${idx+1}`;

    return `
      <div class="clarify-card ${isAnswered ? 'answered' : ''}">
        <div class="c-header">
          <span class="c-tag">${escapeHtml(c.category || 'Clarification')}</span>
          <span class="c-status ${isAnswered ? 'clarified' : 'pending'}">
            ${isAnswered ? '✓ Clarified by Stakeholder' : '● Needs Stakeholder Input'}
          </span>
        </div>
        <div class="c-question">${escapeHtml(c.question)}</div>
        ${c.triggeredBy ? `<div class="c-trigger">Triggered by statement: "${escapeHtml(c.triggeredBy)}"</div>` : ''}

        <div class="c-options-stack">
          <div style="font-size: 10px; color: #94a3b8; margin-bottom: 2px; font-weight: 600;">
            AI SUGGESTED METRICS (Click to adopt as stakeholder decision):
          </div>
          ${options.map(opt => {
            const isSelected = c.selectedResponse === opt ? 'selected' : '';
            return `
              <button class="opt-choice-btn ${isSelected}" data-cid="${cid}" data-idx="${idx}" data-opt="${escapeHtml(opt)}">
                ${escapeHtml(opt)}
              </button>
            `;
          }).join('')}
        </div>

        <input type="text" class="c-custom-input" placeholder="Or type custom stakeholder specification..." value="${escapeHtml(c.selectedResponse || '')}" data-cid="${cid}" data-idx="${idx}" />
      </div>
    `;
  }).join('');

  // Event handlers with session broadcast
  container.querySelectorAll('.opt-choice-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cid = btn.getAttribute('data-cid');
      const idx = parseInt(btn.getAttribute('data-idx'));
      const chosen = btn.getAttribute('data-opt');
      
      activeClarifications[idx].selectedResponse = chosen;
      renderClarificationsHub();

      // Sync to shared backend session
      try {
        await fetch('/api/session/clarify/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clarificationId: cid, selectedResponse: chosen })
        });
      } catch {}

      await synthesizeAndEvaluateRequirements();
    });
  });

  container.querySelectorAll('.c-custom-input').forEach(input => {
    input.addEventListener('change', async () => {
      const cid = input.getAttribute('data-cid');
      const idx = parseInt(input.getAttribute('data-idx'));
      const val = input.value.trim();
      
      activeClarifications[idx].selectedResponse = val;

      try {
        await fetch('/api/session/clarify/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clarificationId: cid, selectedResponse: val })
        });
      } catch {}

      await synthesizeAndEvaluateRequirements();
    });
  });
}

async function autoClarifyAll() {
  if (currentScenario?.sampleClarifications) {
    activeClarifications = currentScenario.sampleClarifications.map(c => ({ ...c }));
  } else {
    activeClarifications.forEach(c => {
      if (!c.selectedResponse) {
        const opts = c.suggestedOptions || c.options || [];
        c.selectedResponse = opts[0] || 'Quantified benchmark established.';
      }
    });
  }

  renderClarificationsHub();

  try {
    await fetch('/api/session/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: activeTranscript,
        clarifications: activeClarifications,
        domain: currentScenario?.domain || 'HR Tech'
      })
    });
  } catch {}

  await synthesizeAndEvaluateRequirements();
}

// Requirements Synthesis & Board Rendering
async function synthesizeAndEvaluateRequirements() {
  if (activeTranscript.length === 0) return;

  try {
    const domain = currentScenario?.domain || 'HR Tech';
    const res = await fetch('/api/refine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: activeTranscript,
        clarifications: activeClarifications,
        domain
      })
    });
    const json = await res.json();
    if (json.success) {
      currentRequirements = { baseline: json.baseline, refined: json.refined };
      currentEvaluation = json.evaluation || { refined: json.metrics };
      updateQualityEvaluationDisplay();
      renderTransformationDiff();
    }
  } catch (e) {
    console.error('Error generating requirements:', e);
  }

  renderRequirementsBoard();
}

function renderRequirementsBoard() {
  const container = document.getElementById('requirements-cards-container');
  const countTab = document.getElementById('count-req-tab');
  const countsIndicator = document.getElementById('req-counts-indicator');

  if (!container) return;

  if (!currentRequirements?.refined) {
    container.innerHTML = `
      <div class="empty-req-state">
        <div class="empty-icon">📋</div>
        <h4>Requirements Board Ready</h4>
        <p>Requirements will synthesize dynamically from meeting statements and stakeholder clarifications.</p>
      </div>
    `;
    return;
  }

  const frs = currentRequirements.refined.frs || [];
  const nfrs = currentRequirements.refined.nfrs || [];
  const total = frs.length + nfrs.length;

  if (countTab) countTab.innerText = total;
  if (countsIndicator) countsIndicator.innerText = `${frs.length} FRs | ${nfrs.length} NFRs`;

  let items = [];
  if (activeReqFilter === 'all') items = [...frs, ...nfrs];
  else if (activeReqFilter === 'fr') items = frs;
  else if (activeReqFilter === 'nfr') items = nfrs;

  container.innerHTML = items.map(req => {
    const isNFR = req.id.startsWith('NFR');
    const isResolved = req.status === 'RESOLVED';

    return `
      <div class="req-card ${isNFR ? 'nfr' : 'fr'}">
        <div class="req-card-header">
          <div class="req-id-badge">${escapeHtml(req.id)}</div>
          <span class="req-category-pill">${escapeHtml(isNFR ? (req.category || 'NFR') : 'Functional')}</span>
          <span class="req-status-pill ${isResolved ? 'resolved' : 'pending'}">
            ${isResolved ? '✓ RESOLVED' : '● PENDING CLARIFICATION'}
          </span>
        </div>
        <div class="req-title">${escapeHtml(req.title)}</div>
        <div class="req-desc">${escapeHtml(req.description)}</div>

        ${isNFR && req.targetThreshold ? `
          <div class="req-metric-box">
            <span class="metric-label">Target SLO / Criterion:</span>
            <span class="metric-val">${escapeHtml(req.targetThreshold)}</span>
          </div>
        ` : ''}

        ${req.acceptanceCriteria && req.acceptanceCriteria.length > 0 ? `
          <div class="req-ac-section">
            <div class="ac-header-label">Verifiable Acceptance Criteria:</div>
            ${req.acceptanceCriteria.map(ac => `
              <div class="ac-item-row">
                <span class="ac-icon">✓</span>
                <span>${escapeHtml(ac)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="req-footer">
          <span class="prov-tag">Source: ${escapeHtml(req.source || 'RAW_DIALOGUE')}</span>
          ${req.verificationMethod ? `<span class="verif-tag">Method: ${escapeHtml(req.verificationMethod)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Transformation Diff Tab
function renderTransformationDiff() {
  const container = document.getElementById('diff-cards-container');
  if (!container) return;

  if (!currentRequirements?.baseline || !currentRequirements?.refined) {
    container.innerHTML = `
      <div class="empty-diff-state">
        <p>Record meeting dialogue and answer clarifications to view before-vs-after requirement transformations.</p>
      </div>
    `;
    return;
  }

  const baseFRs = currentRequirements.baseline.frs || [];
  const baseNFRs = currentRequirements.baseline.nfrs || [];
  const refFRs = currentRequirements.refined.frs || [];
  const refNFRs = currentRequirements.refined.nfrs || [];

  const allRef = [...refFRs, ...refNFRs];
  const allBase = [...baseFRs, ...baseNFRs];

  container.innerHTML = allRef.map((ref, idx) => {
    const base = allBase.find(b => b.id === ref.id) || allBase[idx] || {};
    const isResolved = ref.status === 'RESOLVED';

    return `
      <div class="diff-card">
        <div class="diff-card-header">
          <span class="diff-req-id">${escapeHtml(ref.id)}: ${escapeHtml(ref.title)}</span>
          <span class="diff-status ${isResolved ? 'gain' : 'unresolved'}">
            ${isResolved ? '✓ Specification Quantified' : '● Awaiting Clarification'}
          </span>
        </div>
        <div class="diff-columns-grid">
          <div class="diff-col before">
            <div class="diff-col-tag">WITHOUT CLARIFICATION (Baseline)</div>
            <div class="diff-statement">${escapeHtml(base.description || 'Raw, unquantified statement.')}</div>
            <div class="diff-meta">Target: <code>${escapeHtml(base.targetThreshold || 'Unspecified')}</code></div>
          </div>
          <div class="diff-col after">
            <div class="diff-col-tag">WITH CLARIFICATION (Refined)</div>
            <div class="diff-statement">${escapeHtml(ref.description || '')}</div>
            <div class="diff-meta">Target: <code>${escapeHtml(ref.targetThreshold || 'Pending')}</code></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Quality Radar Chart & Evaluation
function initRadarChart() {
  const ctx = document.getElementById('quality-radar-canvas')?.getContext('2d');
  if (!ctx || typeof Chart === 'undefined') return;

  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Ambiguity (Inverse)', 'Testability', 'Completeness', 'Specificity', 'Traceability'],
      datasets: [
        {
          label: 'Without Clarification (Baseline)',
          data: [0, 0, 0, 0, 50],
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          pointBackgroundColor: '#ef4444',
          borderWidth: 2
        },
        {
          label: 'With Clarification (Refined)',
          data: [100, 100, 100, 90, 100],
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.25)',
          pointBackgroundColor: '#10b981',
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { stepSize: 20, backdropColor: 'transparent', color: '#94a3b8' },
          grid: { color: 'rgba(148, 163, 184, 0.15)' },
          angleLines: { color: 'rgba(148, 163, 184, 0.2)' },
          pointLabels: { color: '#f8fafc', font: { size: 11, weight: '600' } }
        }
      },
      plugins: {
        legend: { labels: { color: '#e2e8f0', font: { size: 11 } } }
      }
    }
  });
}

function updateQualityEvaluationDisplay() {
  if (!currentEvaluation) return;

  const refEval = currentEvaluation.refined || currentEvaluation;
  const baseEval = currentEvaluation.baseline;

  const oqi = refEval.overallQualityIndex ?? 8;
  const tier = refEval.qualityTier || (oqi >= 85 ? 'Excellent' : oqi >= 60 ? 'Good' : 'Poor');

  const oqiEl = document.getElementById('oqi-score-number');
  const tierEl = document.getElementById('oqi-tier-badge');
  const deltaEl = document.getElementById('oqi-delta-chip');

  if (oqiEl) oqiEl.innerText = `${oqi}/100`;
  if (tierEl) {
    tierEl.innerText = tier;
    tierEl.className = `tier-badge ${tier.toLowerCase()}`;
  }

  if (baseEval && deltaEl) {
    const delta = oqi - (baseEval.overallQualityIndex ?? 8);
    deltaEl.innerText = `+${delta} pts improvement`;
  }

  const m = refEval.metrics || {};
  const ambEl = document.getElementById('metric-val-ambiguity');
  const testEl = document.getElementById('metric-val-testability');
  const compEl = document.getElementById('metric-val-completeness');
  const specEl = document.getElementById('metric-val-specificity');
  const traceEl = document.getElementById('metric-val-traceability');

  if (ambEl) ambEl.innerText = `${m.ambiguity?.score ?? 0}%`;
  if (testEl) testEl.innerText = `${m.testability?.score ?? 100}%`;
  if (compEl) compEl.innerText = `${m.completeness?.score ?? 100}%`;
  if (specEl) specEl.innerText = `${m.specificity?.score ?? 90}%`;
  if (traceEl) traceEl.innerText = `${m.traceability?.score ?? 100}%`;

  if (radarChart && baseEval) {
    const baseM = baseEval.metrics || {};
    radarChart.data.datasets[0].data = [
      100 - (baseM.ambiguity?.score ?? 100),
      baseM.testability?.score ?? 0,
      baseM.completeness?.score ?? 0,
      baseM.specificity?.score ?? 0,
      baseM.traceability?.score ?? 50
    ];
    radarChart.data.datasets[1].data = [
      100 - (m.ambiguity?.score ?? 0),
      m.testability?.score ?? 100,
      m.completeness?.score ?? 100,
      m.specificity?.score ?? 90,
      m.traceability?.score ?? 100
    ];
    radarChart.update();
  }
}

function resetEvaluationDisplay() {
  const oqiEl = document.getElementById('oqi-score-number');
  const tierEl = document.getElementById('oqi-tier-badge');
  const deltaEl = document.getElementById('oqi-delta-chip');

  if (oqiEl) oqiEl.innerText = '-- / 100';
  if (tierEl) {
    tierEl.innerText = 'Awaiting Analysis';
    tierEl.className = 'tier-badge poor';
  }
  if (deltaEl) deltaEl.innerText = '+0 pts improvement';

  if (radarChart) {
    radarChart.data.datasets[0].data = [0, 0, 0, 0, 0];
    radarChart.data.datasets[1].data = [0, 0, 0, 0, 0];
    radarChart.update();
  }
}

// Live Microphone Speech Recognition (Web Speech API)
function toggleMicListening() {
  if (isMicListening) {
    stopMic();
  } else {
    startMic();
  }
}

function startMic() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Web Speech API is not supported in this browser. Please use Chrome.');
    return;
  }

  speechRecognitionInstance = new SpeechRecognition();
  speechRecognitionInstance.continuous = true;
  speechRecognitionInstance.interimResults = false;
  speechRecognitionInstance.lang = 'en-US';

  speechRecognitionInstance.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        const transcript = event.results[i][0].transcript.trim();
        const time = new Date().toTimeString().slice(3, 8);
        processNewUtterance(transcript, 'Live Speaker (Mic)', time);
      }
    }
  };

  speechRecognitionInstance.onerror = (e) => {
    console.error('Speech recognition error:', e.error);
    stopMic();
  };

  speechRecognitionInstance.onend = () => {
    if (isMicListening) {
      try { speechRecognitionInstance.start(); } catch {}
    }
  };

  speechRecognitionInstance.start();
  isMicListening = true;
  document.getElementById('btn-mic-toggle').classList.add('active');
  document.getElementById('btn-mic-toggle').style.background = '#ef4444';
}

function stopMic() {
  if (speechRecognitionInstance) {
    speechRecognitionInstance.stop();
  }
  isMicListening = false;
  const btn = document.getElementById('btn-mic-toggle');
  if (btn) {
    btn.classList.remove('active');
    btn.style.background = '';
  }
}

// Manual Quick Input & Custom Transcript
function sendManualLine() {
  const input = document.getElementById('manual-line-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const time = new Date().toTimeString().slice(3, 8);
  processNewUtterance(text, 'Manual Input', time);
}

function applyCustomTranscript() {
  const text = document.getElementById('custom-transcript-text').value.trim();
  if (!text) return;

  resetMeetingState();
  document.getElementById('custom-drawer').style.display = 'none';

  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const utterances = lines.map((line, idx) => {
    let speaker = 'Speaker';
    let content = line;
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < 30) {
      speaker = line.slice(0, colonIdx).trim();
      content = line.slice(colonIdx + 1).trim();
    }
    return {
      speaker,
      text: content,
      timestamp: `00:${String(idx * 5).padStart(2, '0')}`
    };
  });

  currentScenario = {
    id: 'custom',
    title: 'Custom Meeting Transcript',
    domain: 'General Software',
    utterances,
    sampleClarifications: []
  };

  utterances.forEach(u => processNewUtterance(u.text, u.speaker, u.timestamp));
}

// Export Execution
async function exportSpecification(format) {
  if (!currentRequirements) {
    alert('Please record or simulate meeting statements first!');
    return;
  }

  const payload = {
    title: currentScenario?.title || 'AI-Powered Requirement Analysis & Quality Report',
    transcript: activeTranscript,
    clarifications: activeClarifications,
    baseline: currentRequirements.baseline,
    refined: currentRequirements.refined,
    evaluation: currentEvaluation
  };

  try {
    const res = await fetch(`/api/export/${format}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Export request failed');

    if (format === 'json') {
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, 'requirement-specification.json');
    } else {
      const blob = await res.blob();
      const ext = format === 'txt' ? 'md' : format;
      downloadBlob(blob, `requirement-specification-report.${ext}`);
    }
  } catch (err) {
    alert(`Export Error: ${err.message}`);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegex(str) {
  return (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function localAnalyzeUtterance(text, speaker, timestamp) {
  const vague = /\b(good enough|trusts it|solid|impactful|strong|not strictly|not very structured|useful|avoid bias|shouldn'?t be slow|ideally quick|mvp soon)\b/gi;
  const matches = text.match(vague) || [];
  const isAmbiguous = matches.length > 0 && !text.trim().endsWith('?');

  return {
    text,
    speaker,
    timestamp,
    isAmbiguous,
    ambiguityScore: isAmbiguous ? 70 : 0,
    detectedFlags: matches.map(m => ({ phrase: m, category: 'Vagueness', severity: 'HIGH' })),
    candidateQuestion: isAmbiguous ? {
      id: `q-${Date.now()}`,
      category: 'Clarification',
      question: `Could you specify concrete numerical acceptance criteria for "${text}"?`,
      triggeredBy: text,
      suggestedOptions: ['Define measurable latency/accuracy SLO', 'Establish standard data schema', 'Specify formal acceptance bounds']
    } : null
  };
}
