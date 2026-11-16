"""
Automated Form Filling API Router
Provides endpoints for:
1. LangGraph session state retrieval and interaction
2. Citizen chatbot conversational slot-filling
3. Multi-document upload with local deterministic OCR extraction & isolated storage
4. Field matching & confidence scoring comparison
5. Discrepancy resolution (Keep User Input vs Use Document OCR Value)
6. Direct inline field review & editing
7. Final statutory declaration & application submission
"""
import os
import uuid
import shutil
import logging
import asyncio
import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.routes.auth import get_current_citizen
from app.data_layer.repositories.application_repo import ApplicationRepository
from app.data_layer.repositories.audit_repo import AuditRepository
from app.models.db_models import Document, ApplicationData, Application
from app.orchestration.state_machine.application_fsm import AppState
from app.orchestration.langgraph_workflow import (
    automated_form_graph,
    calculate_progress,
    get_required_fields_for_service,
    PARTICULARS_SPEC,
    AutomatedFormState,
)
from app.services.ocr_service import OCRService
from app.services.matching_service import MatchingService, CANONICAL_FIELD_MAP, FIELD_TYPES


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/applications/automated", tags=["automated-form"])

# In-memory session store mapping draft_id -> AutomatedFormState
SESSION_STORE: Dict[str, Dict[str, Any]] = {}


# Document types that do not require OCR (photo & signature)
NON_OCR_DOC_TYPES = {"passport_image", "passport_photo", "photo", "signature"}


class ChatMessageRequest(BaseModel):
    message: str


class ResolveFieldRequest(BaseModel):
    field_name: str
    chosen_source: str           # "CHAT" | "OCR" | "CUSTOM"
    chosen_value: Optional[str] = None


class UpdateFormFieldRequest(BaseModel):
    field_name: str
    value: str


class SubmitAutomatedFormRequest(BaseModel):
    declaration_confirmed: bool = False
    service_id: Optional[str] = None
    fields: Optional[Dict[str, Any]] = None


def _find_draft_app(repo: ApplicationRepository, draft_id: str) -> Optional[Application]:
    """Find draft application by UUID, application_number, or tracking_id."""
    return repo.get_by_id(draft_id) or repo.get_by_number(draft_id) or repo.get_by_tracking_id(draft_id)


