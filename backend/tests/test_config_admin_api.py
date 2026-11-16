import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from main import app
from app.core.database import SessionLocal
from app.models.db_models import User
from app.api.routes.auth import pwd_ctx, _create_token


@pytest.fixture
def db():
    db_session = SessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def admin_token(db: Session):
    admin = db.query(User).filter(User.username == "admin_test").first()
    if not admin:
        admin = User(
            username="admin_test",
            hashed_password=pwd_ctx.hash("admin123"),
            role="ADMIN",
            is_active=True,
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
    return _create_token({"sub": "admin_test", "role": "ADMIN"})


def test_get_message_config(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.get("/api/v1/admin/config/message", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    config = data["config"]
    assert "sms_provider" in config
    assert "whatsapp_provider" in config
    assert "triggers" in config
    assert "SUBMITTED" in config["triggers"]
    assert "APPROVED" in config["triggers"]
    assert "ESCALATED" in config["triggers"]
    assert "placeholders" in config


def test_update_message_config(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "sms_provider": "twilio",
        "sender_id": "MAHAGOV",
        "enable_sms": True,
    }
    response = client.post("/api/v1/admin/config/message", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["config"]["sms_provider"] == "twilio"
    assert data["config"]["sender_id"] == "MAHAGOV"


def test_test_message_dispatch(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "recipient_phone": "9876543210",
        "channel": "whatsapp",
        "trigger_event": "APPROVED",
        "language": "hi",
    }
    response = client.post("/api/v1/admin/config/message/test", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["status"] == "DELIVERED"
    assert data["channel"] == "whatsapp"
    assert "आवेदन स्वीकृत" in data["rendered_message"]


def test_get_ivr_config(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.get("/api/v1/admin/config/ivr", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    config = data["config"]
    assert "helpline_number" in config
    assert "dtmf_menu" in config
    assert "greetings" in config
    assert "en" in config["greetings"]
    assert "hi" in config["greetings"]
    assert "mr" in config["greetings"]


def test_update_ivr_config(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "helpline_number": "1800-222-9999",
        "fallback_action": "TRANSFER_TO_CLERK",
    }
    response = client.post("/api/v1/admin/config/ivr", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["config"]["helpline_number"] == "1800-222-9999"


def test_test_ivr_tts_synthesis(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    payload = {
        "text": "Welcome to Revenue Helpline test prompt",
        "language": "en",
    }
    response = client.post("/api/v1/admin/config/ivr/test-tts", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["audio_url"] is not None
    assert "/data/audio/ivr/" in data["audio_url"]
