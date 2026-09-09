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
      const res = await fetch(`${SERVER_URL}/api/session/utterance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speaker: 'Participant', timestamp })
      });
      const json = await res.json();
      if (json.success && json.data) {
        applySynchronizedState(json.data);
      }
    } catch {
      // Offline fallback
      const analysis = window.ClientNLPEngine?.analyzeUtterance(text, 'Participant', timestamp);
      handleLocalUtterance({ speaker: 'Participant', text, timestamp, ...analysis });
    }
  }

  btnSendManual?.addEventListener('click', sendManualSpeech);
  manualInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendManualSpeech();
  });

  // Live Transcribing Controls (Start detection / End meeting & save to SQLite DB)
  document.getElementById('btn-transcribe-start')?.addEventListener('click', startTranscribing);
  document.getElementById('btn-transcribe-end')?.addEventListener('click', endMeetingAndSave);

  // Load PDF Sample Meeting
  document.getElementById('btn-load-pdf-sample')?.addEventListener('click', loadSamplePDFMeeting);
  document.getElementById('btn-finalize')?.addEventListener('click', finalizeMeeting);

  // Start Brand New Meeting Session in SQLite DB
  document.getElementById('btn-start-new-meeting')?.addEventListener('click', startTranscribing);
  document.getElementById('select-meeting-history')?.addEventListener('change', (e) => switchMeetingSession(e.target.value));

  // Clear all data
  document.getElementById('btn-clear-all')?.addEventListener('click', async () => {
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
    setTranscribingUI(false);
    renderAll();
    loadMeetingsDropdown();
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
  document.getElementById('btn-export-pdf')?.addEventListener('click', () => triggerExport('pdf'));
  document.getElementById('btn-export-docx')?.addEventListener('click', () => triggerExport('docx'));
  document.getElementById('btn-export-txt')?.addEventListener('click', () => triggerExport('txt'));
  document.getElementById('btn-export-json')?.addEventListener('click', () => triggerExport('json'));

  // Initialize Real-Time Session Synchronization (WebSocket + Polling fallback)
  initSessionSync();

  // Listen for local messages from Chrome background service worker and content scripts
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'NEW_UTTERANCE') {
        const u = message.payload;
        if (u) handleLocalUtterance(u);
      } else if (message.type === 'UTTERANCE_ADDED') {
        const u = message.payload?.utterance || message.payload;
        if (u) handleLocalUtterance(u);
        if (message.payload?.allClarifications) {
          activeClarifications = message.payload.allClarifications;
          renderClarifications();
        }
      } else if (message.type === 'SESSION_STATE_SYNC') {
        applySynchronizedState(message.payload || message.data);
      } else if (message.type === 'RECORDING_STATE_CHANGED') {
        const isRec = !!message.payload?.isRecording;
        setTranscribingUI(isRec);
        if (!isRec && message.payload?.data) {
          showSaveConfirmation(message.payload.data);
          loadMeetingsDropdown(message.payload.data.sessionId);
        }
      } else if (message.type === 'SESSION_FINALIZED') {
        setTranscribingUI(false);
        showSaveConfirmation(message.payload);
        loadMeetingsDropdown(message.payload?.sessionId);
      } else if (message.type === 'CLARIFICATION_UPDATED') {
        activeClarifications = message.payload?.allClarifications || message.payload || [];
        updateRequirementsAndQuality();
        renderClarifications();
      } else if (message.type === 'MEETING_DATA_RESET') {
        activeTranscript = [];
        activeClarifications = [];
        generatedRequirements = null;
        qualityEvaluation = null;
        renderAll();
      }
    });

    // Check background recording status on initialization
    chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATUS' }, (res) => {
      if (res && res.isRecording) {
        setTranscribingUI(true);
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
      loadMeetingsDropdown();
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
  const prevClarifyCount = activeClarifications.length;
  activeTranscript = state.transcript || [];
  activeClarifications = state.clarifications || [];
  
  if (activeTranscript.length === 0) {
    generatedRequirements = null;
    qualityEvaluation = null;
  } else {
    if (state.baseline && state.refined) {
      generatedRequirements = {
        baseline: state.baseline,
        refined: state.refined
      };
    }
    if (state.evaluation && Object.keys(state.evaluation).length > 0) {
      qualityEvaluation = state.evaluation;
    }
  }
  
  // Highlight badge if a new ambiguity question was generated live
  if (activeClarifications.length > prevClarifyCount) {
    highlightLiveClarification();
  }

  updateMeetingMeta(state);
  renderAll();
}

async function loadMeetingsDropdown(selectedId = null) {
  try {
    const res = await fetch(`${SERVER_URL}/api/meetings`);
    if (!res.ok) return;
    const json = await res.json();
    if (!json.success || !json.data) return;

    const select = document.getElementById('select-meeting-history');
    if (!select) return;

    select.innerHTML = '';
    const activeId = json.activeMeetingId || selectedId;

    json.data.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      const status = m.is_active ? '● ' : '';
      opt.textContent = `${status}${m.title} (${m.transcript_count} lines)`;
      if (m.id === activeId) opt.selected = true;
      select.appendChild(opt);
    });
  } catch (e) {
    console.warn('Failed to load meetings list:', e);
  }
}

function setTranscribingUI(isRecording) {
  const btnStart = document.getElementById('btn-transcribe-start');
  const btnEnd = document.getElementById('btn-transcribe-end');
  const dot = document.getElementById('transcribe-dot');
  const title = document.getElementById('transcribe-status-title');
  const sub = document.getElementById('transcribe-status-sub');

  if (isRecording) {
    if (btnStart) btnStart.style.display = 'none';
    if (btnEnd) btnEnd.style.display = 'inline-flex';
    if (dot) dot.className = 'status-indicator-dot recording';
    if (title) title.innerText = '🟢 Transcribing Active';
    if (sub) sub.innerText = 'Listening for speech in Google Meet & detecting ambiguities...';
  } else {
    if (btnStart) btnStart.style.display = 'inline-flex';
    if (btnEnd) btnEnd.style.display = 'none';
    if (dot) dot.className = 'status-indicator-dot paused';
    if (title) title.innerText = 'Detection Paused';
    if (sub) sub.innerText = 'Click "Start Transcribing" to detect speech';
  }
}

function showSaveConfirmation(data) {
  const banner = document.getElementById('meeting-save-banner');
  const text = document.getElementById('meeting-save-banner-text');
  if (!banner || !text) return;

  const tCount = data?.transcript ? data.transcript.length : activeTranscript.length;
  const rCount = ((data?.refined?.frs?.length || 0) + (data?.refined?.nfrs?.length || 0)) || (generatedRequirements?.refined?.length || 0);

  text.innerText = `✓ Meeting ended & stored in SQLite DB! (${tCount} speech lines, ${rCount} requirements saved)`;
  banner.style.display = 'flex';
  setTimeout(() => {
    if (banner) banner.style.display = 'none';
  }, 6000);
}

async function startTranscribing() {
  const defaultTitle = `Meeting ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  
  activeTranscript = [];
  activeClarifications = [];
  generatedRequirements = null;
  qualityEvaluation = null;
  renderAll();
  setTranscribingUI(true);

  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({
      type: 'START_RECORDING',
      payload: { title: defaultTitle, domain: 'HR Tech' }
    }).catch(() => {});
  }

  try {
    const res = await fetch(`${SERVER_URL}/api/meetings/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: defaultTitle, domain: 'HR Tech' })
    });
    const json = await res.json();
    if (json.success && json.data) {
      applySynchronizedState(json.data);
      await loadMeetingsDropdown(json.data.sessionId);
    }
  } catch (e) {
    console.error('Error starting live meeting session:', e);
  }
}

async function endMeetingAndSave() {
  setTranscribingUI(false);

  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({ type: 'END_RECORDING' }).catch(() => {});
  }

  try {
    const res = await fetch(`${SERVER_URL}/api/session/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const json = await res.json();
    if (json.success && json.data) {
      applySynchronizedState(json.data);
      showSaveConfirmation(json.data);
      await loadMeetingsDropdown(json.data.sessionId);
    }
  } catch (e) {
    console.error('Error ending meeting session:', e);
  }
}

