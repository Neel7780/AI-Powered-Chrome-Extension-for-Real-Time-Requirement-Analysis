/**
 * Injected In-Meeting HUD
 * Renders floating widget on Zoom/Google Meet for live ambiguity warnings and Q&A.
 */

(function () {
  let hudContainer = null;
  let isMinimized = false;
  let activeQuestion = null;
  let selectedOption = null;

  // The HUD is injected into a third-party page (Zoom / Meet / Teams) and renders
  // live caption text, so every interpolation is escaped.
  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Neutralise regex metacharacters so caption-derived phrases can be used as
  // literal search patterns.
  function escapeRegex(str) {
    return (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  let isRecording = false;

  function createHUD() {
    if (document.getElementById('ai-re-hud-container')) return;

    hudContainer = document.createElement('div');
    hudContainer.id = 'ai-re-hud-container';
    hudContainer.innerHTML = `
      <div class="ai-re-hud-header" id="ai-re-hud-header">
        <div class="ai-re-hud-title-area">
          <div class="ai-re-pulse-dot" id="ai-re-pulse-dot" style="background: #94a3b8; box-shadow: none;"></div>
          <span class="ai-re-hud-title">Requirement AI</span>
          <span class="ai-re-hud-badge" id="ai-re-ambiguity-badge">0 Ambiguities</span>
        </div>
        <div class="ai-re-hud-actions">
          <button class="ai-re-btn-session-toggle" id="ai-re-btn-session-toggle" title="Start live detection of meeting transcripts">▶ Start</button>
          <button class="ai-re-btn-icon" id="ai-re-btn-mic" title="Toggle Direct Microphone Transcription">🎙️</button>
          <button class="ai-re-btn-icon" id="ai-re-btn-sidepanel" title="Open Full Sidepanel">⧉</button>
          <button class="ai-re-btn-icon" id="ai-re-btn-toggle" title="Minimize / Expand">_</button>
        </div>
      </div>
      <div class="ai-re-hud-body" id="ai-re-hud-body">
        <div class="ai-re-live-feed" id="ai-re-live-feed">
          <div class="ai-re-feed-speaker" id="ai-re-feed-status-title">Detection Paused</div>
          <div id="ai-re-feed-text" style="color: #94a3b8; font-style: italic;">Click "▶ Start" above to begin detecting Google Meet speech and storing in SQLite DB.</div>
        </div>
        <div id="ai-re-question-slot"></div>
      </div>
    `;

    document.body.appendChild(hudContainer);

    // Event listeners
    document.getElementById('ai-re-btn-session-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!isRecording) {
        chrome.runtime.sendMessage({ type: 'START_RECORDING' }).catch(() => {});
        if (window.MeetObserver?.startCapturing) window.MeetObserver.startCapturing();
        setRecordingState(true);
      } else {
        chrome.runtime.sendMessage({ type: 'END_RECORDING' }).catch(() => {});
        if (window.MeetObserver?.stopCapturing) window.MeetObserver.stopCapturing();
        setRecordingState(false);
      }
    });

    document.getElementById('ai-re-btn-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMinimize();
    });

    document.getElementById('ai-re-hud-header').addEventListener('click', () => {
      if (isMinimized) toggleMinimize();
    });

    document.getElementById('ai-re-btn-mic')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = document.getElementById('ai-re-btn-mic');
      const isListening = window.MeetObserver?.toggleMic ? window.MeetObserver.toggleMic() : false;
      if (isListening) {
        btn.style.background = '#ef4444';
        btn.title = 'Direct Mic Active (Listening...)';
      } else {
        btn.style.background = '';
        btn.title = 'Toggle Direct Microphone Transcription';
      }
    });

    document.getElementById('ai-re-btn-sidepanel').addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' }).catch(() => {});
    });
  }

  function setRecordingState(rec) {
    isRecording = rec;
    const btn = document.getElementById('ai-re-btn-session-toggle');
    const pulseDot = document.getElementById('ai-re-pulse-dot');
    const statusTitle = document.getElementById('ai-re-feed-status-title');
    const feedText = document.getElementById('ai-re-feed-text');

    if (btn) {
      if (rec) {
        btn.innerHTML = '⏹ End &amp; Save';
        btn.classList.add('recording');
        btn.title = 'End meeting and save all data to SQLite Database';
      } else {
        btn.innerHTML = '▶ Start';
        btn.classList.remove('recording');
        btn.title = 'Start live detection of meeting transcripts';
      }
    }

    if (pulseDot) {
      if (rec) {
        pulseDot.style.background = '#10b981';
        pulseDot.style.boxShadow = '0 0 10px #10b981';
      } else {
        pulseDot.style.background = '#94a3b8';
        pulseDot.style.boxShadow = 'none';
      }
    }

    if (statusTitle && feedText) {
      if (rec) {
        statusTitle.innerText = '🟢 Transcribing Active';
        statusTitle.style.color = '#34d399';
        feedText.innerHTML = 'Listening for speech in Google Meet... Ambiguities will trigger instant questions.';
        feedText.style.color = '#cbd5e1';
        feedText.style.fontStyle = 'normal';
      } else {
        statusTitle.innerText = 'Detection Paused';
        statusTitle.style.color = '#94a3b8';
        feedText.innerHTML = '✓ Meeting ended and stored in SQLite database! Click "▶ Start" to transcribe a new meeting.';
        feedText.style.color = '#a7f3d0';
        feedText.style.fontStyle = 'italic';
      }
    }
  }

  function toggleMinimize() {
    isMinimized = !isMinimized;
    if (isMinimized) {
      hudContainer.classList.add('minimized');
      document.getElementById('ai-re-hud-body').style.display = 'none';
      document.getElementById('ai-re-btn-toggle').innerText = '+';
    } else {
      hudContainer.classList.remove('minimized');
      document.getElementById('ai-re-hud-body').style.display = 'flex';
      document.getElementById('ai-re-btn-toggle').innerText = '_';
    }
  }

  function displayUtterance(data) {
    createHUD();
    const feedText = document.getElementById('ai-re-feed-text');
    const speakerEl = document.querySelector('.ai-re-feed-speaker');
    const badge = document.getElementById('ai-re-ambiguity-badge');

    if (speakerEl) speakerEl.innerText = `${data.speaker || 'Speaker'} (${data.timestamp || 'now'}):`;

    if (feedText) {
      // Escape first, then highlight against the identically-escaped phrase, so
      // live captions can never inject markup into the host page's HUD.
      let displayText = escapeHtml(data.text);
      if (data.detectedFlags && data.detectedFlags.length > 0) {
        data.detectedFlags.forEach(flag => {
          if (!flag.phrase) return;
          displayText = displayText.replace(
            new RegExp(`(${escapeRegex(escapeHtml(flag.phrase))})`, 'gi'),
            '<span class="ai-re-highlight-vague">$1</span>'
          );
        });
      }
      feedText.innerHTML = displayText;
    }

    if (data.isAmbiguous && data.candidateQuestion) {
      renderClarificationQuestion(data.candidateQuestion);
    }
  }

  function renderClarificationQuestion(q) {
    activeQuestion = q;
    selectedOption = null;
    const slot = document.getElementById('ai-re-question-slot');
    if (!slot) return;

    slot.innerHTML = `
      <div class="ai-re-question-card">
        <span class="ai-re-q-tag">${escapeHtml(q.category || 'Clarification')}</span>
        <div class="ai-re-q-text">${escapeHtml(q.question)}</div>
        <div class="ai-re-options-list" id="ai-re-options-list">
          ${(q.suggestedOptions || []).map((opt, i) => `
            <button class="ai-re-opt-btn" data-index="${i}">${escapeHtml(opt)}</button>
          `).join('')}
        </div>
        <button class="ai-re-submit-btn" id="ai-re-submit-answer" disabled>Record Clarification Response</button>
      </div>
    `;

    const optButtons = slot.querySelectorAll('.ai-re-opt-btn');
    const submitBtn = slot.querySelector('#ai-re-submit-answer');

    optButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        optButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedOption = btn.innerText;
        submitBtn.removeAttribute('disabled');
      });
    });

    submitBtn.addEventListener('click', () => {
      if (!selectedOption) return;
      
      const payload = {
        id: activeQuestion.id,
        category: activeQuestion.category,
        question: activeQuestion.question,
        triggeredBy: activeQuestion.triggeredBy,
        selectedResponse: selectedOption,
        timestamp: new Date().toLocaleTimeString()
      };

      chrome.runtime.sendMessage({
        type: 'SAVE_CLARIFICATION_RESPONSE',
        payload
      }).catch(() => {});

      slot.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; padding: 10px; border-radius: 8px; font-size: 11.5px; color: #a7f3d0; text-align: center;">
          ✓ Clarification logged to Requirement Engine!
        </div>
      `;

      setTimeout(() => {
        if (slot) slot.innerHTML = '';
      }, 4000);
    });
  }

  // Initialize on meeting page load
  window.addEventListener('load', () => {
    setTimeout(() => {
      createHUD();
      chrome.runtime?.sendMessage?.({ type: 'GET_RECORDING_STATUS' }, (res) => {
        if (res && typeof res.isRecording === 'boolean') {
          setRecordingState(res.isRecording);
        }
      });
    }, 1000);
  });

  // Listen for recording state changes from background worker
  chrome.runtime?.onMessage?.addListener((message) => {
    if (message.type === 'RECORDING_STATE_CHANGED') {
      const rec = !!message.payload?.isRecording;
      setRecordingState(rec);
    }
  });

  window.InjectedHUD = {
    init: createHUD,
    displayUtterance,
    renderClarificationQuestion,
    setRecordingState,
    isRecording: () => isRecording
  };
})();