def _get_or_init_session(
    draft_id: str,
    service_id: str,
    db: Session,
    citizen_ref: str,
) -> Dict[str, Any]:
    """Retrieve existing session or instantiate new LangGraph workflow session state."""
    repo = ApplicationRepository(db)
    app_record = _find_draft_app(repo, draft_id)
    actual_app_id = app_record.id if app_record else draft_id
    if not service_id and app_record and app_record.service_id:
        service_id = app_record.service_id

    field_alias_map = {
        "applicant_name": "name",
        "full_name": "name",
        "father": "father_name",
        "mother": "mother_name",
        "date_of_birth": "dob",
        "birth_date": "dob",
        "gender": "sex",
        "residential_address": "address",
        "residence_years": "years_of_residence",
        "purpose_of_certificate": "purpose",
    }

    if draft_id in SESSION_STORE:
        state = SESSION_STORE[draft_id]
        if service_id and state.get("service_id") != service_id:
            state["service_id"] = service_id

        # If cached session has empty chat_data, sync from ApplicationData in DB
        if not state.get("chat_data"):
            raw_fields = repo.get_fields(actual_app_id, decrypt=True) or {}
            if not raw_fields and actual_app_id != draft_id:
                raw_fields = repo.get_fields(draft_id, decrypt=True) or {}
            if raw_fields:
                synced_chat: Dict[str, Any] = {}
                for k, v in raw_fields.items():
                    if v is not None and str(v).strip():
                        canonical_k = field_alias_map.get(k, k)
                        synced_chat[canonical_k] = str(v).strip()
                state["chat_data"] = synced_chat

        # Always sync latest clerk notes and document verification statuses from DB
        if app_record:
            app_val_summary = dict((app_record.validation_summary or {}) if app_record else {})
            state["clerk_notes"] = (
                app_val_summary.get("admin_notes")
                or app_val_summary.get("clarification_reason")
                or app_val_summary.get("rejection_reason")
                or app_val_summary.get("desk_clerk_notes")
                or ""
            )
            state["rejection_reason"] = (
                app_val_summary.get("rejection_reason")
                or app_val_summary.get("clarification_reason")
                or ""
            )

            existing_docs = db.query(Document).filter(
                (Document.application_id == actual_app_id) | (Document.application_id == draft_id)
            ).all()
            for d in existing_docs:
                dtype = d.doc_type
                rej_notes = None
                if hasattr(d, "rejection_notes") and d.rejection_notes:
                    rej_notes = d.rejection_notes
                elif isinstance(d.mismatch_resolutions, dict):
                    rej_notes = d.mismatch_resolutions.get("rejection_reason") or d.mismatch_resolutions.get("rejection_notes")

                if dtype in state.get("uploaded_documents", {}):
                    state["uploaded_documents"][dtype]["verification_status"] = d.verification_status
                    state["uploaded_documents"][dtype]["rejection_notes"] = rej_notes
                else:
                    state.setdefault("uploaded_documents", {})[dtype] = {
                        "id": d.id,
                        "doc_type": dtype,
                        "filename": os.path.basename(d.file_ref or "document"),
                        "file_ref": d.file_ref,
                        "verification_status": d.verification_status,
                        "rejection_notes": rej_notes,
                        "created_at": d.created_at.isoformat() if d.created_at else datetime.datetime.utcnow().isoformat(),
                    }

            state["rejected_docs"] = [
                dtype for dtype, d in state.get("uploaded_documents", {}).items()
                if d.get("verification_status") == "REJECTED"
            ]

        state["progress_percent"] = calculate_progress(
            state.get("chat_data", {}),
            state.get("service_id", service_id),
            state.get("uploaded_documents", {}),
        )
        return state

    # Check for existing uploaded documents in DB
    existing_docs = db.query(Document).filter(
        (Document.application_id == actual_app_id) | (Document.application_id == draft_id)
    ).all()
    uploaded_docs: Dict[str, Any] = {}
    ocr_data: Dict[str, Any] = {}

    ocr_service = OCRService()
    matching_service = MatchingService()

    for d in existing_docs:
        dtype = d.doc_type
        rejection_reason_for_doc = None
        if hasattr(d, "rejection_notes") and d.rejection_notes:
            rejection_reason_for_doc = d.rejection_notes
        elif isinstance(d.mismatch_resolutions, dict):
            rejection_reason_for_doc = (
                d.mismatch_resolutions.get("rejection_reason")
                or d.mismatch_resolutions.get("rejection_notes")
            )

        uploaded_docs[dtype] = {
            "id": d.id,
            "doc_type": dtype,
            "filename": os.path.basename(d.file_ref or "document"),
            "file_ref": d.file_ref,
            "verification_status": d.verification_status,
            "rejection_notes": rejection_reason_for_doc,
            "created_at": d.created_at.isoformat() if d.created_at else datetime.datetime.utcnow().isoformat(),
        }
        
        # 1. Bypass OCR completely for photograph and signature
        if dtype.lower() in NON_OCR_DOC_TYPES:
            ocr_data[dtype] = {
                "extracted_fields": {},
                "confidence": 1.0,
                "provider": "bypassed",
                "raw_text_snippet": "Photograph / Signature recorded - Direct visual verification",
            }
        # 2. Use existing extracted_fields from DB if already available (avoid slow re-run)
        elif d.extracted_fields:
            ocr_data[dtype] = {
                "extracted_fields": d.extracted_fields,
                "confidence": d.confidence_score if d.confidence_score is not None else 0.9,
                "provider": d.normalization_provider or "database",
                "raw_text_snippet": (d.raw_ocr_text or "")[:200],
            }
        # 3. Fallback: Only run OCR if not previously extracted
        elif d.file_ref and os.path.exists(d.file_ref):
            try:
                ocr_res = ocr_service.run_ocr(d.file_ref, doc_type=dtype)
                ocr_data[dtype] = {
                    "extracted_fields": ocr_res.extracted_fields,
                    "confidence": ocr_res.confidence,
                    "provider": ocr_res.provider,
                    "raw_text_snippet": ocr_res.raw_text[:200] if ocr_res.raw_text else "",
                }
            except Exception as e:
                logger.warning(f"Failed pre-OCR for existing doc {d.id}: {e}")

    # Check for any previously saved ApplicationData in DB (decrypted)
    raw_fields = repo.get_fields(actual_app_id, decrypt=True) or {}
    if not raw_fields and actual_app_id != draft_id:
        raw_fields = repo.get_fields(draft_id, decrypt=True) or {}

    chat_data: Dict[str, Any] = {}
    for k, v in raw_fields.items():
        if v is not None and str(v).strip():
            canonical_k = field_alias_map.get(k, k)
            chat_data[canonical_k] = str(v).strip()

    first_spec = PARTICULARS_SPEC[0]
    initial_messages = [
        {
            "role": "assistant",
            "content": first_spec["question"],
            "field": first_spec["field"],
        }
    ]

    new_state: Dict[str, Any] = {
        "draft_id": draft_id,
        "service_id": service_id or "caste_certificate",
        "messages": initial_messages,
        "chat_data": chat_data,
        "ocr_data": ocr_data,
        "uploaded_documents": uploaded_docs,
        "comparison_scores": {},
        "pending_field": first_spec["field"],
        "progress_percent": calculate_progress(chat_data, service_id, uploaded_docs),
        "current_phase": "chat",
        "last_user_message": "",
        "latest_assistant_response": first_spec["question"],
        "can_view_form": False,
    }

    # If some particulars were already filled, advance pending field
    req_fields = get_required_fields_for_service(service_id, chat_data)
    missing = [f for f in req_fields if not chat_data.get(f)]
    if missing:
        new_state["pending_field"] = missing[0]
        curr_spec = next((p for p in PARTICULARS_SPEC if p["field"] == missing[0]), None)
        if curr_spec and chat_data:
            q = curr_spec["question"]
            new_state["messages"].append({"role": "assistant", "content": q, "field": missing[0]})
            new_state["latest_assistant_response"] = q
    else:
        new_state["pending_field"] = None
        new_state["current_phase"] = "documents" if len(uploaded_docs) < 5 else "ready_for_review"
        new_state["can_view_form"] = True
        ready_msg = f"All {len(req_fields)} statutory particulars have been recorded. You can review them in the panel on the right, or click 'View Application Form' at any time."
        new_state["messages"] = [
            {
                "role": "assistant",
                "content": f"Welcome back! 👋 I have loaded your application particulars.\n\n{ready_msg}",
                "field": "all_particulars_complete",
            }
        ]
        new_state["latest_assistant_response"] = ready_msg

    # Compute comparison scores if we have both chat_data and ocr_data
    _recompute_all_comparisons(new_state)

    # Attach clerk notes & rejected docs if present from reviewing officer
    app_val_summary = dict((app_record.validation_summary or {}) if app_record else {})
    clerk_notes = (
        app_val_summary.get("admin_notes")
        or app_val_summary.get("clarification_reason")
        or app_val_summary.get("rejection_reason")
        or app_val_summary.get("desk_clerk_notes")
        or ""
    )
    rejection_reason = (
        app_val_summary.get("rejection_reason")
        or app_val_summary.get("clarification_reason")
        or ""
    )
    rejected_docs = [dtype for dtype, d in uploaded_docs.items() if d.get("verification_status") == "REJECTED"]

    new_state["clerk_notes"] = clerk_notes
    new_state["rejection_reason"] = rejection_reason
    new_state["rejected_docs"] = rejected_docs

    if rejected_docs or clerk_notes:
        doc_labels = ", ".join([r.replace('_', ' ').title() for r in rejected_docs]) if rejected_docs else "document"
        feedback_lines = ["⚠️ **Action Required: Reviewing Officer Feedback**\n"]
        if clerk_notes:
            feedback_lines.append(f"> *\"{clerk_notes}\"*\n")
        if rejected_docs:
            feedback_lines.append(f"Please re-upload your rejected document: **{doc_labels}** using the document uploader panel on the right to proceed with verification.")
        else:
            feedback_lines.append("Please review and rectify the requested particulars to proceed with verification.")
        feedback_msg = "\n".join(feedback_lines)
        new_state["messages"].append({
            "role": "assistant",
            "content": feedback_msg,
            "field": "reviewer_feedback",
        })
        new_state["latest_assistant_response"] = feedback_msg

    SESSION_STORE[draft_id] = new_state
    return new_state


