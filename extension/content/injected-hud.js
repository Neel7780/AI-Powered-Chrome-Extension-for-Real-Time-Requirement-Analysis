/**
 * Injected In-Meeting HUD
 * Renders floating widget on Zoom/Google Meet for live ambiguity warnings and Q&A.
 */

(function () {
  let hudContainer = null;
  let isMinimized = false;
  let activeQuestion = null;
  let selectedOption = null;

  function createHUD() {
    if (document.getElementById('ai-re-hud-container')) return;

    hudContainer = document.createElement('div');
    hudContainer.id = 'ai-re-hud-container';
    hudContainer.innerHTML = `
      <div class="ai-re-hud-header" id="ai-re-hud-header">
        <div class="ai-re-hud-title-area">
          <div class="ai-re-pulse-dot"></div>
          <span class="ai-re-hud-title">Requirement AI Copilot</span>
          <span class="ai-re-hud-badge" id="ai-re-ambiguity-badge">0 Ambiguities</span>
        </div>
        <div class="ai-re-hud-actions">
          <button class="ai-re-btn-icon" id="ai-re-btn-sidepanel" title="Open Full Sidepanel">⧉</button>
          <button class="ai-re-btn-icon" id="ai-re-btn-toggle" title="Minimize / Expand">_</button>
        </div>
      </div>
      <div class="ai-re-hud-body" id="ai-re-hud-body">
        <div class="ai-re-live-feed" id="ai-re-live-feed">
          <div class="ai-re-feed-speaker">AI Transcript Observer Active</div>
          <div id="ai-re-feed-text" style="color: #94a3b8; font-style: italic;">Listening for meeting speech...</div>
        </div>
        <div id="ai-re-question-slot"></div>
      </div>
    `;

    document.body.appendChild(hudContainer);

    // Event listeners
    document.getElementById('ai-re-btn-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMinimize();
    });

    document.getElementById('ai-re-hud-header').addEventListener('click', () => {
      if (isMinimized) toggleMinimize();
    });

    document.getElementById('ai-re-btn-sidepanel').addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' }).catch(() => {});
    });
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
      let displayText = data.text;
      if (data.detectedFlags && data.detectedFlags.length > 0) {
        data.detectedFlags.forEach(flag => {
          displayText = displayText.replace(
            new RegExp(`(${flag.phrase})`, 'gi'),
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
        <span class="ai-re-q-tag">${q.category || 'Clarification'}</span>
        <div class="ai-re-q-text">${q.question}</div>
        <div class="ai-re-options-list" id="ai-re-options-list">
          ${(q.suggestedOptions || []).map((opt, i) => `
            <button class="ai-re-opt-btn" data-index="${i}">${opt}</button>
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
    setTimeout(createHUD, 1000);
  });

  window.InjectedHUD = {
    init: createHUD,
    displayUtterance,
    renderClarificationQuestion
  };
})();
