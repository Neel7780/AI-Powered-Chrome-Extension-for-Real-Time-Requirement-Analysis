import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_session_lifecycle():
    # 1. Reset Session
    res = client.post("/api/session/reset")
    assert res.status_code == 200
    state = res.json()["data"]
    assert len(state["transcript"]) == 0
    assert len(state["clarifications"]) == 0

    # 2. Start Session
    res = client.post("/api/session/start", json={"title": "Sprint 10 Elicitation", "domain": "HR Tech"})
    assert res.status_code == 200
    state = res.json()["data"]
    assert state["sessionTitle"] == "Sprint 10 Elicitation"
    assert state["isActive"] is True

    # 3. Add Ambiguous Utterance
    res = client.post("/api/session/utterance", json={
        "speaker": "Hiring Manager",
        "text": "It shouldn't be slow. Response time per resume should ideally be quick.",
        "timestamp": "01:35"
    })
    assert res.status_code == 200
    state = res.json()["data"]
    assert len(state["transcript"]) == 1
    assert state["transcript"][0]["isAmbiguous"] is True
    assert len(state["clarifications"]) >= 1

    clar_id = state["clarifications"][0]["id"]

    # 4. Answer Clarification
    res = client.post("/api/session/clarify/answer", json={
        "clarificationId": clar_id,
        "selectedResponse": "Single resume parsing must be under 1.5s (95th percentile)."
    })
    assert res.status_code == 200
    state = res.json()["data"]
    answered = [c for c in state["clarifications"] if c.get("selectedResponse")]
    assert len(answered) >= 1

    # 5. Verify State
    res = client.get("/api/session/state")
    assert res.status_code == 200
    assert res.json()["data"]["stats"]["transcriptCount"] == 1