# Allowed document types per form field in authoritative priority order
DOC_PRIORITY_BY_FIELD = {
    "applicant_name": ["identity_proof", "caste_certificate", "age_proof"],
    "father_name": ["identity_proof", "caste_certificate", "age_proof"],
    "mother_name": ["age_proof"],
    "dob": ["age_proof", "identity_proof"],
    "gender": ["identity_proof"],
    "address": ["residential_proof", "identity_proof"],
    "annual_income": ["income_proof"],
    "caste_category": ["caste_certificate"],
}


def _recompute_all_comparisons(state: Dict[str, Any]):
    """
    Aggregates field comparisons strictly between declared chat/form particulars and
    the corresponding extracted value from authoritative supporting documents.

    Pure mathematical calculation:
    - Only compares valid form particulars declared by citizen and extracted for that same field.
    - Strictly blocks unrelated document headers (e.g. utility bills providing applicant name).
    - Excludes spurious metadata fields (employer_name, transaction_id, etc.).
    - Overall match score is the exact average of compared field scores.
    """
    matching_service = MatchingService()
    chat_data = state.get("chat_data") or {}
    ocr_data = state.get("ocr_data") or {}

    # 1. Normalize declared form particulars to canonical keys
    canonical_chat: Dict[str, str] = {}
    for k, v in chat_data.items():
        if v is not None and str(v).strip():
            canon_k = CANONICAL_FIELD_MAP.get(k, k)
            if canon_k in DOC_PRIORITY_BY_FIELD:
                canonical_chat[canon_k] = str(v).strip()

    # 2. Extract OCR values strictly from authoritative document types for each field
    merged_ocr_fields: Dict[str, str] = {}
    for target_field, allowed_docs in DOC_PRIORITY_BY_FIELD.items():
        for doc_type in allowed_docs:
            doc_ocr = ocr_data.get(doc_type) or {}
            extracted = doc_ocr.get("extracted_fields") or {}
            # Canonicalize extracted keys
            canonical_extracted = {
                CANONICAL_FIELD_MAP.get(k, k): v
                for k, v in extracted.items()
                if v and str(v).strip()
            }
            if target_field in canonical_extracted:
                merged_ocr_fields[target_field] = str(canonical_extracted[target_field]).strip()
                break

    # 3. Strictly compare the filled value and extracted value of the exact same field
    field_scores: Dict[str, Any] = {}
    matched_fields = []
    mismatched_fields = []

    for f in sorted(DOC_PRIORITY_BY_FIELD.keys()):
        if f in canonical_chat and f in merged_ocr_fields:
            app_val = canonical_chat[f]
            ocr_val = merged_ocr_fields[f]
            if not app_val or not ocr_val:
                continue

            cmp_res = matching_service.compare_fields(app_val, ocr_val, f)
            field_scores[f] = {
                "app_value": cmp_res.app_value,
                "ocr_value": cmp_res.ocr_value,
                "score": cmp_res.score,
                "match": cmp_res.match,
                "field_type": FIELD_TYPES.get(f, "text"),
            }
            if cmp_res.match:
                matched_fields.append(f)
            else:
                mismatched_fields.append(f)

    # 4. Pure mathematical overall score: exact average of compared fields
    if field_scores:
        overall_score = round(sum(v["score"] for v in field_scores.values()) / len(field_scores), 1)
        has_comparisons = True
    else:
        overall_score = None
        has_comparisons = False

    fields_only_in_app = [
        f for f in canonical_chat if f in DOC_PRIORITY_BY_FIELD and f not in merged_ocr_fields
    ]
    fields_only_in_doc = [
        f for f in merged_ocr_fields if f not in canonical_chat
    ]

    state["comparison_scores"] = {
        "overall_score": overall_score,
        "has_comparisons": has_comparisons,
        "field_scores": field_scores,
        "matched_fields": matched_fields,
        "mismatched_fields": mismatched_fields,
        "fields_only_in_app": fields_only_in_app,
        "fields_only_in_doc": fields_only_in_doc,
    }


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────

