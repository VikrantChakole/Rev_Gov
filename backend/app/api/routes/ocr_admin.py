"""
Admin OCR Configuration & Diagnostic Test Sandbox Router
Provides endpoints for:
1. Querying OCR engine status (Tesseract, Gemini 3.6 Flash Vision, OpenRouter Vision, PyMuPDF)
2. Updating OCR active provider and custom binary executable paths
3. Real-time test sandbox to upload sample documents and validate OCR extraction
"""
import os
import uuid
import time
import shutil
import logging
from typing import Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form

from app.services.ocr_service import OCRService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/ocr", tags=["admin-ocr"])

# Shared service instance
ocr_service = OCRService()


class UpdateOCRConfigRequest(BaseModel):
    provider: Optional[str] = "auto"              # "auto" | "vision_ai" | "tesseract" | "mock"
    tesseract_cmd: Optional[str] = None


@router.get("/config")
def get_ocr_configuration():
    """Retrieve full OCR engine configuration and live status."""
    return {
        "success": True,
        "config": ocr_service.get_health_status(),
    }


@router.post("/config")
def update_ocr_configuration(body: UpdateOCRConfigRequest):
    """
    Update active OCR provider and/or configure custom Tesseract binary path.
    Re-validates connection and returns updated health status.
    """
    updated = ocr_service.update_config(
        provider=body.provider or "auto",
        tesseract_cmd=body.tesseract_cmd,
    )
    return {
        "success": True,
        "message": f"OCR configuration updated. Active provider: {updated['active_provider']}.",
        "config": updated,
    }


@router.post("/test")
async def test_ocr_extraction(
    file: UploadFile = File(...),
    doc_type: Optional[str] = Form(None),
    language: Optional[str] = Form("eng+hin+mar"),
):
    """
    Test Window / Sandbox for Admins to validate OCR on any uploaded image or PDF.
    Returns:
    - active provider used
    - execution time in milliseconds
    - overall confidence score
    - detected document type
    - raw extracted text
    - structured extracted fields
    """
    test_dir = "data/ocr_cache/test_sandbox"
    os.makedirs(test_dir, exist_ok=True)

    clean_filename = os.path.basename(file.filename or f"test_{uuid.uuid4().hex[:6]}.pdf")
    ext = os.path.splitext(clean_filename)[1] or ".png"
    temp_path = os.path.join(test_dir, f"sandbox_{uuid.uuid4().hex[:6]}{ext}").replace("\\", "/")

    try:
        with open(temp_path, "wb") as f_out:
            shutil.copyfileobj(file.file, f_out)

        diagnostics = ocr_service.test_ocr(
            file_path=temp_path,
            doc_type=doc_type if doc_type and doc_type != "AUTO" else None,
            language=language or "eng+hin+mar",
        )

        return {
            "success": True,
            "filename": clean_filename,
            "diagnostics": diagnostics,
        }
    except Exception as e:
        logger.exception(f"[OCR_TEST_FAIL] Error running OCR test: {e}")
        raise HTTPException(status_code=500, detail=f"OCR test execution error: {str(e)}")
    finally:
        # Clean up temporary test file
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
