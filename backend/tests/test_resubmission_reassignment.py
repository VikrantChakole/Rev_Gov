"""
Test suite for Resubmission Reassignment Workflow.
Verifies that when an application that was rejected or marked correction needed
is resubmitted by the citizen, it is automatically reassigned to the clerk who
reviewed / rejected it, placed in UNDER_REVIEW, and isolated to that clerk.
"""
import time
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from main import app
from app.core.database import SessionLocal
from app.models.db_models import User, Application, Citizen, Service
from app.api.routes.auth import _create_token, pwd_ctx

client = TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def auth_context(db: Session):
    """Create test users: Clerk 1, Clerk 2, and Citizen."""
    c1 = db.query(User).filter(User.username == "resub_clerk_1").first()
    if not c1:
        c1 = User(
            username="resub_clerk_1",
            hashed_password=pwd_ctx.hash("Pass123!"),
            role="DESK_CLERK",
            state="Maharashtra",
            first_name="Anita",
            last_name="Deshmukh",
        )
        db.add(c1)

    c2 = db.query(User).filter(User.username == "resub_clerk_2").first()
    if not c2:
        c2 = User(
            username="resub_clerk_2",
            hashed_password=pwd_ctx.hash("Pass123!"),
            role="DESK_CLERK",
            state="Maharashtra",
            first_name="Vikram",
            last_name="Shinde",
        )
        db.add(c2)

    cit = db.query(Citizen).filter(Citizen.citizen_ref == "CIT-TEST-RESUB-01").first()
    if not cit:
        cit = Citizen(
            citizen_ref="CIT-TEST-RESUB-01",
            name="Pooja Sharma",
            phone="9876501234",
            state="Maharashtra",
            nationality="Indian",
        )
        db.add(cit)

    srv = db.query(Service).filter(Service.id == "caste_certificate").first()
    if not srv:
        srv = Service(id="caste_certificate", name_en="Caste Certificate", department="Revenue")
        db.add(srv)

    db.commit()

    token_c1 = _create_token({"sub": "resub_clerk_1", "role": "DESK_CLERK"})
    token_c2 = _create_token({"sub": "resub_clerk_2", "role": "DESK_CLERK"})
    token_cit = _create_token({"sub": "CIT-TEST-RESUB-01", "role": "CITIZEN"})

    return {
        "clerk1": {"Authorization": f"Bearer {token_c1}"},
        "clerk2": {"Authorization": f"Bearer {token_c2}"},
        "citizen": {"Authorization": f"Bearer {token_cit}"},
    }


def test_rejected_application_resubmission_reassigns_to_clerk(db: Session, auth_context):
    """
    When Clerk 1 rejects an application, and the citizen resubmits via manual submit,
    the application must be reassigned to Clerk 1 and placed into UNDER_REVIEW.
    Clerk 1 must see it in their UNDER_REVIEW queue, while Clerk 2 must NOT.
    """
    app_num = f"CST-REJ-{int(time.time() * 1000) % 1000000}"
    app_rec = Application(
        application_number=app_num,
        tracking_id=app_num,
        citizen_ref="CIT-TEST-RESUB-01",
        service_id="caste_certificate",
        status="UNDER_REVIEW",
        assigned_to="resub_clerk_1",
    )
    db.add(app_rec)
    db.commit()
    db.refresh(app_rec)

    # 1. Clerk 1 rejects the application
    rej_res = client.post(
        f"/api/v1/applications/admin/{app_rec.id}/decision",
        headers=auth_context["clerk1"],
        json={"decision": "REJECT", "reason": "Address proof not legible, please provide clear copy"},
    )
    assert rej_res.status_code == 200
    assert rej_res.json()["new_status"] == "REJECTED"

    # Verify application recorded rejecting clerk
    db.refresh(app_rec)
    assert app_rec.status == "REJECTED"
    assert app_rec.assigned_to == "resub_clerk_1"
    assert app_rec.validation_summary.get("rejected_by") == "resub_clerk_1"

    # 2. Citizen rectifies and resubmits via manual-submit
    resub_res = client.post(
        f"/api/v1/applications/{app_rec.id}/manual-submit",
        headers=auth_context["citizen"],
        json={
            "declaration_confirmed": True,
            "service_id": "caste_certificate",
            "fields": {
                "name": "Pooja Sharma",
                "father_name": "Ramesh Sharma",
                "address": "Flat 402, Shiv Colony, Pune, Maharashtra",
            },
        },
    )
    assert resub_res.status_code == 200
    res_data = resub_res.json()
    assert res_data["status"] == "UNDER_REVIEW"
    assert res_data["assigned_to"] == "resub_clerk_1"

    # 3. Clerk 1 checks Under Review queue -> application IS visible
    q1_res = client.get(
        "/api/v1/applications/admin/list?status=UNDER_REVIEW&state=Maharashtra",
        headers=auth_context["clerk1"],
    )
    assert q1_res.status_code == 200
    apps_c1 = [a["application_number"] for a in q1_res.json()["applications"]]
    assert app_num in apps_c1

    # 4. Clerk 2 checks Under Review queue -> application is NOT visible
    q2_res = client.get(
        "/api/v1/applications/admin/list?status=UNDER_REVIEW&state=Maharashtra",
        headers=auth_context["clerk2"],
    )
    assert q2_res.status_code == 200
    apps_c2 = [a["application_number"] for a in q2_res.json()["applications"]]
    assert app_num not in apps_c2


