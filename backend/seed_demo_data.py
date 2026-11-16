"""
Seed Script — TCS RevGOV Live Demo Data Population
Creates reproducible accounts for all 7 roles:
1. Citizen
2. Assisted Operator
3. Officer
4. Reviewer
5. Approver
6. Auditor
7. Administrator

Seeds complete sample Income Certificate journey records for live presentation.
"""
import os
import sys
import datetime
from passlib.context import CryptContext

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from app.core.database import SessionLocal, engine, Base
from app.models.db_models import User, Citizen, Application, Document, Payment, ApplicationData, ChannelIdentity, Certificate, AuditLog
from app.services.risk_scoring_service import RiskScoringService

pwd_ctx = CryptContext(schemes=["sha256_crypt"], deprecated="auto")


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("🌱 Seeding TCS RevGOV Demo Accounts...")

        # 1. Accounts to seed
        accounts = [
            {"username": "citizen", "password": "Citizen123!", "role": "CITIZEN", "name": "Rajesh Kumar Sharma", "phone": "+919876543210", "email": "rajesh.sharma@example.com"},
            {"username": "operator", "password": "Operator123!", "role": "OPERATOR", "name": "Operator Suresh V.", "phone": "+919811122233", "email": "operator@revgov.gov.in"},
            {"username": "deskclerk", "password": "Clerk123!", "role": "DESK_CLERK", "name": "Clerk Ramesh Patil", "phone": "+919811122244", "email": "clerk@revgov.gov.in"},
            {"username": "officer", "password": "Officer123!", "role": "OFFICER", "name": "Officer Anjali Nair", "phone": "+919822233344", "email": "officer@revgov.gov.in"},
            {"username": "districtofficer", "password": "Officer123!", "role": "DISTRICT_OFFICER", "name": "District Officer Kavita Desai", "phone": "+919822233355", "email": "districtofficer@revgov.gov.in"},
            {"username": "reviewer", "password": "Reviewer123!", "role": "REVIEWER", "name": "Reviewer Manoj Menon", "phone": "+919833344455", "email": "reviewer@revgov.gov.in"},
            {"username": "approver", "password": "Approver123!", "role": "APPROVER", "name": "District Collector R. Varma", "phone": "+919844455566", "email": "approver@revgov.gov.in"},
            {"username": "auditor", "password": "Auditor123!", "role": "AUDITOR", "name": "Audit Inspector K. Pillai", "phone": "+919855566677", "email": "auditor@revgov.gov.in"},
            {"username": "admin", "password": "Admin123!", "role": "ADMIN", "name": "System Administrator", "phone": "+919866677788", "email": "admin@revgov.gov.in"},
        ]

        citizen_ref_map = {}

        for acc in accounts:
            usr = db.query(User).filter(User.username == acc["username"]).first()
            if not usr:
                c_ref = None
                if acc["role"] == "CITIZEN":
                    cit = db.query(Citizen).filter(Citizen.phone == acc["phone"]).first()
                    if not cit:
                        cit = Citizen(
                            citizen_ref=f"CIT-DEMO-001",
                            name=acc["name"],
                            phone=acc["phone"],
                            email=acc["email"],
                            preferred_language="ml",
                            preferred_channel="WEB"
                        )
                        db.add(cit)
                        db.commit()
                    c_ref = cit.citizen_ref
                    citizen_ref_map["citizen"] = c_ref

                usr = User(
                    username=acc["username"],
                    hashed_password=pwd_ctx.hash(acc["password"]),
                    role=acc["role"],
                    citizen_ref=c_ref,
                    is_active=True
                )
                db.add(usr)
                db.commit()
                print(f"  ✅ Created user: {acc['username']} ({acc['role']})")

        # 2. Seed Sample Application REV-DEMO-2026-0001
        app_num = "REV-DEMO-2026-0001"
        existing_app = db.query(Application).filter(Application.application_number == app_num).first()
        
        if not existing_app:
            cit_ref = citizen_ref_map.get("citizen", "CIT-DEMO-001")
            app = Application(
                application_number=app_num,
                tracking_id="INC-2026-000001",
                citizen_ref=cit_ref,
                service_id="income_certificate",
                status="UNDER_REVIEW",
                current_step="OFFICER_REVIEW",
                channel_origin="WEB",
                last_channel="WHATSAPP",
                language="ml",
                progress_percent=75,
                overall_match_score=85.0,
                payment_status="PAID",
                anomaly_score=0.12,
                consent_given=True,
                submitted_at=datetime.datetime.utcnow() - datetime.timedelta(hours=3),
            )
            db.add(app)
            db.commit()

            # Application fields
            form_fields = [
                ("applicant_name", "Rajesh Kumar Sharma", "RESTRICTED"),
                ("phone", "+919876543210", "RESTRICTED"),
                ("email", "rajesh.sharma@example.com", "QUASI_IDENTIFIER"),
                ("annual_income", "48000", "RESTRICTED"),
                ("income_source", "Agriculture & Local Retail", "NON_SENSITIVE"),
                ("district", "Ernakulam", "NON_SENSITIVE"),
                ("taluka", "Kochi", "NON_SENSITIVE"),
                ("village", "Kadavanthra", "NON_SENSITIVE"),
            ]
            for f_name, f_val, f_class in form_fields:
                db.add(ApplicationData(
                    application_id=app.id,
                    field_name=f_name,
                    field_value_encrypted=f_val,
                    classification=f_class,
                    source="WEB",
                    confirmed=True
                ))

            # Identity Document with minor OCR mismatch
            db.add(Document(
                application_id=app.id,
                doc_type="IDENTITY_PROOF",
                file_ref="data/uploads/demo_aadhaar.png",
                upload_channel="WEB",
                raw_ocr_text="Government of India Aadhaar Card Name: Rajesh K. Sharma DOB: 15/03/1990",
                raw_extracted_fields={"applicant_name": "Rajesh K. Sharma", "dob": "15/03/1990"},
                normalized_fields={"applicant_name": "Rajesh K. Sharma", "dob": "15/03/1990"},
                confidence_score=0.88,
                overall_match_score=85.0,
                matched_fields=["dob"],
                mismatch_fields=["applicant_name"],
                verification_status="REVIEW_REQUIRED"
            ))

            # Payment record
            if not db.query(Payment).filter(Payment.transaction_id == "TXN-REV-2026-9901").first():
                db.add(Payment(
                    application_id=app.id,
                    transaction_id="TXN-REV-2026-9901",
                    amount=25.0,
                    currency="INR",
                    method="UPI",
                    status="SUCCESS",
                    gateway="SIMULATED_TREASURY_GATEWAY"
                ))

            # Audit Trail
            db.add(AuditLog(
                event_type="APPLICATION_SUBMITTED",
                actor="CITIZEN:CIT-DEMO-001",
                citizen_ref=cit_ref,
                application_id=app.id,
                action="Income Certificate application submitted successfully with consent and payment.",
                outcome="SUCCESS",
                metadata_json={"application_number": app_num, "fee": 25.0}
            ))

            db.commit()
            print(f"  ✅ Seeded demo application: {app_num} ({app.status})")

        print("🎉 Demo Data Seeding Complete!")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
