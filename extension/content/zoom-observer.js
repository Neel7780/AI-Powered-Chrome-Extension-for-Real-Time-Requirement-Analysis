/**
 * Zoom Web Client Meeting Transcript Observer
 * Listens for live closed captions and live transcript panel updates in Zoom Web App.
 */

(function () {
  console.log('[AI RE] Zoom Observer loaded');

  // Zoom Web DOM selectors for captions & transcripts
  const ZOOM_SELECTORS = [
    '.closed-caption-window',
    '.transcript-container',
    '.transcript-item',
    '.ax-outline',
    '[aria-label*="caption" i]',
    '[aria-label*="transcript" i]',
    '.meeting-app__transcription'
  ];

  let observer = null;
  let lastCapturedText = '';

  function initZoomObserver() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          scanZoomDOM();
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    console.log('[AI RE] Zoom DOM MutationObserver initialized');
  }

  function scanZoomDOM() {
    for (const selector of ZOOM_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.innerText?.trim();
        if (text && text.length > 5 && text !== lastCapturedText) {
          lastCapturedText = text;
          processCapturedZoomSpeech(text);
        }
      });
    }
  }

  function processCapturedZoomSpeech(rawText) {
    // Attempt to extract speaker name and speech
    let speaker = 'Participant';
    let content = rawText;

    const colonIndex = rawText.indexOf(':');
    if (colonIndex > 0 && colonIndex < 35) {
      speaker = rawText.slice(0, colonIndex).trim();
      content = rawText.slice(colonIndex + 1).trim();
    }

    const timestamp = new Date().toTimeString().slice(3, 8);

    // Analyze utterance via client NLP engine
    const analysis = window.ClientNLPEngine 
      ? window.ClientNLPEngine.analyzeUtterance(content, speaker, timestamp)
      : { text: content, speaker, timestamp, isAmbiguous: false, ambiguityScore: 0, detectedFlags: [] };

    // Send to background service worker
    chrome.runtime.sendMessage({
      type: 'NEW_UTTERANCE',
      payload: {
        speaker,
        text: content,
        timestamp,
        ...analysis,
        source: 'zoom'
      }
    }).catch(() => {});

    // Notify in-meeting HUD
    if (window.InjectedHUD) {
      window.InjectedHUD.displayUtterance({ speaker, text: content, timestamp, ...analysis });
    }
  }

  // Auto-start if on Zoom domain
  if (window.location.hostname.includes('zoom.us')) {
    window.addEventListener('load', initZoomObserver);
    setTimeout(initZoomObserver, 2000);
  }

  window.ZoomObserver = { init: initZoomObserver };
})();
