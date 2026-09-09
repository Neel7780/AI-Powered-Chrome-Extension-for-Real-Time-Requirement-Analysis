/**
 * Zoom Web Client Meeting Transcript Observer
 * Listens for live closed captions and live transcript panel updates in Zoom Web App.
 * Accurately extracts participant speech while ignoring UI control bars, toolbars, and buttons.
 */

(function () {
  console.log('[AI RE] Zoom Observer loaded');

  // Zoom Web DOM selectors specifically for caption/transcript text content
  const ZOOM_CAPTION_SELECTORS = [
    '.closed-caption-text',
    '.closed-caption-window span',
    '.transcript-item__content',
    '.transcript-item .content-container',
    '.transcription-text',
    '.meeting-app__transcription-text',
    '.ax-outline .message-content'
  ];

  const DISALLOWED_CONTAINERS = [
    'button',
    '[role="button"]',
    '[role="toolbar"]',
    '[role="menu"]',
    'nav',
    'footer',
    '.footer',
    '.meeting-control-bar'
  ];

  let observer = null;
  const emittedSentences = new Set();
  const speakerBuffers = new Map();
  const DEBOUNCE_PAUSE_MS = 1400;

  function isMeetingUINoise(text) {
    if (!text || typeof text !== 'string') return true;
    const trimmed = text.trim();
    if (trimmed.length < 3) return true;

    const lower = trimmed.toLowerCase();

    const uiPhrases = [
      'mute', 'unmute', 'start video', 'stop video',
      'share screen', 'record', 'breakout rooms',
      'reactions', 'more meeting controls', 'end meeting',
      'leave meeting', 'audio settings', 'video settings',
      'closed caption', 'live transcript', 'turn on',
      'press down arrow', 'hover tray'
    ];

    for (const phrase of uiPhrases) {
      if (lower.includes(phrase)) return true;
    }

    if (/\(ctrl\s*\+\s*[a-z0-9]\)/i.test(trimmed) ||
        /\(alt\s*\+\s*[a-z0-9]\)/i.test(trimmed)) {
      return true;
    }

    if (!/[a-zA-Z]{2,}/.test(trimmed)) {
      return true;
    }

    return false;
  }

  function cleanSpokenText(rawText, speaker) {
    if (!rawText) return '';
    let cleaned = rawText.trim();

    if (speaker && speaker !== 'Participant') {
      const speakerRegex = new RegExp(`^${speaker}[:\\s\\n-]*`, 'i');
      cleaned = cleaned.replace(speakerRegex, '').trim();
    }

    cleaned = cleaned.replace(/\s+/g, ' ');
    return cleaned;
  }

  function emitCompletedUtterance(speaker, text) {
    if (!text || text.length < 3) return;
    if (isMeetingUINoise(text)) return;

    const hash = `${speaker}:${text}`;
    if (emittedSentences.has(hash)) return;
    emittedSentences.add(hash);
    if (emittedSentences.size > 200) {
      const first = emittedSentences.values().next().value;
      emittedSentences.delete(first);
    }

    const timestamp = new Date().toTimeString().slice(3, 8);
    console.log(`[AI RE] 🎙️ Zoom Speech: [${speaker}] "${text}"`);

    const analysis = window.ClientNLPEngine 
      ? window.ClientNLPEngine.analyzeUtterance(text, speaker, timestamp)
      : { text, speaker, timestamp, isAmbiguous: false, ambiguityScore: 0, detectedFlags: [] };

    chrome.runtime.sendMessage({
      type: 'NEW_UTTERANCE',
      payload: {
        speaker,
        text,
        timestamp,
        ...analysis,
        source: 'zoom'
      }
    }).catch(() => {});

    if (window.InjectedHUD) {
      window.InjectedHUD.displayUtterance({ speaker, text, timestamp, ...analysis });
    }
  }

  function handleLiveCaptionStream(speaker, rawText) {
    const text = cleanSpokenText(rawText, speaker);
    if (!text || isMeetingUINoise(text)) return;

    const existing = speakerBuffers.get(speaker);

    if (existing) {
      clearTimeout(existing.timer);

      const endsWithSentencePunct = /[.?!]$/.test(text.trim());
      if (endsWithSentencePunct && text.length > 15) {
        speakerBuffers.delete(speaker);
        emitCompletedUtterance(speaker, text);
        return;
      }

      existing.text = text;
      existing.timer = setTimeout(() => {
        speakerBuffers.delete(speaker);
        emitCompletedUtterance(speaker, text);
      }, DEBOUNCE_PAUSE_MS);
    } else {
      const timer = setTimeout(() => {
        speakerBuffers.delete(speaker);
        emitCompletedUtterance(speaker, text);
      }, DEBOUNCE_PAUSE_MS);

      speakerBuffers.set(speaker, { text, timer, timestamp: Date.now() });
    }
  }

  function scanZoomDOM() {
    for (const selector of ZOOM_CAPTION_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el.closest(DISALLOWED_CONTAINERS.join(', '))) return;

        const rawText = el.innerText?.trim();
        if (!rawText || rawText.length < 2) return;
        if (isMeetingUINoise(rawText)) return;

        // Try to identify speaker
        let speaker = 'Participant';
        const speakerEl = el.closest('.transcript-item')?.querySelector('.transcript-item__speaker, .user-name')
          || el.parentElement?.querySelector('.speaker-name');
        if (speakerEl && speakerEl.innerText) {
          speaker = speakerEl.innerText.trim();
        } else {
          const colonIndex = rawText.indexOf(':');
          if (colonIndex > 0 && colonIndex < 30) {
            speaker = rawText.slice(0, colonIndex).trim();
          }
        }

        handleLiveCaptionStream(speaker, rawText);
      });
    }
  }

  function initZoomObserver() {
    if (observer) return;

    observer = new MutationObserver(() => {
      scanZoomDOM();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    console.log('[AI RE] Zoom DOM Speech Observer active');
  }

  if (window.location.hostname.includes('zoom.us')) {
    window.addEventListener('load', initZoomObserver);
    setTimeout(initZoomObserver, 2000);
  }

  window.ZoomObserver = { init: initZoomObserver };
})();
