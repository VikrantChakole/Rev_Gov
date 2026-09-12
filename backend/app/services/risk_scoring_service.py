"""
Risk & Fraud Scoring Service — Transparent, Explainable Risk Engine
Computes risk score (0–100) and contributing signals for revenue service applications.
Used by Officers, Reviewers, and Approvers for decision support.

IMPORTANT: Fraud score NEVER auto-rejects a citizen.
Officers/Reviewers can review signals and provide false-positive overrides with mandatory reasons.
"""
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class RiskSignal:
    code: str
    name: str
    severity: str        # LOW | MEDIUM | HIGH | CRITICAL
    weight: int
    confidence: float
    evidence: str
    limitations: Optional[str] = None


@dataclass
class RiskAssessmentResult:
    score: int                           # 0 to 100
    category: str                        # LOW | MEDIUM | HIGH | CRITICAL
    signals: List[RiskSignal] = field(default_factory=list)
    override_reason: Optional[str] = None
    overridden_by: Optional[str] = None
    override_timestamp: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "score": self.score,
            "category": self.category,
            "signals": [
                {
                    "code": s.code,
                    "name": s.name,
                    "severity": s.severity,
                    "weight": s.weight,
                    "confidence": s.confidence,
                    "evidence": s.evidence,
                    "limitations": s.limitations,
                }
                for s in self.signals
            ],
            "override_reason": self.override_reason,
            "overridden_by": self.overridden_by,
            "override_timestamp": self.override_timestamp,
        }


class RiskScoringService:
    """Computes explainable risk scores for applications based on empirical verification signals."""

    @staticmethod
    def evaluate_application(
        app_data: Dict[str, Any],
        documents: List[Dict[str, Any]],
        anomaly_score: float = 0.0
    ) -> RiskAssessmentResult:
        signals: List[RiskSignal] = []
        total_score = 0

        declared_name = (app_data.get("applicant_name") or app_data.get("name") or "").strip().lower()
        declared_income = app_data.get("annual_income") or app_data.get("family_income")

        # 1. OCR Mismatch Signal
        for doc in documents:
            doc_type = doc.get("doc_type", "")
            extracted = doc.get("extracted_fields") or doc.get("normalized_fields") or {}
            ocr_name = (extracted.get("applicant_name") or extracted.get("name") or "").strip().lower()

            if declared_name and ocr_name and declared_name != ocr_name:
                weight = 25
                total_score += weight
                signals.append(RiskSignal(
                    code="NAME_MISMATCH",
                    name="Applicant Name Mismatch",
                    severity="HIGH",
                    weight=weight,
                    confidence=0.88,
                    evidence=f"Declared name '{app_data.get('applicant_name')}' differs from {doc_type} OCR extracted name '{extracted.get('applicant_name')}'",
                    limitations="Name spelling variations may occur across regional language transliterations."
                ))
                break

        # 2. Low OCR Confidence Signal
        for doc in documents:
            conf = float(doc.get("confidence_score") or doc.get("confidence") or 1.0)
            if conf < 0.70:
                weight = 20
                total_score += weight
                signals.append(RiskSignal(
                    code="LOW_OCR_CONFIDENCE",
                    name="Low Document OCR Confidence",
                    severity="MEDIUM",
                    weight=weight,
                    confidence=conf,
                    evidence=f"Document '{doc.get('doc_type', 'UPLOAD')}' produced low OCR confidence ({int(conf * 100)}%)",
                    limitations="Image might be slightly blurry, dark, or cropped."
                ))
                break

        # 3. Duplicate Document Hash Signal
        for doc in documents:
            if doc.get("is_duplicate"):
                weight = 17
                total_score += weight
                signals.append(RiskSignal(
                    code="DUPLICATE_DOCUMENT_HASH",
                    name="Duplicate Document Fingerprint",
                    severity="HIGH",
                    weight=weight,
                    confidence=0.95,
                    evidence="Uploaded document file hash matches a previously submitted document from another application.",
                    limitations="Citizen may have submitted document for a relative's previous application."
                ))
                break

        # 4. Income Discrepancy Signal
        for doc in documents:
            extracted = doc.get("extracted_fields") or doc.get("normalized_fields") or {}
            ocr_income = extracted.get("annual_income") or extracted.get("gross_income")
            if declared_income and ocr_income:
                try:
                    dec_val = float(str(declared_income).replace(",", "").replace("₹", ""))
                    ocr_val = float(str(ocr_income).replace(",", "").replace("₹", ""))
                    if abs(dec_val - ocr_val) > 10000:
                        weight = 15
                        total_score += weight
                        signals.append(RiskSignal(
                            code="INCONSISTENT_INCOME",
                            name="Income Field Discrepancy",
                            severity="MEDIUM",
                            weight=weight,
                            confidence=0.90,
                            evidence=f"Declared annual income (₹{int(dec_val):,}) differs from document income (₹{int(ocr_val):,})",
                            limitations="Gross vs Net income differences or deductions may explain variance."
                        ))
                        break
                except ValueError:
                    pass

        # 5. Anomalous Behavior Signal
        if anomaly_score > 0.4:
            weight = 10
            total_score += weight
            signals.append(RiskSignal(
                code="ANOMALOUS_BEHAVIOR",
                name="Suspicious Interaction Pattern",
                severity="LOW",
                weight=weight,
                confidence=0.75,
                evidence=f"Session anomaly score is {int(anomaly_score * 100)}% due to rapid automated form fills or multiple IP switches.",
                limitations="Citizen may be using an assisted service operator portal or proxy network."
            ))

        final_score = min(total_score, 100)
        if final_score >= 75:
            category = "CRITICAL"
        elif final_score >= 50:
            category = "HIGH"
        elif final_score >= 25:
            category = "MEDIUM"
        else:
            category = "LOW"

        return RiskAssessmentResult(
            score=final_score,
            category=category,
            signals=signals
        )
