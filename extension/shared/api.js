/**
 * API Client for Chrome Extension
 * Connects to localhost:3000 backend with seamless fallback to client-side NLP and evaluation.
 */

const DEFAULT_SERVER_URL = 'http://localhost:3000';

class ExtensionAPI {
  constructor() {
    this.serverUrl = DEFAULT_SERVER_URL;
  }

  async setServerUrl(url) {
    this.serverUrl = url || DEFAULT_SERVER_URL;
  }

  async checkServerHealth() {
    try {
      const res = await fetch(`${this.serverUrl}/api/health`, { method: 'GET' });
      const data = await res.json();
      return { online: true, data };
    } catch {
      return { online: false };
    }
  }

  async analyzeUtterance(text, speaker, timestamp) {
    try {
      const res = await fetch(`${this.serverUrl}/api/analyze/utterance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speaker, timestamp })
      });
      const json = await res.json();
      if (json.success) return json.data;
    } catch {
      // Offline fallback
    }

    if (window.ClientNLPEngine) {
      return window.ClientNLPEngine.analyzeUtterance(text, speaker, timestamp);
    }
    return { text, speaker, timestamp, isAmbiguous: false, ambiguityScore: 0, detectedFlags: [] };
  }

  async generateRequirements(utterances, clarifications, domain) {
    try {
      const res = await fetch(`${this.serverUrl}/api/requirements/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utterances, clarifications, domain })
      });
      const json = await res.json();
      if (json.success) return json.data;
    } catch {
      // Backend offline
    }
    return null;
  }

  async evaluateRequirements(baseline, refined) {
    try {
      const res = await fetch(`${this.serverUrl}/api/evaluate/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseline, refined })
      });
      const json = await res.json();
      if (json.success) return json.data;
    } catch {
      // Backend offline
    }
    return null;
  }

  async exportDocument(type, payload) {
    const res = await fetch(`${this.serverUrl}/api/export/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
    return await res.blob();
  }
}

if (typeof window !== 'undefined') {
  window.ExtensionAPI = new ExtensionAPI();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = new ExtensionAPI();
}
