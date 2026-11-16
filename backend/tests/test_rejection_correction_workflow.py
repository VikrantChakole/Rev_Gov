import os
import io
import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.database import SessionLocal, get_db
from app.models.db_models import User, Citizen, Application, Document, AuditLog
from app.orchestration.state_machine.application_fsm import AppState
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

def test_clerk_rejects_document_and_application_citizen_updates_and_resubmits(db_session):
    repo = ApplicationRepository(db_session)

    # 1. Create Citizen User and Token
    citizen_ref = "CIT_TEST_REJECT_99"
    citizen = db_session.query(Citizen).filter(Citizen.citizen_ref == citizen_ref).first()
    if not citizen:
        citizen = Citizen(
            citizen_ref=citizen_ref,
            phone="9876543299",
            name="Ramesh Test Kumar",
            state="Maharashtra",
            email="ramesh99@example.com",
            address="Flat 101, Test Residency, Pune",
        )
        db_session.add(citizen)
        db_session.commit()
        db_session.refresh(citizen)

    citizen_token = _create_token({"sub": citizen.phone, "role": "CITIZEN", "citizen_ref": citizen.citizen_ref})
    citizen_headers = {"Authorization": f"Bearer {citizen_token}"}

    # Create Clerk User in DB and Token
    clerk = db_session.query(User).filter(User.username == "clerk_desk_01").first()
    if not clerk:
        clerk = User(
            username="clerk_desk_01",
            hashed_password="mock_password",
            role="DESK_CLERK",
            is_active=True,
        )
        db_session.add(clerk)
        db_session.commit()
        db_session.refresh(clerk)

    clerk_token = _create_token({"sub": "clerk_desk_01", "username": "clerk_desk_01", "role": "DESK_CLERK"})
    clerk_headers = {"Authorization": f"Bearer {clerk_token}"}

    # 2. Citizen creates a draft application
    create_res = client.post(
        "/api/v1/applications/draft",
        json={"service_id": "domicile_certificate", "channel": "WEB_MANUAL"},
        headers=citizen_headers,
    )
    assert create_res.status_code == 200, create_res.text
    draft_data = create_res.json()
    draft_id = draft_data["draft_id"]

    # 3. Citizen uploads documents (identity_proof, residential_proof, signature, passport_image)
    pdf_bytes = b"%PDF-1.4 test dummy content"
    upload_res = client.post(
        f"/api/v1/applications/{draft_id}/upload-document",
        data={"doc_type": "identity_proof", "doc_subtype": "Aadhaar card"},
        files={"file": ("aadhaar.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        headers=citizen_headers,
    )
    assert upload_res.status_code == 200

    upload_res2 = client.post(
        f"/api/v1/applications/{draft_id}/upload-document",
        data={"doc_type": "residential_proof", "doc_subtype": "Electricity Bill"},
        files={"file": ("bill.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        headers=citizen_headers,
    )
    assert upload_res2.status_code == 200

    # 4. Citizen submits manual application
    submit_res = client.post(
        f"/api/v1/applications/{draft_id}/manual-submit",
        json={
            "service_id": "domicile_certificate",
            "fields": {
                "applicant_name": "Ramesh Test Kumar",
                "father_name": "Suresh Kumar",
                "mother_name": "Sunita Devi",
                "date_of_birth": "1992-05-15",
                "sex": "Male",
                "marital_status": "No",
                "address": "Flat 101, Test Residency, Pune",
                "years_of_residence": "12",
                "identity_proof_type": "Aadhaar card",
                "residential_proof_type": "Electricity Bill",
            },
            "declaration_confirmed": True,
        },
        headers=citizen_headers,
    )
    assert submit_res.status_code == 200, submit_res.text
    assert submit_res.json()["status"] == "SUBMITTED"

    # 5. Desk Clerk verifies documents and REJECTS identity_proof
    app_db = repo.get_by_id(draft_id)
    doc_aadhaar = db_session.query(Document).filter(Document.application_id == app_db.id, Document.doc_type == "identity_proof").first()
    assert doc_aadhaar is not None

    verify_doc_res = client.post(
        f"/api/v1/applications/{app_db.id}/documents/{doc_aadhaar.id}/verify",
        json={"status": "REJECTED", "notes": "Aadhaar card image is blurred and unreadable. Please re-upload clear color scan."},
        headers=clerk_headers,
    )
    assert verify_doc_res.status_code == 200, verify_doc_res.text

    # Desk clerk rejects the application
    reject_app_res = client.post(
        f"/api/v1/applications/admin/{app_db.id}/decision",
        json={
            "decision": "REJECT",
            "reason": "Identity proof document rejected due to poor image clarity. Please rectify and re-upload.",
            "admin_notes": "Aadhaar unreadable, rejected by clerk",
        },
        headers=clerk_headers,
    )
    assert reject_app_res.status_code == 200, reject_app_res.text
    assert reject_app_res.json()["new_status"] == "REJECTED"

    # 6. Citizen checks /my-applications
    my_apps_res = client.get("/api/v1/applications/my-applications", headers=citizen_headers)
    assert my_apps_res.status_code == 200
    apps_list = my_apps_res.json()["applications"]
    target_app = next((a for a in apps_list if a["id"] == app_db.id), None)
    assert target_app is not None
    assert target_app["status"] == "REJECTED"
    assert target_app["has_rejected_documents"] is True
    assert "identity_proof" in target_app["rejected_doc_types"]
    assert "Identity proof document rejected" in (target_app["clerk_notes"] or target_app["rejection_reason"])

    # 7. Citizen opens application detail / GET /{id} (for form population)
    app_detail_res = client.get(f"/api/v1/applications/{app_db.id}", headers=citizen_headers)
    assert app_detail_res.status_code == 200
    app_detail = app_detail_res.json()
    assert app_detail["slots_data"] is not None
    assert app_detail["slots_data"].get("applicant_name") == "Ramesh Test Kumar"
    assert app_detail["has_rejected_documents"] is True
    assert "identity_proof" in app_detail["rejected_doc_types"]
    assert app_detail["clerk_notes"] is not None

    # Check that identity_proof document has status REJECTED and rejection_notes
    id_doc_in_response = next((d for d in app_detail["documents"] if d["doc_type"] == "identity_proof"), None)
    assert id_doc_in_response is not None
    assert id_doc_in_response["verification_status"] == "REJECTED"
    assert "blurred and unreadable" in id_doc_in_response["rejection_notes"]

    # 8. Citizen re-uploads identity_proof
    new_pdf_bytes = b"%PDF-1.4 clear high quality scan"
    reupload_res = client.post(
        f"/api/v1/applications/{app_db.id}/upload-document",
        data={"doc_type": "identity_proof", "doc_subtype": "Aadhaar card"},
        files={"file": ("aadhaar_clear.pdf", io.BytesIO(new_pdf_bytes), "application/pdf")},
        headers=citizen_headers,
    )
    assert reupload_res.status_code == 200

    # 9. Verify that after re-upload, document status is EXTRACTED and rejection reason is cleared
    app_detail_res2 = client.get(f"/api/v1/applications/{app_db.id}", headers=citizen_headers)
    app_detail2 = app_detail_res2.json()
    id_doc_updated = next((d for d in app_detail2["documents"] if d["doc_type"] == "identity_proof"), None)
    assert id_doc_updated["verification_status"] in ("EXTRACTED", "PENDING")
    assert id_doc_updated["rejection_notes"] is None
    assert app_detail2["has_rejected_documents"] is False

    # 10. Citizen re-submits application
    resubmit_res = client.post(
        f"/api/v1/applications/{app_db.id}/manual-submit",
        json={
            "service_id": "domicile_certificate",
            "fields": {
                "applicant_name": "Ramesh Test Kumar",
                "father_name": "Suresh Kumar",
                "mother_name": "Sunita Devi",
                "date_of_birth": "1992-05-15",
                "sex": "Male",
                "marital_status": "No",
                "address": "Flat 101, Test Residency, Pune",
                "years_of_residence": "12",
                "identity_proof_type": "Aadhaar card",
                "residential_proof_type": "Electricity Bill",
            },
            "declaration_confirmed": True,
        },
        headers=citizen_headers,
    )
    assert resubmit_res.status_code == 200
    assert resubmit_res.json()["status"] == "SUBMITTED"

    # Application is now back in SUBMITTED state with audit log
    db_session.expire_all()
    final_app = repo.get_by_id(app_db.id)
    assert final_app.status == AppState.SUBMITTED
