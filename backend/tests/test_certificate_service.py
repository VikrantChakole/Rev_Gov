"""
Test Suite — PyMuPDF Certificate Generation and Download
Verifies authentic binary PDF generation, database linkage, and download endpoint.
"""
import os
import uuid
import pytest
import pymupdf
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from app.core.database import SessionLocal
from app.models.db_models import Citizen, Application, Certificate
from app.services.certificate_service import CertificateService


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


def test_pymupdf_certificate_generation(db: Session):
    """Verify that CertificateService generates a real, valid binary PDF via PyMuPDF."""
    cit = db.query(Citizen).filter(Citizen.citizen_ref == "CIT-TEST-CERT").first()
    if not cit:
        cit = Citizen(
            citizen_ref="CIT-TEST-CERT",
            name="Vikramaditya Shinde",
            phone="+919876543299",
            state="Maharashtra",
        )
        db.add(cit)
        db.commit()

    test_num = f"APP-CERT-{uuid.uuid4().hex[:6].upper()}"
    app_record = Application(
        application_number=test_num,
        tracking_id=f"DOM-{test_num}",
        citizen_ref=cit.citizen_ref,
        service_id="domicile_certificate",
        status="APPROVED",
    )
    db.add(app_record)
    db.commit()
    db.refresh(app_record)

    service = CertificateService(db)
    result = service.generate_and_store(str(app_record.id), cit.citizen_ref)

    assert result.get("success") is True
    file_path = result.get("file_ref")
    assert file_path is not None
    assert os.path.exists(file_path)

    # Validate file starts with %PDF magic bytes
    with open(file_path, "rb") as f:
        header = f.read(4)
        assert header == b"%PDF", "Certificate file must be a valid binary PDF"

    # Open with PyMuPDF to verify structure and content
    doc = pymupdf.open(file_path)
    assert len(doc) == 1, "Certificate must have 1 page"
    page_text = doc[0].get_text()
    assert "GOVERNMENT OF MAHARASHTRA" in page_text
    assert "REVENUE DEPARTMENT" in page_text
    assert "Vikramaditya Shinde" in page_text
    assert test_num in page_text
    doc.close()


def test_certificate_download_endpoint(client: TestClient, db: Session):
    """Verify GET /api/v1/applications/{id}/certificate serves the valid PDF."""
    cit = db.query(Citizen).filter(Citizen.citizen_ref == "CIT-TEST-DOWNLOAD").first()
    if not cit:
        cit = Citizen(
            citizen_ref="CIT-TEST-DOWNLOAD",
            name="Anjali Deshmukh",
            phone="+919876543298",
            state="Maharashtra",
        )
        db.add(cit)
        db.commit()

    test_num = f"APP-DL-{uuid.uuid4().hex[:6].upper()}"
    app_record = Application(
        application_number=test_num,
        tracking_id=f"INC-{test_num}",
        citizen_ref=cit.citizen_ref,
        service_id="income_certificate",
        status="COMPLETED",
    )
    db.add(app_record)
    db.commit()
    db.refresh(app_record)

    response = client.get(f"/api/v1/applications/{test_num}/certificate")
    assert response.status_code == 200
    assert response.headers.get("content-type") == "application/pdf"
    assert response.content.startswith(b"%PDF")
