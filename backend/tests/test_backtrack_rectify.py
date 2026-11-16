"""
Test Suite for Automated Form Chatbot Backtrack and Rectification Workflow
Validates:
1. Heuristics & pattern detection for BACKTRACK and RECTIFY_DATA
2. Direct rectification with value in a single turn
3. Guided rectification (request to edit -> prompt -> supply new value)
4. Backtracking to previous question slot
5. Reactive state adjustments (e.g. marital_status modification impacts husband_name)
6. Rectifying particulars after all fields are completed
7. Preservation of other filled slots during rectification
"""
import pytest
from app.orchestration.langgraph_workflow import (
    automated_form_graph,
    classify_citizen_intent,
    detect_rectification_or_backtrack,
    extract_field_value,
)


def test_detect_rectification_or_backtrack_patterns():
    # 1. Backtrack triggers
    intent, field, val, reason = detect_rectification_or_backtrack("go back", {}, "dob")
    assert intent == "BACKTRACK"

    intent, field, val, reason = detect_rectification_or_backtrack("backtrack", {}, "sex")
    assert intent == "BACKTRACK"

    intent, field, val, reason = detect_rectification_or_backtrack("previous question", {}, "address")
    assert intent == "BACKTRACK"

    intent, field, val, reason = detect_rectification_or_backtrack("undo", {}, "father_name")
    assert intent == "BACKTRACK"

    # 2. Direct rectification with value
    intent, field, val, reason = detect_rectification_or_backtrack(
        "Change my name to Rajesh Ramesh Pawar",
        {"name": "Ramesh Pawar"},
        "father_name",
    )
    assert intent == "RECTIFY_DATA"
    assert field == "name"
    assert val == "Rajesh Ramesh Pawar"

    intent, field, val, reason = detect_rectification_or_backtrack(
        "Actually my father's name is Suresh Pawar",
        {"father_name": "Ramesh Pawar"},
        "mother_name",
    )
    assert intent == "RECTIFY_DATA"
    assert field == "father_name"
    assert val == "Suresh Pawar"

    intent, field, val, reason = detect_rectification_or_backtrack(
        "Update my DOB to 14-07-1996",
        {"dob": "10-10-1990"},
        "sex",
    )
    assert intent == "RECTIFY_DATA"
    assert field == "dob"
    assert val == "14-07-1996"

    intent, field, val, reason = detect_rectification_or_backtrack(
        "Correct gender to Female",
        {"sex": "Male"},
        "marital_status",
    )
    assert intent == "RECTIFY_DATA"
    assert field == "sex"
    assert val == "Female"

    intent, field, val, reason = detect_rectification_or_backtrack(
        "Change marital status to Married",
        {"marital_status": "No"},
        "address",
    )
    assert intent == "RECTIFY_DATA"
    assert field == "marital_status"
    assert val == "Yes"

    # 3. Guided rectification request without value
    intent, field, val, reason = detect_rectification_or_backtrack(
        "I want to change my name",
        {"name": "Ramesh Pawar"},
        "father_name",
    )
    assert intent == "RECTIFY_DATA"
    assert field == "name"
    assert val is None

    intent, field, val, reason = detect_rectification_or_backtrack(
        "Can I update my father's name?",
        {"father_name": "Suresh"},
        "dob",
    )
    assert intent == "RECTIFY_DATA"
    assert field == "father_name"
    assert val is None

    intent, field, val, reason = detect_rectification_or_backtrack(
        "I made a mistake in date of birth",
        {"dob": "01-01-1990"},
        "sex",
    )
    assert intent == "RECTIFY_DATA"
    assert field == "dob"
    assert val is None


