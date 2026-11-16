import pytest
from app.services.matching_service import MatchingService
from app.api.routes.automated_form import _recompute_all_comparisons, DOC_PRIORITY_BY_FIELD


def test_pure_calculation_overall_score():
    """Verify that overall score is pure mathematical average of compared fields with no random data."""
    matching_service = MatchingService()

    # Field 1: exact match (100.0)
    # Field 2: mismatch date (0.0)
    state = {
        "chat_data": {
            "name": "Ramesh Pawar",
            "dob": "15-08-1995",
        },
        "ocr_data": {
            "identity_proof": {
                "extracted_fields": {
                    "applicant_name": "Ramesh Pawar",
                    "dob": "01-01-2000",
                }
            }
        },
        "comparison_scores": {},
    }

    _recompute_all_comparisons(state)
    comp = state["comparison_scores"]

    assert comp["has_comparisons"] is True
    assert "applicant_name" in comp["field_scores"]
    assert "dob" in comp["field_scores"]

    name_score = comp["field_scores"]["applicant_name"]["score"]
    dob_score = comp["field_scores"]["dob"]["score"]

    assert name_score == 100.0
    assert dob_score == 0.0

    # Strict average: (100.0 + 0.0) / 2 = 50.0
    assert comp["overall_score"] == 50.0


def test_empty_documents_no_hallucination():
    """When no documents or comparable fields exist, overall score must be None, not fake 100%."""
    state = {
        "chat_data": {
            "name": "Ramesh Pawar",
        },
        "ocr_data": {},
        "comparison_scores": {},
    }

    _recompute_all_comparisons(state)
    comp = state["comparison_scores"]

    assert comp["has_comparisons"] is False
    assert comp["overall_score"] is None
    assert comp["field_scores"] == {}


def test_authoritative_document_priority_prevents_light_bill_pollution():
    """
    A utility bill (residential_proof) often contains company headers or landlord names.
    It must NEVER overwrite or provide applicant_name when comparing.
    """
    state = {
        "chat_data": {
            "name": "Ramesh Pawar",
            "address": "Flat 402, Shivajinagar, Pune 411005",
        },
        "ocr_data": {
            "identity_proof": {
                "extracted_fields": {
                    "applicant_name": "Ramesh Pawar",
                }
            },
            "residential_proof": {
                "extracted_fields": {
                    # Electricity bill header or landlord name
                    "name": "Maharashtra State Electricity Distribution Co Ltd",
                    "applicant_name": "Landlord Suresh Patil",
                    "address": "Flat 402, Shivajinagar, Pune 411005",
                }
            }
        },
        "comparison_scores": {},
    }

    _recompute_all_comparisons(state)
    comp = state["comparison_scores"]

    # applicant_name must be compared against identity_proof ("Ramesh Pawar"), NOT light bill!
    assert comp["field_scores"]["applicant_name"]["ocr_value"] == "Ramesh Pawar"
    assert comp["field_scores"]["applicant_name"]["match"] is True
    assert comp["field_scores"]["applicant_name"]["score"] == 100.0

    # address must be compared against residential_proof
    assert "Shivajinagar" in comp["field_scores"]["address"]["ocr_value"]
    assert comp["field_scores"]["address"]["score"] == 100.0

    # Overall score = (100 + 100) / 2 = 100.0
    assert comp["overall_score"] == 100.0


def test_spurious_fields_not_included_in_form_comparison():
    """
    Generic OCR regex might extract spurious metadata (employer_name, transaction_id).
    These must NOT produce discrepancy cards in the citizen form validation.
    """
    state = {
        "chat_data": {
            "name": "Ramesh Pawar",
            "father_name": "Shankar Pawar",
        },
        "ocr_data": {
            "identity_proof": {
                "extracted_fields": {
                    "applicant_name": "Ramesh Pawar",
                    "father_name": "Shankar Pawar",
                    "employer_name": "Infosys Ltd",
                    "transaction_id": "TXN998822",
                    "bill_number": "BILL-12345",
                }
            }
        },
        "comparison_scores": {},
    }

    _recompute_all_comparisons(state)
    comp = state["comparison_scores"]

    assert set(comp["field_scores"].keys()) == {"applicant_name", "father_name"}
    assert "employer_name" not in comp["field_scores"]
    assert "transaction_id" not in comp["field_scores"]
    assert "bill_number" not in comp["field_scores"]
