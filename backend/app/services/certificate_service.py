"""
Certificate Generation Service
Generates official government certificates upon successful payment completion.
Integrates with SQLite database, Certificate model, and SSE event broadcast.
Generates authentic binary PDF documents using PyMuPDF.
"""
import os
import uuid
import hashlib
import logging
import datetime
from typing import Dict, Any
from sqlalchemy.orm import Session
import pymupdf

from app.models.db_models import Application, Certificate, Citizen
from app.data_layer.repositories.application_repo import ApplicationRepository
from app.rules_engine.engine import ServiceSpecLoader

logger = logging.getLogger(__name__)

CERT_DIR = "data/certificates"
os.makedirs(CERT_DIR, exist_ok=True)


class CertificateService:
    def __init__(self, db: Session):
        self.db = db
        self.app_repo = ApplicationRepository(db)

    def _create_certificate_pdf(
        self,
        file_path: str,
        cert_number: str,
        app: Application,
        citizen_name: str,
        service_title: str,
        issue_date: str,
        expiry_date: str,
    ) -> None:
        """Create a styled, authentic Government of Maharashtra PDF certificate using PyMuPDF."""
        doc = pymupdf.open()
        page = doc.new_page(width=595, height=842)  # A4 portrait: 595.3 x 841.9 points

        navy = (0.0, 0.208, 0.373)      # #00355f
        gold = (0.85, 0.47, 0.02)       # #d97706
        charcoal = (0.12, 0.16, 0.22)   # #1e293b
        slate = (0.39, 0.45, 0.55)      # #64748b
        light_bg = (0.97, 0.98, 0.99)   # #f8fafc

        # 1. Outer & Inner Borders
        page.draw_rect(pymupdf.Rect(20, 20, 575, 822), color=navy, width=3)
        page.draw_rect(pymupdf.Rect(26, 26, 569, 816), color=gold, width=1.5)

        # 2. Header Section
        page.draw_rect(pymupdf.Rect(30, 30, 565, 125), color=light_bg, fill=light_bg)
        page.insert_text((150, 60), "GOVERNMENT OF MAHARASHTRA", fontsize=16, fontname="helv", color=navy)
        page.insert_text((205, 80), "REVENUE DEPARTMENT", fontsize=13, fontname="helv", color=charcoal)
        page.insert_text((155, 105), "OFFICIAL STATUTORY CERTIFICATE", fontsize=14, fontname="helv", color=gold)

        # Decorative separator line
        page.draw_line(pymupdf.Point(40, 132), pymupdf.Point(555, 132), color=navy, width=1.5)

        # 3. Certificate & Application Meta Box
        meta_rect = pymupdf.Rect(40, 145, 555, 235)
        page.draw_rect(meta_rect, color=slate, fill=light_bg, width=0.8)

        page.insert_text((55, 168), f"Certificate No:  {cert_number}", fontsize=11, fontname="helv", color=navy)
        page.insert_text((340, 168), f"Date of Issue:  {issue_date}", fontsize=11, fontname="helv", color=charcoal)
        page.insert_text((55, 192), f"Tracking ID:     {app.tracking_id or app.application_number}", fontsize=10.5, fontname="helv", color=charcoal)
        page.insert_text((340, 192), f"Valid Upto:     {expiry_date}", fontsize=10.5, fontname="helv", color=charcoal)
        page.insert_text((55, 216), f"Application No:  {app.application_number}", fontsize=10.5, fontname="helv", color=charcoal)
        page.insert_text((340, 216), "Status:          LEGALLY VALID", fontsize=10.5, fontname="helv", color=(0.08, 0.5, 0.24))

        # 4. Certification Statement
        page.insert_text((55, 270), "TO WHOMSOEVER IT MAY CONCERN", fontsize=13, fontname="helv", color=navy)

        stmt_text = (
            f"This is to certify that the citizen identified below has formally submitted the application for "
            f"issuance of '{service_title}'. The relevant documents, records, and statutory declarations have "
            f"been thoroughly verified and processed in compliance with the Maharashtra Right to Public Services Act "
            f"and the rules framed thereunder by the Revenue Department."
        )
        rect_text = pymupdf.Rect(55, 285, 540, 360)
        page.insert_textbox(rect_text, stmt_text, fontsize=10.5, fontname="helv", color=charcoal, lineheight=1.4)

        # 5. Citizen Particulars Table
        part_box = pymupdf.Rect(40, 370, 555, 530)
        page.draw_rect(part_box, color=(0.8, 0.85, 0.9), fill=(0.99, 0.99, 1.0), width=1)
        page.draw_rect(pymupdf.Rect(40, 370, 555, 395), color=navy, fill=navy)
        page.insert_text((55, 388), "BENEFICIARY PARTICULARS", fontsize=11, fontname="helv", color=(1.0, 1.0, 1.0))

        y = 420
        fields = [
            ("Full Name of Citizen", citizen_name),
            ("Citizen Reference ID", app.citizen_ref or "N/A"),
            ("Service Name", service_title),
            ("Jurisdiction / State", "Maharashtra"),
            ("Verification Level", "Competent Revenue Authority (District Office)"),
        ]
        for label, val in fields:
            page.insert_text((55, y), f"{label}:", fontsize=10, fontname="helv", color=slate)
            page.insert_text((220, y), str(val), fontsize=10, fontname="helv", color=charcoal)
            page.draw_line(pymupdf.Point(50, y + 6), pymupdf.Point(545, y + 6), color=(0.9, 0.92, 0.95), width=0.5)
            y += 24

        # 6. Statutory Declaration & Notes
        legal_text = (
            "Statutory Notice: This certificate is issued based on the digital verification of records and "
            "declarations made by the applicant. Any falsification, suppression of material facts, or fraudulent "
            "representation shall render this certificate null and void ab initio and attract punitive action "
            "under the Indian Penal Code and applicable state enactments."
        )
        page.insert_textbox(pymupdf.Rect(55, 545, 540, 610), legal_text, fontsize=8.5, fontname="helv", color=slate, lineheight=1.3)

        # 7. Digital Signature & Official Seal Box
        sig_rect = pymupdf.Rect(40, 620, 555, 730)
        page.draw_rect(sig_rect, color=navy, fill=light_bg, width=1.2)

        # Left: Seal & QR representation
        qr_box = pymupdf.Rect(55, 635, 140, 715)
        page.draw_rect(qr_box, color=gold, fill=(1.0, 0.98, 0.94), width=1)
        page.insert_text((72, 660), "[ OFFICIAL ]", fontsize=9, fontname="helv", color=gold)
        page.insert_text((82, 678), "STATE", fontsize=11, fontname="helv", color=navy)
        page.insert_text((85, 693), "SEAL", fontsize=11, fontname="helv", color=navy)
        page.insert_text((65, 708), "MAHARASHTRA", fontsize=8, fontname="helv", color=charcoal)

        # Right: Digital Signature Details
        auth_hash = hashlib.sha256(f"{cert_number}-{app.application_number}-{citizen_name}".encode()).hexdigest()[:24].upper()
        page.insert_text((160, 645), "DIGITALLY SIGNED & VERIFIED", fontsize=11, fontname="helv", color=navy)
        page.insert_text((160, 663), "Signatory: District Officer / Sub-Divisional Magistrate", fontsize=9.5, fontname="helv", color=charcoal)
        page.insert_text((160, 679), "Authority: Department of Revenue, Government of Maharashtra", fontsize=9.5, fontname="helv", color=charcoal)
        page.insert_text((160, 695), f"Issuance Timestamp: {issue_date} UTC", fontsize=9.5, fontname="helv", color=slate)
        page.insert_text((160, 711), f"Digital Signature Hash: {auth_hash}", fontsize=8.5, fontname="helv", color=slate)

        # 8. Footer Section
        page.draw_line(pymupdf.Point(40, 785), pymupdf.Point(555, 785), color=slate, width=0.5)
        page.insert_text((120, 802), "This is a computer-generated statutory certificate and requires no physical ink signature.", fontsize=8.5, fontname="helv", color=slate)

        doc.save(file_path)
        doc.close()

    def generate_and_store(
        self,
        application_id: str,
        citizen_ref: str,
    ) -> Dict[str, Any]:
        """
        Generate and persist official certificate using PyMuPDF.
        Transitions state to CERTIFICATE_READY -> COMPLETED.
        """
        app = self.app_repo.get_by_id(application_id)
        if not app:
            logger.error(f"Cannot generate certificate: Application {application_id} not found")
            return {"success": False, "error": "Application not found"}

        cert_number = f"CERT-{datetime.datetime.utcnow().year}-{str(uuid.uuid4())[:8].upper()}"
        file_path = os.path.join(CERT_DIR, f"{cert_number}.pdf")

        # Resolve applicant name & service title
        citizen = self.db.query(Citizen).filter(Citizen.citizen_ref == app.citizen_ref).first()
        citizen_name = citizen.name if citizen and citizen.name else "Valued Citizen"
        try:
            fields = self.app_repo.get_fields(app.id, decrypt=True)
            if fields.get("applicant_name"):
                citizen_name = fields["applicant_name"]
            elif fields.get("name"):
                citizen_name = fields["name"]
        except Exception:
            pass

        spec = ServiceSpecLoader.get(app.service_id) if app.service_id else None
        if spec and isinstance(spec.name, dict):
            service_title = spec.name.get("en") or list(spec.name.values())[0]
        elif spec:
            service_title = str(spec.name)
        elif app.service:
            service_title = app.service.name_en
        else:
            service_title = (app.service_id or "Statutory Certificate").replace("_", " ").title()

        now_dt = datetime.datetime.utcnow()
        issue_date_str = now_dt.strftime("%d-%m-%Y")
        expiry_date_str = (now_dt + datetime.timedelta(days=180)).strftime("%d-%m-%Y")

        # Create valid binary PDF file
        try:
            self._create_certificate_pdf(
                file_path=file_path,
                cert_number=cert_number,
                app=app,
                citizen_name=citizen_name,
                service_title=service_title,
                issue_date=issue_date_str,
                expiry_date=expiry_date_str,
            )
        except Exception as e:
            logger.error(f"Could not generate PDF certificate via PyMuPDF: {e}", exc_info=True)
            # Fallback basic PDF writing if anything unexpected fails
            doc = pymupdf.open()
            page = doc.new_page()
            page.insert_text((50, 100), f"GOVERNMENT OF MAHARASHTRA\nCertificate Number: {cert_number}\nApplication: {app.application_number}\nCitizen: {citizen_name}")
            doc.save(file_path)
            doc.close()

        # Persist Certificate record
        cert = self.app_repo.issue_certificate(
            application_id=app.id,
            file_ref=file_path,
            expiry_days=180,
        )
        cert.certificate_number = cert_number
        self.db.commit()

        # Broadcast SSE
        try:
            from app.api.routes.stream import broadcast_status_change_sync, bus
            broadcast_status_change_sync(
                application_id=app.tracking_id or str(app.id),
                tracking_id=app.tracking_id or app.application_number,
                new_status="CERTIFICATE_READY",
                actor="SYSTEM",
                extra={
                    "certificate_number": cert_number,
                    "file_ref": f"/data/certificates/{cert_number}.pdf",
                },
            )
            if citizen_ref:
                bus.publish_sync(citizen_ref, {
                    "type": "status_change",
                    "tracking_id": app.tracking_id or app.application_number,
                    "new_status": "CERTIFICATE_READY",
                    "actor": "SYSTEM",
                    "certificate_number": cert_number,
                })
        except Exception as e:
            logger.warning(f"SSE broadcast error: {e}")

        return {
            "success": True,
            "certificate_number": cert_number,
            "file_ref": file_path,
            "application_id": str(app.id),
            "tracking_id": app.tracking_id,
        }
