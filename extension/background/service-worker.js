/**
 * Chrome Extension Background Service Worker (Manifest V3)
 * Coordinates transcript state, live messaging, and Side Panel management.
 * Synchronizes with FastAPI backend session.
 */

const SERVER_URL = 'http://localhost:3000';

let meetingState = {
  isMonitoring: false,
  isRecording: false,
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
    case 'START_RECORDING':
    case 'START_NEW_MEETING':
      meetingState.transcript = [];
      meetingState.clarifications = [];
      meetingState.ambiguousCount = 0;
      meetingState.qualityScores = null;
      meetingState.isMonitoring = true;
      meetingState.isRecording = true;
      meetingState.activePlatform = payload?.platform || 'meeting';
      broadcastToTabs({ type: 'RECORDING_STATE_CHANGED', payload: { isRecording: true } });
      broadcastToTabs({ type: 'MEETING_DATA_RESET', payload: meetingState });
      fetch(`${SERVER_URL}/api/meetings/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: payload?.title || `Meeting ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          domain: payload?.domain || 'HR Tech'
        })
      }).then(r => r.json()).then(res => {
        if (res.data) {
          broadcastToTabs({ type: 'SESSION_STATE_SYNC', payload: res.data });
          broadcastToTabs({ type: 'RECORDING_STATE_CHANGED', payload: { isRecording: true, meetingId: res.data.sessionId } });
        }
      }).catch(() => {});
      sendResponse({ success: true, isRecording: true, state: meetingState });
      break;

    case 'END_RECORDING':
    case 'STOP_MONITORING':
      meetingState.isMonitoring = false;
      meetingState.isRecording = false;
      broadcastToTabs({ type: 'RECORDING_STATE_CHANGED', payload: { isRecording: false } });
      fetch(`${SERVER_URL}/api/session/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).then(r => r.json()).then(res => {
        if (res.data) {
          broadcastToTabs({ type: 'SESSION_FINALIZED', payload: res.data, meetings: res.meetings });
          broadcastToTabs({ type: 'SESSION_STATE_SYNC', payload: res.data });
        }
      }).catch(() => {});
      sendResponse({ success: true, isRecording: false, state: meetingState });
      break;

    case 'GET_RECORDING_STATUS':
      sendResponse({ success: true, isRecording: !!meetingState.isRecording, state: meetingState });
      break;

    case 'START_MONITORING':
      meetingState.isMonitoring = true;
      meetingState.isRecording = true;
      meetingState.activePlatform = payload?.platform || 'meeting';
      if (payload?.cleanSlate) {
        meetingState.transcript = [];
        meetingState.clarifications = [];
        meetingState.ambiguousCount = 0;
        meetingState.qualityScores = null;
        broadcastToTabs({ type: 'MEETING_DATA_RESET', payload: meetingState });
      }
      broadcastToTabs({ type: 'RECORDING_STATE_CHANGED', payload: { isRecording: true } });
      broadcastToTabs({ type: 'MONITORING_STATUS_CHANGED', payload: meetingState });
      fetch(`${SERVER_URL}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Live ${meetingState.activePlatform} Meeting`, domain: 'HR Tech' })
      }).catch(() => {});
      sendResponse({ success: true, state: meetingState });
      break;

    case 'NEW_UTTERANCE':
      handleNewUtterance(payload);
      sendResponse({ success: true });
      break;

    case 'GET_STATE':
      sendResponse({ success: true, state: meetingState, isRecording: !!meetingState.isRecording });
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
      meetingState.isRecording = false;
      broadcastToTabs({ type: 'RECORDING_STATE_CHANGED', payload: { isRecording: false } });
      broadcastToTabs({ type: 'MEETING_DATA_RESET', payload: meetingState });
      fetch(`${SERVER_URL}/api/session/reset`, { method: 'POST' }).catch(() => {});
      sendResponse({ success: true, state: meetingState });
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }

  return true;
});

function handleNewUtterance(utterance) {
  if (!utterance || !utterance.text) return;
  if (!meetingState.isRecording && !meetingState.isMonitoring) {
    return;
  }


  const last = meetingState.transcript[meetingState.transcript.length - 1];
  if (last && last.text === utterance.text && last.speaker === utterance.speaker) {
    return;
  }

  meetingState.transcript.push(utterance);
  if (utterance.isAmbiguous) {
    meetingState.ambiguousCount++;
  }

  if (utterance.candidateQuestion) {
    const question = utterance.candidateQuestion;
    const alreadyTracked = meetingState.clarifications.some(c =>
      c.id === question.id || c.triggeredBy === question.triggeredBy
    );
    if (!alreadyTracked) {
      meetingState.clarifications.push({
        ...question,
        selectedResponse: null
      });
    }
  }

  // Sync with FastAPI backend
  fetch(`${SERVER_URL}/api/session/utterance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: utterance.text,
      speaker: utterance.speaker || 'Participant',
      timestamp: utterance.timestamp
    })
  }).then(res => res.json()).then(json => {
    if (json.success && json.data) {
      meetingState.transcript = json.data.transcript || meetingState.transcript;
      meetingState.clarifications = json.data.clarifications || meetingState.clarifications;
      meetingState.qualityScores = json.data.evaluation || meetingState.qualityScores;
      broadcastToTabs({
        type: 'SESSION_STATE_SYNC',
        payload: json.data
      });
    }
  }).catch(() => {});

  broadcastToTabs({
    type: 'UTTERANCE_ADDED',
    payload: {
      utterance,
      allTranscript: meetingState.transcript,
      allClarifications: meetingState.clarifications
    }
  });
}

function saveClarification(clarification) {
  const index = meetingState.clarifications.findIndex(c => c.id === clarification.id || c.triggeredBy === clarification.triggeredBy);
  if (index !== -1) {
    meetingState.clarifications[index] = {
      ...meetingState.clarifications[index],
      selectedResponse: clarification.selectedResponse
    };
  } else {
    meetingState.clarifications.push(clarification);
  }

  // Sync answer to FastAPI backend
  fetch(`${SERVER_URL}/api/session/clarify/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clarificationId: clarification.id || '',
      selectedResponse: clarification.selectedResponse || ''
    })
  }).then(res => res.json()).then(json => {
    if (json.success && json.data) {
      meetingState.transcript = json.data.transcript || meetingState.transcript;
      meetingState.clarifications = json.data.clarifications || meetingState.clarifications;
      meetingState.qualityScores = json.data.evaluation || meetingState.qualityScores;
      broadcastToTabs({
        type: 'SESSION_STATE_SYNC',
        payload: json.data
      });
    }
  }).catch(() => {});

  broadcastToTabs({
    type: 'CLARIFICATION_UPDATED',
    payload: {
      clarification,
      allClarifications: meetingState.clarifications
    }
  });
}

function broadcastToTabs(message) {
  // 1. Broadcast to all content script tabs (Google Meet, Zoom, Webapp)
  chrome.tabs?.query({}, (tabs) => {
    if (!tabs) return;
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    });
  });

  // 2. CRUCIAL: Also broadcast directly to extension views (Side Panel, Popup)
  chrome.runtime?.sendMessage(message).catch(() => {});
}
