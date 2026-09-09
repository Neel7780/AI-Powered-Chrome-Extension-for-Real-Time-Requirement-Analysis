/**
 * Google Meet & Microsoft Teams Caption Observer
 * Captures ONLY authentic participant speech from live closed captions and transcripts.
 * Rejects UI controls, meeting toolbars, buttons, and tray noise.
 */

(function () {
  console.log('[AI RE] Meet & Teams Speech Observer initialized');

  // Specific caption text leaf selectors (NEVER match container/root elements like .T4LgNb)
  const CAPTION_LEAF_SELECTORS = [
    '[jsname="tgaKEf"]',                         // Google Meet closed caption text span/div
    'div[jsname="YSvySm"] .bh44bd',              // Google Meet caption content block
    'div[jsname="YSvySm"] .VbkSUe',              // Google Meet alternate caption span
    '.cnK48d',                                   // Google Meet transcript side panel item
    '[data-tid="closed-caption-text"]',          // Microsoft Teams closed caption text
    '[data-tid="caption-text-body"]'             // Microsoft Teams transcript text body
  ];

  // Disallowed parent containers (UI controls, button trays, toolbars, settings dialogs)
  const DISALLOWED_CONTAINER_SELECTORS = [
    'button',
    '[role="button"]',
    '[role="toolbar"]',
    '[role="menu"]',
    '[role="navigation"]',
    '[role="tablist"]',
    'nav',
    'header',
    'footer',
    '[jscontroller="kAPstc"]',                   // Google Meet bottom control bar
    '[aria-label*="hover tray" i]',
    '[aria-label*="Meeting details" i]',
    '.google-material-icons'
  ];

  // Active utterance buffer per speaker to handle streaming caption updates
  const speakerBuffers = new Map(); // speaker -> { text, timer, timestamp }
  const DEBOUNCE_PAUSE_MS = 1400;   // Wait 1.4s after speaker pauses to finalize line
  const emittedSentences = new Set(); // Prevent duplicate emissions

  let observer = null;

  /**
   * Filters out any Google Meet / Teams control-bar UI noise, button labels, and shortcut keys.
   */
  function isMeetingUINoise(text) {
    if (!text || typeof text !== 'string') return true;
    const trimmed = text.trim();
    if (trimmed.length < 3) return true;

    const lower = trimmed.toLowerCase();

    // Known UI control terms and meeting tool descriptions
    const uiNoisePhrases = [
      'press down arrow',
      'open the hover tray',
      'turn off microphone',
      'turn on microphone',
      'turn off camera',
      'turn on camera',
      'turn on captions',
      'turn off captions',
      'share screen',
      'raise hand',
      'leave call',
      'meeting details',
      'host controls',
      'audio settings',
      'video settings',
      'backgrounds and effects',
      'chat with everyone',
      'more options for',
      'show more info',
      'send a reaction',
      'blur background',
      'meeting tools',
      'reframe visual_effects'
    ];

    for (const phrase of uiNoisePhrases) {
      if (lower.includes(phrase)) return true;
    }

    // Keyboard shortcut hints in UI
    if (/\(ctrl\s*\+\s*[a-z0-9]\)/i.test(trimmed) ||
        /\(ctrl\s*\+\s*alt\s*\+\s*[a-z0-9]\)/i.test(trimmed) ||
        /\(c\s+or\s+shift\s*\+\s*c\)/i.test(trimmed)) {
      return true;
    }

    // Material icon names dumped into text
    if (/\b(frame_person|visual_effects|keyboard_arrow_up|keyboard_arrow_down|more_vert|call_end|back_hand|mic_off|videocam_off|closed_caption_off|lock_person|blur_on|apps|computer_arrow_up|mood)\b/i.test(trimmed)) {
      return true;
    }

    // Meeting code pattern (e.g. 'teo-jmfy-dfk')
    if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(trimmed)) {
      return true;
    }

    // Must contain letters (actual speech), not just timestamps or symbols
    if (!/[a-zA-Z]{2,}/.test(trimmed)) {
      return true;
    }

    return false;
  }

  /**
   * Cleans text to extract only the spoken sentence.
   */
  function cleanSpokenText(rawText, speaker) {
    if (!rawText) return '';
    let cleaned = rawText.trim();

    // Strip leading speaker name if repeated (e.g., "Neel Khatri: Hello" -> "Hello")
    if (speaker && speaker !== 'Participant') {
      const speakerRegex = new RegExp(`^${escapeRegex(speaker)}[:\\s\\n-]*`, 'i');
      cleaned = cleaned.replace(speakerRegex, '').trim();
    }

    // Clean internal excess whitespace
    cleaned = cleaned.replace(/\s+/g, ' ');
    return cleaned;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Extracts speaker name from the caption unit container.
   */
  function extractSpeaker(node) {
    const unit = node.closest('[jsname="YSvySm"], div[jscontroller="D1tHje"], [data-tid*="caption"], .nMx2nd');
    if (!unit) return 'Participant';

    // Check specific speaker name nodes
    const nameEl = unit.querySelector('[jsname="W297wb"], .NWqnrd, .zs75Bi, .speaker-name, [data-tid="author-avatar"]');
    if (nameEl && nameEl.innerText) {
      const name = nameEl.innerText.trim();
      if (name && !isMeetingUINoise(name)) return name;
    }

    // Check avatar image alt
    const imgEl = unit.querySelector('img[alt], .K6W0Fd');
    if (imgEl && imgEl.getAttribute('alt')) {
      const alt = imgEl.getAttribute('alt').trim();
      if (alt && !isMeetingUINoise(alt)) return alt;
    }

    return 'Participant';
  }

  /**
   * Finalizes and broadcasts a completed speech utterance.
   */
  function emitCompletedUtterance(speaker, text) {
    if (!text || text.length < 3) return;
    if (isMeetingUINoise(text)) return;

    // Deduplicate identical sentences
    const hash = `${speaker}:${text}`;
    if (emittedSentences.has(hash)) return;
    emittedSentences.add(hash);
    if (emittedSentences.size > 200) {
      const first = emittedSentences.values().next().value;
      emittedSentences.delete(first);
    }

    const timestamp = new Date().toTimeString().slice(3, 8);
    console.log(`[AI RE] 🎙️ Captured Speech: [${speaker}] "${text}"`);

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
        source: 'meet'
      }
    }).catch(() => {});

    if (window.InjectedHUD) {
      window.InjectedHUD.displayUtterance({ speaker, text, timestamp, ...analysis });
    }
  }

  /**
   * Buffers streaming live caption words and emits completed sentences.
   */
  function handleLiveCaptionStream(speaker, rawText) {
    const text = cleanSpokenText(rawText, speaker);
    if (!text || isMeetingUINoise(text)) return;

    const existing = speakerBuffers.get(speaker);

    if (existing) {
      // Clear pending pause timer
      clearTimeout(existing.timer);

      // Check if sentence finished with terminal punctuation (. ? !)
      const endsWithSentencePunct = /[.?!]$/.test(text.trim());
      const isSubstantialLength = text.length > 35;

      if (endsWithSentencePunct && text.length > 15) {
        // Complete sentence detected
        speakerBuffers.delete(speaker);
        emitCompletedUtterance(speaker, text);
        return;
      }

      // Otherwise, update buffer and set pause timer
      existing.text = text;
      existing.timer = setTimeout(() => {
        speakerBuffers.delete(speaker);
        emitCompletedUtterance(speaker, text);
      }, DEBOUNCE_PAUSE_MS);
    } else {
      // New speaker buffer
      const timer = setTimeout(() => {
        speakerBuffers.delete(speaker);
        emitCompletedUtterance(speaker, text);
      }, DEBOUNCE_PAUSE_MS);

      speakerBuffers.set(speaker, { text, timer, timestamp: Date.now() });
    }
  }

  /**
   * Main scan function triggered by DOM mutations.
   */
  function scanCaptions() {
    for (const selector of CAPTION_LEAF_SELECTORS) {
      const nodes = document.querySelectorAll(selector);
      nodes.forEach(node => {
        // 1. Verify this is NOT inside any button, toolbar, or control tray
        if (node.closest(DISALLOWED_CONTAINER_SELECTORS.join(', '))) {
          return;
        }

        // 2. Verify this is inside an actual caption / transcript container
        const captionContainer = node.closest('[jsname="YSvySm"], div[jscontroller="D1tHje"], .iO50fd, [data-tid*="caption"], .a4cQT, .cnK48d');
        if (!captionContainer) {
          return;
        }

        const rawText = node.innerText?.trim();
        if (!rawText || rawText.length < 2) return;

        // 3. Filter out any meeting UI noise
        if (isMeetingUINoise(rawText)) return;

        // 4. Extract speaker and process speech
        const speaker = extractSpeaker(node);
        handleLiveCaptionStream(speaker, rawText);
      });
    }
  }

  function initMeetObserver() {
    if (observer) return;

    observer = new MutationObserver(() => {
      scanCaptions();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    console.log('[AI RE] Meet & Teams Speech Observer active');
  }

  if (window.location.hostname.includes('meet.google.com') || window.location.hostname.includes('teams.microsoft.com')) {
    window.addEventListener('load', initMeetObserver);
    setTimeout(initMeetObserver, 1500);
  }

  window.MeetObserver = { init: initMeetObserver };
})();
