"""
Tests for Payment Simulation Gateway and OCR Confidence Score Calculation
"""
import pytest
import uuid
import datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from app.core.database import SessionLocal
from app.models.db_models import User, Citizen, Service, Application, Document
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


def _ensure_citizen_and_service(db: Session, citizen_ref: str = "CIT-PAY-1001"):
    citizen = db.query(Citizen).filter(Citizen.citizen_ref == citizen_ref).first()
    if not citizen:
        citizen = Citizen(
            citizen_ref=citizen_ref,
            name="Test Citizen",
            phone="+919876543210",
            email="citizen@test.gov",
        )
        db.add(citizen)
        db.commit()

    svc = db.query(Service).filter(Service.id == "income_certificate").first()
    if not svc:
        svc = Service(
            id="income_certificate",
            name_en="Income Certificate",
            name_mr="उत्पन्न प्रमाणपत्र",
        )
        db.add(svc)
        db.commit()

    return citizen, svc


@pytest.fixture
def desk_clerk_token(db: Session):
    clerk = db.query(User).filter(User.username == "clerk_test_conf").first()
    if not clerk:
        clerk = User(
            username="clerk_test_conf",
            hashed_password=pwd_ctx.hash("clerk123"),
            role="DESK_CLERK",
            is_active=True,
            first_name="Test",
            last_name="Clerk",
        )
        db.add(clerk)
        db.commit()
        db.refresh(clerk)
    return _create_token(
        {"sub": clerk.username, "username": clerk.username, "role": clerk.role}
    )


def test_payment_simulate_success_flow(db: Session, client: TestClient):
    """Verify payment simulation endpoint updates status and returns receipt."""
    cit, svc = _ensure_citizen_and_service(db, "CIT-PAY-FLOW-01")
    test_app_id = str(uuid.uuid4())
    test_app_num = f"PAY-TEST-{uuid.uuid4().hex[:6].upper()}"

    app_record = Application(
        id=test_app_id,
        application_number=test_app_num,
        service_id=svc.id,
        status="PAYMENT_REQUIRED",
        payment_status="PENDING",
        citizen_ref=cit.citizen_ref,
        validation_summary={},
    )
    db.add(app_record)
    db.commit()

    # 1. Simulate payment using application_number
    res = client.post(
        f"/api/v1/payment/simulate-success/{test_app_num}",
        json={
            "payment_method": "UPI",
            "payment_mode": "UPI (test@upi)",
            "notes": "Test payment simulation",
        },
    )

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["payment_status"] == "PAID"
    assert "receipt_number" in data
    assert data["receipt_number"].startswith("MH-TREAS-")
    assert "txn_id" in data
    assert data["amount"] == 50.0
    assert data["payment_mode"] == "UPI (test@upi)"

    # Check DB state
    db.expire_all()
    updated = db.query(Application).filter(Application.id == test_app_id).first()
    assert updated.payment_status == "PAID"
    assert updated.validation_summary.get("payment_receipt") is not None
    assert (
        updated.validation_summary["payment_receipt"]["receipt_number"]
        == data["receipt_number"]
    )


def test_payment_simulate_success_by_uuid(db: Session, client: TestClient):
    """Verify payment simulation endpoint works directly with UUID."""
    cit, svc = _ensure_citizen_and_service(db, "CIT-PAY-UUID-02")
    test_app_id = str(uuid.uuid4())
    app_record = Application(
        id=test_app_id,
        application_number=f"PAY-UUID-{uuid.uuid4().hex[:6].upper()}",
        service_id=svc.id,
        status="PAYMENT_REQUIRED",
        payment_status="PENDING",
        citizen_ref=cit.citizen_ref,
    )
    db.add(app_record)
    db.commit()

    res = client.post(
        f"/api/v1/payment/simulate-success/{test_app_id}",
        json={
            "payment_method": "CARD",
            "payment_mode": "RuPay Card (•••• 1234)",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["payment_status"] == "PAID"


def test_ocr_confidence_score_formatting(
    db: Session, client: TestClient, desk_clerk_token: str
):
    """Verify clerk application detail formats OCR confidence score and level."""
    cit, svc = _ensure_citizen_and_service(db, "CIT-CONF-03")
    test_app_id = str(uuid.uuid4())
    test_app_num = f"CONF-TEST-{uuid.uuid4().hex[:6].upper()}"

    app_record = Application(
        id=test_app_id,
        application_number=test_app_num,
        service_id=svc.id,
        status="UNDER_REVIEW",
        payment_status="PENDING",
        citizen_ref=cit.citizen_ref,
    )
    db.add(app_record)
    db.flush()

    # Add document with confidence score 0.94 (float 0-1)
    doc1 = Document(
        id=str(uuid.uuid4()),
        application_id=test_app_id,
        doc_type="RATION_CARD",
        file_ref="uploads/test_ration.jpg",
        extracted_fields={"head_of_family": "Ramesh Kumar"},
        confidence_score=0.94,
        normalization_confidence={"head_of_family": 0.96},
    )
    # Add document with confidence score 72 (percentage)
    doc2 = Document(
        id=str(uuid.uuid4()),
        application_id=test_app_id,
        doc_type="SALARY_SLIP",
        file_ref="uploads/test_salary.pdf",
        extracted_fields={"monthly_income": "45000"},
        confidence_score=72.0,
        normalization_confidence={"monthly_income": 0.72},
    )
    db.add_all([doc1, doc2])
    db.commit()

    # Call admin application detail endpoint
    headers = {"Authorization": f"Bearer {desk_clerk_token}"}
    res = client.get(
        f"/api/v1/applications/admin/{test_app_id}", headers=headers
    )
    assert res.status_code == 200
    data = res.json()
    docs = data.get("documents", [])
    assert len(docs) == 2

    # Verify doc1 (0.94 -> 94.0%, HIGH)
    doc1_res = next(d for d in docs if d["id"] == doc1.id)
    assert doc1_res["confidence_score"] == 94.0
    assert doc1_res["confidence_level"] == "HIGH"
    assert "normalization_confidence" in doc1_res

    # Verify doc2 (72.0% -> 72.0%, MEDIUM)
    doc2_res = next(d for d in docs if d["id"] == doc2.id)
    assert doc2_res["confidence_score"] == 72.0
    assert doc2_res["confidence_level"] == "MEDIUM"
