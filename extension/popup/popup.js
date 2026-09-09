/**
 * Popup Logic for Chrome Extension
 */

document.addEventListener('DOMContentLoaded', async () => {
  const statUtterances = document.getElementById('stat-utterances');
  const statAmbiguous = document.getElementById('stat-ambiguous');
  const statClarifications = document.getElementById('stat-clarifications');
  const statQuality = document.getElementById('stat-quality');
  const latestUtterance = document.getElementById('latest-utterance');
  const serverStatus = document.getElementById('server-status');

  const btnOpenSidepanel = document.getElementById('btn-open-sidepanel');
  const btnLoadSample = document.getElementById('btn-load-sample');
  const btnOpenWebapp = document.getElementById('btn-open-webapp');
  const btnReset = document.getElementById('btn-reset');

  // Check Backend Server Health
  if (window.ExtensionAPI) {
    const health = await window.ExtensionAPI.checkServerHealth();
    if (health.online) {
      serverStatus.innerHTML = '<span style="color: #10b981;">● Backend Online (Port 3000)</span>';
    } else {
      serverStatus.innerHTML = '<span style="color: #f59e0b;">● Offline Mode (Built-in NLP Active)</span>';
    }
  }

  // Request latest state from background service worker
  function refreshState() {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }, (res) => {
      if (chrome.runtime.lastError || !res || !res.state) return;
      const state = res.state;

      statUtterances.innerText = state.transcript.length;
      statAmbiguous.innerText = state.ambiguousCount;
      statClarifications.innerText = state.clarifications.length;

      // Quality is measured, never assumed: ask the evaluator for the real index
      // instead of printing a fixed number whenever a question happens to exist.
      updateQualityStat(state);

      if (state.transcript.length > 0) {
        const last = state.transcript[state.transcript.length - 1];
        // Escape first, then highlight against the identically-escaped phrase.
        let text = escapeHtml(last.text);
        if (last.detectedFlags && last.detectedFlags.length > 0) {
          last.detectedFlags.forEach(f => {
            if (!f.phrase) return;
            text = text.replace(
              new RegExp(`(${escapeRegex(escapeHtml(f.phrase))})`, 'gi'),
              '<span class="highlight-vague">$1</span>'
            );
          });
        }
        latestUtterance.innerHTML = `<strong>${escapeHtml(last.speaker || 'Speaker')}:</strong> ${text}`;
      }
    });
  }

  // Derives the Overall Quality Index from the current meeting state. Shows '--'
  // when there is nothing to score or the backend evaluator is unreachable,
  // rather than displaying a placeholder score as if it were measured.
  async function updateQualityStat(state) {
    if (!state.transcript.length || !window.ExtensionAPI) {
      statQuality.innerText = '--';
      return;
    }

    const reqData = await window.ExtensionAPI.generateRequirements(
      state.transcript, state.clarifications, 'HR Tech'
    );
    if (!reqData) {
      statQuality.innerText = 'n/a';
      statQuality.title = 'Start the backend on port 3000 to compute the quality index';
      return;
    }

    const evalData = await window.ExtensionAPI.evaluateRequirements(reqData.baseline, reqData.refined);
    const oqi = evalData?.refined?.overallQualityIndex;
    statQuality.innerText = typeof oqi === 'number' ? `${oqi}%` : 'n/a';
  }

  refreshState();

  // Button actions
  btnOpenSidepanel.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
    window.close();
  });

  document.getElementById('btn-new-meeting')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'START_RECORDING' }, () => {
      refreshState();
    });
  });

  document.getElementById('btn-end-meeting')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'END_RECORDING' }, () => {
      refreshState();
    });
  });


  btnLoadSample.addEventListener('click', () => {
    const sample = window.EXT_SAMPLE_TRANSCRIPTS?.[0];
    if (!sample) return;

    chrome.runtime.sendMessage({ type: 'CLEAR_MEETING_DATA' });
    sample.utterances.forEach(u => {
      const analysis = window.ClientNLPEngine?.analyzeUtterance(u.text, u.speaker, u.timestamp);
      chrome.runtime.sendMessage({
        type: 'NEW_UTTERANCE',
        payload: {
          speaker: u.speaker,
          text: u.text,
          timestamp: u.timestamp,
          ...analysis
        }
      });
    });

    setTimeout(refreshState, 300);
  });

  btnOpenWebapp.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000' });
  });

  btnReset.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_MEETING_DATA' }, () => {
      refreshState();
    });
  });
});

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
