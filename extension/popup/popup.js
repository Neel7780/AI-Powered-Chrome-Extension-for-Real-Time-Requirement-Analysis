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

      // Quality score estimate
      if (state.clarifications.length > 0) {
        statQuality.innerText = '92%';
      } else if (state.transcript.length > 0) {
        statQuality.innerText = '35%';
      } else {
        statQuality.innerText = '--';
      }

      if (state.transcript.length > 0) {
        const last = state.transcript[state.transcript.length - 1];
        let text = last.text;
        if (last.detectedFlags && last.detectedFlags.length > 0) {
          last.detectedFlags.forEach(f => {
            text = text.replace(new RegExp(`(${f.phrase})`, 'gi'), '<span class="highlight-vague">$1</span>');
          });
        }
        latestUtterance.innerHTML = `<strong>${last.speaker || 'Speaker'}:</strong> ${text}`;
      }
    });
  }

  refreshState();

  // Button actions
  btnOpenSidepanel.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });
    window.close();
  });

  btnLoadSample.addEventListener('click', () => {
    const sample = window.EXT_SAMPLE_TRANSCRIPTS?.[0];
    if (!sample) return;

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

    sample.sampleClarifications.forEach(c => {
      chrome.runtime.sendMessage({
        type: 'SAVE_CLARIFICATION_RESPONSE',
        payload: c
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