def test_direct_rectification_mid_flow():
    """Verify that user can change an earlier field while answering a later question."""
    initial_state = {
        "draft_id": "test_rect_1",
        "service_id": "domicile_certificate",
        "messages": [],
        "chat_data": {
            "name": "Ramesh Pawar",
        },
        "ocr_data": {},
        "uploaded_documents": {},
        "comparison_scores": {},
        "pending_field": "father_name",
        "progress_percent": 10,
        "current_phase": "chat",
        "last_user_message": "Change my name to Rajesh Ramesh Pawar",
        "latest_assistant_response": "",
        "can_view_form": False,
        "detected_intent": None,
        "intent_reason": None,
        "casual_reply": None,
        "rectifying_field": None,
        "rectified_field": None,
        "rectified_value": None,
    }

    res = automated_form_graph.invoke(initial_state)

    assert res["chat_data"]["name"] == "Rajesh Ramesh Pawar"
    # Still pending father_name
    assert res["pending_field"] == "father_name"
    # Acknowledges the change and prompts father_name
    assert "Rajesh Ramesh Pawar" in res["latest_assistant_response"]
    assert "father" in res["latest_assistant_response"].lower()


def test_rectifying_after_multiple_steps():
    """Verify rectifying father_name while on sex field preserves all other particulars."""
    initial_state = {
        "draft_id": "test_rect_2",
        "service_id": "domicile_certificate",
        "messages": [],
        "chat_data": {
            "name": "Rajesh Pawar",
            "father_name": "Suresh Pawar",
            "mother_name": "Shanta Pawar",
            "dob": "15-08-1995",
        },
        "ocr_data": {},
        "uploaded_documents": {},
        "comparison_scores": {},
        "pending_field": "sex",
        "progress_percent": 35,
        "current_phase": "chat",
        "last_user_message": "Actually my father's name is Suresh Babu Pawar",
        "latest_assistant_response": "",
        "can_view_form": False,
        "detected_intent": None,
        "intent_reason": None,
        "casual_reply": None,
        "rectifying_field": None,
        "rectified_field": None,
        "rectified_value": None,
    }

    res = automated_form_graph.invoke(initial_state)

    assert res["chat_data"]["father_name"] == "Suresh Babu Pawar"
    # Verify other fields remain intact
    assert res["chat_data"]["name"] == "Rajesh Pawar"
    assert res["chat_data"]["mother_name"] == "Shanta Pawar"
    assert res["chat_data"]["dob"] == "15-08-1995"
    assert res["pending_field"] == "sex"
    assert "Suresh Babu Pawar" in res["latest_assistant_response"]
    assert "gender" in res["latest_assistant_response"].lower() or "sex" in res["latest_assistant_response"].lower()


def test_guided_rectification_two_turns():
    """Verify two-turn guided rectification: request to change -> prompt -> supply new value."""
    # Turn 1: Request to change father's name
    turn1_state = {
        "draft_id": "test_guided_1",
        "service_id": "domicile_certificate",
        "messages": [],
        "chat_data": {
            "name": "Rajesh Pawar",
            "father_name": "Suresh Pawar",
        },
        "ocr_data": {},
        "uploaded_documents": {},
        "comparison_scores": {},
        "pending_field": "mother_name",
        "progress_percent": 20,
        "current_phase": "chat",
        "last_user_message": "I want to update my father's name",
        "latest_assistant_response": "",
        "can_view_form": False,
        "detected_intent": None,
        "intent_reason": None,
        "casual_reply": None,
        "rectifying_field": None,
        "rectified_field": None,
        "rectified_value": None,
    }

    res1 = automated_form_graph.invoke(turn1_state)

    assert res1["detected_intent"] == "RECTIFY_DATA"
    assert res1["pending_field"] == "father_name"
    assert res1["rectifying_field"] == "father_name"
    assert "Father's Full Name" in res1["latest_assistant_response"]

    # Turn 2: Provide new father's name
    res1["last_user_message"] = "Kishore Suresh Pawar"
    res2 = automated_form_graph.invoke(res1)

    assert res2["chat_data"]["father_name"] == "Kishore Suresh Pawar"
    assert res2["rectifying_field"] is None
    # Now moves to the next missing field, which is mother_name
    assert res2["pending_field"] == "mother_name"
    assert "Kishore Suresh Pawar" in res2["latest_assistant_response"]
    assert "mother" in res2["latest_assistant_response"].lower()


