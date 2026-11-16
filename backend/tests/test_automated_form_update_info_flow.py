import os
import io
import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.database import SessionLocal
from app.models.db_models import User, Citizen, Application, Document, ApplicationData
from app.api.routes.auth import _create_token
from app.data_layer.repositories.application_repo import ApplicationRepository

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_automated_form_prepopulates_particulars_and_handles_rejected_docs(db_session):
    repo = ApplicationRepository(db_session)

    # 1. Create Citizen User and Token
    citizen_ref = "CIT_TEST_AUTO_FILL_88"
    citizen = db_session.query(Citizen).filter(Citizen.citizen_ref == citizen_ref).first()
    if not citizen:
        citizen = Citizen(
            citizen_ref=citizen_ref,
            phone="9876543288",
            name="Sneha Ramesh Patil",
            state="Maharashtra",
            email="sneha88@example.com",
            address="Shivaji Road, Pune, Maharashtra",
        )
        db_session.add(citizen)
        db_session.commit()
        db_session.refresh(citizen)

    citizen_token = _create_token({"sub": citizen.phone, "role": "CITIZEN", "citizen_ref": citizen.citizen_ref})
    citizen_headers = {"Authorization": f"Bearer {citizen_token}"}

    # Create Clerk User and Token
    clerk = db_session.query(User).filter(User.username == "clerk_auto_test").first()
    if not clerk:
        clerk = User(
            username="clerk_auto_test",
            hashed_password="mock_password",
            role="DESK_CLERK",
            is_active=True,
        )
        db_session.add(clerk)
        db_session.commit()
        db_session.refresh(clerk)

    clerk_token = _create_token({"sub": "clerk_auto_test", "username": "clerk_auto_test", "role": "DESK_CLERK"})
    clerk_headers = {"Authorization": f"Bearer {clerk_token}"}

    # 2. Citizen creates draft application
    create_res = client.post(
        "/api/v1/applications/draft",
        json={"service_id": "domicile_certificate", "channel": "WEB_MANUAL"},
        headers=citizen_headers,
    )
    assert create_res.status_code == 200, create_res.text
    draft_id = create_res.json()["draft_id"]

    # 3. Upload documents
    pdf_dummy = b"%PDF-1.4 dummy file content"
    for doc_type in ["identity_proof", "residential_proof", "age_proof"]:
        res_up = client.post(
            f"/api/v1/applications/{draft_id}/upload-document",
            data={"doc_type": doc_type, "doc_subtype": "Official Document"},
            files={"file": (f"{doc_type}.pdf", io.BytesIO(pdf_dummy), "application/pdf")},
            headers=citizen_headers,
        )
        assert res_up.status_code == 200

    # 4. Citizen submits manual application with 8 particulars
    submit_res = client.post(
        f"/api/v1/applications/{draft_id}/manual-submit",
        json={
            "service_id": "domicile_certificate",
            "fields": {
                "applicant_name": "Sneha Ramesh Patil",
                "father_name": "Ramesh Patil",
                "mother_name": "Suman Patil",
                "date_of_birth": "1994-08-20",
                "sex": "Female",
                "marital_status": "No",
                "residential_address": "Flat 4B, Shivaji Road, Pune",
                "residence_years": "15",
            },
            "declaration_confirmed": True,
        },
        headers=citizen_headers,
    )
    assert submit_res.status_code == 200

    # 5. Desk clerk rejects identity_proof and rejects application
    app_db = repo.get_by_id(draft_id)
    doc_id_proof = db_session.query(Document).filter(
        Document.application_id == app_db.id, Document.doc_type == "identity_proof"
    ).first()
    assert doc_id_proof is not None

    reject_doc_res = client.post(
        f"/api/v1/applications/{app_db.id}/documents/{doc_id_proof.id}/verify",
        json={"status": "REJECTED", "notes": "Identity document is expired and cropped. Please re-upload full scan."},
        headers=clerk_headers,
    )
    assert reject_doc_res.status_code == 200

    reject_app_res = client.post(
        f"/api/v1/applications/admin/{app_db.id}/decision",
        json={
            "decision": "REJECT",
            "reason": "Identity proof expired and rejected by clerk.",
            "admin_notes": "Aadhaar cropped and unreadable",
        },
        headers=clerk_headers,
    )
    assert reject_app_res.status_code == 200

    # 6. Citizen clicks "AI Assisted Fill" -> triggers GET /applications/automated/{draft_id}/state
    auto_state_res = client.get(
        f"/api/v1/applications/automated/{app_db.id}/state",
        headers=citizen_headers,
    )
    assert auto_state_res.status_code == 200, f"Failed with: {auto_state_res.text}"
    state_payload = auto_state_res.json()
    assert state_payload["success"] is True
    session_state = state_payload["state"]

    # Verify particulars are pre-populated (Extracted Particulars)
    chat_data = session_state.get("chat_data", {})
    assert chat_data.get("name") == "Sneha Ramesh Patil"
    assert chat_data.get("father_name") == "Ramesh Patil"
    assert chat_data.get("mother_name") == "Suman Patil"
    assert chat_data.get("dob") == "1994-08-20"
    assert chat_data.get("sex") == "Female"
    assert chat_data.get("marital_status") == "No"
    assert chat_data.get("address") == "Flat 4B, Shivaji Road, Pune"
    assert chat_data.get("years_of_residence") == "15"

    # Verify rejected documents are highlighted and tracked
    assert "identity_proof" in session_state.get("rejected_docs", [])
    assert "Identity document is expired" in session_state["uploaded_documents"]["identity_proof"]["rejection_notes"]
    assert "cropped and unreadable" in (session_state.get("clerk_notes") or session_state.get("rejection_reason"))

    # Verify assistant message has Reviewing Officer Feedback Notice
    messages = session_state.get("messages", [])
    assert any("Reviewing Officer Feedback" in m.get("content", "") for m in messages)

    # 7. Citizen attempts to submit without re-uploading rejected document -> should be blocked
    bad_submit = client.post(
        f"/api/v1/applications/automated/{app_db.id}/submit",
        json={"declaration_confirmed": True, "service_id": "domicile_certificate"},
        headers=citizen_headers,
    )
    assert bad_submit.status_code == 400
    assert "re-upload your rejected document" in bad_submit.json()["detail"]

    # 8. Citizen re-uploads the rejected identity_proof document
    reupload_res = client.post(
        f"/api/v1/applications/automated/{app_db.id}/upload-document",
        data={"doc_type": "identity_proof"},
        files={"file": ("identity_proof_valid.pdf", io.BytesIO(pdf_dummy), "application/pdf")},
        headers=citizen_headers,
    )
    assert reupload_res.status_code == 200, reupload_res.text
    reup_data = reupload_res.json()
    assert "identity_proof" not in reup_data.get("rejected_docs", [])
    assert reup_data.get("can_view_form") is True

    # 9. Now final submission succeeds and reassigns application under review
    final_submit = client.post(
        f"/api/v1/applications/automated/{app_db.id}/submit",
        json={"declaration_confirmed": True, "service_id": "domicile_certificate"},
        headers=citizen_headers,
    )
    assert final_submit.status_code == 200, final_submit.text
    assert final_submit.json()["status"] == "UNDER_REVIEW"
    assert final_submit.json()["assigned_to"] == "clerk_auto_test"

