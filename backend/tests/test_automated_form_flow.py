"""
Test Suite for Automated Form Filling (AI Assisted) Workflow
Validates:
1. LangGraph slot extraction and graph execution
2. State retrieval, dynamic progress calculation, and conversational intake
3. Isolated OCR extraction & separate storage
4. Field matching & comparison scoring
5. Discrepancy resolution (Keep Form vs Use OCR)
6. Final statutory declaration & application submission
"""
import io
import uuid
import pytest
from fastapi.testclient import TestClient

from main import app
from app.orchestration.langgraph_workflow import (
    automated_form_graph,
    extract_field_value,
    calculate_progress,
    get_required_fields_for_service,
)
from app.services.matching_service import MatchingService

client = TestClient(app)


@pytest.fixture
def auth_citizen():
    """Register and log in a dedicated citizen for automated form tests."""
    unique_suffix = uuid.uuid4().hex[:6]
    test_email = f"ai_citizen_{unique_suffix}@example.com"
    password = "SecurePassword123!"

    reg_resp = client.post("/api/v1/auth/citizen/register", json={
        "identifier": test_email,
        "password": password,
        "name": "Kunal Wandhare",
        "phone": f"+9199{unique_suffix.ljust(8, '0')[:8]}",
        "state": "Maharashtra",
        "nationality": "Indian",
        "address": "104 Shivaji Nagar, Nagpur, Maharashtra - 440010",
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


def test_langgraph_workflow_units():
    """Test unit level LangGraph extraction and progress computation."""
    # Test slot extraction
    assert extract_field_value("name", "My name is Kunal Wandhare") == "Kunal Wandhare"
    assert extract_field_value("father_name", "Father's name is Ramesh Wandhare") == "Ramesh Wandhare"
    assert extract_field_value("dob", "I was born on 15-06-2000") == "15-06-2000"
    assert extract_field_value("sex", "male") == "Male"
    assert extract_field_value("sex", "female") == "Female"
    assert extract_field_value("marital_status", "no unmarried") == "No"

    # Test progress computation
    chat_data = {
        "name": "Kunal Wandhare",
        "father_name": "Ramesh Wandhare",
        "mother_name": "Sunita Wandhare",
        "dob": "15-06-2000",
        "sex": "Male",
        "marital_status": "No",
        "address": "Nagpur",
    }
    progress = calculate_progress(chat_data, "caste_certificate", {})
    assert progress > 0
    assert progress <= 70

    # Test LangGraph invocation
    state = {
        "draft_id": "test_draft_1",
        "service_id": "caste_certificate",
        "messages": [],
        "chat_data": {},
        "ocr_data": {},
        "uploaded_documents": {},
        "comparison_scores": {},
        "pending_field": "name",
        "progress_percent": 0,
        "current_phase": "chat",
        "last_user_message": "Kunal Wandhare",
        "latest_assistant_response": "",
        "can_view_form": False,
    }
    res = automated_form_graph.invoke(state)
    assert res["chat_data"].get("name") == "Kunal Wandhare"
    assert res["pending_field"] == "father_name"


def test_matching_service_comparison():
    """Test MatchingService comparing chat_data vs OCR extracted data."""
    matching_service = MatchingService()
    chat_data = {
        "name": "Kunal Wandhare",
        "dob": "15-06-2000",
        "sex": "Male",
        "address": "104 Shivaji Nagar Nagpur",
    }
    ocr_data = {
        "applicant_name": "Kunal Wandhare",
        "dob": "15-06-2000",
        "gender": "Male",
        "address": "104 Shivaji Nagar Nagpur Maharashtra",
    }
    result = matching_service.compare_document(chat_data, ocr_data)
    assert result.overall_score >= 90.0
    assert "applicant_name" in result.matched_fields


def test_automated_form_end_to_end_api(auth_citizen):
    """
    Test the full automated form filling lifecycle through FastAPI:
    1. Create draft application
    2. Retrieve automated state
    3. Send chat turns (Name, Father's Name, DOB, etc.)
    4. Upload document & verify isolated OCR extraction and match scoring
    5. Resolve field discrepancy
    6. Direct inline field editing
    7. Submit application with declaration
    """
    headers = auth_citizen["headers"]

    # 1. Create temporary draft
    create_resp = client.post("/api/v1/applications/draft", json={
        "service_id": "caste_certificate",
        "channel": "WEB_AUTOMATED_AI",
    }, headers=headers)
    assert create_resp.status_code == 200, create_resp.text
    draft_id = create_resp.json()["draft_id"]

    # 2. Get initial automated state
    state_resp = client.get(f"/api/v1/applications/automated/{draft_id}/state", headers=headers)
    assert state_resp.status_code == 200, state_resp.text
    state_data = state_resp.json()
    assert state_data["success"] is True
    assert state_data["draft_id"] == draft_id
    assert state_data["state"]["pending_field"] == "name"

    # 3. Send chat response for Name
    chat_resp1 = client.post(f"/api/v1/applications/automated/{draft_id}/chat", json={
        "message": "My full name is Kunal Wandhare",
    }, headers=headers)
    assert chat_resp1.status_code == 200, chat_resp1.text
    chat_data1 = chat_resp1.json()
    assert chat_data1["chat_data"]["name"] == "Kunal Wandhare"
    assert chat_data1["pending_field"] == "father_name"

    # Send chat response for Father's Name
    chat_resp2 = client.post(f"/api/v1/applications/automated/{draft_id}/chat", json={
        "message": "Ramesh Wandhare",
    }, headers=headers)
    assert chat_resp2.status_code == 200, chat_resp2.text
    chat_data2 = chat_resp2.json()
    assert chat_data2["chat_data"]["father_name"] == "Ramesh Wandhare"
    assert chat_data2["pending_field"] == "mother_name"

    # 4. Upload mock document (Aadhaar Card)
    fake_pdf = b"%PDF-1.4 Mock Aadhaar Document with Kunal Wandhare Date of Birth: 15-06-2000 Male 1234 5678 9012"
    upload_resp = client.post(
        f"/api/v1/applications/automated/{draft_id}/upload-document",
        data={"doc_type": "identity_proof"},
        files={"file": ("aadhaar_sample.pdf", io.BytesIO(fake_pdf), "application/pdf")},
        headers=headers,
    )
    assert upload_resp.status_code == 200, upload_resp.text
    upload_data = upload_resp.json()
    assert upload_data["success"] is True
    assert "ocr_result" in upload_data
    assert upload_data["document"]["doc_type"] == "identity_proof"

    # 4b. Upload Signature and Passport Photo (must bypass OCR)
    fake_img = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00"
    sig_resp = client.post(
        f"/api/v1/applications/automated/{draft_id}/upload-document",
        data={"doc_type": "signature"},
        files={"file": ("applicant_signature.jpg", io.BytesIO(fake_img), "image/jpeg")},
        headers=headers,
    )
    assert sig_resp.status_code == 200, sig_resp.text
    sig_data = sig_resp.json()
    assert sig_data["success"] is True
    assert sig_data["ocr_result"]["provider"] == "bypassed"
    assert sig_data["ocr_result"]["confidence"] == 1.0
    assert sig_data["document"]["doc_type"] == "signature"

    photo_resp = client.post(
        f"/api/v1/applications/automated/{draft_id}/upload-document",
        data={"doc_type": "passport_image"},
        files={"file": ("passport_photo.jpg", io.BytesIO(fake_img), "image/jpeg")},
        headers=headers,
    )
    assert photo_resp.status_code == 200, photo_resp.text
    photo_data = photo_resp.json()
    assert photo_data["success"] is True
    assert photo_data["ocr_result"]["provider"] == "bypassed"
    assert photo_data["ocr_result"]["confidence"] == 1.0
    assert photo_data["document"]["doc_type"] == "passport_image"

    # 5. Resolve Field Discrepancy test
    resolve_resp = client.post(
        f"/api/v1/applications/automated/{draft_id}/resolve-field",
        json={
            "field_name": "name",
            "chosen_source": "CHAT",
        },
        headers=headers,
    )
    assert resolve_resp.status_code == 200, resolve_resp.text
    resolve_data = resolve_resp.json()
    assert resolve_data["success"] is True

    # 6. Inline field edit test
    edit_resp = client.post(
        f"/api/v1/applications/automated/{draft_id}/update-form-field",
        json={
            "field_name": "address",
            "value": "104 Shivaji Nagar, Nagpur, Maharashtra - 440010",
        },
        headers=headers,
    )
    assert edit_resp.status_code == 200, edit_resp.text
    edit_data = edit_resp.json()
    assert edit_data["value"] == "104 Shivaji Nagar, Nagpur, Maharashtra - 440010"

    # 7. Submit without declaration should fail (400)
    fail_submit = client.post(
        f"/api/v1/applications/automated/{draft_id}/submit",
        json={"declaration_confirmed": False},
        headers=headers,
    )
    assert fail_submit.status_code == 400

    # Submit with declaration confirmed
    success_submit = client.post(
        f"/api/v1/applications/automated/{draft_id}/submit",
        json={
            "declaration_confirmed": True,
            "fields": {
                "name": "Kunal Wandhare",
                "father_name": "Ramesh Wandhare",
                "mother_name": "Sunita Wandhare",
                "dob": "15-06-2000",
                "sex": "Male",
                "marital_status": "No",
                "address": "104 Shivaji Nagar, Nagpur, Maharashtra - 440010",
            }
        },
        headers=headers,
    )
    assert success_submit.status_code == 200, success_submit.text
    sub_data = success_submit.json()
    assert sub_data["success"] is True
    assert sub_data["status"] == "SUBMITTED"
    assert "tracking_id" in sub_data
    assert "citizen_id" in sub_data
    assert "certificate_id" in sub_data
