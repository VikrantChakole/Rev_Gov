"""
Test Suite for New Application Draft Lifecycle, Manual Form Submission, and Discard Flow.
"""
import io
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from app.core.database import SessionLocal, engine, Base
from app.models.db_models import User, Citizen, Application, Document

client = TestClient(app)


@pytest.fixture
def auth_citizen():
    """Register and log in a dedicated citizen for manual form tests."""
    unique_suffix = uuid.uuid4().hex[:6]
    test_email = f"manual_citizen_{unique_suffix}@example.com"
    password = "SecurePassword123!"

    reg_resp = client.post("/api/v1/auth/citizen/register", json={
        "identifier": test_email,
        "password": password,
        "name": "Ramesh Pawar",
        "phone": f"+9198{unique_suffix.ljust(8, '0')[:8]}",
        "state": "Maharashtra",
        "nationality": "Indian",
        "address": "42, Shanti Nagar, Pune, Maharashtra - 411001",
    })
    assert reg_resp.status_code == 200, reg_resp.text
    data = reg_resp.json()
    token = data["access_token"]
    citizen_id = data["citizen_id"]
    return {
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
        "citizen_id": citizen_id,
        "citizen": data,
    }


def test_draft_create_and_discard(auth_citizen):
    """
    Test clicking New Application -> creates temporary draft -> clicking cancel discards it.
    """
    headers = auth_citizen["headers"]

    # 1. Create temporary draft
    resp = client.post("/api/v1/applications/draft", json={
        "service_id": "caste_certificate",
        "channel": "WEB_MANUAL",
    }, headers=headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["success"] is True
    assert data["status"] == "DRAFT"
    assert data["service_id"] == "caste_certificate"
    draft_id = data["draft_id"]
    assert data["tracking_id"] is not None
    assert data["certificate_id"] is not None

    # 2. Cancel/discard temporary draft
    del_resp = client.delete(f"/api/v1/applications/{draft_id}/draft", headers=headers)
    assert del_resp.status_code == 200, del_resp.text
    del_data = del_resp.json()
    assert del_data["success"] is True

    # 3. Verify it is discarded from database
    lookup = client.get(f"/api/v1/applications/{draft_id}", headers=headers)
    assert lookup.status_code == 404


def test_draft_update_service(auth_citizen):
    """
    Test switching certificate type in modal updates draft service_id.
    """
    headers = auth_citizen["headers"]

    # 1. Create draft with default caste_certificate
    resp = client.post("/api/v1/applications/draft", json={
        "service_id": "caste_certificate",
    }, headers=headers)
    assert resp.status_code == 200
    draft_id = resp.json()["draft_id"]

    # 2. Update to domicile_certificate
    patch_resp = client.patch(f"/api/v1/applications/{draft_id}/draft", json={
        "service_id": "domicile_certificate",
    }, headers=headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["service_id"] == "domicile_certificate"

    # Clean up
    client.delete(f"/api/v1/applications/{draft_id}/draft", headers=headers)


def test_upload_document_and_manual_submit(auth_citizen):
    """
    Test full manual form flow:
    - Create draft
    - Upload identity proof, residential proof, age proof, signature, passport image
    - Verify declaration validation
    - Submit application -> status moves to SUBMITTED
    """
    headers = auth_citizen["headers"]

    # 1. Create draft
    resp = client.post("/api/v1/applications/draft", json={
        "service_id": "income_certificate",
    }, headers=headers)
    assert resp.status_code == 200
    draft_id = resp.json()["draft_id"]

    # 2. Upload an identity proof file
    dummy_file = io.BytesIO(b"%PDF-1.4 dummy identity proof content")
    upload_resp = client.post(
        f"/api/v1/applications/{draft_id}/upload-document",
        data={"doc_type": "identity_proof", "doc_subtype": "Aadhaar card"},
        files={"file": ("aadhaar_test.pdf", dummy_file, "application/pdf")},
        headers=headers,
    )
    assert upload_resp.status_code == 200, upload_resp.text
    upload_data = upload_resp.json()
    assert upload_data["success"] is True
    assert "ocr_result" in upload_data
    assert upload_data["ocr_result"]["bypassed"] is False
    assert "extracted_fields" in upload_data["ocr_result"]
    assert upload_data["document"]["verification_status"] == "EXTRACTED"
    doc_id = upload_data["document"]["id"]

    # 3. Test delete document endpoint
    del_doc_resp = client.delete(f"/api/v1/applications/{draft_id}/documents/{doc_id}", headers=headers)
    assert del_doc_resp.status_code == 200
    assert del_doc_resp.json()["success"] is True

    # 4. Upload photo/signature -> verify OCR is bypassed and status remains PENDING
    photo_file = io.BytesIO(b"fake photo data")
    photo_resp = client.post(
        f"/api/v1/applications/{draft_id}/upload-document",
        data={"doc_type": "passport_image"},
        files={"file": ("photo.jpg", photo_file, "image/jpeg")},
        headers=headers,
    )
    assert photo_resp.status_code == 200
    photo_data = photo_resp.json()
    assert photo_data["success"] is True
    assert photo_data["ocr_result"]["bypassed"] is True
    assert photo_data["document"]["verification_status"] == "PENDING"

    # 5. Re-upload document
    dummy_file2 = io.BytesIO(b"%PDF-1.4 fresh proof")
    upload_resp2 = client.post(
        f"/api/v1/applications/{draft_id}/upload-document",
        data={"doc_type": "identity_proof", "doc_subtype": "PAN card"},
        files={"file": ("pan_test.pdf", dummy_file2, "application/pdf")},
        headers=headers,
    )
    assert upload_resp2.status_code == 200

    # 5. Attempt manual submit without declaration -> must fail with 400
    fail_submit = client.post(f"/api/v1/applications/{draft_id}/manual-submit", json={
        "service_id": "income_certificate",
        "fields": {"applicant_name": "Ramesh Pawar"},
        "declaration_confirmed": False,
    }, headers=headers)
    assert fail_submit.status_code == 400
    assert "statutory declaration" in fail_submit.text.lower()

    # 6. Submit with declaration -> must succeed and transition to SUBMITTED
    sub_resp = client.post(f"/api/v1/applications/{draft_id}/manual-submit", json={
        "service_id": "income_certificate",
        "fields": {
            "applicant_name": "Ramesh Pawar",
            "father_name": "Suresh Pawar",
            "mother_name": "Sunita Pawar",
            "date_of_birth": "1995-05-12",
            "sex": "Male",
            "marital_status": "No",
            "address": "42, Shanti Nagar, Pune, Maharashtra - 411001",
            "purpose_of_certificate": "Higher Education Scholarship",
        },
        "declaration_confirmed": True,
    }, headers=headers)
    assert sub_resp.status_code == 200, sub_resp.text
    sub_data = sub_resp.json()
    assert sub_data["success"] is True
    assert sub_data["status"] == "SUBMITTED"
    assert sub_data["tracking_id"] is not None
    assert sub_data["citizen_id"] is not None
    assert sub_data["certificate_id"] is not None

    # 7. Check application status via status endpoint
    status_resp = client.get(f"/api/v1/applications/status/{sub_data['tracking_id']}", headers=headers)
    assert status_resp.status_code == 200
    assert status_resp.json()["application"]["status"] == "SUBMITTED"


def test_get_active_draft(auth_citizen):
    """
    Test GET /api/v1/applications/active-draft:
    - Returns has_draft: false when citizen has no draft
    - Returns has_draft: true with draft details when citizen creates a draft
    - Returns has_draft: false again after draft is discarded or submitted
    """
    headers = auth_citizen["headers"]

    # 1. Initial state: no draft
    resp = client.get("/api/v1/applications/active-draft", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_draft"] is False
    assert data["draft"] is None

    # 2. Create a temporary draft
    draft_resp = client.post("/api/v1/applications/draft", json={
        "service_id": "domicile_certificate",
    }, headers=headers)
    assert draft_resp.status_code == 200
    draft_id = draft_resp.json()["draft_id"]

    # 3. Check active-draft again: must return the active draft
    active_resp = client.get("/api/v1/applications/active-draft", headers=headers)
    assert active_resp.status_code == 200
    active_data = active_resp.json()
    assert active_data["has_draft"] is True
    assert active_data["draft"]["id"] == draft_id
    assert active_data["draft"]["service_id"] == "domicile_certificate"
    assert active_data["draft"]["status"] == "DRAFT"

    # 4. Discard the draft
    del_resp = client.delete(f"/api/v1/applications/{draft_id}/draft", headers=headers)
    assert del_resp.status_code == 200

    # 5. Check active-draft again: must be false
    final_resp = client.get("/api/v1/applications/active-draft", headers=headers)
    assert final_resp.status_code == 200
    assert final_resp.json()["has_draft"] is False


def test_get_application_by_id(auth_citizen):
    """
    Test GET /api/v1/applications/{application_id}:
    - Create draft
    - Query by UUID -> returns application details
    - Discard draft
    - Query by UUID -> returns 404
    """
    headers = auth_citizen["headers"]

    # 1. Create draft
    resp = client.post("/api/v1/applications/draft", json={
        "service_id": "caste_certificate",
    }, headers=headers)
    assert resp.status_code == 200
    draft_id = resp.json()["draft_id"]

    # 2. Get by ID
    get_resp = client.get(f"/api/v1/applications/{draft_id}", headers=headers)
    assert get_resp.status_code == 200, get_resp.text
    data = get_resp.json()
    assert data["id"] == draft_id
    assert data["service_id"] == "caste_certificate"
    assert data["status"] == "DRAFT"
    assert data["tracking_id"] is not None
    assert data["certificate_id"] is not None

    # 3. Clean up
    del_resp = client.delete(f"/api/v1/applications/{draft_id}/draft", headers=headers)
    assert del_resp.status_code == 200

    # 4. Verify 404 after deletion
    lookup = client.get(f"/api/v1/applications/{draft_id}", headers=headers)
    assert lookup.status_code == 404