def test_backtracking_to_previous_question():
    """Verify backtracking steps back to the previous question and presents current value."""
    initial_state = {
        "draft_id": "test_backtrack_1",
        "service_id": "domicile_certificate",
        "messages": [],
        "chat_data": {
            "name": "Rajesh Pawar",
            "father_name": "Suresh Pawar",
        },
        "ocr_data": {},
        "uploaded_documents": {},
        "comparison_scores": {},
        "pending_field": "mother_name",
        "progress_percent": 20,
        "current_phase": "chat",
        "last_user_message": "Go back",
        "latest_assistant_response": "",
        "can_view_form": False,
        "detected_intent": None,
        "intent_reason": None,
        "casual_reply": None,
        "rectifying_field": None,
        "rectified_field": None,
        "rectified_value": None,
    }

    res = automated_form_graph.invoke(initial_state)

    assert res["detected_intent"] == "BACKTRACK"
    assert res["pending_field"] == "father_name"
    assert res["rectifying_field"] == "father_name"
    assert "Suresh Pawar" in res["latest_assistant_response"]
    assert "Father's Full Name" in res["latest_assistant_response"]

    # Supply corrected value
    res["last_user_message"] = "Dattatray Suresh Pawar"
    res2 = automated_form_graph.invoke(res)

    assert res2["chat_data"]["father_name"] == "Dattatray Suresh Pawar"
    assert res2["pending_field"] == "mother_name"


def test_backtrack_at_beginning_of_form():
    """Verify backtracking when on the first question does not crash and stays on name."""
    initial_state = {
        "draft_id": "test_backtrack_start",
        "service_id": "domicile_certificate",
        "messages": [],
        "chat_data": {},
        "ocr_data": {},
        "uploaded_documents": {},
        "comparison_scores": {},
        "pending_field": "name",
        "progress_percent": 0,
        "current_phase": "chat",
        "last_user_message": "previous question",
        "latest_assistant_response": "",
        "can_view_form": False,
        "detected_intent": None,
        "intent_reason": None,
        "casual_reply": None,
        "rectifying_field": None,
        "rectified_field": None,
        "rectified_value": None,
    }

    res = automated_form_graph.invoke(initial_state)

    assert res["detected_intent"] == "BACKTRACK"
    assert res["pending_field"] == "name"
    assert "first step" in res["latest_assistant_response"].lower() or "first" in res["latest_assistant_response"].lower()


def test_marital_status_rectification_cleans_husband_name():
    """Verify changing marital status to No clears husband_name from chat_data."""
    initial_state = {
        "draft_id": "test_marital_rect",
        "service_id": "domicile_certificate",
        "messages": [],
        "chat_data": {
            "name": "Pooja Patil",
            "father_name": "Ramesh Patil",
            "mother_name": "Sita Patil",
            "dob": "10-10-1992",
            "sex": "Female",
            "marital_status": "Yes",
            "husband_name": "Amit Patil",
            "address": "12 Shanti Nagar, Pune",
            "years_of_residence": "15",
        },
        "ocr_data": {},
        "uploaded_documents": {},
        "comparison_scores": {},
        "pending_field": None,
        "progress_percent": 70,
        "current_phase": "documents",
        "last_user_message": "Change marital status to No",
        "latest_assistant_response": "",
        "can_view_form": True,
        "detected_intent": None,
        "intent_reason": None,
        "casual_reply": None,
        "rectifying_field": None,
        "rectified_field": None,
        "rectified_value": None,
    }

    res = automated_form_graph.invoke(initial_state)

    assert res["chat_data"]["marital_status"] == "No"
    # husband_name should be pruned
    assert "husband_name" not in res["chat_data"]
    assert "Marital Status" in res["latest_assistant_response"]
