import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

SAMPLE_TRANSCRIPT_STR = """
Hiring Manager: We need to build an AI-based resume analyzer.
ML Engineer: We have past resumes and hiring decisions, but they're not very structured.
Hiring Manager: It shouldn't be slow. Response time per resume should ideally be quick.
Hiring Manager: It should be good enough so that HR trusts it.
Hiring Manager: Yes, we must avoid bias, especially related to gender or college background.
Hiring Manager: We need an MVP soon.
"""

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "service" in data

def test_analyze_endpoint():
    response = client.post("/analyze", json={"transcript": SAMPLE_TRANSCRIPT_STR})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "baseline" in data
    assert "metrics" in data
    assert len(data["ambiguities"]) > 0

def test_clarify_endpoint():
    response = client.post("/clarify", json={"transcript": SAMPLE_TRANSCRIPT_STR})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert len(data["questions"]) > 0

def test_refine_endpoint():
    payload = {
        "transcript": SAMPLE_TRANSCRIPT_STR,
        "questions": ["What is the latency SLO?"],
        "responses": ["Single resume < 1.5s p95"],
        "clarifications": [
            {
                "id": "q-perf-01",
                "category": "Performance",
                "question": "What is the latency SLO?",
                "selectedResponse": "Single resume parsing must be under 1.5s (95th percentile)."
            }
        ]
    }
    response = client.post("/refine", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "refined" in data
    assert "metrics" in data

def test_compare_endpoint():
    base_res = client.post("/analyze", json={"transcript": SAMPLE_TRANSCRIPT_STR}).json()["baseline"]
    ref_res = client.post("/refine", json={
        "transcript": SAMPLE_TRANSCRIPT_STR,
        "clarifications": [
            {"id": "q-perf-01", "category": "Performance", "selectedResponse": "Under 1.5s"}
        ]
    }).json()["refined"]

    response = client.post("/compare", json={"baseline": base_res, "refined": ref_res})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "delta" in data
    assert "baseline_metrics" in data
    assert "refined_metrics" in data

def test_export_txt_endpoint():
    response = client.post("/export/txt", json={
        "title": "Test Report",
        "transcript": SAMPLE_TRANSCRIPT_STR
    })
    assert response.status_code == 200
    assert "Test Report" in response.text

def test_export_json_endpoint():
    response = client.post("/export/json", json={
        "title": "Test Report JSON",
        "transcript": SAMPLE_TRANSCRIPT_STR
    })
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Report JSON"
