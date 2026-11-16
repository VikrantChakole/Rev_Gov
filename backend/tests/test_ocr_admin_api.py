import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from main import app
from app.core.database import SessionLocal
from app.models.db_models import User
from app.api.routes.auth import pwd_ctx, _create_token
from PIL import Image, ImageDraw


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


def test_get_ocr_config(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.get("/api/v1/admin/ocr/config", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    config = data["config"]
    assert "active_provider" in config
    assert "effective_provider" in config
    assert "tesseract" in config
    assert "vision_ai" in config
    assert "pdf_engine" in config


def test_update_ocr_config(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.post(
        "/api/v1/admin/ocr/config",
        headers=headers,
        json={
            "provider": "auto",
            "tesseract_cmd": "C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["config"]["active_provider"] == "auto"


def test_admin_ocr_test_endpoint(client, admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    # Create sample image
    img = Image.new('RGB', (400, 150), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.text((20, 30), "Name: Rajesh Sharma", fill=(0, 0, 0))
    draw.text((20, 70), "DOB: 10/10/1985", fill=(0, 0, 0))
    
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="PNG")
    img_bytes.seek(0)
    
    response = client.post(
        "/api/v1/admin/ocr/test",
        headers=headers,
        files={"file": ("test_doc.png", img_bytes, "image/png")},
        data={"doc_type": "identity_proof"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    diagnostics = data["diagnostics"]
    assert "provider_used" in diagnostics
    assert "execution_time_ms" in diagnostics
    assert "extracted_fields" in diagnostics
    assert "raw_text" in diagnostics
    assert "Rajesh" in diagnostics["raw_text"] or diagnostics["extracted_fields"].get("applicant_name") == "Rajesh Sharma"
