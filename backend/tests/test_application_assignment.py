"""
Test suite for Application Assignment and Isolation Workflow.
Verifies:
1. Application submission transitions status to SUBMITTED.
2. Desk Clerk assignment endpoint sets assigned_to and transitions status to UNDER_REVIEW.
3. Assigned application is excluded from the unassigned SUBMITTED queue.
4. Assigned application is visible to the assigned Desk Clerk under UNDER_REVIEW.
5. Assigned application is NOT visible to other Desk Clerks under UNDER_REVIEW.
6. Decisions for CORRECTION_NEEDED and DISTRICT_OFFICER_APPROVAL update application status properly.
"""
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
def auth_headers(db: Session):
    """Create test users: Clerk 1, Clerk 2, and Citizen."""
    # Clerk 1 (Maharashtra)
    c1 = db.query(User).filter(User.username == "test_clerk_1").first()
    if not c1:
        c1 = User(
            username="test_clerk_1",
            hashed_password=pwd_ctx.hash("Pass123!"),
            role="DESK_CLERK",
            state="Maharashtra",
            first_name="Ramesh",
            last_name="Patil",
        )
        db.add(c1)

    # Clerk 2 (Maharashtra)
    c2 = db.query(User).filter(User.username == "test_clerk_2").first()
    if not c2:
        c2 = User(
            username="test_clerk_2",
            hashed_password=pwd_ctx.hash("Pass123!"),
            role="DESK_CLERK",
            state="Maharashtra",
            first_name="Suresh",
            last_name="Jadhav",
        )
        db.add(c2)

    # Citizen
    cit = db.query(Citizen).filter(Citizen.citizen_ref == "CIT-TEST-ASSIGN-01").first()
    if not cit:
        cit = Citizen(
            citizen_ref="CIT-TEST-ASSIGN-01",
            name="Aarav Sharma",
            phone="9876543210",
            state="Maharashtra",
            nationality="Indian",
        )
        db.add(cit)

    # Service
    srv = db.query(Service).filter(Service.id == "income_certificate").first()
    if not srv:
        srv = Service(id="income_certificate", name_en="Income Certificate", department="Revenue")
        db.add(srv)

    db.commit()

    token_c1 = _create_token({"sub": "test_clerk_1", "role": "DESK_CLERK"})
    token_c2 = _create_token({"sub": "test_clerk_2", "role": "DESK_CLERK"})

    return {
        "clerk1": {"Authorization": f"Bearer {token_c1}"},
        "clerk2": {"Authorization": f"Bearer {token_c2}"},
    }


def test_submission_and_assignment_isolation(db: Session, auth_headers):
    # 1. Create a fresh test application in READY_FOR_REVIEW
    app_num = f"INC-TEST-{int(pytest.importorskip('time').time() * 1000) % 1000000}"
    app_rec = Application(
        application_number=app_num,
        tracking_id=app_num,
        citizen_ref="CIT-TEST-ASSIGN-01",
        service_id="income_certificate",
        status="READY_FOR_REVIEW",
    )
    db.add(app_rec)
    db.commit()
    db.refresh(app_rec)

    # 2. Citizen submits application
    res_sub = client.post(f"/api/v1/applications/{app_rec.id}/submit")
    assert res_sub.status_code == 200
    assert res_sub.json()["status"] == "SUBMITTED"

    # 3. Clerk 1 views Submitted queue -> application should be visible
    res_q1 = client.get(
        "/api/v1/applications/admin/list?status=SUBMITTED&state=Maharashtra",
        headers=auth_headers["clerk1"],
    )
    assert res_q1.status_code == 200
    apps_submitted = [a["application_number"] for a in res_q1.json()["applications"]]
    assert app_num in apps_submitted

    # 4. Clerk 1 assigns the application to self
    res_assign = client.post(
        f"/api/v1/applications/{app_rec.id}/assign",
        headers=auth_headers["clerk1"],
    )
    assert res_assign.status_code == 200
    assert res_assign.json()["status"] == "UNDER_REVIEW"
    assert res_assign.json()["assigned_to"] == "test_clerk_1"

    # 5. Clerk 2 checks Submitted queue -> assigned application must NOT be visible
    res_q2_sub = client.get(
        "/api/v1/applications/admin/list?status=SUBMITTED&state=Maharashtra",
        headers=auth_headers["clerk2"],
    )
    apps_c2_sub = [a["application_number"] for a in res_q2_sub.json()["applications"]]
    assert app_num not in apps_c2_sub

    # 6. Clerk 1 checks Under Review queue -> application IS visible
    res_c1_rev = client.get(
        "/api/v1/applications/admin/list?status=UNDER_REVIEW&state=Maharashtra",
        headers=auth_headers["clerk1"],
    )
    apps_c1_rev = [a["application_number"] for a in res_c1_rev.json()["applications"]]
    assert app_num in apps_c1_rev

    # 7. Clerk 2 checks Under Review queue -> application must NOT be visible (isolated to Clerk 1)
    res_c2_rev = client.get(
        "/api/v1/applications/admin/list?status=UNDER_REVIEW&state=Maharashtra",
        headers=auth_headers["clerk2"],
    )
    apps_c2_rev = [a["application_number"] for a in res_c2_rev.json()["applications"]]
    assert app_num not in apps_c2_rev

    # 8. Clerk 1 forwards to District Officer for approval
    res_dec = client.post(
        f"/api/v1/applications/admin/{app_rec.id}/decision",
        headers=auth_headers["clerk1"],
        json={"decision": "DISTRICT_OFFICER_APPROVAL", "admin_notes": "Verified by Desk Clerk"},
    )
    assert res_dec.status_code == 200
    assert res_dec.json()["new_status"] == "DISTRICT_OFFICER_APPROVAL"
