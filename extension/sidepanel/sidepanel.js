/**
 * Side Panel Controller for Real-Time Requirement Engineering
 */

let activeTranscript = [];
let activeClarifications = [];
let generatedRequirements = null;
let qualityEvaluation = null;
let currentReqFilter = 'all';
let backendReachable = true;

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

  // Copy each clarification object, not just the array: selecting a response
  // writes to `selectedResponse`, which would otherwise mutate the shared sample
  // data and leave stale answers behind after "Clear all".
  activeClarifications = sample.sampleClarifications.map(c => ({ ...c }));
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
    // Escape before highlighting, and escape the flag phrase the same way so it
    // still matches. Regex metacharacters in the phrase are neutralised.
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

    return `
      <div class="utterance-card ${u.isAmbiguous ? 'ambiguous' : ''}">
        <div class="utterance-meta">
          <span class="speaker-name">${escapeHtml(u.speaker || 'Speaker')}</span>
          <span class="speaker-time">${escapeHtml(u.timestamp || '00:00')}</span>
        </div>
        <div class="utterance-text">${displayText}</div>
        ${u.detectedFlags && u.detectedFlags.length > 0 ? `
          <div class="flags-tags">
            ${u.detectedFlags.map(f => `<span class="flag-badge">${escapeHtml(f.category)}: ${escapeHtml(f.severity)}</span>`).join('')}
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
          <span class="q-cat">${escapeHtml(c.category || 'Clarification')}</span>
          <span style="font-size: 11px; color: ${isAnswered ? '#10b981' : '#f59e0b'}; font-weight: 700;">
            ${isAnswered ? '✓ Clarified' : '● Needs Answer'}
          </span>
        </div>
        <div class="q-title">${escapeHtml(c.question)}</div>
        ${c.triggeredBy ? `<div class="q-trigger">Triggered by: "${escapeHtml(c.triggeredBy)}"</div>` : ''}

        <div class="options-stack">
          ${(c.suggestedOptions || c.options || []).map((opt, oIdx) => {
            const selected = c.selectedResponse === opt ? 'selected' : '';
            return `
              <button class="option-choice-btn ${selected}" data-qindex="${idx}" data-opt="${escapeHtml(opt)}">
                ${escapeHtml(opt)}
              </button>
            `;
          }).join('')}
        </div>

        <input type="text" class="custom-answer-input" placeholder="Or enter custom stakeholder clarification..." value="${escapeHtml(c.selectedResponse || '')}" data-qindex="${idx}" />
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
  // A null result means the local backend is unreachable. Record that so the
  // Requirements and Quality tabs can say so instead of showing an empty panel
  // that looks like "no requirements found".
  backendReachable = !!reqData;

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
    list.innerHTML = !backendReachable
      ? `
      <div class="empty-state">
        <div class="empty-icon">🔌</div>
        <p><strong>Backend unreachable.</strong> Ambiguity detection and clarification capture keep working offline, but requirement synthesis and quality evaluation need the local server.</p>
        <p style="margin-top: 6px; font-size: 11px; opacity: 0.8;">Run <code>npm start</code> and reopen this panel.</p>
      </div>
    `
      : `
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
    const isResolved = req.status === 'RESOLVED';
    return `
      <div class="req-card ${isResolved ? 'resolved' : 'pending'}">
        <div class="req-card-top">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="req-id">${escapeHtml(req.id)}</span>
            <span style="font-size: 9px; font-weight: 800; padding: 1px 6px; border-radius: 8px; background: ${isResolved ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; color: ${isResolved ? '#6ee7b7' : '#fcd34d'};">
              ${isResolved ? 'RESOLVED' : 'PENDING'}
            </span>
          </div>
          <span class="req-priority ${req.priority === 'High' ? 'high' : ''}">${escapeHtml(req.priority || 'High')}</span>
        </div>
        <div class="req-title">${escapeHtml(req.title)}</div>
        <div class="req-desc">${escapeHtml(req.description)}</div>
        ${isNFR ? `
          <div class="req-metric-box" style="${isResolved ? '' : 'background: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.3); color: #fcd34d;'}">
            <strong>Target SLO / Metric:</strong> ${escapeHtml(req.targetThreshold || req.metric)}
          </div>
        ` : `
          <div style="font-size: 11px; color: #94a3b8; font-style: italic;">
            ${escapeHtml((req.acceptanceCriteria || []).slice(0, 1).join(''))}
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

  // Never fabricate scores: until an evaluation exists, show placeholders rather
  // than hard-coded numbers that would misreport the measured quality.
  const baseOQI = qualityEvaluation?.baseline?.overallQualityIndex;
  const refOQI = qualityEvaluation?.refined?.overallQualityIndex;

  if (typeof baseOQI !== 'number' || typeof refOQI !== 'number') {
    baseScoreEl.innerText = '--';
    refScoreEl.innerText = '--';
    badgeScore.innerText = '--';
    deltaBadge.innerText = backendReachable
      ? 'Awaiting requirement evaluation'
      : 'Backend unreachable — start the server on port 3000';
    return;
  }

  const delta = refOQI - baseOQI;
  baseScoreEl.innerText = `${baseOQI}%`;
  refScoreEl.innerText = `${refOQI}%`;
  badgeScore.innerText = `${refOQI}%`;
  // Guard the relative figure: a baseline of 0 has no finite percentage gain.
  deltaBadge.innerText = baseOQI > 0
    ? `+${delta} Points Overall Quality Improvement (+${Math.round((delta / baseOQI) * 100)}%)`
    : `+${delta} Points Overall Quality Improvement`;
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

// --- Shared escaping helpers (hoisted; used by the render code above) ---
function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Neutralise regex metacharacters so transcript-derived phrases can be used as
// literal search patterns.
function escapeRegex(str) {
  return (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
