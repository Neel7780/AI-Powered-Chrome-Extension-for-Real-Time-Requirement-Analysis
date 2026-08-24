/**
 * Side Panel Controller for Real-Time Requirement Engineering
 */

let activeTranscript = [];
let activeClarifications = [];
let generatedRequirements = null;
let qualityEvaluation = null;
let currentReqFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId)?.classList.add('active');
    });
  });

  // Manual Input
  const manualInput = document.getElementById('manual-transcript-input');
  const btnSendManual = document.getElementById('btn-send-manual');

  function sendManualSpeech() {
    const text = manualInput.value.trim();
    if (!text) return;
    manualInput.value = '';

    const timestamp = new Date().toTimeString().slice(3, 8);
    const analysis = window.ClientNLPEngine?.analyzeUtterance(text, 'Participant', timestamp);

    chrome.runtime.sendMessage({
      type: 'NEW_UTTERANCE',
      payload: {
        speaker: 'Participant',
        text,
        timestamp,
        ...analysis
      }
    });

    handleLocalUtterance({ speaker: 'Participant', text, timestamp, ...analysis });
  }

  btnSendManual.addEventListener('click', sendManualSpeech);
  manualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendManualSpeech();
  });

  // Load PDF Sample Meeting
  document.getElementById('btn-load-pdf-sample').addEventListener('click', loadSamplePDFMeeting);

  // Clear all data
  document.getElementById('btn-clear-all').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_MEETING_DATA' });
    activeTranscript = [];
    activeClarifications = [];
    generatedRequirements = null;
    qualityEvaluation = null;
    renderAll();
  });

  // Requirement Filter Chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentReqFilter = chip.getAttribute('data-filter');
      renderRequirements();
    });
  });

  // Export Buttons
  document.getElementById('btn-export-pdf').addEventListener('click', () => triggerExport('pdf'));
  document.getElementById('btn-export-docx').addEventListener('click', () => triggerExport('docx'));
  document.getElementById('btn-export-txt').addEventListener('click', () => triggerExport('txt'));
  document.getElementById('btn-export-json').addEventListener('click', () => triggerExport('json'));

  // Sync initial state from background service worker
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
    if (res?.state) {
      activeTranscript = res.state.transcript || [];
      activeClarifications = res.state.clarifications || [];
      renderAll();
    }
  });

  // Listen for real-time messages from background worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'UTTERANCE_ADDED') {
      handleLocalUtterance(message.payload.utterance);
    } else if (message.type === 'CLARIFICATION_UPDATED') {
      activeClarifications = message.payload.allClarifications;
      updateRequirementsAndQuality();
    } else if (message.type === 'MEETING_DATA_RESET') {
      activeTranscript = [];
      activeClarifications = [];
      renderAll();
    }
  });
});

function handleLocalUtterance(u) {
  const last = activeTranscript[activeTranscript.length - 1];
  if (last && last.text === u.text && last.speaker === u.speaker) return;

  activeTranscript.push(u);
  if (u.candidateQuestion) {
    const exists = activeClarifications.some(c => c.id === u.candidateQuestion.id || c.triggeredBy === u.text);
    if (!exists) {
      activeClarifications.push({
        ...u.candidateQuestion,
        selectedResponse: null
      });
    }
  }

  renderAll();
}

function loadSamplePDFMeeting() {
  const sample = window.EXT_SAMPLE_TRANSCRIPTS?.[0];
  if (!sample) return;

  activeTranscript = [];
  sample.utterances.forEach(u => {
    const analysis = window.ClientNLPEngine?.analyzeUtterance(u.text, u.speaker, u.timestamp);
    activeTranscript.push({
      speaker: u.speaker,
      text: u.text,
      timestamp: u.timestamp,
      ...analysis
    });
  });

  activeClarifications = [...sample.sampleClarifications];
  renderAll();
}

function renderAll() {
  renderTranscript();
  renderClarifications();
  updateRequirementsAndQuality();
}