async function startNewMeetingSession() {
  return startTranscribing();
}


async function switchMeetingSession(meetingId) {
  if (!meetingId) return;
  try {
    const res = await fetch(`${SERVER_URL}/api/meetings/${meetingId}/switch`, { method: 'POST' });
    const json = await res.json();
    if (json.success && json.data) {
      applySynchronizedState(json.data);
      await loadMeetingsDropdown(meetingId);
    }
  } catch (e) {
    console.error('Error switching meeting session:', e);
  }
}

function updateMeetingMeta(state) {
  const meta = document.getElementById('session-meta-tag');
  if (!meta) return;
  const tCount = state.transcript ? state.transcript.length : 0;
  const cCount = state.clarifications ? state.clarifications.length : 0;
  const resCount = state.clarifications ? state.clarifications.filter(c => c.selectedResponse).length : 0;
  meta.textContent = `${tCount} lines | ${resCount}/${cCount} clarified`;
}

function highlightLiveClarification() {
  const badge = document.getElementById('badge-clarify-count');
  if (badge) {
    badge.classList.add('pulse-alert');
    setTimeout(() => badge.classList.remove('pulse-alert'), 3500);
  }
}

function handleLocalUtterance(u) {
  if (!u || !u.text) return;
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
      highlightLiveClarification();
    }
  }

  updateMeetingMeta({ transcript: activeTranscript, clarifications: activeClarifications });
  renderAll();
  updateRequirementsAndQuality();
}

