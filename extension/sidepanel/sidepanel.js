/**
 * Side Panel Controller for Real-Time Requirement Engineering
 * Synchronized with Web Dashboard and live Zoom/Google Meet meetings via WebSocket & REST.
 */

let activeTranscript = [];
let activeClarifications = [];
let generatedRequirements = null;
let qualityEvaluation = null;
let currentReqFilter = 'all';
let backendReachable = true;
let sessionSocket = null;
let syncPollTimer = null;

const SERVER_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/ws/session';

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

  async function sendManualSpeech() {
    const text = manualInput.value.trim();
    if (!text) return;
    manualInput.value = '';

    const timestamp = new Date().toTimeString().slice(3, 8);
    
    // Broadcast via Session API
    try {
      await fetch(`${SERVER_URL}/api/session/utterance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speaker: 'Participant', timestamp })
      });
    } catch {
      // Offline fallback
      const analysis = window.ClientNLPEngine?.analyzeUtterance(text, 'Participant', timestamp);
      handleLocalUtterance({ speaker: 'Participant', text, timestamp, ...analysis });
    }
  }

  btnSendManual.addEventListener('click', sendManualSpeech);
  manualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendManualSpeech();
  });

  // Load PDF Sample Meeting
  document.getElementById('btn-load-pdf-sample').addEventListener('click', loadSamplePDFMeeting);

  // Clear all data
  document.getElementById('btn-clear-all').addEventListener('click', async () => {
    try {
      await fetch(`${SERVER_URL}/api/session/reset`, { method: 'POST' });
    } catch {}
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'CLEAR_MEETING_DATA' });
    }
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

  // Initialize Real-Time Session Synchronization (WebSocket + Polling fallback)
  initSessionSync();

  // Listen for local messages from Chrome background service worker
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'UTTERANCE_ADDED') {
        handleLocalUtterance(message.payload.utterance);
      } else if (message.type === 'CLARIFICATION_UPDATED') {
        activeClarifications = message.payload.allClarifications;
        updateRequirementsAndQuality();
      } else if (message.type === 'MEETING_DATA_RESET') {
        activeTranscript = [];
        activeClarifications = [];
        generatedRequirements = null;
        qualityEvaluation = null;
        renderAll();
      }
    });
  }
});

/**
 * Connects to backend WebSocket session for 100% synchronized live stream.
 */
function initSessionSync() {
  try {
    sessionSocket = new WebSocket(WS_URL);
    sessionSocket.onopen = () => {
      console.log('🔗 [Sidepanel] WebSocket session connected.');
      backendReachable = true;
    };

    sessionSocket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.data) {
          applySynchronizedState(msg.data);
        }
      } catch (e) {
        console.error('Error parsing session sync event:', e);
      }
    };

    sessionSocket.onclose = () => {
      console.warn('⚠️ [Sidepanel] WebSocket closed. Starting fallback polling.');
      startPollingFallback();
    };

    sessionSocket.onerror = () => {
      startPollingFallback();
    };
  } catch {
    startPollingFallback();
  }
}

function startPollingFallback() {
  if (syncPollTimer) return;
  fetchSessionState();
  syncPollTimer = setInterval(fetchSessionState, 1500);
}

async function fetchSessionState() {
  try {
    const res = await fetch(`${SERVER_URL}/api/session/state`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        applySynchronizedState(json.data);
        backendReachable = true;
      }
    }
  } catch {
    backendReachable = false;
  }
}

function applySynchronizedState(state) {
  if (!state) return;
  activeTranscript = state.transcript || [];
  activeClarifications = state.clarifications || [];
  
  if (state.baseline && state.refined && (state.refined.frs?.length > 0 || state.refined.nfrs?.length > 0)) {
    generatedRequirements = {
      baseline: state.baseline,
      refined: state.refined
    };
  }
  if (state.evaluation && Object.keys(state.evaluation).length > 0) {
    qualityEvaluation = state.evaluation;
  }
  
  renderTranscript();
  renderClarifications();
  renderRequirements();
  renderQualityTab();
}

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

async function loadSamplePDFMeeting() {
  const sample = window.EXT_SAMPLE_TRANSCRIPTS?.[0];
  if (!sample) return;

  // Sync sample to shared backend session
  try {
    const res = await fetch(`${SERVER_URL}/api/session/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: sample.utterances.map((u, i) => ({
          id: `u-${i+1}`,
          speaker: u.speaker,
          text: u.text,
          timestamp: u.timestamp,
          isAmbiguous: false,
          detectedFlags: []
        })),
        clarifications: [],
        domain: 'HR Tech'
      })
    });
    const json = await res.json();
    if (json.success && json.data) {
      applySynchronizedState(json.data);
      return;
    }
  } catch (e) {
    console.warn('Backend sync failed, using local fallback');
  }

  activeTranscript = [];
  activeClarifications = [];
  sample.utterances.forEach(u => {
    const analysis = window.ClientNLPEngine?.analyzeUtterance(u.text, u.speaker, u.timestamp);
    const utterance = {
      speaker: u.speaker,
      text: u.text,
      timestamp: u.timestamp,
      ...analysis
    };
    activeTranscript.push(utterance);
    if (utterance.candidateQuestion) {
      activeClarifications.push({
        ...utterance.candidateQuestion,
        selectedResponse: null
      });
    }
  });

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

  if (badgeStream) badgeStream.innerText = activeTranscript.length;
  const ambiguousCount = activeTranscript.filter(u => u.isAmbiguous || (u.detectedFlags && u.detectedFlags.length > 0)).length;
  if (ambCountEl) ambCountEl.innerText = `${ambiguousCount} flagged statements`;

  if (!feed) return;

  if (activeTranscript.length === 0) {
    feed.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎙️</div>
        <p>Start speaking in Zoom / Google Meet or click "Sample" to load the assignment transcript.</p>
      </div>
    `;
    return;
  }

  feed.innerHTML = activeTranscript.map((u) => {
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
      <div class="utterance-card ${u.isAmbiguous || (u.detectedFlags && u.detectedFlags.length > 0) ? 'ambiguous' : ''}">
        <div class="utterance-meta">
          <span class="speaker-name">${escapeHtml(u.speaker || 'Speaker')}</span>
          <span class="speaker-time">${escapeHtml(u.timestamp || '00:00')}</span>
        </div>
        <div class="utterance-text">${displayText}</div>
        ${u.detectedFlags && u.detectedFlags.length > 0 ? `
          <div class="flags-tags">
            ${u.detectedFlags.map(f => `<span class="flag-badge">${escapeHtml(f.category)}: ${escapeHtml(f.severity || 'Medium')}</span>`).join('')}
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
  if (badgeClarify) badgeClarify.innerText = activeClarifications.length;

  if (!list) return;

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
    const cid = c.id || `q-${idx+1}`;
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
          ${(c.suggestedOptions || c.options || []).map((opt) => {
            const selected = c.selectedResponse === opt ? 'selected' : '';
            return `
              <button class="option-choice-btn ${selected}" data-cid="${cid}" data-opt="${escapeHtml(opt)}">
                ${escapeHtml(opt)}
              </button>
            `;
          }).join('')}
        </div>

        <input type="text" class="custom-answer-input" placeholder="Or enter custom stakeholder clarification..." value="${escapeHtml(c.selectedResponse || '')}" data-cid="${cid}" />
      </div>
    `;
  }).join('');

  // Event handlers for option selection & custom inputs with shared session sync
  list.querySelectorAll('.option-choice-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cid = btn.getAttribute('data-cid');
      const chosen = btn.getAttribute('data-opt');
      
      // Update locally
      const target = activeClarifications.find(c => (c.id || '') === cid || activeClarifications.indexOf(c) === parseInt(cid.replace('q-',''))-1);
      if (target) target.selectedResponse = chosen;
      
      renderClarifications();
      updateRequirementsAndQuality();

      // Sync to shared backend session
      try {
        await fetch(`${SERVER_URL}/api/session/clarify/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clarificationId: cid, selectedResponse: chosen })
        });
      } catch {}
    });
  });

  list.querySelectorAll('.custom-answer-input').forEach(input => {
    input.addEventListener('change', async () => {
      const cid = input.getAttribute('data-cid');
      const customVal = input.value.trim();
      
      const target = activeClarifications.find(c => (c.id || '') === cid || activeClarifications.indexOf(c) === parseInt(cid.replace('q-',''))-1);
      if (target) target.selectedResponse = customVal;
      
      updateRequirementsAndQuality();

      try {
        await fetch(`${SERVER_URL}/api/session/clarify/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clarificationId: cid, selectedResponse: customVal })
        });
      } catch {}
    });
  });
}

async function updateRequirementsAndQuality() {
  if (activeTranscript.length === 0) return;

  try {
    const res = await fetch(`${SERVER_URL}/api/refine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: activeTranscript,
        clarifications: activeClarifications,
        domain: 'HR Tech'
      })
    });
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        generatedRequirements = { baseline: json.baseline, refined: json.refined };
        qualityEvaluation = json.evaluation || { refined: json.metrics };
        backendReachable = true;
      }
    }
  } catch {
    backendReachable = false;
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

  if (!list) return;

  if (!generatedRequirements?.refined) {
    list.innerHTML = !backendReachable
      ? `
      <div class="empty-state">
        <div class="empty-icon">🔌</div>
        <p><strong>Backend offline.</strong> Start server with <code>python3 run.py</code> to view live requirements.</p>
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
  if (countFr) countFr.innerText = frs.length;
  if (countNfr) countNfr.innerText = nfrs.length;
  if (countAll) countAll.innerText = frs.length + nfrs.length;
  if (badgeReq) badgeReq.innerText = frs.length + nfrs.length;

  let itemsToRender = [];
  if (currentReqFilter === 'all') itemsToRender = [...frs, ...nfrs];
  else if (currentReqFilter === 'fr') itemsToRender = frs;
  else if (currentReqFilter === 'nfr') itemsToRender = nfrs;

  list.innerHTML = itemsToRender.map(req => {
    const isNFR = req.id.startsWith('NFR');
    const isPending = req.status === 'PENDING_CLARIFICATION';

    return `
      <div class="req-card ${isNFR ? 'nfr' : 'fr'}">
        <div class="req-header">
          <span class="req-id">${escapeHtml(req.id)}</span>
          <span class="req-type-tag">${escapeHtml(isNFR ? (req.category || 'NFR') : 'Functional')}</span>
        </div>
        <div class="req-title">${escapeHtml(req.title)}</div>
        <div class="req-desc">${escapeHtml(req.description)}</div>

        ${isNFR && req.targetThreshold ? `
          <div class="req-slo-box">
            <strong>Target SLO / Metric:</strong> ${escapeHtml(req.targetThreshold)}
          </div>
        ` : ''}

        ${req.acceptanceCriteria && req.acceptanceCriteria.length > 0 ? `
          <div style="font-size: 11px; font-weight: 700; color: #475569; margin-top: 6px;">Acceptance Criteria:</div>
          <div class="ac-list">
            ${req.acceptanceCriteria.map(ac => `
              <div class="ac-item">✓ ${escapeHtml(ac)}</div>
            `).join('')}
          </div>
        ` : ''}

        <div class="req-footer">
          <span class="status-badge ${isPending ? 'pending' : 'resolved'}">
            ${isPending ? '⚠️ Pending Clarification' : '✓ Resolved Specification'}
          </span>
          <span style="font-size: 10px; color: #64748b;">${escapeHtml(req.source || 'TRANSCRIPT')}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderQualityTab() {
  const oqiEl = document.getElementById('oqi-score-val');
  const tierEl = document.getElementById('oqi-tier-label');
  const deltaEl = document.getElementById('quality-delta-val');
  const ambScoreEl = document.getElementById('metric-ambiguity-score');
  const testScoreEl = document.getElementById('metric-testability-score');
  const compScoreEl = document.getElementById('metric-completeness-score');
  const specScoreEl = document.getElementById('metric-specificity-score');

  const refEval = qualityEvaluation?.refined || qualityEvaluation;
  const baseEval = qualityEvaluation?.baseline;

  if (!refEval) {
    if (oqiEl) oqiEl.innerText = '--';
    if (tierEl) tierEl.innerText = 'Awaiting Analysis';
    return;
  }

  const oqi = refEval.overallQualityIndex ?? 8;
  const tier = refEval.qualityTier || (oqi >= 85 ? 'Excellent' : oqi >= 60 ? 'Good' : 'Poor');
  
  if (oqiEl) oqiEl.innerText = `${oqi}/100`;
  if (tierEl) tierEl.innerText = `Quality Tier: ${tier}`;

  if (baseEval && deltaEl) {
    const delta = oqi - (baseEval.overallQualityIndex ?? 8);
    deltaEl.innerText = `+${delta} pts`;
  }

  const m = refEval.metrics || {};
  if (ambScoreEl) ambScoreEl.innerText = `${m.ambiguity?.score ?? 100}%`;
  if (testScoreEl) testScoreEl.innerText = `${m.testability?.score ?? 0}%`;
  if (compScoreEl) compScoreEl.innerText = `${m.completeness?.score ?? 0}%`;
  if (specScoreEl) specScoreEl.innerText = `${m.specificity?.score ?? 0}%`;
}

async function triggerExport(format) {
  try {
    const res = await fetch(`${SERVER_URL}/api/export/${format}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Meeting Requirement Specification Report',
        transcript: activeTranscript,
        clarifications: activeClarifications,
        refined: generatedRequirements?.refined,
        baseline: generatedRequirements?.baseline,
        evaluation: qualityEvaluation
      })
    });

    if (format === 'json') {
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, 'requirement-specification.json');
    } else if (format === 'txt' || format === 'md') {
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/markdown' });
      downloadBlob(blob, 'requirement-specification.md');
    } else {
      const blob = await res.blob();
      const ext = format === 'pdf' ? 'pdf' : 'docx';
      downloadBlob(blob, `requirement-specification-report.${ext}`);
    }
  } catch (e) {
    alert(`Export failed: ${e.message}`);
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
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
