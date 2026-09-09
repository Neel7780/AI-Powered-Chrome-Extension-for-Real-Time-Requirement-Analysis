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


def test_meeting_end_and_persist_to_sqlite_db():
    # 1. Start a dedicated meeting session
    res_start = client.post("/api/meetings/new", json={"title": "Q3 Architecture Review", "domain": "HR Tech"})
    assert res_start.status_code == 200
    mid = res_start.json()["data"]["sessionId"]

    # 2. Transcribe speech
    res_utt = client.post("/api/session/utterance", json={
        "text": "The candidate scoring pipeline must be ultra responsive and extremely reliable.",
        "speaker": "Principal Architect"
    })
    assert res_utt.status_code == 200
    state = res_utt.json()["data"]
    assert len(state["transcript"]) == 1
    assert len(state["clarifications"]) > 0

    # Answer clarification
    clar_id = state["clarifications"][0]["id"]
    res_ans = client.post("/api/session/clarify/answer", json={
        "clarificationId": clar_id,
        "selectedResponse": "Candidate pipeline execution must complete in under 500ms at 99.9% uptime."
    })
    assert res_ans.status_code == 200

    # 3. Explicitly End the meeting session to store everything in SQLite DB
    res_end = client.post("/api/session/end")
    assert res_end.status_code == 200
    end_data = res_end.json()
    assert end_data["success"] is True
    assert end_data["data"]["isFinalized"] is True
    assert end_data["data"]["isActive"] is False
    assert end_data["data"]["isRecording"] is False

    # 4. Verify directly in SQLite database via DatabaseManager
    full_db_record = db_manager.get_meeting_full(mid)
    assert full_db_record is not None
    assert full_db_record["id"] == mid
    assert full_db_record["isFinalized"] is True
    assert full_db_record["isActive"] is False
    assert len(full_db_record["transcript"]) == 1
    assert full_db_record["transcript"][0]["text"] == "The candidate scoring pipeline must be ultra responsive and extremely reliable."
    assert len(full_db_record["clarifications"]) >= 1
    answered = [c for c in full_db_record["clarifications"] if c.get("selectedResponse")]
    assert len(answered) >= 1
    # Check that requirements cache was persisted to SQLite
    assert len(full_db_record["refined"]["frs"]) > 0 or len(full_db_record["refined"]["nfrs"]) > 0

