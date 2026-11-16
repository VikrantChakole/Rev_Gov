import os
import uuid
import asyncio
import datetime
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.data_layer.repositories.application_repo import ApplicationRepository
from app.data_layer.repositories.citizen_repo import CitizenRepository
from app.rules_engine.engine import ServiceSpecLoader
from app.orchestration.state_machine.application_fsm import STATE_PROGRESS, AppState
from app.services.ocr_service import OCRService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/applications", tags=["applications"])

# Document types that bypass OCR in application forms (photo & signature)
NON_OCR_DOC_TYPES = {"passport_image", "passport_photo", "photo", "signature"}


@router.get("/services")
def list_services():
    """List all available certificate services (from YAML specs)."""
    services = ServiceSpecLoader.list_services()
    return {"status": "ok", "count": len(services), "services": services}


@router.get("/services/{service_id}")
def get_service(service_id: str):
    """Get detailed spec for a specific service."""
    spec = ServiceSpecLoader.get(service_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Service '{service_id}' not found")
    return {
        "id": spec.id,
        "name": spec.name,
        "department": spec.department,
        "sla_days": spec.sla_days,
        "fee": {"amount": spec.fee_amount, "currency": spec.fee_currency},
        "waiver_conditions": spec.waiver_conditions,
        "slots": [
            {
                "name": s.name,
                "type": s.type,
                "required": s.required,
                "classification": s.classification,
                "prompt": s.prompt,
            }
            for s in spec.slots
        ],
        "required_docs": spec.required_docs,
        "eligibility_rules": spec.eligibility_rules,
    }


from fastapi import Request
from jose import jwt, JWTError
from app.core.config import settings
from app.api.routes.auth import get_current_citizen
from app.core.security import verify_application_ownership
import shutil


class CreateDraftRequest(BaseModel):
    service_id: Optional[str] = "caste_certificate"
    channel: Optional[str] = "WEB_MANUAL"


class UpdateDraftRequest(BaseModel):
    service_id: str


class ManualSubmitRequest(BaseModel):
    service_id: Optional[str] = None
    fields: Dict[str, Any] = {}
    declaration_confirmed: bool = False


@router.post("/draft")
def create_draft_application(
    body: Optional[CreateDraftRequest] = None,
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """
    Instantiate a new temporary application in DRAFT status for the authenticated citizen.
    Used when clicking 'New Application'.
    """
    service_id = (body.service_id if body and body.service_id else "caste_certificate").strip()
    channel = (body.channel if body and body.channel else "WEB_MANUAL").strip()

    repo = ApplicationRepository(db)
    app = repo.create(
        citizen_ref=current_citizen.citizen_ref,
        service_id=service_id,
        channel_origin=channel,
        language="en",
    )

    service_names = {
        "caste_certificate": "Caste Certificate",
        "income_certificate": "Income Certificate",
        "domicile_certificate": "Domicile Certificate",
        "obc_ncl_certificate": "OBC Non Creamy Layer Certificate",
    }
    s_name = service_names.get(app.service_id, app.service.name_en if app.service else app.service_id)

    return {
        "success": True,
        "draft_id": app.id,
        "application_id": app.id,
        "application_number": app.application_number,
        "certificate_id": app.application_number,
        "tracking_id": app.tracking_id,
        "service_id": app.service_id,
        "service_name": s_name,
        "status": app.status,
        "created_at": app.created_at.isoformat(),
        "message": "Temporary draft application created."
    }


@router.delete("/{draft_id}/draft")
def discard_draft_application(
    draft_id: str,
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """
    Discard/delete a temporary draft application when user cancels the popup modal or form.
    Only applications in DRAFT status belonging to the citizen can be discarded.
    """
    repo = ApplicationRepository(db)
    app = repo.get_by_id(draft_id)
    if not app:
        return {"success": True, "message": "Draft already deleted or not found."}

    if app.citizen_ref != current_citizen.citizen_ref:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot discard another user's draft.")

    if app.status != "DRAFT":
        raise HTTPException(status_code=400, detail=f"Cannot discard application in '{app.status}' status. Only DRAFT can be discarded.")

    deleted = repo.delete_draft(app.id)
    return {
        "success": deleted,
        "draft_id": draft_id,
        "message": "Temporary draft application discarded successfully."
    }


@router.delete("/{application_id}")
def delete_application(
    application_id: str,
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """
    Delete an application by the owning citizen.
    Cleans up documents, uploaded files, and all associated database records.
    """
    repo = ApplicationRepository(db)
    app = repo.get_by_id(application_id)
    if not app:
        app = repo.get_by_number(application_id) or repo.get_by_tracking_id(application_id)

    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if app.citizen_ref != current_citizen.citizen_ref:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot delete another citizen's application.")

    app_id = app.id
    app_num = app.application_number

    # Clean up automated session store if present
    try:
        from app.api.routes.automated_form import SESSION_STORE
        SESSION_STORE.pop(app_id, None)
    except Exception:
        pass

    deleted = repo.delete_application(app_id)

    # Log audit event
    try:
        audit_repo = AuditRepository(db)
        audit_repo.log_event(
            event_type="APPLICATION_DELETED",
            actor=current_citizen.citizen_ref,
            citizen_ref=current_citizen.citizen_ref,
            application_id=app_id,
            action=f"Citizen deleted application #{app_num} ({app_id})",
            outcome="SUCCESS" if deleted else "FAILURE",
        )
    except Exception as e:
        logger.warning(f"Failed to log deletion audit event: {e}")

    return {
        "success": deleted,
        "application_id": app_id,
        "application_number": app_num,
        "message": f"Application #{app_num} deleted successfully."
    }



@router.patch("/{draft_id}/draft")
def update_draft_service(
    draft_id: str,
    body: UpdateDraftRequest,
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """Update service_id of an existing DRAFT application."""
    repo = ApplicationRepository(db)
    app = repo.get_by_id(draft_id)
    if not app:
        raise HTTPException(status_code=404, detail="Draft application not found")
    if app.citizen_ref != current_citizen.citizen_ref:
        raise HTTPException(status_code=403, detail="Forbidden")
    if app.status != "DRAFT":
        raise HTTPException(status_code=400, detail="Only DRAFT applications can be modified here")

    app.service_id = body.service_id
    db.commit()

    service_names = {
        "caste_certificate": "Caste Certificate",
        "income_certificate": "Income Certificate",
        "domicile_certificate": "Domicile Certificate",
        "obc_ncl_certificate": "OBC Non Creamy Layer Certificate",
    }
    s_name = service_names.get(app.service_id, app.service.name_en if app.service else app.service_id)

    return {
        "success": True,
        "draft_id": app.id,
        "service_id": app.service_id,
        "service_name": s_name,
    }


@router.get("/active-draft")
def get_active_draft(
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """
    Get citizen's current DRAFT application if one exists.
    Used by the Form Filling navigation to automatically redirect to the in-progress draft form.
    """
    repo = ApplicationRepository(db)
    apps = repo.get_by_citizen(current_citizen.citizen_ref, limit=20)
    draft = next((a for a in apps if a.status == "DRAFT"), None)
    if draft:
        return {
            "has_draft": True,
            "draft": {
                "id": draft.id,
                "application_number": draft.application_number,
                "certificate_id": draft.application_number,
                "tracking_id": draft.tracking_id,
                "service_id": draft.service_id,
                "status": draft.status,
                "created_at": draft.created_at.isoformat(),
            }
        }
    return {"has_draft": False, "draft": None}


@router.post("/{draft_id}/upload-document")
async def upload_draft_document(
    draft_id: str,
    doc_type: str = Form(...),
    doc_subtype: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """
    Upload an enclosed document (identity proof, residential proof, age proof, signature, passport image)
    for a draft application.
    """
    repo = ApplicationRepository(db)
    app = repo.get_by_id(draft_id)
    if not app:
        raise HTTPException(status_code=404, detail="Draft application not found")
    if app.citizen_ref != current_citizen.citizen_ref:
        raise HTTPException(status_code=403, detail="Forbidden")

    upload_dir = f"data/uploads/{app.id}"
    os.makedirs(upload_dir, exist_ok=True)

    clean_filename = os.path.basename(file.filename or f"doc_{uuid.uuid4().hex[:6]}.pdf")
    ext = os.path.splitext(clean_filename)[1] or ".pdf"
    unique_name = f"{doc_type}_{uuid.uuid4().hex[:6]}{ext}"
    saved_path = os.path.join(upload_dir, unique_name).replace("\\", "/")

    with open(saved_path, "wb") as f_out:
        shutil.copyfileobj(file.file, f_out)

    is_non_ocr = doc_type.lower() in NON_OCR_DOC_TYPES

    if is_non_ocr:
        # 1. Bypass OCR completely for photograph and signature
        extracted_fields = {
            "original_filename": clean_filename,
            "subtype": doc_subtype or doc_type,
        }
        confidence = 1.0
        provider = "bypassed"
        raw_text = "Photograph / Signature recorded - Direct visual verification"
        confidence_breakdown = {}

        doc = repo.save_document(
            application_id=app.id,
            doc_type=doc_type,
            file_ref=saved_path,
            extracted_fields=extracted_fields,
            confidence_score=1.0,
            raw_ocr_text=raw_text,
            verification_status="PENDING",
        )
    else:
        # 1. Save initial Document record in DB as PROCESSING_OCR
        doc = repo.save_document(
            application_id=app.id,
            doc_type=doc_type,
            file_ref=saved_path,
            extracted_fields={"original_filename": clean_filename, "subtype": doc_subtype or doc_type},
            confidence_score=0.5,
            verification_status="PROCESSING_OCR",
        )

        # 2. Asynchronous OCR Execution in threadpool to keep event loop responsive
        ocr_service = OCRService()
        try:
            ocr_res = await asyncio.to_thread(ocr_service.run_ocr, saved_path, doc_type=doc_subtype or doc_type)
            extracted_fields = ocr_res.extracted_fields or {}
            confidence = ocr_res.confidence
            confidence_breakdown = ocr_res.confidence_breakdown or {}
            provider = ocr_res.provider
            raw_text = ocr_res.raw_text or ""
        except Exception as e:
            logger.error(f"Async OCR execution failed for manual draft doc {doc_type}: {e}", exc_info=True)
            extracted_fields = {}
            confidence = 0.5
            confidence_breakdown = {}
            provider = "fallback_error"
            raw_text = f"OCR processing notice: {str(e)}"

        # Merge metadata
        extracted_fields["original_filename"] = clean_filename
        extracted_fields["subtype"] = doc_subtype or doc_type

        # Update Document record with OCR results
        doc = repo.save_document(
            application_id=app.id,
            doc_type=doc_type,
            file_ref=saved_path,
            extracted_fields=extracted_fields,
            confidence_score=confidence,
            raw_ocr_text=raw_text,
            verification_status="EXTRACTED",
        )

    if doc and doc.mismatch_resolutions and "rejection_reason" in doc.mismatch_resolutions:
        m_resols = dict(doc.mismatch_resolutions)
        m_resols.pop("rejection_reason", None)
        doc.mismatch_resolutions = m_resols
        db.commit()

    return {
        "success": True,
        "document": {
            "id": doc.id,
            "doc_type": doc.doc_type,
            "subtype": doc_subtype or doc_type,
            "filename": clean_filename,
            "file_ref": f"/data/uploads/{app.id}/{unique_name}",
            "created_at": doc.created_at.isoformat() if doc.created_at else datetime.datetime.utcnow().isoformat(),
            "extracted_fields": extracted_fields,
            "confidence_score": confidence,
            "verification_status": doc.verification_status,
        },
        "ocr_result": {
            "bypassed": is_non_ocr,
            "doc_id": doc.id,
            "doc_type": doc_type,
            "filename": clean_filename,
            "extracted_fields": extracted_fields,
            "confidence": confidence,
            "confidence_breakdown": confidence_breakdown,
            "provider": provider,
            "raw_text": raw_text[:400] if raw_text else "",
        }
    }


@router.delete("/{draft_id}/documents/{doc_id}")
def delete_draft_document(
    draft_id: str,
    doc_id: str,
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """Delete an uploaded document from a draft application."""
    repo = ApplicationRepository(db)
    app = repo.get_by_id(draft_id)
    if not app:
        raise HTTPException(status_code=404, detail="Draft application not found")
    if app.citizen_ref != current_citizen.citizen_ref:
        raise HTTPException(status_code=403, detail="Forbidden")

    from app.models.db_models import Document
    doc = db.query(Document).filter(Document.id == doc_id, Document.application_id == app.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.file_ref and os.path.exists(doc.file_ref):
        try:
            os.remove(doc.file_ref)
        except Exception:
            pass

    db.delete(doc)
    db.commit()

    return {"success": True, "message": "Document deleted successfully"}


@router.post("/{draft_id}/manual-submit")
def manual_submit_application(
    draft_id: str,
    body: ManualSubmitRequest,
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """
    Submits manual form application after confirmation.
    Validates declaration, persists particulars into ApplicationData,
    updates status to SUBMITTED, logs audit event, and broadcasts SSE.
    """
    if not body.declaration_confirmed:
        raise HTTPException(status_code=400, detail="You must check the statutory declaration before submitting.")

    repo = ApplicationRepository(db)
    app = repo.get_by_id(draft_id)
    if not app:
        raise HTTPException(status_code=404, detail="Draft application not found")
    if app.citizen_ref != current_citizen.citizen_ref:
        raise HTTPException(status_code=403, detail="Forbidden")

    if body.service_id:
        app.service_id = body.service_id

    # Store particulars into ApplicationData
    fields = body.fields or {}
    for k, v in fields.items():
        if v is not None and str(v).strip():
            repo.save_field(
                application_id=app.id,
                field_name=k,
                field_value=str(v).strip(),
                source="WEB_MANUAL",
                confirmed=True,
            )

    now = datetime.datetime.utcnow()
    old_status = app.status

    val_summary = dict(app.validation_summary or {})
    prev_clerk = app.assigned_to or val_summary.get("rejected_by") or val_summary.get("reviewed_by")
    is_resubmission = old_status in ("REJECTED", "CORRECTION_NEEDED", "CLARIFICATION_REQUIRED") or bool(
        prev_clerk and old_status not in ("DRAFT", "INITIATED", "CONSENT_GIVEN", "SERVICE_SELECTED")
    )

    if is_resubmission and prev_clerk:
        app.assigned_to = prev_clerk
        target_status = AppState.UNDER_REVIEW
    else:
        target_status = AppState.SUBMITTED

    repo.update_status(app.id, target_status)
    app.submitted_at = now
    app.consent_given = True
    db.commit()

    # Write AuditLog
    from app.data_layer.repositories.audit_repo import AuditRepository
    action_text = (
        f"APPLICATION_RESUBMITTED_REASSIGNED: {app.application_number} ({old_status} -> {target_status}, reassigned to {prev_clerk})"
        if (is_resubmission and prev_clerk)
        else f"APPLICATION_SUBMITTED_MANUAL: {app.application_number} ({old_status} -> {target_status})"
    )
    AuditRepository(db).write(
        event_type="SUBMISSION",
        actor=current_citizen.citizen_ref,
        application_id=app.id,
        action=action_text,
        outcome="SUCCESS",
        metadata={
            "tracking_id": app.tracking_id,
            "previous_status": old_status,
            "new_status": target_status,
            "reassigned_to": prev_clerk if (is_resubmission and prev_clerk) else None,
            "service_id": app.service_id,
            "submission_mode": "MANUAL",
        },
    )

    # Broadcast SSE events
    try:
        from app.api.routes.stream import broadcast_status_change_sync, bus
        broadcast_status_change_sync(
            application_id=app.tracking_id or str(app.id),
            tracking_id=app.tracking_id or app.application_number,
            new_status=target_status,
            actor="CITIZEN",
            extra={"reassigned_to": prev_clerk} if (is_resubmission and prev_clerk) else None,
        )
        if app.citizen_ref:
            bus.publish_sync(app.citizen_ref, {
                "type": "status_change",
                "tracking_id": app.tracking_id or app.application_number,
                "new_status": target_status,
                "actor": "CITIZEN",
                "assigned_to": app.assigned_to,
            })
    except Exception as e:
        logger.warning(f"SSE broadcast error: {e}")

    service_names = {
        "caste_certificate": "Caste Certificate",
        "income_certificate": "Income Certificate",
        "domicile_certificate": "Domicile Certificate",
        "obc_ncl_certificate": "OBC Non Creamy Layer Certificate",
    }
    s_name = service_names.get(app.service_id, app.service.name_en if app.service else app.service_id)

    return {
        "success": True,
        "application_id": app.id,
        "application_number": app.application_number,
        "certificate_id": app.application_number,
        "tracking_id": app.tracking_id,
        "citizen_id": current_citizen.citizen_ref,
        "service_id": app.service_id,
        "service_name": s_name,
        "status": target_status,
        "assigned_to": app.assigned_to,
        "submitted_at": now.isoformat(),
        "message": f"Application for {s_name} has been successfully submitted.",
    }


@router.get("/my-applications")
def get_my_applications(
    limit: int = Query(100, ge=1, le=200),
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """
    Get all applications belonging ONLY to the authenticated citizen.
    Backend authorization is strictly enforced.
    """
    repo = ApplicationRepository(db)
    apps = repo.get_by_citizen(current_citizen.citizen_ref, limit=limit)

    return {
        "status": "ok",
        "citizen_id": current_citizen.citizen_ref,
        "count": len(apps),
        "applications": [
            {
                "id": a.id,
                "application_number": a.application_number,
                "tracking_id": a.tracking_id,
                "service_id": a.service_id,
                "service_name": a.service.name_en if a.service else a.service_id,
                "status": a.status,
                "progress_percent": a.progress_percent if a.progress_percent is not None and a.progress_percent > 0 else STATE_PROGRESS.get(a.status, 0),
                "payment_status": a.payment_status,
                "channel_origin": a.channel_origin,
                "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
                "created_at": a.created_at.isoformat(),
                "validation_summary": a.validation_summary or {},
                "clerk_notes": (
                    (a.validation_summary or {}).get("rejection_reason")
                    or (a.validation_summary or {}).get("clarification_reason")
                    or (a.validation_summary or {}).get("admin_notes")
                    or (a.validation_summary or {}).get("desk_clerk_notes")
                    or ""
                ),
                "rejection_reason": (
                    (a.validation_summary or {}).get("rejection_reason")
                    or (a.validation_summary or {}).get("clarification_reason")
                    or ""
                ),
                "has_rejected_documents": any(d.verification_status == "REJECTED" for d in (a.documents or [])),
                "rejected_doc_types": [d.doc_type for d in (a.documents or []) if d.verification_status == "REJECTED"],
            }
            for a in apps
        ]
    }


@router.get("/citizen/{citizen_ref}")
def get_applications_by_citizen_ref(
    citizen_ref: str,
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Backward-compatible citizen application lookup route.
    If authenticated with JWT, validates ownership.
    Returns canonical list of applications for the citizen.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "").strip()
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            token_ref = payload.get("citizen_ref")
            role = payload.get("role")
            if token_ref and token_ref != citizen_ref and role not in ("ADMIN", "OFFICER"):
                raise HTTPException(status_code=403, detail="Access forbidden: citizen ID mismatch")
        except JWTError:
            pass

    repo = ApplicationRepository(db)
    apps = repo.get_by_citizen(citizen_ref, limit=limit)
    return {
        "status": "ok",
        "citizen_id": citizen_ref,
        "count": len(apps),
        "applications": [
            {
                "id": a.id,
                "application_number": a.application_number,
                "tracking_id": a.tracking_id,
                "service_id": a.service_id,
                "service_name": a.service.name_en if a.service else a.service_id,
                "status": a.status,
                "progress_percent": a.progress_percent,
                "payment_status": a.payment_status,
                "channel_origin": a.channel_origin,
                "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
                "created_at": a.created_at.isoformat(),
                "validation_summary": a.validation_summary or {},
                "clerk_notes": (
                    (a.validation_summary or {}).get("rejection_reason")
                    or (a.validation_summary or {}).get("clarification_reason")
                    or (a.validation_summary or {}).get("admin_notes")
                    or (a.validation_summary or {}).get("desk_clerk_notes")
                    or ""
                ),
                "rejection_reason": (
                    (a.validation_summary or {}).get("rejection_reason")
                    or (a.validation_summary or {}).get("clarification_reason")
                    or ""
                ),
                "has_rejected_documents": any(d.verification_status == "REJECTED" for d in (a.documents or [])),
                "rejected_doc_types": [d.doc_type for d in (a.documents or []) if d.verification_status == "REJECTED"],
            }
            for a in apps
        ]
    }


@router.get("/status/{application_number}")
def get_application_status(
    application_number: str,
    request: Request,
    db: Session = Depends(get_db),
):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Authentication token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.replace("Bearer ", "").strip()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_ref = payload.get("citizen_ref")
    role = payload.get("role")

    repo = ApplicationRepository(db)
    app = repo.get_by_number(application_number) or repo.get_by_id(application_number)
    if not app:
        from app.models.db_models import Application
        app = db.query(Application).filter(Application.tracking_id == application_number).first()

    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if token_ref and token_ref != app.citizen_ref and role not in ("ADMIN", "OFFICER", "REVIEWER", "APPROVER", "AUDITOR", "OPERATOR"):
        raise HTTPException(status_code=403, detail="Access forbidden: citizen ID mismatch")

    cert = None
    if app.certificate:
        cert = {
            "certificate_number": app.certificate.certificate_number,
            "issue_date": app.certificate.issue_date.isoformat(),
        }

    slots_data = repo.get_fields(app.id, decrypt=True)

    return {
        "application": {
            "id":                 app.id,
            "application_number": app.application_number,
            "tracking_id":        app.tracking_id,
            "service_type":       app.service_id,   # service_id is the service type key
            "service_name":       app.service.name_en if app.service else None,
            "sla_days":           app.service.sla_days if app.service else None,
            "status":             app.status,
            "payment_status":     app.payment_status,
            "fee_paid_amount":    (app.payments[0].amount if app.payments else None),
            "fee_waiver":         False,
            "payment_reference":  (app.payments[0].transaction_id if app.payments else None),
            "channel":            app.channel_origin,
            "language":           app.language,
            "consent_given":      app.consent_given,
            "anomaly_score":      app.anomaly_score,
            "literacy_level":     None,
            "citizen_ref":        app.citizen_ref,
            "slots_data":         slots_data,
            "submitted_at":       app.submitted_at.isoformat() if app.submitted_at else None,
            "completed_at":       app.completed_at.isoformat() if app.completed_at else None,
            "created_at":         app.created_at.isoformat(),
            "certificate":        cert,
            "documents":          [
                {
                    "id": d.id,
                    "doc_type": d.doc_type,
                    "filename": os.path.basename(d.file_ref) if d.file_ref else "",
                    "file_ref": f"/data/uploads/{os.path.basename(d.file_ref)}" if d.file_ref and not d.file_ref.startswith("mock") else d.file_ref,
                    "is_verified": d.verification_status == "VERIFIED",
                    "verification_status": d.verification_status,
                    "mismatch_fields": d.mismatch_fields,
                    "extracted_fields": d.extracted_fields,
                    "confidence_score": d.confidence_score,
                    "uploaded_at": d.created_at.isoformat(),
                }
                for d in (app.documents or [])
            ],
            "validation_summary": app.validation_summary or {},
            "clerk_notes": (
                (app.validation_summary or {}).get("rejection_reason")
                or (app.validation_summary or {}).get("clarification_reason")
                or (app.validation_summary or {}).get("admin_notes")
                or (app.validation_summary or {}).get("desk_clerk_notes")
                or ""
            ),
            "rejection_reason": (
                (app.validation_summary or {}).get("rejection_reason")
                or (app.validation_summary or {}).get("clarification_reason")
                or ""
            ),
            "has_rejected_documents": any(d.verification_status == "REJECTED" for d in (app.documents or [])),
            "rejected_doc_types": [d.doc_type for d in (app.documents or []) if d.verification_status == "REJECTED"],
            "eligibility_result": {},
            "conversation_log":   [],
        }
    }


@router.get("/citizen/{citizen_identifier}")
def get_citizen_applications(
    citizen_identifier: str,
    limit: int = Query(default=10, ge=1, le=50),
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """Get all applications for a citizen with authorization guard."""
    citizen_repo = CitizenRepository(db)
    target_citizen = citizen_repo.get_by_identifier(citizen_identifier) or citizen_repo.get_by_ref(citizen_identifier)
    
    if not target_citizen:
        raise HTTPException(status_code=404, detail="Citizen not found")
        
    if target_citizen.citizen_ref != current_citizen.citizen_ref:
        raise HTTPException(status_code=403, detail="Forbidden: You cannot access another citizen's applications.")

    app_repo = ApplicationRepository(db)
    apps = app_repo.get_by_citizen(target_citizen.citizen_ref, limit=limit)

    return {
        "citizen_ref": target_citizen.citizen_ref,
        "count": len(apps),
        "applications": [
            {
                "application_number": a.application_number,
                "tracking_id": a.tracking_id,
                "service_id": a.service_id,
                "status": a.status,
                "payment_status": a.payment_status,
                "created_at": a.created_at.isoformat(),
            }
            for a in apps
        ],
    }


@router.get("/recent")
def get_recent_applications(
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Get recent applications (admin/officer view)."""
    repo = ApplicationRepository(db)
    return {"applications": repo.get_recent_applications(limit=limit)}


from pydantic import BaseModel

class StatusUpdateRequest(BaseModel):
    status: str
    note: str = ""

@router.patch("/status/{application_number}")
def update_application_status(
    application_number: str,
    body: StatusUpdateRequest,
    db: Session = Depends(get_db),
):
    """Update application status (officer action). Broadcasts via SSE."""
    status = body.status
    valid_statuses = ["UNDER_REVIEW", "APPROVED", "REJECTED", "ESCALATED",
                      "PAYMENT_COMPLETED", "SUBMITTED_FOR_VERIFICATION", "CERTIFICATE_READY"]
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {valid_statuses}"
        )

    repo = ApplicationRepository(db)
    app = repo.get_by_number(application_number)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    old_status = app.status
    updated = repo.update_status(app.id, status)

    # Write audit log
    from app.data_layer.repositories.audit_repo import AuditRepository
    AuditRepository(db).write(
        event_type="STATUS_UPDATE",
        actor="OFFICER",
        application_id=app.id,
        action=f"Status updated: {old_status} to {status}. Note: {body.note}",
        outcome="SUCCESS",
        metadata={"application_number": application_number, "new_status": status, "note": body.note},
    )

    # Push chat message into citizen's conversation session
    try:
        from app.data_layer.repositories.session_repo import SessionRepository
        session_repo = SessionRepository(db)
        session = session_repo.load_session(app.citizen_ref)
        if session:
            status_msgs = {
                "APPROVED": f"🎉 Great news! Your application **{application_number}** has been **APPROVED** by the officer! Your certificate will be issued shortly.",
                "REJECTED": f"❌ Your application **{application_number}** was **REJECTED** by the officer. Reason: {body.note or 'Details do not match requirements'}",
                "UNDER_REVIEW": f"📋 Your application **{application_number}** is now **UNDER REVIEW** by an officer.",
                "ESCALATED": f"🆘 Your application **{application_number}** has been **ESCALATED** to a senior officer.",
                "CERTIFICATE_READY": f"📜 Congratulations! Your certificate for application **{application_number}** is **READY** to download!",
            }
            msg_text = status_msgs.get(status)
            if msg_text:
                session_repo.add_message(session.id, "ASSISTANT", msg_text)
                logger.info(f"Officer status update '{status}' saved to citizen session {session.id}")
    except Exception as e:
        logger.warning(f"Could not store officer status update message: {e}")

    # ── Phase 12: Broadcast SSE event to all connected clients ──
    try:
        from app.core.events import broadcast_status_change
        PROGRESS_MAP = {
            "UNDER_REVIEW": 60, "APPROVED": 100, "REJECTED": 100,
            "ESCALATED": 65, "PAYMENT_COMPLETED": 85,
            "SUBMITTED_FOR_VERIFICATION": 90, "CERTIFICATE_READY": 100,
        }
        broadcast_status_change(
            application_id=app.id,
            new_status=status,
            progress=PROGRESS_MAP.get(status),
            channel="OFFICER_WEB",
            tracking_id=app.tracking_id,
        )
    except Exception as e:
        logger.warning(f"SSE broadcast failed (non-critical): {e}")

    return {
        "application_number": application_number,
        "old_status": old_status,
        "new_status": status,
        "updated": True,
    }


@router.get("/{id_or_number}/certificate")
def download_application_certificate(id_or_number: str, request: Request, db: Session = Depends(get_db)):
    """Download official issued certificate PDF."""
    from fastapi.responses import FileResponse
    repo = ApplicationRepository(db)
    app = repo.get_by_id(id_or_number) or repo.get_by_number(id_or_number) or repo.get_by_tracking_id(id_or_number)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "").strip()
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            role = (payload.get("role") or "").upper()
            token_citizen = payload.get("citizen_ref")
            if role not in ("ADMIN", "OFFICER", "DESK_CLERK", "DISTRICT_OFFICER") and token_citizen and token_citizen != app.citizen_ref:
                raise HTTPException(status_code=403, detail="Forbidden: You do not have access to this certificate.")
        except HTTPException:
            raise
        except Exception:
            pass

    from app.models.db_models import Certificate
    cert = db.query(Certificate).filter(Certificate.application_id == app.id).order_by(Certificate.issue_date.desc()).first()
    file_path = None

    if cert and cert.file_ref and os.path.exists(cert.file_ref):
        # Validate that the file is not an old fake text stub
        try:
            with open(cert.file_ref, "rb") as f:
                header = f.read(4)
                if header == b"%PDF":
                    file_path = cert.file_ref
        except Exception:
            file_path = None

    if not file_path:
        from app.services.certificate_service import CertificateService
        svc = CertificateService(db)
        res = svc.generate_and_store(str(app.id), app.citizen_ref or "CITIZEN")
        if res.get("file_ref") and os.path.exists(res.get("file_ref")):
            file_path = res["file_ref"]
        else:
            cert = db.query(Certificate).filter(Certificate.application_id == app.id).order_by(Certificate.issue_date.desc()).first()
            if cert and cert.file_ref and os.path.exists(cert.file_ref):
                file_path = cert.file_ref

    if file_path and os.path.exists(file_path):
        return FileResponse(
            file_path,
            media_type="application/pdf",
            filename=f"Certificate_{app.tracking_id or app.application_number}.pdf",
        )
    raise HTTPException(status_code=404, detail="Certificate has not been issued yet")


@router.post("/status/{application_number}/simulate-approve")
def simulate_approve_application(application_number: str, db: Session = Depends(get_db)):
    """Simulate government officer approval for testing/demo purposes."""
    repo = ApplicationRepository(db)
    app = repo.get_by_number(application_number)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    old_status = app.status
    repo.update_status(app.id, "APPROVED")

    from app.data_layer.repositories.audit_repo import AuditRepository
    AuditRepository(db).write(
        event_type="STATUS_UPDATE",
        actor="SYSTEM_SIMULATOR",
        application_id=app.id,
        action=f"Status auto-approved via simulator: {old_status} to APPROVED",
        outcome="SUCCESS",
        metadata={"application_number": application_number, "new_status": "APPROVED"},
    )

    # ── Phase 12: SSE broadcast ──
    try:
        from app.core.events import broadcast_status_change
        broadcast_status_change(app.id, "APPROVED", 100, "SYSTEM", app.tracking_id)
    except Exception as e:
        logger.warning(f"SSE broadcast failed: {e}")

    return {
        "application_number": application_number,
        "old_status": old_status,
        "new_status": "APPROVED",
        "updated": True,
    }


@router.post("/validate-eligibility")

def validate_eligibility_endpoint(
    service_id: str,
    slots: dict,
    language: str = "en",
    db: Session = Depends(get_db),
):
    """Validate eligibility for a service before full application."""
    spec = ServiceSpecLoader.get(service_id)
    if not spec:
        raise HTTPException(status_code=404, detail="Service not found")

    from app.rules_engine.engine import EligibilityChecker, FeeCalculator
    eligibility = EligibilityChecker.check(spec, slots, language)
    fee = FeeCalculator.calculate(spec, slots)

    return {
        "eligible": eligibility.valid,
        "errors": eligibility.errors,
        "warnings": eligibility.warnings,
        "fee": {
            "base": fee.base_fee,
            "discount": fee.discount,
            "final": fee.final_fee,
            "waiver_reason": fee.waiver_reason,
        },
    }


@router.get("/{application_number}/readiness")
def get_application_readiness(
    application_number: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Phase 7 — Compute and return Application Readiness Score.

    Returns a 0-100 score based on 5 components:
      1. Field Completeness     (30 pts)
      2. Document Coverage      (25 pts)
      3. OCR Validation         (20 pts)
      4. Eligibility            (15 pts)
      5. Cross-field Consistency (10 pts)

    Frontend NEVER calculates this — always fetches from backend.
    Score ≥ 75 and no blocking issues → can_submit = true.
    """
    from app.services.readiness_engine import ReadinessEngine
    from app.rules_engine.engine import EligibilityChecker

    repo = ApplicationRepository(db)
    app = repo.get_by_number(application_number) or repo.get_by_id(application_number) or repo.get_by_tracking_id(application_number)
    if not app:
        raise HTTPException(status_code=404, detail=f"Application '{application_number}' not found")

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "").strip()
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            role = (payload.get("role") or "").upper()
            token_citizen = payload.get("citizen_ref")
            if role not in ("ADMIN", "OFFICER") and token_citizen and token_citizen != app.citizen_ref:
                raise HTTPException(status_code=403, detail="Forbidden: You do not have access to this application.")
        except HTTPException:
            raise
        except Exception:
            pass

    service_id = getattr(app, "service_id", None)
    filled_slots = dict(getattr(app, "submitted_data", None) or {})

    # Get required slots and docs from YAML
    try:
        spec = ServiceSpecLoader.get(service_id)
        required_slots = [s.name for s in spec.slots if s.required]
        required_docs = list(spec.required_docs or [])
    except Exception:
        required_slots = []
        required_docs = []

    # Get uploaded documents
    uploaded_docs = []
    if app.documents:
        uploaded_docs = [
            getattr(d, "doc_type", getattr(d, "document_type", "")) or ""
            for d in app.documents
        ]

    # Get OCR results
    ocr_results = []
    if app.documents:
        for doc in app.documents:
            ocr_status = getattr(doc, "ocr_status", None) or getattr(doc, "validation_status", "PENDING")
            match_score = getattr(doc, "match_score", 0) or 0
            ocr_results.append({
                "doc_type": getattr(doc, "doc_type", "") or "",
                "status": ocr_status,
                "overall_match_score": float(match_score),
            })

    # Run eligibility check
    eligibility_result = None
    try:
        spec = ServiceSpecLoader.get(service_id)
        elig = EligibilityChecker.check(spec, filled_slots)
        eligibility_result = {
            "eligible": elig.valid,
            "reason": "; ".join(elig.errors) if elig.errors else "Eligible",
        }
    except Exception:
        pass

    engine = ReadinessEngine()
    result = engine.compute(
        service_id=service_id or "",
        filled_slots=filled_slots,
        required_slots=required_slots,
        required_docs=required_docs,
        uploaded_docs=uploaded_docs,
        ocr_results=ocr_results,
        eligibility_result=eligibility_result,
    )

    return result.to_dict()


@router.get("/{application_number}/evidence-graph")
def get_evidence_graph(
    application_number: str,
    db: Session = Depends(get_db),
):
    """
    Phase 7 (Gap Fix) — Evidence Graph.

    Returns a structured JSON showing:
    - Which document supports which declared field
    - Which fields have conflicts between declared and OCR values
    - Which fields are fully verified
    - Which fields have missing evidence

    This helps the admin and citizen understand validation confidence.
    """
    repo = ApplicationRepository(db)
    app = repo.get_by_number(application_number)
    if not app:
        raise HTTPException(status_code=404, detail=f"Application '{application_number}' not found")

    filled_slots = dict(getattr(app, "submitted_data", None) or {})
    graph = {"fields": {}, "documents": [], "summary": {}}

    # Initialize field nodes from declared data
    for field_name, declared_value in filled_slots.items():
        graph["fields"][field_name] = {
            "declared_value": declared_value,
            "doc_sources": [],      # which docs have this field
            "verified": False,
            "conflicting": False,
            "missing_evidence": True,
            "confidence": None,
        }

    # Populate from document OCR results
    if app.documents:
        for doc in app.documents:
            doc_type = getattr(doc, "doc_type", "") or ""
            ocr_status = getattr(doc, "ocr_status", "PENDING") or "PENDING"
            match_result = getattr(doc, "match_result", None)

            doc_node = {
                "doc_type": doc_type,
                "status": ocr_status,
                "fields_extracted": [],
                "fields_matched": [],
                "fields_mismatched": [],
            }

            if match_result and isinstance(match_result, dict):
                # Fields that matched
                for f in match_result.get("matched_fields", []):
                    fname = f.get("field", "")
                    doc_node["fields_matched"].append(fname)
                    if fname in graph["fields"]:
                        graph["fields"][fname]["verified"] = True
                        graph["fields"][fname]["missing_evidence"] = False
                        graph["fields"][fname]["confidence"] = f.get("score", 100)
                        graph["fields"][fname]["doc_sources"].append(doc_type)

                # Fields that mismatched
                for f in match_result.get("mismatched_fields", []):
                    fname = f.get("field", "")
                    doc_node["fields_mismatched"].append(fname)
                    if fname in graph["fields"]:
                        graph["fields"][fname]["conflicting"] = True
                        graph["fields"][fname]["missing_evidence"] = False
                        graph["fields"][fname]["confidence"] = f.get("score", 0)
                        graph["fields"][fname]["doc_sources"].append(doc_type)

            graph["documents"].append(doc_node)

    # Summary
    all_fields = graph["fields"]
    total = len(all_fields)
    verified = sum(1 for f in all_fields.values() if f["verified"])
    conflicting = sum(1 for f in all_fields.values() if f["conflicting"])
    missing_evidence = sum(1 for f in all_fields.values() if f["missing_evidence"])

    graph["summary"] = {
        "total_fields": total,
        "verified_fields": verified,
        "conflicting_fields": conflicting,
        "missing_evidence_fields": missing_evidence,
        "verification_coverage_pct": round((verified / total * 100) if total > 0 else 0, 1),
    }

    return graph


@router.get("/current")
def get_current_application(
    citizen_identifier: str = Query(...),
    service_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Phase 12 — Application Deduplication.

    Returns the most recent active (non-terminal) application for a citizen.
    Used by the web portal to load the same application started on WhatsApp.
    Prevents duplicate applications across channels.
    """
    repo = ApplicationRepository(db)
    citizen_repo = CitizenRepository(db)

    citizen = citizen_repo.get_by_identifier(citizen_identifier)
    if not citizen:
        return {"found": False, "application": None}

    # Try service-specific lookup first
    terminal_states = ["COMPLETED", "REJECTED"]
    apps = repo.get_by_citizen_ref(citizen.citizen_ref)

    if apps:
        # Filter: non-terminal, optionally by service
        active = [
            a for a in apps
            if a.status not in terminal_states
            and (not service_id or getattr(a, "service_id", None) == service_id)
        ]
        # Sort: most recent first
        active.sort(key=lambda a: getattr(a, "created_at", ""), reverse=True)

        if active:
            app = active[0]
            return {
                "found": True,
                "application": {
                    "id": str(app.id),
                    "application_number": getattr(app, "application_number", None),
                    "tracking_id": getattr(app, "tracking_id", None),
                    "service_id": getattr(app, "service_id", None),
                    "status": app.status,
                    "created_at": str(getattr(app, "created_at", "")),
                },
            }

    return {"found": False, "application": None}


@router.get("/{application_id}")
def get_application_by_id(
    application_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Get application details by UUID, tracking ID, or application number.
    Works for both draft and submitted applications.
    """
    auth_header = request.headers.get("Authorization", "")
    token_ref = None
    role = None
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "").strip()
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            token_ref = payload.get("citizen_ref")
            role = payload.get("role")
        except JWTError:
            pass

    repo = ApplicationRepository(db)
    app = repo.get_by_id(application_id) or repo.get_by_number(application_id)
    if not app:
        from app.models.db_models import Application
        app = db.query(Application).filter(Application.tracking_id == application_id).first()

    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if token_ref and token_ref != app.citizen_ref and role not in ("ADMIN", "OFFICER", "REVIEWER", "APPROVER", "AUDITOR", "OPERATOR"):
        raise HTTPException(status_code=403, detail="Access forbidden: citizen ID mismatch")

    service_names = {
        "caste_certificate": "Caste Certificate",
        "income_certificate": "Income Certificate",
        "domicile_certificate": "Domicile Certificate",
        "obc_ncl_certificate": "OBC Non Creamy Layer Certificate",
    }
    s_name = service_names.get(app.service_id, app.service.name_en if app.service else app.service_id)

    slots_data = repo.get_fields(app.id, decrypt=True) or {}
    val_summary = dict(app.validation_summary or {})
    clerk_notes = (
        val_summary.get("rejection_reason")
        or val_summary.get("clarification_reason")
        or val_summary.get("admin_notes")
        or val_summary.get("desk_clerk_notes")
        or ""
    )
    rejection_reason = (
        val_summary.get("rejection_reason")
        or val_summary.get("clarification_reason")
        or ""
    )

    docs_list = [
        {
            "id": d.id,
            "doc_type": d.doc_type,
            "filename": os.path.basename(d.file_ref) if d.file_ref else "",
            "file_ref": f"/data/uploads/{os.path.basename(d.file_ref)}" if d.file_ref and not d.file_ref.startswith("mock") else d.file_ref,
            "is_verified": d.verification_status == "VERIFIED",
            "verification_status": d.verification_status,
            "mismatch_fields": d.mismatch_fields or [],
            "extracted_fields": d.extracted_fields or {},
            "confidence_score": d.confidence_score,
            "rejection_notes": (d.mismatch_resolutions or {}).get("rejection_reason") if isinstance(d.mismatch_resolutions, dict) else None,
            "uploaded_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in (app.documents or [])
    ]
    has_rejected_docs = any(d.get("verification_status") == "REJECTED" for d in docs_list)
    rejected_doc_types = [d.get("doc_type") for d in docs_list if d.get("verification_status") == "REJECTED"]

    return {
        "id": app.id,
        "application_number": app.application_number,
        "certificate_id": app.application_number,
        "tracking_id": app.tracking_id,
        "service_id": app.service_id,
        "service_name": s_name,
        "status": app.status,
        "payment_status": app.payment_status,
        "created_at": app.created_at.isoformat() if app.created_at else None,
        "submitted_at": app.submitted_at.isoformat() if app.submitted_at else None,
        "channel_origin": app.channel_origin,
        "slots_data": slots_data,
        "fields": slots_data,
        "documents": docs_list,
        "validation_summary": val_summary,
        "clerk_notes": clerk_notes,
        "rejection_reason": rejection_reason,
        "has_rejected_documents": has_rejected_docs,
        "rejected_doc_types": rejected_doc_types,
    }


# ─────────────────────────────────────────────────────────────
# Phase 8 / Section 8-15: Authoritative Admin & Submission APIs
# ─────────────────────────────────────────────────────────────

from app.api.routes.auth import require_admin, require_staff
from app.orchestration.state_machine.application_fsm import AppState, ApplicationFSM
from app.data_layer.repositories.audit_repo import AuditRepository
from app.data_layer.repositories.session_repo import SessionRepository


class AdminDecisionRequest(BaseModel):
    decision: str           # "APPROVE" | "REJECT" | "REQUEST_CLARIFICATION"
    reason: Optional[str] = None
    admin_notes: Optional[str] = None


class CitizenSubmitRequest(BaseModel):
    tracking_id: Optional[str] = None
    application_id: Optional[str] = None
    citizen_ref: Optional[str] = None


class EscalateApplicationRequest(BaseModel):
    reason: str
    priority: Optional[str] = "HIGH"


@router.post("/{id_or_number}/escalate")
def escalate_application_endpoint(
    id_or_number: str,
    body: EscalateApplicationRequest,
    db: Session = Depends(get_db),
):
    """
    Escalates an application to the local desk clerk.
    Creates an Escalation record, sets status to ESCALATED,
    writes audit event, and broadcasts SSE.
    """
    if not body.reason or not body.reason.strip():
        raise HTTPException(status_code=400, detail="Escalation reason is required.")

    repo = ApplicationRepository(db)
    app = repo.get_by_id(id_or_number) or repo.get_by_number(id_or_number) or repo.get_by_tracking_id(id_or_number)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    if app.status in ("DRAFT", "INITIATED", "CONSENT_GIVEN", "SERVICE_SELECTED"):
        raise HTTPException(status_code=400, detail="Cannot escalate an unsubmitted draft application.")

    from app.models.db_models import Escalation
    ticket_id = f"ESC-{datetime.datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    
    escalation = Escalation(
        ticket_id=ticket_id,
        application_id=app.id,
        reason=body.reason.strip(),
        priority=(body.priority or "HIGH").upper(),
        status="OPEN",
        officer_summary=f"Citizen initiated escalation: {body.reason.strip()}",
    )
    db.add(escalation)

    old_status = app.status
    repo.update_status(app.id, AppState.ESCALATED)
    
    app_summary = dict(app.validation_summary or {})
    app_summary["escalation_ticket_id"] = ticket_id
    app_summary["escalation_reason"] = body.reason.strip()
    app_summary["escalated_at"] = datetime.datetime.utcnow().isoformat()
    app.validation_summary = app_summary
    db.commit()

    # Audit log
    from app.data_layer.repositories.audit_repo import AuditRepository
    AuditRepository(db).write(
        event_type="ESCALATION",
        actor=app.citizen_ref or "CITIZEN",
        application_id=app.id,
        action=f"CITIZEN_ESCALATION: {ticket_id} ({old_status} -> ESCALATED)",
        outcome="SUCCESS",
        metadata={
            "ticket_id": ticket_id,
            "reason": body.reason.strip(),
            "priority": body.priority,
            "previous_status": old_status,
        },
    )

    # Broadcast SSE
    try:
        from app.api.routes.stream import broadcast_status_change_sync, bus
        broadcast_status_change_sync(
            application_id=app.tracking_id or str(app.id),
            tracking_id=app.tracking_id or app.application_number,
            new_status=AppState.ESCALATED,
            actor=app.citizen_ref or "CITIZEN",
            extra={"ticket_id": ticket_id, "reason": body.reason.strip()},
        )
        if app.citizen_ref:
            bus.publish_sync(app.citizen_ref, {
                "type": "status_change",
                "tracking_id": app.tracking_id or app.application_number,
                "new_status": AppState.ESCALATED,
                "actor": "CITIZEN",
                "ticket_id": ticket_id,
            })
    except Exception as e:
        logger.warning(f"SSE broadcast error during escalation: {e}")

    return {
        "success": True,
        "message": "Application has been escalated to your local desk clerk.",
        "ticket_id": ticket_id,
        "status": AppState.ESCALATED,
        "application_number": app.application_number,
        "tracking_id": app.tracking_id,
    }


@router.get("/admin/list")
def list_admin_applications_endpoint(
    status: Optional[str] = Query(None),
    service_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    sort_by: str = Query("newest"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(require_staff),
):
    """Authoritative Admin application list with filtering, search, sorting and pagination."""
    repo = ApplicationRepository(db)
    effective_state = state
    if current_user.role in ("DESK_CLERK", "DISTRICT_OFFICER") and not effective_state:
        effective_state = current_user.state

    return repo.list_admin_applications(
        status=status,
        service_id=service_id,
        search=search,
        sort_by=sort_by,
        page=page,
        limit=limit,
        state=effective_state,
        current_user=current_user,
    )


@router.post("/{id_or_number}/assign")
@router.post("/assign")
def assign_application_endpoint(
    id_or_number: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(require_staff),
):
    """
    Assign an application to the authenticated Desk Clerk or Officer and transition status to UNDER_REVIEW.
    """
    repo = ApplicationRepository(db)
    target_id = id_or_number
    if not target_id:
        raise HTTPException(status_code=400, detail="Missing application identifier")

    app = repo.get_by_id(target_id) or repo.get_by_number(target_id) or repo.get_by_tracking_id(target_id)
    if not app:
        raise HTTPException(status_code=404, detail=f"Application '{target_id}' not found")

    old_assignee = app.assigned_to
    old_status = app.status

    repo.assign_application(app.id, username=current_user.username, new_status=AppState.UNDER_REVIEW)

    # Write AuditLog
    AuditRepository(db).write(
        event_type="STATUS_UPDATE",
        actor=current_user.username,
        application_id=app.id,
        action=f"APPLICATION_ASSIGNED: {app.application_number} assigned to {current_user.username} ({old_status} -> {AppState.UNDER_REVIEW})",
        outcome="SUCCESS",
        metadata={
            "assigned_to": current_user.username,
            "previous_assignee": old_assignee,
            "previous_status": old_status,
            "new_status": AppState.UNDER_REVIEW,
        },
    )

    # Broadcast SSE
    try:
        from app.api.routes.stream import broadcast_status_change_sync, bus
        broadcast_status_change_sync(
            application_id=app.tracking_id or str(app.id),
            tracking_id=app.tracking_id or app.application_number,
            new_status=AppState.UNDER_REVIEW,
            actor=current_user.username,
        )
        if app.citizen_ref:
            bus.publish_sync(app.citizen_ref, {
                "type": "status_change",
                "tracking_id": app.tracking_id or app.application_number,
                "new_status": AppState.UNDER_REVIEW,
                "actor": current_user.username,
            })
    except Exception as e:
        logger.warning(f"SSE broadcast error: {e}")

    return {
        "success": True,
        "application_number": app.application_number,
        "tracking_id": app.tracking_id or app.application_number,
        "status": AppState.UNDER_REVIEW,
        "assigned_to": current_user.username,
        "message": f"Application successfully assigned to {current_user.username} under review.",
    }


@router.get("/admin/{id_or_number}")
def get_admin_application_detail_endpoint(
    id_or_number: str,
    db: Session = Depends(get_db),
    _staff = Depends(require_staff),
):
    """Get authoritative application details for Admin and Desk Clerk review."""
    repo = ApplicationRepository(db)
    detail = repo.get_admin_application_detail(id_or_number)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Application '{id_or_number}' not found")
    return detail


@router.post("/admin/{id_or_number}/decision")
def submit_admin_decision_endpoint(
    id_or_number: str,
    body: AdminDecisionRequest,
    db: Session = Depends(get_db),
    _staff = Depends(require_staff),
):
    """
    Authoritative decision handler for APPROVE / REJECT / CORRECTION_NEEDED / DISTRICT_OFFICER_APPROVAL.
    Validates FSM, persists changes to SQLite, writes AuditLog, emits SSE events,
    and pushes chat notification to citizen session.
    """
    repo = ApplicationRepository(db)
    app = repo.get_by_id(id_or_number) or repo.get_by_number(id_or_number) or repo.get_by_tracking_id(id_or_number)
    if not app:
        raise HTTPException(status_code=404, detail=f"Application '{id_or_number}' not found")

    decision = body.decision.upper()
    valid_decisions = {
        "APPROVE", "REJECT", "REQUEST_CLARIFICATION", "CLARIFICATION_REQUIRED",
        "CORRECTION_NEEDED", "DISTRICT_OFFICER_APPROVAL", "FORWARD_DISTRICT_OFFICER",
        "PAYMENT_REQUIRED", "REQUIRE_PAYMENT", "VERIFY_DOCUMENTS_REQUEST_PAYMENT",
        "VALIDATE_PAYMENT_FORWARD_DISTRICT",
    }
    if decision not in valid_decisions:
        raise HTTPException(status_code=400, detail=f"Invalid decision. Must be one of: {valid_decisions}")

    old_status = app.status
    now = datetime.datetime.utcnow()
    audit_repo = AuditRepository(db)
    session_repo = SessionRepository(db)

    # 1. APPROVE (District Officer final statutory approval)
    if decision == "APPROVE":
        valid_approval_states = (
            AppState.SUBMITTED_FOR_VERIFICATION,
            AppState.UNDER_REVIEW,
            AppState.READY_FOR_REVIEW,
            "READY_FOR_REVIEW",
            "READY_FOR_VERIFICATION",
            "FINAL_REVIEW",
            "CONSENT_CONFIRMED",
            "SUBMITTED",
            AppState.DISTRICT_OFFICER_APPROVAL,
            "DISTRICT_OFFICER_APPROVAL",
            AppState.PAYMENT_REQUIRED,
            AppState.PAYMENT_COMPLETED,
        )
        if old_status not in valid_approval_states:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot approve application in state '{old_status}'. Application must be in a submitted or review-ready state.",
            )

        fsm = ApplicationFSM(current_state=old_status)
        try:
            fsm.transition(AppState.UNDER_REVIEW)
            repo.update_status(app.id, AppState.UNDER_REVIEW)
        except Exception:
            pass

        try:
            fsm.transition(AppState.APPROVED)
        except Exception:
            pass
        repo.update_status(app.id, AppState.APPROVED)

        app.approved_at = now
        app.reviewed_at = now
        app_summary = dict(app.validation_summary or {})
        app_summary["reviewed_by"] = _staff.username
        if body.admin_notes:
            app_summary["admin_notes"] = body.admin_notes
        app.validation_summary = app_summary
        db.commit()

        # If payment is already completed or coming from DO approval queue, generate certificate immediately!
        if old_status in (AppState.DISTRICT_OFFICER_APPROVAL, "DISTRICT_OFFICER_APPROVAL") or app.payment_status in ("PAID", "SUCCESS"):
            try:
                from app.services.certificate_service import CertificateService
                cert_service = CertificateService(db)
                cert_res = cert_service.generate_and_store(app.id, app.citizen_ref)
                if cert_res.get("success"):
                    repo.update_status(app.id, AppState.CERTIFICATE_READY)
                    repo.update_status(app.id, AppState.COMPLETED)
                    repo.update_progress(app.id, 100, "COMPLETED")
                    new_status = AppState.COMPLETED
                else:
                    new_status = AppState.APPROVED
            except Exception as e:
                logger.warning(f"Certificate generation on approval error: {e}")
                new_status = AppState.APPROVED
        else:
            # Fallback transition to PAYMENT_REQUIRED if payment not yet done
            try:
                fsm.transition(AppState.PAYMENT_REQUIRED)
            except Exception:
                pass
            repo.update_status(app.id, AppState.PAYMENT_REQUIRED)
            new_status = AppState.PAYMENT_REQUIRED

        # AuditLog
        audit_repo.write(
            event_type="DECISION",
            actor=_staff.username,
            application_id=app.id,
            action=f"APPLICATION_APPROVED: {app.application_number} ({old_status} -> {new_status})",
            outcome="SUCCESS",
            metadata={
                "tracking_id": app.tracking_id,
                "previous_status": old_status,
                "new_status": new_status,
                "notes": body.admin_notes,
            },
        )

        # Broadcast SSE
        try:
            from app.api.routes.stream import broadcast_status_change_sync, bus
            broadcast_status_change_sync(
                application_id=app.tracking_id or str(app.id),
                tracking_id=app.tracking_id or app.application_number,
                new_status=AppState.APPROVED,
                actor=_staff.username,
                extra={"decision": "APPROVE", "notes": body.admin_notes},
            )
            broadcast_status_change_sync(
                application_id=app.tracking_id or str(app.id),
                tracking_id=app.tracking_id or app.application_number,
                new_status=AppState.PAYMENT_REQUIRED,
                actor=_staff.username,
                extra={"decision": "APPROVE", "fee_amount": 50},
            )
            if app.citizen_ref:
                bus.publish_sync(app.citizen_ref, {
                    "type": "status_change",
                    "tracking_id": app.tracking_id or app.application_number,
                    "new_status": AppState.APPROVED,
                    "actor": _staff.username,
                })
                bus.publish_sync(app.citizen_ref, {
                    "type": "status_change",
                    "tracking_id": app.tracking_id or app.application_number,
                    "new_status": AppState.PAYMENT_REQUIRED,
                    "actor": _staff.username,
                    "fee_amount": 50,
                })
        except Exception as e:
            logger.warning(f"SSE broadcast error: {e}")

        # Push notification to citizen session
        try:
            session = session_repo.load_session(app.citizen_ref)
            if session:
                msg = (
                    f"🎉 Great news! Your application **{app.tracking_id or app.application_number}** has been **APPROVED** by the government officer!\n\n"
                    f"💳 **Payment Required**: Please complete the statutory fee payment (₹50) to generate and download your official certificate."
                )
                session_repo.add_message(session.id, "ASSISTANT", msg)
        except Exception as e:
            logger.warning(f"Failed to push notification to citizen: {e}")

        return {
            "success": True,
            "tracking_id": app.tracking_id or app.application_number,
            "application_number": app.application_number,
            "old_status": old_status,
            "new_status": new_status,
            "citizen_notified": True,
            "message": "Application approved. Status transitioned to PAYMENT_REQUIRED.",
        }

    # 2. REJECT
    elif decision == "REJECT":
        if not body.reason or not body.reason.strip():
            raise HTTPException(status_code=400, detail="Rejection reason is required")

        if old_status in ("COMPLETED", "REJECTED"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot reject application in state '{old_status}'.",
            )

        fsm = ApplicationFSM(current_state=old_status)
        try:
            fsm.transition(AppState.UNDER_REVIEW)
            repo.update_status(app.id, AppState.UNDER_REVIEW)
        except Exception:
            pass

        try:
            fsm.transition(AppState.REJECTED)
        except Exception:
            pass
        repo.update_status(app.id, AppState.REJECTED)
        new_status = AppState.REJECTED

        app.completed_at = now
        app.reviewed_at = now
        app.assigned_to = _staff.username
        app_summary = dict(app.validation_summary or {})
        app_summary["rejection_reason"] = body.reason.strip()
        app_summary["reviewed_by"] = _staff.username
        app_summary["rejected_by"] = _staff.username
        if body.admin_notes:
            app_summary["admin_notes"] = body.admin_notes
        app.validation_summary = app_summary
        db.commit()

        # AuditLog
        audit_repo.write(
            event_type="DECISION",
            actor=_staff.username,
            application_id=app.id,
            action=f"APPLICATION_REJECTED: {app.application_number} ({old_status} -> REJECTED). Reason: {body.reason}",
            outcome="SUCCESS",
            metadata={
                "tracking_id": app.tracking_id,
                "previous_status": old_status,
                "new_status": AppState.REJECTED,
                "reason": body.reason,
            },
        )

        # Broadcast SSE
        try:
            from app.api.routes.stream import broadcast_status_change_sync, bus
            broadcast_status_change_sync(
                application_id=app.tracking_id or str(app.id),
                tracking_id=app.tracking_id or app.application_number,
                new_status=AppState.REJECTED,
                actor=_staff.username,
                extra={"decision": "REJECT", "reason": body.reason},
            )
            if app.citizen_ref:
                bus.publish_sync(app.citizen_ref, {
                    "type": "status_change",
                    "tracking_id": app.tracking_id or app.application_number,
                    "new_status": AppState.REJECTED,
                    "actor": _staff.username,
                    "reason": body.reason,
                })
        except Exception as e:
            logger.warning(f"SSE broadcast error: {e}")

        # Push notification to citizen session
        try:
            session = session_repo.load_session(app.citizen_ref)
            if session:
                msg = (
                    f"❌ Your application **{app.tracking_id or app.application_number}** was **REJECTED** by the reviewing officer.\n\n"
                    f"**Reason**: {body.reason.strip()}\n\n"
                    f"If you believe this was in error, you may submit a new application with the correct documentation."
                )
                session_repo.add_message(session.id, "ASSISTANT", msg)
        except Exception as e:
            logger.warning(f"Failed to push notification to citizen: {e}")

        return {
            "success": True,
            "tracking_id": app.tracking_id or app.application_number,
            "application_number": app.application_number,
            "old_status": old_status,
            "new_status": new_status,
            "citizen_notified": True,
            "message": f"Application rejected. Reason: {body.reason}",
        }

    # 3. REQUEST_CLARIFICATION / CORRECTION_NEEDED
    elif decision in ("REQUEST_CLARIFICATION", "CLARIFICATION_REQUIRED", "CORRECTION_NEEDED"):
        clarification_text = (body.reason or body.admin_notes or "").strip()
        if not clarification_text:
            raise HTTPException(status_code=400, detail="Correction / Clarification message is required")

        if old_status in ("COMPLETED", "REJECTED", "PAYMENT_REQUIRED", "PAYMENT_COMPLETED", "CERTIFICATE_READY"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot request correction in state '{old_status}'.",
            )

        fsm = ApplicationFSM(current_state=old_status)
        target_state = AppState.CORRECTION_NEEDED if decision == "CORRECTION_NEEDED" else AppState.CLARIFICATION_REQUIRED
        try:
            fsm.transition(target_state)
        except Exception:
            pass
        repo.update_status(app.id, target_state)
        new_status = target_state

        app.reviewed_at = now
        app.assigned_to = _staff.username
        app_summary = dict(app.validation_summary or {})
        app_summary["clarification_reason"] = clarification_text
        app_summary["reviewed_by"] = _staff.username
        app_summary["rejected_by"] = _staff.username
        app.validation_summary = app_summary
        db.commit()

        # AuditLog
        audit_repo.write(
            event_type="DECISION",
            actor=_staff.username,
            application_id=app.id,
            action=f"CORRECTION_REQUESTED: {app.application_number} ({old_status} -> {target_state}). Message: {clarification_text}",
            outcome="SUCCESS",
            metadata={
                "tracking_id": app.tracking_id,
                "previous_status": old_status,
                "new_status": target_state,
                "message": clarification_text,
            },
        )

        # Broadcast SSE
        try:
            from app.api.routes.stream import broadcast_status_change_sync, bus
            broadcast_status_change_sync(
                application_id=app.tracking_id or str(app.id),
                tracking_id=app.tracking_id or app.application_number,
                new_status=target_state,
                actor=_staff.username,
                extra={"decision": decision, "reason": clarification_text},
            )
            if app.citizen_ref:
                bus.publish_sync(app.citizen_ref, {
                    "type": "status_change",
                    "tracking_id": app.tracking_id or app.application_number,
                    "new_status": target_state,
                    "actor": _staff.username,
                    "reason": clarification_text,
                })
        except Exception as e:
            logger.warning(f"SSE broadcast error: {e}")

        # Push notification to citizen session
        try:
            session = session_repo.load_session(app.citizen_ref)
            if session:
                msg = (
                    f"⚠️ **Action Required**: The reviewing officer has requested corrections on your application **{app.tracking_id or app.application_number}**:\n\n"
                    f"👉 **{clarification_text}**\n\n"
                    f"Please provide the requested details or re-upload your document in the portal so we can proceed with verification."
                )
                session_repo.add_message(session.id, "ASSISTANT", msg)
        except Exception as e:
            logger.warning(f"Failed to push notification to citizen: {e}")

        return {
            "success": True,
            "tracking_id": app.tracking_id or app.application_number,
            "application_number": app.application_number,
            "old_status": old_status,
            "new_status": new_status,
            "citizen_notified": True,
            "message": f"Correction requested from citizen: {clarification_text}",
        }

    # 4. PAYMENT_REQUIRED / REQUIRE_PAYMENT / VERIFY_DOCUMENTS_REQUEST_PAYMENT (Desk Clerk document verification)
    elif decision in ("PAYMENT_REQUIRED", "REQUIRE_PAYMENT", "VERIFY_DOCUMENTS_REQUEST_PAYMENT"):
        # Ensure that documents are verified
        unverified = [d for d in (app.documents or []) if d.verification_status != "VERIFIED"]
        if unverified:
            names = ", ".join([d.doc_type for d in unverified])
            raise HTTPException(
                status_code=400,
                detail=f"All supporting documents must be marked 'VERIFIED' by the Desk Clerk before requesting payment. Unverified documents: {names}",
            )

        fsm = ApplicationFSM(current_state=old_status)
        try:
            fsm.transition(AppState.PAYMENT_REQUIRED)
        except Exception:
            pass
        repo.update_status(app.id, AppState.PAYMENT_REQUIRED)
        new_status = AppState.PAYMENT_REQUIRED

        app.reviewed_at = now
        app_summary = dict(app.validation_summary or {})
        app_summary["documents_verified_by"] = _staff.username
        app_summary["documents_verified_at"] = now.isoformat()
        if body.admin_notes:
            app_summary["desk_clerk_notes"] = body.admin_notes
        app.validation_summary = app_summary
        db.commit()

        # AuditLog
        audit_repo.write(
            event_type="DECISION",
            actor=_staff.username,
            application_id=app.id,
            action=f"DOCUMENTS_VERIFIED_PAYMENT_REQUIRED: {app.application_number} ({old_status} -> PAYMENT_REQUIRED)",
            outcome="SUCCESS",
            metadata={
                "tracking_id": app.tracking_id,
                "previous_status": old_status,
                "new_status": AppState.PAYMENT_REQUIRED,
                "notes": body.admin_notes,
            },
        )

        # Broadcast SSE
        try:
            from app.api.routes.stream import broadcast_status_change_sync, bus
            broadcast_status_change_sync(
                application_id=app.tracking_id or str(app.id),
                tracking_id=app.tracking_id or app.application_number,
                new_status=AppState.PAYMENT_REQUIRED,
                actor=_staff.username,
                extra={"decision": "PAYMENT_REQUIRED", "fee_amount": 50},
            )
            if app.citizen_ref:
                bus.publish_sync(app.citizen_ref, {
                    "type": "status_change",
                    "tracking_id": app.tracking_id or app.application_number,
                    "new_status": AppState.PAYMENT_REQUIRED,
                    "actor": _staff.username,
                    "fee_amount": 50,
                })
        except Exception as e:
            logger.warning(f"SSE broadcast error: {e}")

        # Push notification to citizen session
        try:
            session = session_repo.load_session(app.citizen_ref)
            if session:
                msg = (
                    f"✅ **Documents Verified**: Your supporting documents have been verified by the Desk Clerk for application **{app.tracking_id or app.application_number}**!\n\n"
                    f"💳 **Payment Required**: Please complete the statutory fee payment (₹50) to proceed to final District Officer approval."
                )
                session_repo.add_message(session.id, "ASSISTANT", msg)
        except Exception as e:
            logger.warning(f"Failed to push notification to citizen: {e}")

        return {
            "success": True,
            "tracking_id": app.tracking_id or app.application_number,
            "application_number": app.application_number,
            "old_status": old_status,
            "new_status": new_status,
            "citizen_notified": True,
            "message": "Documents verified successfully. Status transitioned to PAYMENT_REQUIRED.",
        }

    # 5. DISTRICT_OFFICER_APPROVAL / FORWARD_DISTRICT_OFFICER / VALIDATE_PAYMENT_FORWARD_DISTRICT
    elif decision in ("DISTRICT_OFFICER_APPROVAL", "FORWARD_DISTRICT_OFFICER", "VALIDATE_PAYMENT_FORWARD_DISTRICT"):
        # If in PAYMENT_REQUIRED, check that citizen has paid
        if old_status == AppState.PAYMENT_REQUIRED:
            if app.payment_status not in ("PAID", "SUCCESS"):
                raise HTTPException(
                    status_code=400,
                    detail="Cannot forward to District Officer: Statutory payment has not been completed by the citizen yet.",
                )

        fsm = ApplicationFSM(current_state=old_status)
        try:
            fsm.transition(AppState.DISTRICT_OFFICER_APPROVAL)
        except Exception:
            pass
        repo.update_status(app.id, AppState.DISTRICT_OFFICER_APPROVAL)
        new_status = AppState.DISTRICT_OFFICER_APPROVAL

        app.reviewed_at = now
        app_summary = dict(app.validation_summary or {})
        app_summary["payment_validated_by"] = _staff.username
        app_summary["forwarded_by"] = _staff.username
        app_summary["forwarded_to_do_at"] = now.isoformat()
        if body.admin_notes:
            app_summary["desk_clerk_notes"] = body.admin_notes
        app.validation_summary = app_summary
        db.commit()

        # AuditLog
        audit_repo.write(
            event_type="DECISION",
            actor=_staff.username,
            application_id=app.id,
            action=f"PAYMENT_VALIDATED_FORWARDED_TO_DISTRICT_OFFICER: {app.application_number} ({old_status} -> DISTRICT_OFFICER_APPROVAL)",
            outcome="SUCCESS",
            metadata={
                "tracking_id": app.tracking_id,
                "previous_status": old_status,
                "new_status": AppState.DISTRICT_OFFICER_APPROVAL,
                "notes": body.admin_notes,
            },
        )

        # Broadcast SSE
        try:
            from app.api.routes.stream import broadcast_status_change_sync, bus
            broadcast_status_change_sync(
                application_id=app.tracking_id or str(app.id),
                tracking_id=app.tracking_id or app.application_number,
                new_status=AppState.DISTRICT_OFFICER_APPROVAL,
                actor=_staff.username,
                extra={"decision": "DISTRICT_OFFICER_APPROVAL", "notes": body.admin_notes},
            )
            if app.citizen_ref:
                bus.publish_sync(app.citizen_ref, {
                    "type": "status_change",
                    "tracking_id": app.tracking_id or app.application_number,
                    "new_status": AppState.DISTRICT_OFFICER_APPROVAL,
                    "actor": _staff.username,
                })
        except Exception as e:
            logger.warning(f"SSE broadcast error: {e}")

        # Push notification to citizen session
        try:
            session = session_repo.load_session(app.citizen_ref)
            if session:
                msg = (
                    f"💳 **Payment Validated**: Desk Clerk has validated your payment for application **{app.tracking_id or app.application_number}**.\n\n"
                    f"🏛️ Your application has been forwarded to the District Officer for final statutory approval and certificate issuance."
                )
                session_repo.add_message(session.id, "ASSISTANT", msg)
        except Exception as e:
            logger.warning(f"Failed to push notification to citizen: {e}")

        return {
            "success": True,
            "tracking_id": app.tracking_id or app.application_number,
            "application_number": app.application_number,
            "old_status": old_status,
            "new_status": new_status,
            "citizen_notified": True,
            "message": "Payment validated and application forwarded to District Officer for statutory approval.",
        }


@router.post("/{id_or_number}/submit")
@router.post("/submit")
def submit_application_endpoint(
    id_or_number: Optional[str] = None,
    body: Optional[CitizenSubmitRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Citizen submits application for verification.
    Transitions: (READY_FOR_REVIEW | FINAL_REVIEW | CONSENT_CONFIRMED | CLARIFICATION_REQUIRED | CORRECTION_NEEDED) → SUBMITTED.
    """
    repo = ApplicationRepository(db)
    target_id = id_or_number or (body.tracking_id if body else None) or (body.application_id if body else None)
    if not target_id:
        raise HTTPException(status_code=400, detail="Missing application identifier")

    app = repo.get_by_id(target_id) or repo.get_by_number(target_id) or repo.get_by_tracking_id(target_id)
    if not app:
        raise HTTPException(status_code=404, detail=f"Application '{target_id}' not found")

    old_status = app.status
    now = datetime.datetime.utcnow()

    val_summary = dict(app.validation_summary or {})
    prev_clerk = app.assigned_to or val_summary.get("rejected_by") or val_summary.get("reviewed_by")
    is_resubmission = old_status in ("REJECTED", "CORRECTION_NEEDED", "CLARIFICATION_REQUIRED") or bool(
        prev_clerk and old_status not in ("DRAFT", "INITIATED", "CONSENT_GIVEN", "SERVICE_SELECTED")
    )

    if is_resubmission and prev_clerk:
        app.assigned_to = prev_clerk
        target_status = AppState.UNDER_REVIEW
    else:
        target_status = AppState.SUBMITTED

    # Transition status
    repo.update_status(app.id, target_status)
    app.submitted_at = now
    db.commit()

    # Write AuditLog
    action_text = (
        f"APPLICATION_RESUBMITTED_REASSIGNED: {app.application_number} ({old_status} -> {target_status}, reassigned to {prev_clerk})"
        if (is_resubmission and prev_clerk)
        else f"APPLICATION_SUBMITTED: {app.application_number} ({old_status} -> {target_status})"
    )
    AuditRepository(db).write(
        event_type="SUBMISSION",
        actor=app.citizen_ref or "CITIZEN",
        application_id=app.id,
        action=action_text,
        outcome="SUCCESS",
        metadata={
            "tracking_id": app.tracking_id,
            "previous_status": old_status,
            "new_status": target_status,
            "reassigned_to": prev_clerk if (is_resubmission and prev_clerk) else None,
        },
    )

    # Broadcast SSE
    try:
        from app.api.routes.stream import broadcast_status_change_sync, bus
        broadcast_status_change_sync(
            application_id=app.tracking_id or str(app.id),
            tracking_id=app.tracking_id or app.application_number,
            new_status=target_status,
            actor="CITIZEN",
            extra={"reassigned_to": prev_clerk} if (is_resubmission and prev_clerk) else None,
        )
        if app.citizen_ref:
            bus.publish_sync(app.citizen_ref, {
                "type": "status_change",
                "tracking_id": app.tracking_id or app.application_number,
                "new_status": target_status,
                "actor": "CITIZEN",
                "assigned_to": app.assigned_to,
            })
    except Exception as e:
        logger.warning(f"SSE broadcast error: {e}")

    return {
        "success": True,
        "tracking_id": app.tracking_id or app.application_number,
        "application_number": app.application_number,
        "status": target_status,
        "new_status": target_status,
        "assigned_to": app.assigned_to,
        "submitted_at": now.isoformat(),
        "message": "Application submitted for government verification.",
    }