function renderTranscript() {
  const feed = document.getElementById('transcript-feed');
  const badgeStream = document.getElementById('badge-stream-count');
  const ambCountEl = document.getElementById('stream-ambiguity-count');

  badgeStream.innerText = activeTranscript.length;
  const ambiguousCount = activeTranscript.filter(u => u.isAmbiguous).length;
  ambCountEl.innerText = `${ambiguousCount} flagged statements`;

  if (activeTranscript.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎙️</div>
        <p>Start speaking in Zoom / Google Meet or click "Sample" to load the assignment transcript.</p>
      </div>
    `;
    return;
  }

  feed.innerHTML = activeTranscript.map((u, i) => {
    let displayText = u.text;
    if (u.detectedFlags && u.detectedFlags.length > 0) {
      u.detectedFlags.forEach(f => {
        displayText = displayText.replace(
          new RegExp(`(${f.phrase})`, 'gi'),
          '<span class="highlight-vague">$1</span>'
        );
      });
    }

    return `
      <div class="utterance-card ${u.isAmbiguous ? 'ambiguous' : ''}">
        <div class="utterance-meta">
          <span class="speaker-name">${u.speaker || 'Speaker'}</span>
          <span class="speaker-time">${u.timestamp || '00:00'}</span>
        </div>
        <div class="utterance-text">${displayText}</div>
        ${u.detectedFlags && u.detectedFlags.length > 0 ? `
          <div class="flags-tags">
            ${u.detectedFlags.map(f => `<span class="flag-badge">${f.category}: ${f.severity}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  feed.scrollTop = feed.scrollHeight;
}

function renderClarifications() {
  const list = document.getElementById('clarifications-list');
  const badgeClarify = document.getElementById('badge-clarify-count');
  badgeClarify.innerText = activeClarifications.length;

  if (activeClarifications.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💡</div>
        <p>No clarification questions pending yet. Ambiguous statements in the transcript will trigger questions here.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = activeClarifications.map((c, idx) => {
    const isAnswered = !!c.selectedResponse;
    return `
      <div class="clarification-card ${isAnswered ? 'answered' : ''}">
        <div class="q-header">
          <span class="q-cat">${c.category || 'Clarification'}</span>
          <span style="font-size: 11px; color: ${isAnswered ? '#10b981' : '#f59e0b'}; font-weight: 700;">
            ${isAnswered ? '✓ Clarified' : '● Needs Answer'}
          </span>
        </div>
        <div class="q-title">${c.question}</div>
        ${c.triggeredBy ? `<div class="q-trigger">Triggered by: "${c.triggeredBy}"</div>` : ''}
        
        <div class="options-stack">
          ${(c.suggestedOptions || c.options || []).map((opt, oIdx) => {
            const selected = c.selectedResponse === opt ? 'selected' : '';
            return `
              <button class="option-choice-btn ${selected}" data-qindex="${idx}" data-opt="${opt}">
                ${opt}
              </button>
            `;
          }).join('')}
        </div>

        <input type="text" class="custom-answer-input" placeholder="Or enter custom stakeholder clarification..." value="${c.selectedResponse || ''}" data-qindex="${idx}" />
      </div>
    `;
  }).join('');

  // Event handlers for option selection & custom inputs
  list.querySelectorAll('.option-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const qIndex = parseInt(btn.getAttribute('data-qindex'));
      const chosen = btn.getAttribute('data-opt');
      activeClarifications[qIndex].selectedResponse = chosen;
      chrome.runtime.sendMessage({
        type: 'SAVE_CLARIFICATION_RESPONSE',
        payload: activeClarifications[qIndex]
      });
      renderClarifications();
      updateRequirementsAndQuality();
    });
  });

  list.querySelectorAll('.custom-answer-input').forEach(input => {
    input.addEventListener('change', () => {
      const qIndex = parseInt(input.getAttribute('data-qindex'));
      activeClarifications[qIndex].selectedResponse = input.value.trim();
      chrome.runtime.sendMessage({
        type: 'SAVE_CLARIFICATION_RESPONSE',
        payload: activeClarifications[qIndex]
      });
      updateRequirementsAndQuality();
    });
  });
}

