"""
Demo Command Center Routes — Hackathon Presentation API Controls
Provides 1-click presentation controls for evaluators during the live demo:
- Quick seed Income Certificate application
- Trigger Aadhaar OCR name mismatch scenario
- Simulate payment callback failure / timeout & retry
- Fetch Malayalam voice speech metrics & audio sample evaluation
"""
import uuid
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.db_models import User, Citizen, Application, Document, Payment, ApplicationData, ChannelIdentity
from app.data_layer.repositories.application_repo import ApplicationRepository
from app.data_layer.repositories.citizen_repo import CitizenRepository
from app.services.risk_scoring_service import RiskScoringService
from app.services.stt_tts_adapter import SpeechAdapterService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/demo", tags=["demo"])


class QuickSeedRequest(BaseModel):
    citizen_name: str = "Rajesh Sharma"
    phone: str = "+919876543210"
    email: str = "rajesh.sharma@example.com"
    annual_income: int = 48000
    district: str = "Ernakulam"
    language: str = "ml"


class OverrideMismatchRequest(BaseModel):
    application_number: str
    field_name: str = "applicant_name"
    resolution: str = "USE_APPLICATION"  # USE_APPLICATION | USE_OCR | MANUAL
    manual_value: Optional[str] = None
    override_reason: str = "Transliteration variation verified by officer"


@router.post("/quick-seed")
def quick_seed_application(
    body: QuickSeedRequest,
    db: Session = Depends(get_db)
):
    """
    1-Click Demo Trigger: Creates a fully-populated Income Certificate application record
    ready for review, payment, and certificate issuance.
    """
    cit_repo = CitizenRepository(db)
    app_repo = ApplicationRepository(db)

    # 1. Resolve or create citizen
    citizen = cit_repo.resolve_or_create(
        identifier=body.phone,
        name=body.citizen_name,
        preferred_channel="WEB"
    )
    citizen.email = body.email
    citizen.preferred_language = body.language
    db.commit()

    # 2. Create Application
    app = app_repo.create(
        citizen_ref=citizen.citizen_ref,
        service_id="income_certificate",
        channel_origin="WEB"
    )
    app.status = "FINAL_REVIEW"
    app.progress_percent = 70
    app.consent_given = True
    db.commit()

    # 3. Form fields
    fields = {
        "applicant_name": body.citizen_name,
        "phone": body.phone,
        "email": body.email,
        "annual_income": str(body.annual_income),
        "district": body.district,
        "purpose": "Higher Education Fee Concession",
    }
    for field_name, val in fields.items():
        app_repo.save_field(app.id, field_name=field_name, field_value=val, confirmed=True)

    # 4. Mock uploaded document
    doc = app_repo.save_document(
        application_id=app.id,
        doc_type="IDENTITY_PROOF",
        file_ref="data/uploads/demo_aadhaar.png",
        raw_ocr_text=f"Government of India Aadhaar Card Name: {body.citizen_name} DOB: 15/03/1990",
        raw_extracted_fields={"applicant_name": body.citizen_name, "dob": "15/03/1990"},
        normalized_fields={"applicant_name": body.citizen_name, "dob": "15/03/1990"},
        overall_match_score=100.0,
        matched_fields=["applicant_name", "dob"],
        verification_status="VERIFIED"
    )

    # 5. Evaluate risk score
    risk_res = RiskScoringService.evaluate_application(
        app_data=fields,
        documents=[{"doc_type": "IDENTITY_PROOF", "confidence_score": 0.98, "extracted_fields": {"applicant_name": body.citizen_name}}]
    )
    app.anomaly_score = float(risk_res.score) / 100.0
    db.commit()

    return {
        "status": "ok",
        "message": "Demo Income Certificate application seeded successfully",
        "citizen_id": citizen.citizen_ref,
        "application_number": app.application_number,
        "tracking_id": app.tracking_id,
        "app_status": app.status,
        "risk_score": risk_res.score,
        "risk_category": risk_res.category,
    }


@router.post("/trigger-mismatch")
def trigger_mismatch_scenario(
    application_number: str,
    db: Session = Depends(get_db)
):
    """
    1-Click Demo Trigger: Injects an OCR name mismatch into an application to demonstrate
    discrepancy detection & side-by-side resolution UI.
    """
    app_repo = ApplicationRepository(db)
    app = app_repo.get_by_number(application_number)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    # Ingest document with mismatched name "Rajesh K. Sharma" vs declared "Rajesh Sharma"
    doc = app_repo.save_document(
        application_id=app.id,
        doc_type="IDENTITY_PROOF",
        file_ref="data/uploads/demo_mismatched_aadhaar.png",
        raw_ocr_text="Government of India Aadhaar Card Name: Rajesh K. Sharma DOB: 15/03/1990",
        raw_extracted_fields={"applicant_name": "Rajesh K. Sharma", "dob": "15/03/1990"},
        normalized_fields={"applicant_name": "Rajesh K. Sharma", "dob": "15/03/1990"},
        overall_match_score=68.0,
        matched_fields=["dob"],
        verification_status="MISMATCH"
    )

    app.status = "OCR_VALIDATION"
    app.overall_match_score = 68.0
    db.commit()

    # Re-evaluate risk score
    fields = app_repo.get_fields(app.id, decrypt=True)
    risk_res = RiskScoringService.evaluate_application(
        app_data=fields,
        documents=[{
            "doc_type": "IDENTITY_PROOF",
            "confidence_score": 0.68,
            "extracted_fields": {"applicant_name": "Rajesh K. Sharma"}
        }]
    )

    return {
        "status": "ok",
        "message": "Discrepancy scenario injected",
        "application_number": app.application_number,
        "declared_name": fields.get("applicant_name"),
        "ocr_extracted_name": "Rajesh K. Sharma",
        "match_score": 68.0,
        "risk_assessment": risk_res.to_dict(),
    }


@router.get("/speech-metrics")
def get_speech_eval_metrics():
    """
    Returns Malayalam STT/TTS native accuracy metrics, WER score, and sample audio evaluation dataset.
    """
    svc = SpeechAdapterService()
    return svc.get_evaluation_metrics()
