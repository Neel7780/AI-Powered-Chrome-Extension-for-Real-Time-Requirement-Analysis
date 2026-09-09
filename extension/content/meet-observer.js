/**
 * Google Meet & Microsoft Teams Caption Observer
 * Captures live participant speech from closed captions and transcripts.
 * Works seamlessly whether alone in a call or in a multi-participant meeting.
 */

(function () {
  console.log('[AI RE] 🚀 Google Meet Speech Observer loaded and active');

  // DOM Selectors for caption containers and text nodes in modern Google Meet
  const MEET_SELECTORS = [
    'div[aria-live="polite"]',
    'div[aria-live="assertive"]',
    '[jsname="tgaKEf"]',
    'div[jsname="YSvySm"]',
    '.bh44bd',
    '.VbkSUe',
    '.nMx2nd',
    '.cnK48d',
    '[data-tid="closed-caption-text"]',
    '[data-tid="caption-text-body"]'
  ];

  let observer = null;
  let lastEmittedText = '';
  let pendingBuffer = { text: '', speaker: 'You', timer: null };
  const emittedHashes = new Set();

  /**
   * Identifies and rejects Google Meet control-bar UI noise, buttons, and shortcuts.
   */
  function isMeetingUINoise(text) {
    if (!text || typeof text !== 'string') return true;
    const trimmed = text.trim();
    if (trimmed.length < 3) return true;

    const lower = trimmed.toLowerCase();

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

    // Keyboard shortcut hints
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

    // Must contain actual speech words
    if (!/[a-zA-Z]{2,}/.test(trimmed)) {
      return true;
    }

    return false;
  }

  /**
   * Extracts speaker name and cleaned speech content from a caption node or text.
   */
  function parseSpeakerAndContent(node, rawText) {
    let speaker = 'You';
    let content = rawText.trim();

    // 1. Check parent container for explicit speaker elements
    const unit = node.closest('[jsname="YSvySm"], .nMx2nd, div[aria-live="polite"], div[aria-live="assertive"]') || node;
    const speakerNode = unit.querySelector('[jsname="W297wb"], .NWqnrd, .zs75Bi, .speaker-name, [data-tid="author-avatar"]');
    if (speakerNode && speakerNode.innerText) {
      const name = speakerNode.innerText.trim();
      if (name && !isMeetingUINoise(name)) {
        speaker = name;
      }
    } else {
      const imgEl = unit.querySelector('img[alt], .K6W0Fd');
      if (imgEl && imgEl.getAttribute('alt')) {
        const alt = imgEl.getAttribute('alt').trim();
        if (alt && !isMeetingUINoise(alt)) {
          speaker = alt;
        }
      }
    }

    // 2. Check if content begins with speaker name (e.g., "You: Hello" or "Neel Khatri: Hello")
    const colonIdx = content.indexOf(':');
    if (colonIdx > 0 && colonIdx < 30) {
      const possibleSpeaker = content.substring(0, colonIdx).trim();
      if (possibleSpeaker.length > 1 && !isMeetingUINoise(possibleSpeaker)) {
        speaker = possibleSpeaker;
        content = content.substring(colonIdx + 1).trim();
      }
    }

    // Strip leading speaker name if duplicated
    if (speaker && speaker !== 'You') {
      const escaped = speaker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      content = content.replace(new RegExp(`^${escaped}[:\\s\\n-]*`, 'i'), '').trim();
    } else if (content.toLowerCase().startsWith('you:')) {
      content = content.substring(4).trim();
    }

    content = content.replace(/\s+/g, ' ').trim();
    return { speaker, content };
  }

  /**
   * Emits the completed utterance to the extension service worker and injected HUD.
   */
  function emitSpeech(speaker, text) {
    if (!text || text.length < 3) return;
    if (isMeetingUINoise(text)) return;

    // Deduplicate identical emissions within short time
    const hash = `${speaker}:${text.toLowerCase()}`;
    if (emittedHashes.has(hash)) return;
    emittedHashes.add(hash);
    if (emittedHashes.size > 200) {
      const first = emittedHashes.values().next().value;
      emittedHashes.delete(first);
    }

    lastEmittedText = text;
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
   * Stabilizes streaming live captions and emits when speaker finishes or pauses.
   */
  function handleCaptionUpdate(speaker, content) {
    if (!content || isMeetingUINoise(content)) return;
    if (content === lastEmittedText) return;

    // Check if sentence finished with punctuation
    const endsWithTerminalPunct = /[.?!]$/.test(content);
    if (endsWithTerminalPunct && content.length > 12) {
      if (pendingBuffer.timer) clearTimeout(pendingBuffer.timer);
      emitSpeech(speaker, content);
      return;
    }

    // Set responsive 600ms stabilization timer
    if (pendingBuffer.timer) clearTimeout(pendingBuffer.timer);
    pendingBuffer = {
      text: content,
      speaker: speaker,
      timer: setTimeout(() => {
        emitSpeech(speaker, content);
      }, 600)
    };
  }

  /**
   * Scans Google Meet DOM for live captions.
   */
  function scanGoogleMeetDOM() {
    // 1. Direct check on aria-live containers
    const ariaContainers = document.querySelectorAll('div[aria-live="polite"], div[aria-live="assertive"]');
    ariaContainers.forEach(container => {
      // Find caption spans inside
      const captionSpans = container.querySelectorAll('[jsname="tgaKEf"], .bh44bd, .VbkSUe, span');
      if (captionSpans.length > 0) {
        captionSpans.forEach(span => {
          if (span.closest('button, [role="button"]')) return;
          const text = span.innerText?.trim();
          if (text && text.length >= 3 && !isMeetingUINoise(text)) {
            const { speaker, content } = parseSpeakerAndContent(span, text);
            handleCaptionUpdate(speaker, content);
          }
        });
      } else {
        const text = container.innerText?.trim();
        if (text && text.length >= 3 && !isMeetingUINoise(text)) {
          const { speaker, content } = parseSpeakerAndContent(container, text);
          handleCaptionUpdate(speaker, content);
        }
      }
    });

    // 2. Specific Google Meet leaf elements
    const leafNodes = document.querySelectorAll('[jsname="tgaKEf"], .bh44bd, .VbkSUe, .cnK48d');
    leafNodes.forEach(node => {
      if (node.closest('button, [role="button"]')) return;
      const text = node.innerText?.trim();
      if (text && text.length >= 3 && !isMeetingUINoise(text)) {
        const { speaker, content } = parseSpeakerAndContent(node, text);
        handleCaptionUpdate(speaker, content);
      }
    });
  }

  /**
   * In-Meeting Direct Web Speech Recognition Fallback
   * Allows transcribing speech directly from the mic if Meet captions are delayed.
   */
  let speechRecognition = null;
  let isMicListening = false;

  function initDirectMicSpeech() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    speechRecognition = new SpeechRec();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = 'en-US';

    speechRecognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const transcript = result[0].transcript.trim();
          if (transcript && !isMeetingUINoise(transcript)) {
            console.log('[AI RE] 🎙️ Direct Mic Transcript:', transcript);
            emitSpeech('You', transcript);
          }
        }
      }
    };

    speechRecognition.onerror = (e) => {
      console.warn('[AI RE] Direct mic error:', e.error);
    };

    speechRecognition.onend = () => {
      if (isMicListening) {
        try { speechRecognition.start(); } catch {}
      }
    };
  }

  function toggleDirectMic() {
    if (!speechRecognition) initDirectMicSpeech();
    if (!speechRecognition) return false;

    if (isMicListening) {
      isMicListening = false;
      try { speechRecognition.stop(); } catch {}
      console.log('[AI RE] Direct mic stopped');
      return false;
    } else {
      isMicListening = true;
      try { speechRecognition.start(); } catch {}
      console.log('[AI RE] Direct mic listening...');
      return true;
    }
  }

  function initMeetObserver() {
    if (observer) return;

    observer = new MutationObserver(() => {
      scanGoogleMeetDOM();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    console.log('[AI RE] Google Meet DOM MutationObserver active');
    initDirectMicSpeech();
  }

  if (window.location.hostname.includes('meet.google.com') || window.location.hostname.includes('teams.microsoft.com')) {
    window.addEventListener('load', initMeetObserver);
    setTimeout(initMeetObserver, 1500);
  }

  window.MeetObserver = {
    init: initMeetObserver,
    toggleMic: toggleDirectMic,
    scanNow: scanGoogleMeetDOM
  };
})();