async function updateRequirementsAndQuality() {
  if (activeTranscript.length === 0) return;

  // Generate via API or offline logic
  const reqData = await window.ExtensionAPI?.generateRequirements(activeTranscript, activeClarifications, 'HR Tech');
  if (reqData) {
    generatedRequirements = reqData;
    const evalData = await window.ExtensionAPI?.evaluateRequirements(reqData.baseline, reqData.refined);
    if (evalData) {
      qualityEvaluation = evalData;
    }
  }

  renderRequirements();
  renderQualityTab();
}

function renderRequirements() {
  const list = document.getElementById('requirements-list');
  const countAll = document.getElementById('count-all-reqs');
  const countFr = document.getElementById('count-fr-reqs');
  const countNfr = document.getElementById('count-nfr-reqs');
  const badgeReq = document.getElementById('badge-req-count');

  if (!generatedRequirements?.refined) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>Requirements will be automatically synthesized from transcript and clarifications.</p>
      </div>
    `;
    return;
  }

  const frs = generatedRequirements.refined.frs || [];
  const nfrs = generatedRequirements.refined.nfrs || [];
  countFr.innerText = frs.length;
  countNfr.innerText = nfrs.length;
  countAll.innerText = frs.length + nfrs.length;
  badgeReq.innerText = frs.length + nfrs.length;

  let itemsToRender = [];
  if (currentReqFilter === 'all') itemsToRender = [...frs, ...nfrs];
  else if (currentReqFilter === 'fr') itemsToRender = frs;
  else if (currentReqFilter === 'nfr') itemsToRender = nfrs;

  list.innerHTML = itemsToRender.map(req => {
    const isNFR = req.id.startsWith('NFR');
    return `
      <div class="req-card">
        <div class="req-card-top">
          <span class="req-id">${req.id}</span>
          <span class="req-priority ${req.priority === 'High' ? 'high' : ''}">${req.priority || 'High'}</span>
        </div>
        <div class="req-title">${req.title}</div>
        <div class="req-desc">${req.description}</div>
        ${isNFR ? `
          <div class="req-metric-box">
            <strong>Target SLO / Metric:</strong> ${req.targetThreshold || req.metric}
          </div>
        ` : `
          <div style="font-size: 11px; color: #94a3b8; font-style: italic;">
            ${(req.acceptanceCriteria || []).slice(0, 1).join('')}
          </div>
        `}
      </div>
    `;
  }).join('');
}

function renderQualityTab() {
  const badgeScore = document.getElementById('badge-quality-score');
  const baseScoreEl = document.getElementById('qual-baseline-score');
  const refScoreEl = document.getElementById('qual-refined-score');
  const deltaBadge = document.getElementById('qual-delta-badge');

  const baseOQI = qualityEvaluation?.baseline?.overallQualityIndex || 30;
  const refOQI = qualityEvaluation?.refined?.overallQualityIndex || 92;
  const delta = refOQI - baseOQI;

  baseScoreEl.innerText = `${baseOQI}%`;
  refScoreEl.innerText = `${refOQI}%`;
  badgeScore.innerText = `${refOQI}%`;
  deltaBadge.innerText = `+${delta} Points Overall Quality Improvement (+${Math.round((delta/baseOQI)*100)}%)`;
}

async function triggerExport(format) {
  if (!generatedRequirements) {
    alert('Please load or record meeting requirements first!');
    return;
  }

  const payload = {
    title: 'AI-Powered Requirement Analysis & Quality Report',
    transcript: activeTranscript,
    clarifications: activeClarifications,
    baseline: generatedRequirements.baseline,
    refined: generatedRequirements.refined,
    evaluation: qualityEvaluation
  };

  try {
    const blob = await window.ExtensionAPI.exportDocument(format, payload);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `requirement-specification-report.${format === 'txt' ? 'md' : format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    alert(`Export error: ${err.message}`);
  }
}
