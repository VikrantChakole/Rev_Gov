"""
Unit and Integration Tests for Demo Presentation Endpoints,
Risk Scoring Engine, and Speech Adapter Service.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from app.core.database import SessionLocal
from app.services.risk_scoring_service import RiskScoringService
from app.services.stt_tts_adapter import SpeechAdapterService

client = TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_risk_scoring_engine_low_risk():
    """Test RiskScoringService produces LOW risk score when fields and documents match."""
    app_data = {"applicant_name": "Rajesh Sharma", "annual_income": "48000"}
    documents = [{
        "doc_type": "IDENTITY_PROOF",
        "confidence_score": 0.98,
        "extracted_fields": {"applicant_name": "Rajesh Sharma", "annual_income": "48000"}
    }]
    result = RiskScoringService.evaluate_application(app_data, documents)
    assert result.score == 0
    assert result.category == "LOW"
    assert len(result.signals) == 0


def test_risk_scoring_engine_name_mismatch():
    """Test RiskScoringService flags name mismatch with HIGH risk category."""
    app_data = {"applicant_name": "Rajesh Sharma"}
    documents = [{
        "doc_type": "IDENTITY_PROOF",
        "confidence_score": 0.95,
        "extracted_fields": {"applicant_name": "Rajesh K. Sharma"}
    }]
    result = RiskScoringService.evaluate_application(app_data, documents)
    assert result.score >= 25
    assert result.category in ("MEDIUM", "HIGH")
    assert any(s.code == "NAME_MISMATCH" for s in result.signals)


def test_speech_adapter_stt_and_tts():
    """Test Malayalam STT transcription and TTS audio synthesis adapters."""
    svc = SpeechAdapterService()
    
    # High quality audio STT
    res_high = svc.transcribe_audio(b"1234567890" * 15000)
    assert res_high["confidence"] >= 0.75
    assert not res_high["requires_confirmation"]

    # Low quality audio STT (triggers confirmation prompt)
    res_low = svc.transcribe_audio(b"123")
    assert res_low["confidence"] < 0.75
    assert res_low["requires_confirmation"]
    assert res_low["confirmation_prompt"] is not None

    # TTS Synthesis
    tts_res = svc.generate_tts_audio("നമസ്കാരം", language="ml")
    assert tts_res["status"] == "ok"
    assert tts_res["audio_url"].startswith("/data/audio/")

    # Evaluation Metrics
    metrics = svc.get_evaluation_metrics()
    assert metrics["word_error_rate_ml"] < 0.10
    assert len(metrics["samples"]) >= 2


def test_demo_quick_seed_endpoint():
    """Test POST /api/v1/demo/quick-seed initializes a complete Income application."""
    payload = {
        "citizen_name": "Rajesh Sharma",
        "phone": "+919876543210",
        "email": "rajesh.sharma@example.com",
        "annual_income": 48000,
        "district": "Ernakulam",
        "language": "ml"
    }
    response = client.post("/api/v1/demo/quick-seed", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["status"] == "ok"
    assert data["application_number"].startswith("APP-") or data["application_number"].startswith("REV-")
    assert data["app_status"] == "FINAL_REVIEW"


def test_demo_trigger_mismatch_endpoint():
    """Test POST /api/v1/demo/trigger-mismatch injects document mismatch into app."""
    # First quick-seed
    seed_res = client.post("/api/v1/demo/quick-seed", json={"citizen_name": "Rajesh Sharma", "phone": "+919876543210"}).json()
    app_num = seed_res["application_number"]

    # Trigger mismatch
    response = client.post(f"/api/v1/demo/trigger-mismatch?application_number={app_num}")
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["status"] == "ok"
    assert data["match_score"] < 100.0
    assert data["ocr_extracted_name"] == "Rajesh K. Sharma"


def test_officer_dashboard_endpoint():
    """Test GET /api/v1/dashboard/officer returns queue of applications for review."""
    # Quick seed an application first
    client.post("/api/v1/demo/quick-seed", json={"citizen_name": "Rajesh Sharma", "phone": "+919876543210"})

    response = client.get("/api/v1/dashboard/officer")
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["status"] == "ok"
    assert data["count"] >= 1
    assert len(data["submitted_applications"]) >= 1