@router.get("/{draft_id}/state")
def get_automated_form_state(
    draft_id: str,
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """Retrieves full interactive state of the automated form session."""
    repo = ApplicationRepository(db)
    app = _find_draft_app(repo, draft_id)
    if not app:
        raise HTTPException(status_code=404, detail="Draft application not found")
    if app.citizen_ref != current_citizen.citizen_ref:
        raise HTTPException(status_code=403, detail="Forbidden")

    state = _get_or_init_session(
        draft_id=app.id,
        service_id=app.service_id,
        db=db,
        citizen_ref=current_citizen.citizen_ref,
    )

    service_names = {
        "caste_certificate": "Caste Certificate",
        "income_certificate": "Income Certificate",
        "domicile_certificate": "Domicile Certificate",
        "obc_ncl_certificate": "OBC Non Creamy Layer Certificate",
    }

    return {
        "success": True,
        "draft_id": app.id,
        "application_number": app.application_number,
        "certificate_id": app.application_number,
        "tracking_id": app.tracking_id,
        "service_id": app.service_id,
        "service_name": service_names.get(app.service_id, app.service_id),
        "status": app.status,
        "state": state,
    }


@router.post("/{draft_id}/chat")
def handle_automated_chat_turn(
    draft_id: str,
    body: ChatMessageRequest,
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """
    Feeds citizen message into the LangGraph workflow engine.
    Extracts the pending slot, determines next question, recalculates progress,
    and updates session state.
    """
    repo = ApplicationRepository(db)
    app = _find_draft_app(repo, draft_id)
    if not app:
        raise HTTPException(status_code=404, detail="Draft application not found")
    if app.citizen_ref != current_citizen.citizen_ref:
        raise HTTPException(status_code=403, detail="Forbidden")

    state = _get_or_init_session(
        draft_id=app.id,
        service_id=app.service_id,
        db=db,
        citizen_ref=current_citizen.citizen_ref,
    )

    user_text = body.message.strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    state["last_user_message"] = user_text

    # Invoke LangGraph Workflow
    try:
        updated_state = automated_form_graph.invoke(state)
        # Merge updated fields into current session
        state.update(updated_state)
    except Exception as e:
        logger.exception(f"LangGraph execution error: {e}")
        raise HTTPException(status_code=500, detail=f"Workflow execution failed: {str(e)}")

    _recompute_all_comparisons(state)
    SESSION_STORE[draft_id] = state

    # Persist updated chat_data into DB ApplicationData for this draft
    if state.get("chat_data"):
        for k, v in state["chat_data"].items():
            if v is not None and str(v).strip():
                try:
                    repo.save_field(
                        application_id=app.id,
                        field_name=k,
                        field_value=str(v).strip(),
                        source="AI_ASSISTED_CHATBOT",
                        confirmed=True,
                    )
                except Exception as e_save:
                    logger.warning(f"Failed to auto-save field {k} in ApplicationData: {e_save}")

    return {
        "success": True,
        "draft_id": draft_id,
        "messages": state["messages"],
        "chat_data": state["chat_data"],
        "pending_field": state.get("pending_field"),
        "progress_percent": state.get("progress_percent", 0),
        "current_phase": state.get("current_phase", "chat"),
        "can_view_form": state.get("can_view_form", False),
        "latest_assistant_response": state.get("latest_assistant_response", ""),
        "detected_intent": state.get("detected_intent", "PROVIDING_DATA"),
        "rectifying_field": state.get("rectifying_field"),
        "rectified_field": state.get("rectified_field"),
    }


@router.post("/{draft_id}/upload-document")
async def upload_automated_form_document(
    draft_id: str,
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """
    Receives supporting document upload:
    1. Saves file in data/uploads/{draft_id}/ and stores Document record in DB
    2. Runs local deterministic OCR via OCRService
    3. Stores extracted OCR text/fields separately in ocr_data[doc_type]
    4. Compares against chat_data using MatchingService to compute match scores
    5. Recalculates progress bar and returns updated state
    """
    repo = ApplicationRepository(db)
    app = _find_draft_app(repo, draft_id)
    if not app:
        raise HTTPException(status_code=404, detail="Draft application not found")
    if app.citizen_ref != current_citizen.citizen_ref:
        raise HTTPException(status_code=403, detail="Forbidden")

    state = _get_or_init_session(
        draft_id=app.id,
        service_id=app.service_id,
        db=db,
        citizen_ref=current_citizen.citizen_ref,
    )

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
        extracted_fields = {}
        confidence = 1.0
        provider = "bypassed"
        raw_text = "Photograph / Signature recorded - Direct visual verification"
        confidence_breakdown = {}

        doc = repo.save_document(
            application_id=app.id,
            doc_type=doc_type,
            file_ref=saved_path,
            extracted_fields={},
            confidence_score=1.0,
            raw_ocr_text=raw_text,
            verification_status="PENDING",
        )
    else:
        # 1. Save initial Document record in DB so it is never lost
        doc = repo.save_document(
            application_id=app.id,
            doc_type=doc_type,
            file_ref=saved_path,
            extracted_fields={},
            confidence_score=0.5,
            verification_status="PROCESSING_OCR",
        )

        # 2. Asynchronous OCR Execution in threadpool to keep event loop responsive
        ocr_service = OCRService()
        try:
            ocr_res = await asyncio.to_thread(ocr_service.run_ocr, saved_path, doc_type=doc_type)
            extracted_fields = ocr_res.extracted_fields or {}
            confidence = ocr_res.confidence
            confidence_breakdown = ocr_res.confidence_breakdown or {}
            provider = ocr_res.provider
            raw_text = ocr_res.raw_text or ""
        except Exception as e:
            logger.error(f"Async OCR execution failed for doc {doc_type}: {e}", exc_info=True)
            extracted_fields = {}
            confidence = 0.5
            confidence_breakdown = {}
            provider = "fallback_error"
            raw_text = f"OCR processing notice: {str(e)}"

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

    # 3. Store in ocr_data SEPARATELY from chat_data
    state.setdefault("ocr_data", {})
    state["ocr_data"][doc_type] = {
        "doc_id": doc.id,
        "doc_type": doc_type,
        "filename": clean_filename,
        "extracted_fields": extracted_fields,
        "confidence": confidence,
        "confidence_breakdown": confidence_breakdown,
        "provider": provider,
        "raw_text": raw_text[:400] if raw_text else "",
    }

    # 4. Update uploaded_documents map
    state.setdefault("uploaded_documents", {})
    state["uploaded_documents"][doc_type] = {
        "id": doc.id,
        "doc_type": doc_type,
        "filename": clean_filename,
        "file_ref": f"/data/uploads/{app.id}/{unique_name}",
        "verification_status": doc.verification_status,
        "rejection_notes": None,
        "created_at": doc.created_at.isoformat() if doc.created_at else datetime.datetime.utcnow().isoformat(),
    }
    if "rejected_docs" in state and doc_type in state["rejected_docs"]:
        state["rejected_docs"].remove(doc_type)

    # If document had a previous rejection in mismatch_resolutions, clear it
    if doc.mismatch_resolutions and "rejection_reason" in doc.mismatch_resolutions:
        m_resols = dict(doc.mismatch_resolutions)
        m_resols.pop("rejection_reason", None)
        doc.mismatch_resolutions = m_resols
        db.commit()

    # Recompute rejected_docs list
    state["rejected_docs"] = [
        dtype for dtype, d in state.get("uploaded_documents", {}).items()
        if d.get("verification_status") == "REJECTED"
    ]

    # 5. Recompute match comparisons
    _recompute_all_comparisons(state)

    # 6. Recompute overall progress
    state["progress_percent"] = calculate_progress(
        state.get("chat_data", {}),
        app.service_id,
        state["uploaded_documents"],
    )

    # If all particulars + docs are ready, update phase
    DOC_KEYS = ["identity_proof", "residential_proof", "age_proof", "signature", "passport_image"]
    has_all_docs = all(state["uploaded_documents"].get(k) for k in DOC_KEYS)
    req_fields = get_required_fields_for_service(app.service_id, state.get("chat_data", {}))
    has_all_fields = all(state.get("chat_data", {}).get(f) for f in req_fields)

    if has_all_docs and has_all_fields and not state["rejected_docs"]:
        state["current_phase"] = "ready_for_review"
        state["can_view_form"] = True
    elif has_all_fields and not state["rejected_docs"]:
        state["can_view_form"] = True

    SESSION_STORE[draft_id] = state

    return {
        "success": True,
        "document": state["uploaded_documents"][doc_type],
        "ocr_result": state["ocr_data"][doc_type],
        "comparison_scores": state["comparison_scores"],
        "progress_percent": state["progress_percent"],
        "current_phase": state["current_phase"],
        "can_view_form": state["can_view_form"],
        "rejected_docs": state["rejected_docs"],
    }


@router.delete("/{draft_id}/documents/{doc_id}")
def delete_automated_form_document(
    draft_id: str,
    doc_id: str,
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """Deletes an uploaded document and removes its OCR data."""
    repo = ApplicationRepository(db)
    app = _find_draft_app(repo, draft_id)
    if not app:
        raise HTTPException(status_code=404, detail="Draft application not found")
    if app.citizen_ref != current_citizen.citizen_ref:
        raise HTTPException(status_code=403, detail="Forbidden")

    doc = db.query(Document).filter(Document.id == doc_id, Document.application_id == app.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc_type = doc.doc_type
    if doc.file_ref and os.path.exists(doc.file_ref):
        try:
            os.remove(doc.file_ref)
        except Exception:
            pass

    db.delete(doc)
    db.commit()

    state = _get_or_init_session(
        draft_id=app.id,
        service_id=app.service_id,
        db=db,
        citizen_ref=current_citizen.citizen_ref,
    )

    if doc_type in state.get("uploaded_documents", {}):
        del state["uploaded_documents"][doc_type]
    if doc_type in state.get("ocr_data", {}):
        del state["ocr_data"][doc_type]
    if "rejected_docs" in state and doc_type in state["rejected_docs"]:
        state["rejected_docs"].remove(doc_type)

    _recompute_all_comparisons(state)
    state["progress_percent"] = calculate_progress(
        state.get("chat_data", {}),
        app.service_id,
        state.get("uploaded_documents", {}),
    )
    SESSION_STORE[draft_id] = state

    return {
        "success": True,
        "message": "Document removed successfully",
        "progress_percent": state["progress_percent"],
        "comparison_scores": state["comparison_scores"],
        "rejected_docs": state.get("rejected_docs", []),
    }


@router.post("/{draft_id}/resolve-field")
def resolve_field_discrepancy(
    draft_id: str,
    body: ResolveFieldRequest,
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """
    Phase 2 Discrepancy Resolution:
    Allows user to select:
    - 'CHAT': Keep the conversational/form input
    - 'OCR': Overwrite with the OCR-extracted document value
    - 'CUSTOM': Set a custom revised value
    """
    repo = ApplicationRepository(db)
    app = _find_draft_app(repo, draft_id)
    if not app:
        raise HTTPException(status_code=404, detail="Draft application not found")
    if app.citizen_ref != current_citizen.citizen_ref:
        raise HTTPException(status_code=403, detail="Forbidden")

    state = _get_or_init_session(
        draft_id=app.id,
        service_id=app.service_id,
        db=db,
        citizen_ref=current_citizen.citizen_ref,
    )

    field_name = body.field_name
    canonical_name = CANONICAL_FIELD_MAP.get(field_name, field_name)
    chat_data = state.setdefault("chat_data", {})

    chosen_val = None
    if body.chosen_source == "CHAT":
        chosen_val = chat_data.get(canonical_name) or chat_data.get(field_name)
    elif body.chosen_source == "OCR":
        chosen_val = body.chosen_value
        if not chosen_val:
            # Look up authoritative OCR value
            for allowed_doc in DOC_PRIORITY_BY_FIELD.get(canonical_name, []):
                doc_info = state.get("ocr_data", {}).get(allowed_doc) or {}
                ef = doc_info.get("extracted_fields") or {}
                canon_ef = {CANONICAL_FIELD_MAP.get(k, k): v for k, v in ef.items() if v and str(v).strip()}
                if canonical_name in canon_ef:
                    chosen_val = str(canon_ef[canonical_name]).strip()
                    break
    elif body.chosen_source == "CUSTOM":
        if body.chosen_value:
            chosen_val = body.chosen_value.strip()

    if chosen_val is not None:
        chat_data[canonical_name] = chosen_val
        chat_data[field_name] = chosen_val
        if canonical_name == "applicant_name":
            chat_data["name"] = chosen_val
        elif canonical_name == "gender":
            chat_data["sex"] = chosen_val
        elif canonical_name == "caste_category":
            chat_data["caste"] = chosen_val

    _recompute_all_comparisons(state)
    SESSION_STORE[draft_id] = state

    return {
        "success": True,
        "field_name": field_name,
        "current_value": chosen_val or chat_data.get(field_name) or chat_data.get(canonical_name),
        "chat_data": chat_data,
        "comparison_scores": state["comparison_scores"],
    }


@router.post("/{draft_id}/update-form-field")
def update_form_field(
    draft_id: str,
    body: UpdateFormFieldRequest,
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """Allows direct user editing of any form field during Phase 2 review."""
    repo = ApplicationRepository(db)
    app = _find_draft_app(repo, draft_id)
    if not app:
        raise HTTPException(status_code=404, detail="Draft application not found")
    if app.citizen_ref != current_citizen.citizen_ref:
        raise HTTPException(status_code=403, detail="Forbidden")

    state = _get_or_init_session(
        draft_id=app.id,
        service_id=app.service_id,
        db=db,
        citizen_ref=current_citizen.citizen_ref,
    )

    canonical_name = CANONICAL_FIELD_MAP.get(body.field_name, body.field_name)
    val = body.value.strip()
    chat_data = state.setdefault("chat_data", {})
    chat_data[body.field_name] = val
    chat_data[canonical_name] = val
    if canonical_name == "applicant_name":
        chat_data["name"] = val
    elif canonical_name == "gender":
        chat_data["sex"] = val
    elif canonical_name == "caste_category":
        chat_data["caste"] = val

    _recompute_all_comparisons(state)
    SESSION_STORE[draft_id] = state

    return {
        "success": True,
        "field_name": body.field_name,
        "value": body.value,
        "chat_data": state["chat_data"],
        "comparison_scores": state["comparison_scores"],
    }


@router.post("/{draft_id}/submit")
def submit_automated_application(
    draft_id: str,
    body: SubmitAutomatedFormRequest,
    current_citizen = Depends(get_current_citizen),
    db: Session = Depends(get_db),
):
    """
    Finalizes and submits the AI-assisted application:
    1. Validates statutory declaration
    2. Persists all validated particulars into DB ApplicationData table
    3. Moves application status from DRAFT -> SUBMITTED
    4. Writes AuditLog event
    """
    if not body.declaration_confirmed:
        raise HTTPException(status_code=400, detail="You must check the statutory declaration before submitting.")

    repo = ApplicationRepository(db)
    app = _find_draft_app(repo, draft_id)
    if not app:
        raise HTTPException(status_code=404, detail="Draft application not found")
    if app.citizen_ref != current_citizen.citizen_ref:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Block submission if any documents remain in REJECTED status
    existing_docs = db.query(Document).filter(Document.application_id == app.id).all()
    rejected_docs = [d.doc_type for d in existing_docs if d.verification_status == "REJECTED"]
    if rejected_docs:
        rejected_names = ", ".join([r.replace("_", " ").title() for r in rejected_docs])
        raise HTTPException(
            status_code=400,
            detail=f"Please re-upload your rejected document(s) ({rejected_names}) before submitting.",
        )

    state = _get_or_init_session(
        draft_id=app.id,
        service_id=app.service_id,
        db=db,
        citizen_ref=current_citizen.citizen_ref,
    )

    # Merge any submitted overrides with session chat_data
    final_fields = dict(state.get("chat_data") or {})
    if body.fields:
        for k, v in body.fields.items():
            if v is not None and str(v).strip():
                final_fields[k] = str(v).strip()

    if body.service_id:
        app.service_id = body.service_id

    # Persist particulars into ApplicationData
    for k, v in final_fields.items():
        if v is not None and str(v).strip():
            repo.save_field(
                application_id=app.id,
                field_name=k,
                field_value=str(v).strip(),
                source="AI_ASSISTED_CHATBOT",
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
    action_text = (
        f"APPLICATION_RESUBMITTED_REASSIGNED: {app.application_number} ({old_status} -> {target_status}, reassigned to {prev_clerk})"
        if (is_resubmission and prev_clerk)
        else f"APPLICATION_SUBMITTED_AUTOMATED_AI: {app.application_number} ({old_status} -> {target_status})"
    )
    AuditRepository(db).write(
        event_type="SUBMISSION",
        actor=current_citizen.citizen_ref,
        application_id=app.id,
        action=action_text,
        outcome="SUCCESS",
        metadata={
            "channel": "WEB_AUTOMATED_AI",
            "service_id": app.service_id,
            "fields_count": len(final_fields),
            "docs_count": len(state.get("uploaded_documents", {})),
            "ocr_match_score": state.get("comparison_scores", {}).get("overall_score", 100.0),
            "previous_status": old_status,
            "new_status": target_status,
            "reassigned_to": prev_clerk if (is_resubmission and prev_clerk) else None,
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

    # Clean up session memory after submission
    if draft_id in SESSION_STORE:
        del SESSION_STORE[draft_id]

    return {
        "success": True,
        "application_id": app.id,
        "application_number": app.application_number,
        "certificate_id": app.application_number,
        "tracking_id": app.tracking_id,
        "citizen_id": current_citizen.citizen_ref,
        "service_id": app.service_id,
        "service_name": app.service.name_en if app.service else app.service_id,
        "status": app.status,
        "assigned_to": app.assigned_to,
        "submitted_at": app.submitted_at.isoformat(),
        "message": "AI-assisted application submitted successfully.",
    }
