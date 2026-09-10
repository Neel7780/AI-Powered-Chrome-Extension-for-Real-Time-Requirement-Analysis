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


def test_streaming_speech_continuation_deduplication():
    """
    Verifies that progressive streaming caption fragments (e.g. Meet word-by-word streaming)
    update the existing utterance and do NOT generate repeated duplicate clarification questions.
    """
    # 1. Start a new isolated meeting
    res_new = client.post("/api/meetings/new", json={"title": "Streaming Test", "domain": "HR Tech"})
    assert res_new.status_code == 200
    mid = res_new.json()["data"]["sessionId"]

    # 2. First streaming fragment with interim period
    res_1 = client.post("/api/session/utterance", json={
        "speaker": "Interviewer",
        "text": "Mainly skill."
    })
    assert res_1.status_code == 200
    state_1 = res_1.json()["data"]
    assert len(state_1["transcript"]) == 1
    assert len(state_1["clarifications"]) == 1

    # 3. Second streaming fragment extending the previous fragment
    res_2 = client.post("/api/session/utterance", json={
        "speaker": "Interviewer",
        "text": "Mainly skills exp."
    })
    assert res_2.status_code == 200
    state_2 = res_2.json()["data"]
    # Utterance must be merged/updated in place, NOT duplicated into 2 utterances
    assert len(state_2["transcript"]) == 1
    assert state_2["transcript"][0]["text"] == "Mainly skills exp."
    # Clarification question must NOT be duplicated!
    assert len(state_2["clarifications"]) == 1

    # 4. Third streaming fragment: completed sentence
    res_3 = client.post("/api/session/utterance", json={
        "speaker": "Interviewer",
        "text": "Mainly skills and experience should be weighted heavily."
    })
    assert res_3.status_code == 200
    state_3 = res_3.json()["data"]
    assert len(state_3["transcript"]) == 1
    assert state_3["transcript"][0]["text"] == "Mainly skills and experience should be weighted heavily."
    assert len(state_3["clarifications"]) == 1

    # Verify directly in SQLite DB
    full_db = db_manager.get_meeting_full(mid)
    assert len(full_db["transcript"]) == 1
    assert full_db["transcript"][0]["text"] == "Mainly skills and experience should be weighted heavily."
    assert len(full_db["clarifications"]) == 1


def test_clarification_answer_from_hud_persists_to_db_and_syncs():
    """
    Verifies that answering a clarification question from ANY client (In-Meeting HUD,
    Sidepanel, Web Dashboard) persists the response to SQLite DB and syncs across all views.
    """
    # 1. Start meeting
    res_start = client.post("/api/meetings/new", json={"title": "Clarification Persistence Test", "domain": "HR Tech"})
    assert res_start.status_code == 200
    mid = res_start.json()["data"]["sessionId"]

    # 2. Add an ambiguous statement
    res_utt = client.post("/api/session/utterance", json={
        "speaker": "Hiring Manager",
        "text": "The resume parsing must not be slow."
    })
    assert res_utt.status_code == 200
    state = res_utt.json()["data"]
    assert len(state["clarifications"]) >= 1
    server_q = state["clarifications"][0]

    # 3. Simulate HUD client answering using a client-generated ID with metadata
    res_ans = client.post("/api/session/clarify/answer", json={
        "clarificationId": "q-1725999-perf", # Client-side ID from HUD
        "question": server_q["question"],
        "triggeredBy": server_q["triggeredBy"],
        "category": server_q["category"],
        "selectedResponse": "Single resume parsing < 1.50s (p95) and batch of 100 resumes < 30.0s"
    })
    assert res_ans.status_code == 200
    state_ans = res_ans.json()["data"]

    # In-memory state must show question resolved!
    assert state_ans["stats"]["resolvedCount"] == 1
    answered_q = next(c for c in state_ans["clarifications"] if c["selectedResponse"])
    assert answered_q["selectedResponse"] == "Single resume parsing < 1.50s (p95) and batch of 100 resumes < 30.0s"

    # 4. Verify directly in SQLite database
    full_db = db_manager.get_meeting_full(mid)
    db_answered = [c for c in full_db["clarifications"] if c.get("selectedResponse")]
    assert len(db_answered) == 1
    assert db_answered[0]["selectedResponse"] == "Single resume parsing < 1.50s (p95) and batch of 100 resumes < 30.0s"

    # 5. GET /api/session/state confirms answered status
    res_state = client.get("/api/session/state")
    assert res_state.status_code == 200
    assert res_state.json()["data"]["stats"]["resolvedCount"] == 1


