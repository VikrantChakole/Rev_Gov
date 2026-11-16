"""
Test Suite — Escalation Workflow & Tab Status Counts
Verifies citizen escalation endpoint, state machine transition, and desk clerk directory filtering & counts.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from app.core.database import SessionLocal
from app.models.db_models import Citizen, Application, Escalation, User
from app.orchestration.state_machine.application_fsm import AppState
from app.api.routes.auth import pwd_ctx, _create_token
from app.data_layer.repositories.application_repo import ApplicationRepository


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
def clerk_token(db: Session):
    clerk = db.query(User).filter(User.username == "clerk_maha_test").first()
    if not clerk:
        clerk = User(
            username="clerk_maha_test",
            hashed_password=pwd_ctx.hash("clerk123"),
            role="DESK_CLERK",
            state="Maharashtra",
            is_active=True,
        )
        db.add(clerk)
        db.commit()
    return _create_token({"sub": "clerk_maha_test", "role": "DESK_CLERK", "state": "Maharashtra"})


def test_cannot_escalate_draft(client: TestClient, db: Session):
    """Verify that unsubmitted DRAFT applications cannot be escalated."""
    cit = Citizen(
        citizen_ref=f"CIT-ESC-DRAFT-{uuid.uuid4().hex[:6]}",
        name="Draft Citizen",
        phone="+919988776655",
        state="Maharashtra",
    )
    db.add(cit)
    db.commit()

    test_num = f"APP-DRAFT-{uuid.uuid4().hex[:6].upper()}"
    draft_app = Application(
        application_number=test_num,
        citizen_ref=cit.citizen_ref,
        service_id="income_certificate",
        status="DRAFT",
    )
    db.add(draft_app)
    db.commit()

    res = client.post(
        f"/api/v1/applications/{test_num}/escalate",
        json={"reason": "Need urgent resolution"},
    )
    assert res.status_code == 400
    assert "Cannot escalate an unsubmitted draft" in res.json().get("detail", "")


def test_escalate_submitted_application(client: TestClient, db: Session, clerk_token: str):
    """Verify escalating a submitted application creates an Escalation record and transitions status to ESCALATED."""
    cit = Citizen(
        citizen_ref=f"CIT-ESC-SUB-{uuid.uuid4().hex[:6]}",
        name="Sunil Patil",
        phone="+919988776656",
        state="Maharashtra",
    )
    db.add(cit)
    db.commit()

    test_num = f"APP-SUB-{uuid.uuid4().hex[:6].upper()}"
    app_record = Application(
        application_number=test_num,
        tracking_id=f"INC-{test_num}",
        citizen_ref=cit.citizen_ref,
        service_id="income_certificate",
        status="SUBMITTED",
    )
    db.add(app_record)
    db.commit()
    db.refresh(app_record)

    reason = "Officer verification pending beyond 7 working days"
    res = client.post(
        f"/api/v1/applications/{test_num}/escalate",
        json={"reason": reason, "priority": "HIGH"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["status"] == "ESCALATED"
    assert data["ticket_id"].startswith("ESC-")

    # Verify in DB
    db.refresh(app_record)
    assert app_record.status == "ESCALATED"

    esc = db.query(Escalation).filter(Escalation.application_id == app_record.id).first()
    assert esc is not None
    assert esc.reason == reason
    assert esc.priority == "HIGH"
    assert esc.status == "OPEN"

    # Verify Desk Clerk can view this in status=ESCALATED
    headers = {"Authorization": f"Bearer {clerk_token}"}
    res_list = client.get(
        "/api/v1/applications/admin/list?status=ESCALATED&state=Maharashtra",
        headers=headers,
    )
    assert res_list.status_code == 200
    list_data = res_list.json()
    app_numbers = [a["application_number"] for a in list_data.get("applications", [])]
    assert test_num in app_numbers

    # Verify status_counts is included in the response
    assert "status_counts" in list_data
    counts = list_data["status_counts"]
    assert "ESCALATED" in counts
    assert counts["ESCALATED"] >= 1
