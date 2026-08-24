/**
 * Web Application Main Controller
 * AI Real-Time Requirement Analysis & Evaluation Studio
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

document.addEventListener('DOMContentLoaded', async () => {
  initRadarChart();
  await loadScenarioData();
  setupEventListeners();
});

// 1. Fetch Sample Transcripts from Server
async function loadScenarioData() {
  try {
    const res = await fetch('/api/analyze/samples');
    const json = await res.json();
    if (json.success && json.data) {
      allSampleScenarios = json.data;
    }
  } catch (e) {
    console.warn('Backend offline, using fallback sample scenarios');
  }

  // Load the first scenario (Resume Analyzer - Assignment PDF)
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

// 2. Setup Event Listeners
function setupEventListeners() {
  // Scenario Select
  document.getElementById('scenario-select').addEventListener('change', (e) => {
    selectScenario(e.target.value);
  });

  // Player Controls
  document.getElementById('btn-play-pause').addEventListener('click', togglePlaySimulation);
  document.getElementById('btn-step-next').addEventListener('click', stepSimulation);
  document.getElementById('btn-instant-load').addEventListener('click', loadEntireMeetingInstantly);
  document.getElementById('btn-reset-meeting').addEventListener('click', resetMeetingState);

  // Microphone Speech Recognition
  document.getElementById('btn-mic-toggle').addEventListener('click', toggleMicListening);

  // Manual Line Input
  document.getElementById('btn-send-manual-line').addEventListener('click', sendManualLine);
  document.getElementById('manual-line-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendManualLine();
  });

  // Custom Transcript Drawer
  document.getElementById('btn-apply-custom').addEventListener('click', applyCustomTranscript);
  document.getElementById('btn-close-custom').addEventListener('click', () => {
    document.getElementById('custom-drawer').style.display = 'none';
    document.getElementById('scenario-select').value = currentScenario?.id || 'resume-analyzer-assignment';
  });

  // View Toggle (Clarifications vs Requirements)
  document.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const view = btn.getAttribute('data-view');
      document.getElementById(`view-${view}`)?.classList.add('active');
    });
  });

  // Auto Clarify All Button
  document.getElementById('btn-clarify-all-smart').addEventListener('click', autoClarifyAll);

  // Requirements Subtab Filters
  document.querySelectorAll('.req-subtab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.req-subtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeReqFilter = tab.getAttribute('data-filter');
      renderRequirementsBoard();
    });
  });

  // Export Dropdown Toggle
  const exportDropdownBtn = document.getElementById('btn-export-dropdown-toggle');
  const exportMenu = document.getElementById('export-menu');
  exportDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    exportMenu.classList.remove('show');
  });

  // Export Format Triggers
  document.getElementById('export-pdf-btn').addEventListener('click', () => exportSpecification('pdf'));
  document.getElementById('export-docx-btn').addEventListener('click', () => exportSpecification('docx'));
  document.getElementById('export-txt-btn').addEventListener('click', () => exportSpecification('txt'));
  document.getElementById('export-json-btn').addEventListener('click', () => exportSpecification('json'));
}

// 3. Meeting Simulation Engine
function togglePlaySimulation() {
  if (isSimPlaying) {
    pauseSimulation();
  } else {
    startSimulation();
  }
}

function startSimulation() {
  if (!currentScenario || !currentScenario.utterances) return;
  isSimPlaying = true;
  document.getElementById('audio-visualizer').classList.add('playing');
  document.getElementById('play-icon').innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';

  const speedMultiplier = parseFloat(document.getElementById('speed-select').value) || 1.0;
  const baseInterval = Math.max(400, Math.round(2000 / speedMultiplier));

  simIntervalTimer = setInterval(() => {
    if (simulationIndex < currentScenario.utterances.length) {
      const u = currentScenario.utterances[simulationIndex];
      processNewUtterance(u.text, u.speaker, u.timestamp);
      simulationIndex++;
    } else {
      pauseSimulation();
    }
  }, baseInterval);
}

function pauseSimulation() {
  isSimPlaying = false;
  clearInterval(simIntervalTimer);
  document.getElementById('audio-visualizer').classList.remove('playing');
  document.getElementById('play-icon').innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
}

function stopSimulation() {
  pauseSimulation();
  simulationIndex = 0;
}

function stepSimulation() {
  if (!currentScenario || !currentScenario.utterances) return;
  if (simulationIndex < currentScenario.utterances.length) {
    const u = currentScenario.utterances[simulationIndex];
    processNewUtterance(u.text, u.speaker, u.timestamp);
    simulationIndex++;
  }
}

function loadEntireMeetingInstantly() {
  if (!currentScenario || !currentScenario.utterances) return;
  pauseSimulation();

  while (simulationIndex < currentScenario.utterances.length) {
    const u = currentScenario.utterances[simulationIndex];
    processNewUtterance(u.text, u.speaker, u.timestamp);
    simulationIndex++;
  }
}

function resetMeetingState() {
  stopSimulation();
  activeTranscript = [];
  activeClarifications = [];
  currentRequirements = null;
  currentEvaluation = null;

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
  resetEvaluationDisplay();
}

// 4. Utterance Processing & Ambiguity Analysis
async function processNewUtterance(text, speaker = 'Participant', timestamp = '00:00') {
  if (!text) return;

  // Clear placeholder if first utterance
  const placeholder = document.getElementById('feed-placeholder');
  if (placeholder) placeholder.remove();

  // Call Backend API or fast NLP heuristic
  let analysis = null;
  try {
    const res = await fetch('/api/analyze/utterance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speaker, timestamp })
    });
    const json = await res.json();
    if (json.success) analysis = json.data;
  } catch (e) {
    // Local fallback
  }

  if (!analysis) {
    analysis = localAnalyzeUtterance(text, speaker, timestamp);
  }

  activeTranscript.push(analysis);

  // Append to Feed DOM
  renderUtteranceBubble(analysis);

  // If question was triggered, add to Clarifications Hub
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

  // Update Ambiguity Strip
  updateAmbiguityMetrics();

  // Refresh Requirements & Quality
  await synthesizeAndEvaluateRequirements();
}

function renderUtteranceBubble(u) {
  const feed = document.getElementById('transcript-feed-area');
  const bubble = document.createElement('div');
  bubble.className = `utterance-bubble ${u.isAmbiguous ? 'ambiguous' : ''}`;

  let displayText = u.text;
  if (u.detectedFlags && u.detectedFlags.length > 0) {
    u.detectedFlags.forEach(f => {
      displayText = displayText.replace(
        new RegExp(`(${f.phrase})`, 'gi'),
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
        <div class="u-avatar ${avatarClass}">${(u.speaker || 'S')[0]}</div>
        <span class="u-speaker">${u.speaker || 'Participant'}</span>
      </div>
      <span class="u-time">${u.timestamp || '00:00'}</span>
    </div>
    <div class="u-body">${displayText}</div>
    ${u.detectedFlags && u.detectedFlags.length > 0 ? `
      <div class="u-flags-row">
        ${u.detectedFlags.map(f => `<span class="flag-chip">${f.category}: ${f.severity}</span>`).join('')}
      </div>
    ` : ''}
  `;

  feed.appendChild(bubble);
  feed.scrollTop = feed.scrollHeight;
}

function updateAmbiguityMetrics() {
  const ambiguousItems = activeTranscript.filter(u => u.isAmbiguous);
  const countEl = document.getElementById('ambiguity-strip-text');
  const chipEl = document.getElementById('ambiguity-index-chip');

  countEl.innerText = `${ambiguousItems.length} Ambiguous Statements Detected`;
  const ratio = activeTranscript.length > 0 ? Math.round((ambiguousItems.length / activeTranscript.length) * 100) : 0;
  chipEl.innerText = `Ambiguity: ${ratio}%`;
}

// 5. Clarification Q&A Hub
function renderClarificationsHub() {
  const container = document.getElementById('clarification-cards-container');
  const tabCount = document.getElementById('count-clarify-tab');
  tabCount.innerText = activeClarifications.length;

  const total = activeClarifications.length;
  const answered = activeClarifications.filter(c => c.selectedResponse && c.selectedResponse.trim().length > 0).length;
  const pending = total - answered;
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  // Update Progress Meter
  const progressLabel = document.getElementById('clarify-progress-label');
  const progressBar = document.getElementById('clarify-progress-bar');
  const pendingSub = document.getElementById('clarify-pending-sub');
  if (progressLabel) progressLabel.innerText = `${answered} / ${total} Resolved (${pct}%)`;
  if (progressBar) progressBar.style.width = `${pct}%`;
  if (pendingSub) pendingSub.innerText = `${pending} requirements still pending stakeholder clarification`;

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

    return `
      <div class="clarify-card ${isAnswered ? 'answered' : ''}">
        <div class="c-header">
          <span class="c-tag">${c.category || 'Clarification'}</span>
          <span class="c-status ${isAnswered ? 'clarified' : 'pending'}">
            ${isAnswered ? '✓ Clarified by Stakeholder' : '● Needs Stakeholder Input'}
          </span>
        </div>
        <div class="c-question">${c.question}</div>
        ${c.triggeredBy ? `<div class="c-trigger">Triggered by statement: "${c.triggeredBy}"</div>` : ''}

        <div class="c-options-stack">
          <div style="font-size: 10px; color: #94a3b8; margin-bottom: 2px; font-weight: 600;">
            AI SUGGESTED METRICS (Click to adopt as stakeholder decision):
          </div>
          ${options.map(opt => {
            const isSelected = c.selectedResponse === opt ? 'selected' : '';
            return `
              <button class="opt-choice-btn ${isSelected}" data-idx="${idx}" data-opt="${escapeHtml(opt)}">
                ${opt}
              </button>
            `;
          }).join('')}
        </div>

        <input type="text" class="c-custom-input" placeholder="Or type custom stakeholder specification..." value="${c.selectedResponse || ''}" data-idx="${idx}" />
      </div>
    `;
  }).join('');

  // Event handlers
  container.querySelectorAll('.opt-choice-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-idx'));
      const chosen = btn.getAttribute('data-opt');
      activeClarifications[idx].selectedResponse = chosen;
      renderClarificationsHub();
      await synthesizeAndEvaluateRequirements();
    });
  });

  container.querySelectorAll('.c-custom-input').forEach(input => {
    input.addEventListener('change', async () => {
      const idx = parseInt(input.getAttribute('data-idx'));
      activeClarifications[idx].selectedResponse = input.value.trim();
      await synthesizeAndEvaluateRequirements();
    });
  });
}

function autoClarifyAll() {
  if (currentScenario?.sampleClarifications) {
    activeClarifications = [...currentScenario.sampleClarifications];
  } else {
    activeClarifications.forEach(c => {
      if (!c.selectedResponse) {
        const opts = c.suggestedOptions || c.options || [];
        c.selectedResponse = opts[0] || 'Quantified benchmark established.';
      }
    });
  }

  renderClarificationsHub();
  synthesizeAndEvaluateRequirements();
}

// 6. Requirements Synthesis & Board Rendering
async function synthesizeAndEvaluateRequirements() {
  if (activeTranscript.length === 0) return;

  try {
    const domain = currentScenario?.domain || 'HR Tech';
    const res = await fetch('/api/requirements/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        utterances: activeTranscript,
        clarifications: activeClarifications,
        domain
      })
    });
    const json = await res.json();
    if (json.success) {
      currentRequirements = json.data;

      // Now Evaluate
      const evalRes = await fetch('/api/evaluate/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseline: currentRequirements.baseline,
          refined: currentRequirements.refined
        })
      });
      const evalJson = await evalRes.json();
      if (evalJson.success) {
        currentEvaluation = evalJson.data;
        updateQualityEvaluationDisplay();
      }
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

  countTab.innerText = total;
  countsIndicator.innerText = `${frs.length} FRs | ${nfrs.length} NFRs`;

  let items = [];
  if (activeReqFilter === 'all') items = [...frs, ...nfrs];
  else if (activeReqFilter === 'fr') items = frs;
  else if (activeReqFilter === 'nfr') items = nfrs;

  container.innerHTML = items.map(req => {
    const isNFR = req.id.startsWith('NFR');
    const isResolved = req.status === 'RESOLVED';
    return `
      <div class="req-full-card ${isResolved ? 'resolved' : 'pending'}">
        <div class="req-top-bar">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="req-badge-id">${req.id}</span>
            <span class="req-category-tag">${req.category || (isNFR ? 'NFR' : 'Functional')}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="status-chip ${isResolved ? 'resolved' : 'pending'}">
              ${isResolved ? '✓ RESOLVED' : '● PENDING CLARIFICATION'}
            </span>
            <span class="req-priority-pill must">${req.priority || 'Must Have'}</span>
          </div>
        </div>

        <div class="req-title-text">${req.title}</div>
        <div class="req-desc-text">${req.description}</div>

        ${isNFR ? `
          <div class="req-slo-highlight ${isResolved ? 'resolved' : 'unresolved'}">
            <strong>Target SLO / Verifiable Threshold:</strong> ${req.targetThreshold || req.metric}
          </div>
        ` : ''}

        ${req.acceptanceCriteria && req.acceptanceCriteria.length > 0 ? `
          <div class="req-ac-list">
            <strong>Acceptance Criteria (Gherkin / Pass-Fail):</strong>
            <ul>
              ${req.acceptanceCriteria.map(ac => `<li>${ac}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div style="font-size: 10.5px; color: #64748b; margin-top: 2px;">
          ${req.clarificationReference ? `Traceability: ${req.clarificationReference}` : `Source: "${req.sourceStatement || 'Meeting discussion'}"`}
        </div>
      </div>
    `;
  }).join('');
}

// 7. Quality Evaluation & Radar Chart
function initRadarChart() {
  const ctx = document.getElementById('qualityRadarChart').getContext('2d');
  radarChart = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Testability', 'Completeness', 'Specificity', 'Traceability', 'Unambiguity'],
      datasets: [
        {
          label: 'Without Clarification (Baseline)',
          data: [25, 35, 30, 40, 22],
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          borderColor: '#ef4444',
          borderWidth: 2,
          pointBackgroundColor: '#ef4444'
        },
        {
          label: 'With AI Clarification (Refined)',
          data: [92, 94, 90, 95, 88],
          backgroundColor: 'rgba(16, 185, 129, 0.25)',
          borderColor: '#10b981',
          borderWidth: 2,
          pointBackgroundColor: '#10b981'
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
          ticks: { display: false },
          grid: { color: 'rgba(255, 255, 255, 0.08)' },
          angleLines: { color: 'rgba(255, 255, 255, 0.08)' },
          pointLabels: {
            color: '#94a3b8',
            font: { size: 11, family: 'Plus Jakarta Sans', weight: '600' }
          }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#cbd5e1', font: { size: 11, family: 'Plus Jakarta Sans' } }
        }
      }
    }
  });
}

function updateQualityEvaluationDisplay() {
  if (!currentEvaluation) return;

  const baseline = currentEvaluation.baseline;
  const refined = currentEvaluation.refined;
  const comparison = currentEvaluation.comparison;

  document.getElementById('eval-baseline-oqi').innerText = `${baseline.overallQualityIndex}%`;
  document.getElementById('eval-baseline-tier').innerText = `${baseline.qualityTier} Quality`;

  document.getElementById('eval-refined-oqi').innerText = `${refined.overallQualityIndex}%`;
  document.getElementById('eval-refined-tier').innerText = `${refined.qualityTier} Quality`;

  const delta = refined.overallQualityIndex - baseline.overallQualityIndex;
  document.getElementById('eval-delta-tag').innerText = `+${delta}% Δ`;

  document.getElementById('quality-verdict-box').innerText = refined.summary || 'Requirements refined to rigorous testable standard.';

  // Update Metric Breakdown
  const bAmb = baseline.metrics?.ambiguity?.score || 78;
  const rAmb = refined.metrics?.ambiguity?.score || 12;
  document.getElementById('val-base-amb').innerText = `${bAmb}%`;
  document.getElementById('val-ref-amb').innerText = `${rAmb}%`;
  document.getElementById('bar-base-amb').style.width = `${bAmb}%`;
  document.getElementById('bar-ref-amb').style.width = `${rAmb}%`;
  document.getElementById('amb-delta').innerText = `-${bAmb - rAmb}% (Improvement)`;

  const bTest = baseline.metrics?.testability?.score || 25;
  const rTest = refined.metrics?.testability?.score || 92;
  document.getElementById('val-base-test').innerText = `${bTest}%`;
  document.getElementById('val-ref-test').innerText = `${rTest}%`;
  document.getElementById('bar-base-test').style.width = `${bTest}%`;
  document.getElementById('bar-ref-test').style.width = `${rTest}%`;
  document.getElementById('test-delta').innerText = `+${rTest - bTest}% Gain`;

  const bComp = baseline.metrics?.completeness?.score || 35;
  const rComp = refined.metrics?.completeness?.score || 94;
  document.getElementById('val-base-comp').innerText = `${bComp}%`;
  document.getElementById('val-ref-comp').innerText = `${rComp}%`;
  document.getElementById('bar-base-comp').style.width = `${bComp}%`;
  document.getElementById('bar-ref-comp').style.width = `${rComp}%`;
  document.getElementById('comp-delta').innerText = `+${rComp - bComp}% Gain`;

  const bSpec = baseline.metrics?.specificity?.score || 30;
  const rSpec = refined.metrics?.specificity?.score || 90;
  document.getElementById('val-base-spec').innerText = `${bSpec}%`;
  document.getElementById('val-ref-spec').innerText = `${rSpec}%`;
  document.getElementById('bar-base-spec').style.width = `${bSpec}%`;
  document.getElementById('bar-ref-spec').style.width = `${rSpec}%`;
  document.getElementById('spec-delta').innerText = `+${rSpec - bSpec}% Gain`;

  // Update Radar Chart Data
  if (radarChart) {
    radarChart.data.datasets[0].data = [bTest, bComp, bSpec, baseline.metrics?.traceability?.score || 40, 100 - bAmb];
    radarChart.data.datasets[1].data = [rTest, rComp, rSpec, refined.metrics?.traceability?.score || 95, 100 - rAmb];
    radarChart.update();
  }
}

function resetEvaluationDisplay() {
  document.getElementById('eval-baseline-oqi').innerText = '0%';
  document.getElementById('eval-refined-oqi').innerText = '0%';
  document.getElementById('eval-delta-tag').innerText = '+0% Δ';
  if (radarChart) {
    radarChart.data.datasets[0].data = [0, 0, 0, 0, 0];
    radarChart.data.datasets[1].data = [0, 0, 0, 0, 0];
    radarChart.update();
  }
}

// 8. Live Microphone Speech Recognition
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
    alert('Web Speech API is not supported in this browser. Please use Chrome or paste your transcript.');
    return;
  }

  speechRecognitionInstance = new SpeechRecognition();
  speechRecognitionInstance.continuous = true;
  speechRecognitionInstance.interimResults = false;
  speechRecognitionInstance.lang = 'en-US';

  speechRecognitionInstance.onresult = (event) => {
    const lastResult = event.results[event.results.length - 1];
    if (lastResult.isFinal) {
      const speech = lastResult[0].transcript.trim();
      const time = new Date().toTimeString().slice(3, 8);
      processNewUtterance(speech, 'Live Speaker (Mic)', time);
    }
  };

  speechRecognitionInstance.onerror = (e) => {
    console.error('Speech recognition error:', e);
    stopMic();
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
  document.getElementById('btn-mic-toggle').classList.remove('active');
  document.getElementById('btn-mic-toggle').style.background = '';
}

// 9. Manual Quick Input & Custom Transcript
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

// 10. Export Execution
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

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `requirement-specification-report.${format === 'txt' ? 'md' : format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    alert(`Export Error: ${err.message}`);
  }
}

// Helper: Escape HTML
function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Fallback client analyzer
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
