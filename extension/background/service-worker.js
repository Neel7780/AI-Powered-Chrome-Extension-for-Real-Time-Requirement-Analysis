/**
 * Chrome Extension Background Service Worker (Manifest V3)
 * Coordinates transcript state, live messaging, and Side Panel management.
 */

// Initial state
let meetingState = {
  isMonitoring: false,
  activePlatform: null, // 'zoom' | 'meet' | 'teams' | 'simulated'
  transcript: [],
  clarifications: [],
  ambiguousCount: 0,
  qualityScores: null
};

// Enable Side Panel behavior
chrome.sidePanel?.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    case 'START_MONITORING':
      meetingState.isMonitoring = true;
      meetingState.activePlatform = payload?.platform || 'meeting';
      broadcastToTabs({ type: 'MONITORING_STATUS_CHANGED', payload: meetingState });
      sendResponse({ success: true, state: meetingState });
      break;

    case 'STOP_MONITORING':
      meetingState.isMonitoring = false;
      broadcastToTabs({ type: 'MONITORING_STATUS_CHANGED', payload: meetingState });
      sendResponse({ success: true, state: meetingState });
      break;

    case 'NEW_UTTERANCE':
      // Captured from Zoom / Google Meet / Simulation
      handleNewUtterance(payload);
      sendResponse({ success: true });
      break;

    case 'GET_STATE':
      sendResponse({ success: true, state: meetingState });
      break;

    case 'OPEN_SIDEPANEL':
      if (sender.tab?.id) {
        chrome.sidePanel.open({ tabId: sender.tab.id });
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.sidePanel.open({ tabId: tabs[0].id });
          }
        });
      }
      sendResponse({ success: true });
      break;

    case 'SAVE_CLARIFICATION_RESPONSE':
      saveClarification(payload);
      sendResponse({ success: true, clarifications: meetingState.clarifications });
      break;

    case 'CLEAR_MEETING_DATA':
      meetingState.transcript = [];
      meetingState.clarifications = [];
      meetingState.ambiguousCount = 0;
      meetingState.qualityScores = null;
      broadcastToTabs({ type: 'MEETING_DATA_RESET', payload: meetingState });
      sendResponse({ success: true, state: meetingState });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true; // Keep channel open for async response
});

function handleNewUtterance(utterance) {
  if (!utterance || !utterance.text) return;

  // Avoid duplicate immediate spam
  const last = meetingState.transcript[meetingState.transcript.length - 1];
  if (last && last.text === utterance.text && last.speaker === utterance.speaker) {
    return;
  }

  meetingState.transcript.push(utterance);
  if (utterance.isAmbiguous) {
    meetingState.ambiguousCount++;
  }

  // Broadcast to Sidepanel and active Content Script HUD
  chrome.runtime.sendMessage({
    type: 'UTTERANCE_ADDED',
    payload: {
      utterance,
      transcriptLength: meetingState.transcript.length,
      ambiguousCount: meetingState.ambiguousCount
    }
  }).catch(() => {});
}

function saveClarification(clarification) {
  const index = meetingState.clarifications.findIndex(c => c.id === clarification.id);
  if (index >= 0) {
    meetingState.clarifications[index] = clarification;
  } else {
    meetingState.clarifications.push(clarification);
  }

  chrome.runtime.sendMessage({
    type: 'CLARIFICATION_UPDATED',
    payload: {
      clarification,
      allClarifications: meetingState.clarifications
    }
  }).catch(() => {});
}

function broadcastToTabs(msg) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
    });
  });
}