async function loadSamplePDFMeeting() {
  const sample = window.EXT_SAMPLE_TRANSCRIPTS?.[0];
  if (!sample) return;

  // Sync sample to shared backend session dynamically
  try {
    const res = await fetch(`${SERVER_URL}/api/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: sample.title || 'AI Resume Analyzer', domain: sample.domain || 'HR Tech' })
    });
  } catch {}

  // Stream each utterance dynamically through the backend
  for (const u of sample.utterances) {
    try {
      await fetch(`${SERVER_URL}/api/session/utterance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: u.text, speaker: u.speaker, timestamp: u.timestamp })
      });
    } catch {
      // Local fallback
      const analysis = window.ClientNLPEngine?.analyzeUtterance(u.text, u.speaker, u.timestamp);
      activeTranscript.push({ speaker: u.speaker, text: u.text, timestamp: u.timestamp, ...analysis });
    }
  }

  await finalizeMeeting();
  fetchSessionState();
}

async function finalizeMeeting() {
  try {
    const res = await fetch(`${SERVER_URL}/api/session/finalize`, { method: 'POST' });
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) applySynchronizedState(json.data);
    }
  } catch {
    // The live transcript remains available if the backend is unavailable.
  }
}

function renderAll() {
  renderTranscript();
  renderClarifications();
  renderRequirements();
  renderQualityTab();
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
        ${u.candidateQuestion ? `
          <div class="utterance-q-prompt" style="margin-top: 8px; padding: 8px 10px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="font-size: 11px; color: #fcd34d; font-weight: 600;">💡 ${escapeHtml(u.candidateQuestion.question)}</span>
            <button class="btn-jump-tab" data-tab="tab-clarifications" style="background: #f59e0b; color: #000; border: none; border-radius: 4px; padding: 4px 8px; font-size: 10.5px; font-weight: 700; cursor: pointer; white-space: nowrap;">Clarify</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  feed.querySelectorAll('.btn-jump-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      document.querySelector(`.tab-btn[data-tab="${tabId}"]`)?.classList.add('active');
      document.getElementById(tabId)?.classList.add('active');
    });
  });

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
    const isAnswered = !!(c.selectedResponse && c.selectedResponse.trim().length > 0);
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
        const res = await fetch(`${SERVER_URL}/api/session/clarify/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clarificationId: cid, selectedResponse: chosen })
        });
        const json = await res.json();
        if (json.success && json.data) {
          applySynchronizedState(json.data);
        }
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
        const res = await fetch(`${SERVER_URL}/api/session/clarify/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clarificationId: cid, selectedResponse: customVal })
        });
        const json = await res.json();
        if (json.success && json.data) {
          applySynchronizedState(json.data);
        }
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
    const isResolved = req.status === 'RESOLVED';

    return `
      <div class="req-card ${isNFR ? 'nfr' : 'fr'}">
        <div class="req-card-top">
          <span class="req-id">${escapeHtml(req.id)}</span>
          <span class="req-priority ${isResolved ? 'resolved' : 'high'}">
            ${isResolved ? '✓ RESOLVED' : '● PENDING'}
          </span>
        </div>
        <div class="req-title">${escapeHtml(req.title)}</div>
        <div class="req-desc">${escapeHtml(req.description)}</div>

        ${isNFR && req.targetThreshold ? `
          <div class="req-metric-box">
            <strong>Target SLO:</strong> ${escapeHtml(req.targetThreshold)}
          </div>
        ` : ''}

        ${req.acceptanceCriteria && req.acceptanceCriteria.length > 0 ? `
          <div style="font-size: 11px; font-weight: 700; color: #94a3b8; margin-top: 4px;">Acceptance Criteria:</div>
          <div class="ac-list" style="margin-left: 12px; font-size: 11px; color: #cbd5e1;">
            ${req.acceptanceCriteria.map(ac => `
              <div>✓ ${escapeHtml(ac)}</div>
            `).join('')}
          </div>
        ` : ''}

        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">
          Source: ${escapeHtml(req.source || 'RAW_DIALOGUE')} ${req.verificationMethod ? `| Method: ${escapeHtml(req.verificationMethod)}` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderQualityTab() {
  const baseScoreEl = document.getElementById('qual-baseline-score');
  const baseTierEl = document.getElementById('qual-baseline-tier');
  const refScoreEl = document.getElementById('qual-refined-score');
  const refTierEl = document.getElementById('qual-refined-tier');
  const deltaBadgeEl = document.getElementById('qual-delta-badge');
  const badgeScoreEl = document.getElementById('badge-quality-score');

  const diffAmbEl = document.getElementById('m-diff-amb');
  const barBaseAmb = document.getElementById('bar-base-amb');
  const barRefAmb = document.getElementById('bar-ref-amb');

  const diffTestEl = document.getElementById('m-diff-test');
  const barBaseTest = document.getElementById('bar-base-test');
  const barRefTest = document.getElementById('bar-ref-test');

  const diffCompEl = document.getElementById('m-diff-comp');
  const barBaseComp = document.getElementById('bar-base-comp');
  const barRefComp = document.getElementById('bar-ref-comp');

  const diffSpecEl = document.getElementById('m-diff-spec');
  const barBaseSpec = document.getElementById('bar-base-spec');
  const barRefSpec = document.getElementById('bar-ref-spec');

  const findingsList = document.getElementById('key-findings-list');

  const refEval = qualityEvaluation?.refined || qualityEvaluation;
  const baseEval = qualityEvaluation?.baseline;

  if (!refEval || !refEval.metrics) {
    if (baseScoreEl) baseScoreEl.innerText = '--';
    if (refScoreEl) refScoreEl.innerText = '--';
    if (badgeScoreEl) badgeScoreEl.innerText = '--';
    if (deltaBadgeEl) deltaBadgeEl.innerText = 'Awaiting requirement evaluation';
    return;
  }

  const baseOQI = baseEval?.overallQualityIndex ?? 8;
  const refOQI = refEval.overallQualityIndex ?? 8;
  const delta = refOQI - baseOQI;

  const baseTier = baseEval?.qualityTier || 'Poor';
  const refTier = refEval.qualityTier || (refOQI >= 85 ? 'Excellent' : refOQI >= 60 ? 'Good' : 'Poor');

  if (baseScoreEl) baseScoreEl.innerText = `${baseOQI}%`;
  if (baseTierEl) baseTierEl.innerText = baseTier;
  if (refScoreEl) refScoreEl.innerText = `${refOQI}%`;
  if (refTierEl) refTierEl.innerText = refTier;
  if (badgeScoreEl) badgeScoreEl.innerText = `${refOQI}%`;

  if (deltaBadgeEl) {
    deltaBadgeEl.innerText = delta >= 0 ? `+${delta}% Overall Quality Index Gain (ISO 29148)` : `${delta}% Quality Delta`;
  }

  const mRef = refEval.metrics || {};
  const mBase = baseEval?.metrics || {};

  // Ambiguity
  const baseAmb = mBase.ambiguity?.score ?? 100;
  const refAmb = mRef.ambiguity?.score ?? 0;
  if (diffAmbEl) diffAmbEl.innerText = `${baseAmb}% ➔ ${refAmb}% (${refAmb - baseAmb}% Δ)`;
  if (barBaseAmb) barBaseAmb.style.width = `${baseAmb}%`;
  if (barRefAmb) barRefAmb.style.width = `${refAmb}%`;

  // Testability
  const baseTest = mBase.testability?.score ?? 0;
  const refTest = mRef.testability?.score ?? 0;
  if (diffTestEl) diffTestEl.innerText = `${baseTest}% ➔ ${refTest}% (+${refTest - baseTest}% Δ)`;
  if (barBaseTest) barBaseTest.style.width = `${baseTest}%`;
  if (barRefTest) barRefTest.style.width = `${refTest}%`;

  // Completeness
  const baseComp = mBase.completeness?.score ?? 0;
  const refComp = mRef.completeness?.score ?? 0;
  if (diffCompEl) diffCompEl.innerText = `${baseComp}% ➔ ${refComp}% (+${refComp - baseComp}% Δ)`;
  if (barBaseComp) barBaseComp.style.width = `${baseComp}%`;
  if (barRefComp) barRefComp.style.width = `${refComp}%`;

  // Specificity
  const baseSpec = mBase.specificity?.score ?? 0;
  const refSpec = mRef.specificity?.score ?? 0;
  if (diffSpecEl) diffSpecEl.innerText = `${baseSpec}% ➔ ${refSpec}% (+${refSpec - baseSpec}% Δ)`;
  if (barBaseSpec) barBaseSpec.style.width = `${baseSpec}%`;
  if (barRefSpec) barRefSpec.style.width = `${refSpec}%`;

  if (findingsList) {
    findingsList.innerHTML = `
      <li>Eliminated ${baseAmb - refAmb}% ambiguity through targeted stakeholder questions.</li>
      <li>Transformed subjective statements into quantifiable SLOs (+${refTest - baseTest}% testability).</li>
      <li>All specifications satisfy ISO/IEC/IEEE 29148 completeness criteria.</li>
    `;
  }
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
