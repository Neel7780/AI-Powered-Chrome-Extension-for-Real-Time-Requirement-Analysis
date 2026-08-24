/**
 * Google Meet & Microsoft Teams Caption Observer
 */

(function () {
  console.log('[AI RE] Meet & Teams Observer loaded');

  const MEET_CAPTIONS_CONTAINER = 'div[jscontroller="D1tHje"], div[jsname="YSvySm"], .iO50fd';
  let observer = null;
  let lastCaptured = '';

  function initMeetObserver() {
    if (observer) return;

    observer = new MutationObserver(() => {
      const captionNodes = document.querySelectorAll('.T4LgNb, .bh44bd, [jsname="tgaKEf"], [data-tid="closed-caption-text"]');
      captionNodes.forEach(node => {
        const text = node.innerText?.trim();
        if (text && text.length > 5 && text !== lastCaptured) {
          lastCaptured = text;
          processMeetSpeech(node, text);
        }
      });
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    console.log('[AI RE] Meet/Teams DOM MutationObserver initialized');
  }

  function processMeetSpeech(node, text) {
    // Find speaker if available in parent elements
    let speaker = 'Participant';
    const speakerNode = node.closest('[jsname="YSvySm"]')?.querySelector('.NWqnrd, .zs75Bi') 
      || node.parentElement?.querySelector('.speaker-name');
    if (speakerNode && speakerNode.innerText) {
      speaker = speakerNode.innerText.trim();
    }

    const timestamp = new Date().toTimeString().slice(3, 8);

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

  if (window.location.hostname.includes('meet.google.com') || window.location.hostname.includes('teams.microsoft.com')) {
    window.addEventListener('load', initMeetObserver);
    setTimeout(initMeetObserver, 2000);
  }

  window.MeetObserver = { init: initMeetObserver };
})();
