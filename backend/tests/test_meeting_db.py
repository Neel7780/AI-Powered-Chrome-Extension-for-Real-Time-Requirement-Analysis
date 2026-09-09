import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.database import db_manager
from backend.app.services.session_manager import session_manager

client = TestClient(app)

def test_meeting_db_lifecycle_and_chat_isolation():
    # 1. Start a meeting A
    res_a = client.post("/api/meetings/new", json={"title": "Sprint Planning Meeting A", "domain": "HR Tech"})
    assert res_a.status_code == 200
    state_a = res_a.json()["data"]
    mid_a = state_a["sessionId"]
    assert state_a["transcript"] == []
    assert state_a["clarifications"] == []

    # 2. Add utterance to meeting A
    res_utt_a = client.post("/api/session/utterance", json={
        "text": "The candidate search should be fast and solid.",
        "speaker": "Engineering Lead"
    })
    assert res_utt_a.status_code == 200
    state_a_updated = res_utt_a.json()["data"]
    assert len(state_a_updated["transcript"]) == 1
    assert len(state_a_updated["clarifications"]) > 0

    # 3. Start a brand new meeting B (MUST HAVE CLEAN ISOLATED STATE, NO OLD CHATS!)
    res_b = client.post("/api/meetings/new", json={"title": "Interview Meeting B", "domain": "HR Tech"})
    assert res_b.status_code == 200
    state_b = res_b.json()["data"]
    mid_b = state_b["sessionId"]
    assert mid_b != mid_a
    # Ensure old chats from meeting A do not leak into meeting B!
    assert state_b["transcript"] == []
    assert state_b["clarifications"] == []

    # 4. List meetings and verify both exist in SQLite DB
    res_list = client.get("/api/meetings")
    assert res_list.status_code == 200
    meetings = res_list.json()["data"]
    meeting_ids = [m["id"] for m in meetings]
    assert mid_a in meeting_ids
    assert mid_b in meeting_ids

    # 5. Switch back to meeting A from SQLite DB
    res_switch = client.post(f"/api/meetings/{mid_a}/switch")
    assert res_switch.status_code == 200
    state_a_restored = res_switch.json()["data"]
    assert state_a_restored["sessionId"] == mid_a
    assert len(state_a_restored["transcript"]) == 1
    assert state_a_restored["transcript"][0]["text"] == "The candidate search should be fast and solid."