def test_correction_needed_resubmission_via_automated_form_reassigns_to_clerk(db: Session, auth_context):
    """
    When Clerk 1 requests correction, and the citizen resubmits via automated form,
    the application must be reassigned to Clerk 1 and placed into UNDER_REVIEW.
    """
    app_num = f"CST-CORR-{int(time.time() * 1000) % 1000000}"
    app_rec = Application(
        application_number=app_num,
        tracking_id=app_num,
        citizen_ref="CIT-TEST-RESUB-01",
        service_id="caste_certificate",
        status="UNDER_REVIEW",
        assigned_to="resub_clerk_1",
    )
    db.add(app_rec)
    db.commit()
    db.refresh(app_rec)

    # 1. Clerk 1 requests correction
    corr_res = client.post(
        f"/api/v1/applications/admin/{app_rec.id}/decision",
        headers=auth_context["clerk1"],
        json={"decision": "CORRECTION_NEEDED", "reason": "Please correct spelling of father's name"},
    )
    assert corr_res.status_code == 200
    assert corr_res.json()["new_status"] == "CORRECTION_NEEDED"

    db.refresh(app_rec)
    assert app_rec.status == "CORRECTION_NEEDED"
    assert app_rec.assigned_to == "resub_clerk_1"

    # 2. Citizen resubmits via automated form submit
    resub_res = client.post(
        f"/api/v1/applications/automated/{app_rec.id}/submit",
        headers=auth_context["citizen"],
        json={
            "declaration_confirmed": True,
            "service_id": "caste_certificate",
            "fields": {
                "applicant_name": "Pooja Sharma",
                "father_name": "Rameshwar Sharma",
            },
        },
    )
    assert resub_res.status_code == 200
    res_data = resub_res.json()
    assert res_data["status"] == "UNDER_REVIEW"
    assert res_data["assigned_to"] == "resub_clerk_1"

    # 3. Verify in database
    db.refresh(app_rec)
    assert app_rec.status == "UNDER_REVIEW"
    assert app_rec.assigned_to == "resub_clerk_1"

    # 4. Verify Clerk 1 sees it in their UNDER_REVIEW list
    q1_res = client.get(
        "/api/v1/applications/admin/list?status=UNDER_REVIEW&state=Maharashtra",
        headers=auth_context["clerk1"],
    )
    assert q1_res.status_code == 200
    apps_c1 = [a["application_number"] for a in q1_res.json()["applications"]]
    assert app_num in apps_c1


def test_general_submit_endpoint_reassigns_to_clerk(db: Session, auth_context):
    """
    When an application in CORRECTION_NEEDED is resubmitted via POST /{id}/submit,
    it must also be reassigned to the previous clerk under UNDER_REVIEW.
    """
    app_num = f"CST-GEN-{int(time.time() * 1000) % 1000000}"
    app_rec = Application(
        application_number=app_num,
        tracking_id=app_num,
        citizen_ref="CIT-TEST-RESUB-01",
        service_id="caste_certificate",
        status="CORRECTION_NEEDED",
        assigned_to="resub_clerk_1",
        validation_summary={"rejected_by": "resub_clerk_1", "clarification_reason": "Update DOB"},
    )
    db.add(app_rec)
    db.commit()
    db.refresh(app_rec)

    # Citizen submits
    sub_res = client.post(f"/api/v1/applications/{app_rec.id}/submit")
    assert sub_res.status_code == 200
    assert sub_res.json()["status"] == "UNDER_REVIEW"
    assert sub_res.json()["assigned_to"] == "resub_clerk_1"

    db.refresh(app_rec)
    assert app_rec.status == "UNDER_REVIEW"
    assert app_rec.assigned_to == "resub_clerk_1"


def test_fresh_application_submission_remains_unassigned_submitted(db: Session, auth_context):
    """
    A fresh application being submitted for the first time should transition to SUBMITTED
    and have NO assigned clerk.
    """
    app_num = f"CST-FRESH-{int(time.time() * 1000) % 1000000}"
    app_rec = Application(
        application_number=app_num,
        tracking_id=app_num,
        citizen_ref="CIT-TEST-RESUB-01",
        service_id="caste_certificate",
        status="READY_FOR_REVIEW",
        assigned_to=None,
    )
    db.add(app_rec)
    db.commit()
    db.refresh(app_rec)

    # Citizen submits fresh application
    sub_res = client.post(f"/api/v1/applications/{app_rec.id}/submit")
    assert sub_res.status_code == 200
    assert sub_res.json()["status"] == "SUBMITTED"
    assert sub_res.json()["assigned_to"] is None

    db.refresh(app_rec)
    assert app_rec.status == "SUBMITTED"
    assert app_rec.assigned_to is None
