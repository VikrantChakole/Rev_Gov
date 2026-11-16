"""
Test Suite for Intent Identifier Graph Node & Casual Conversational Workflow
Validates:
1. Casual greetings & questions classified as CASUAL
2. Form fields are never corrupted by casual messages
3. Casual replies are warm, polite, and restricted to the certificate application
4. Form data answers classified as PROVIDING_DATA, extracted, and advanced with casual acknowledgments
5. Mixed greetings + data (e.g. 'Hi, my name is Rahul') handled smoothly as PROVIDING_DATA
"""
import pytest
from app.orchestration.langgraph_workflow import (
    automated_form_graph,
    classify_citizen_intent,
    extract_field_value,
)


def test_classify_intent_heuristics():
    # Casual cases
    intent, reason = classify_citizen_intent("hey there!", "name", "domicile_certificate", {})
    assert intent == "CASUAL"

    intent, reason = classify_citizen_intent("what is a domicile certificate?", "name", "domicile_certificate", {})
    assert intent == "CASUAL"

    intent, reason = classify_citizen_intent("why do you need my father's name?", "father_name", "domicile_certificate", {"name": "Amit"})
    assert intent == "CASUAL"

    intent, reason = classify_citizen_intent("what documents do i have to upload later?", "address", "domicile_certificate", {})
    assert intent == "CASUAL"

    intent, reason = classify_citizen_intent("ok sure", "name", "domicile_certificate", {})
    assert intent == "CASUAL"

    intent, reason = classify_citizen_intent("wait a sec", "name", "domicile_certificate", {})
    assert intent == "CASUAL"

    # Data cases
    intent, reason = classify_citizen_intent("Ramesh Shankar Pawar", "name", "domicile_certificate", {})
    assert intent == "PROVIDING_DATA"

    intent, reason = classify_citizen_intent("My name is Ramesh Pawar", "name", "domicile_certificate", {})
    assert intent == "PROVIDING_DATA"

    intent, reason = classify_citizen_intent("Hi! My name is Ramesh Pawar", "name", "domicile_certificate", {})
    assert intent == "PROVIDING_DATA"

    intent, reason = classify_citizen_intent("15-08-1995", "dob", "domicile_certificate", {})
    assert intent == "PROVIDING_DATA"

    intent, reason = classify_citizen_intent("male", "sex", "domicile_certificate", {})
    assert intent == "PROVIDING_DATA"

    intent, reason = classify_citizen_intent("married", "marital_status", "domicile_certificate", {})
    assert intent == "PROVIDING_DATA"


def test_casual_greeting_preserves_form_state():
    """Verify that a casual greeting does NOT corrupt chat_data or advance pending_field."""
    state = {
        "draft_id": "test_draft_casual_1",
        "service_id": "domicile_certificate",
        "messages": [],
        "chat_data": {},
        "ocr_data": {},
        "uploaded_documents": {},
        "comparison_scores": {},
        "pending_field": "name",
        "progress_percent": 0,
        "current_phase": "chat",
        "last_user_message": "Hey! Good morning!",
        "latest_assistant_response": "",
        "can_view_form": False,
        "detected_intent": None,
        "intent_reason": None,
        "casual_reply": None,
    }

    res = automated_form_graph.invoke(state)

    assert res["detected_intent"] == "CASUAL"
    # Form data must remain untouched
    assert res["chat_data"].get("name") is None
    # Pending field must still be name
    assert res["pending_field"] == "name"
    # Response must be casual and mention Domicile Certificate or assistant greeting
    assert any(term in res["latest_assistant_response"].lower() for term in ["domicile", "revenuegov", "hey", "certificate", "help", "application"])
    assert len(res["messages"]) == 2  # user message + assistant reply


def test_casual_certificate_question_explains_purpose():
    """Verify that asking what the certificate is for provides accurate info without corrupting slots."""
    state = {
        "draft_id": "test_draft_casual_2",
        "service_id": "domicile_certificate",
        "messages": [],
        "chat_data": {},
        "ocr_data": {},
        "uploaded_documents": {},
        "comparison_scores": {},
        "pending_field": "name",
        "progress_percent": 0,
        "current_phase": "chat",
        "last_user_message": "What is this certificate used for?",
        "latest_assistant_response": "",
        "can_view_form": False,
        "detected_intent": None,
        "intent_reason": None,
        "casual_reply": None,
    }

    res = automated_form_graph.invoke(state)

    assert res["detected_intent"] == "CASUAL"
    assert res["chat_data"].get("name") is None
    assert res["pending_field"] == "name"
    resp = res["latest_assistant_response"]
    assert any(k in resp.lower() for k in ["domicile", "maharashtra", "resid", "state", "certif"])


def test_casual_inquiry_on_father_name():
    """Verify citizen asking why father's name is required gets a polite explanation."""
    state = {
        "draft_id": "test_draft_casual_3",
        "service_id": "income_certificate",
        "messages": [],
        "chat_data": {"name": "Pooja Sharma"},
        "ocr_data": {},
        "uploaded_documents": {},
        "comparison_scores": {},
        "pending_field": "father_name",
        "progress_percent": 10,
        "current_phase": "chat",
        "last_user_message": "Why do you need my father's name?",
        "latest_assistant_response": "",
        "can_view_form": False,
        "detected_intent": None,
        "intent_reason": None,
        "casual_reply": None,
    }

    res = automated_form_graph.invoke(state)

    assert res["detected_intent"] == "CASUAL"
    # father_name must NOT be set to the question text
    assert res["chat_data"].get("father_name") is None
    assert res["pending_field"] == "father_name"
    resp = res["latest_assistant_response"]
    assert any(k in resp.lower() for k in ["father", "lineage", "record", "revenue", "verify", "parent"])


def test_providing_data_extracts_and_progresses_casually():
    """Verify that providing actual data extracts the value and gives a warm acknowledgment."""
    state = {
        "draft_id": "test_draft_data_1",
        "service_id": "domicile_certificate",
        "messages": [],
        "chat_data": {},
        "ocr_data": {},
        "uploaded_documents": {},
        "comparison_scores": {},
        "pending_field": "name",
        "progress_percent": 0,
        "current_phase": "chat",
        "last_user_message": "My name is Kunal Wandhare",
        "latest_assistant_response": "",
        "can_view_form": False,
        "detected_intent": None,
        "intent_reason": None,
        "casual_reply": None,
    }

    res = automated_form_graph.invoke(state)

    assert res["detected_intent"] == "PROVIDING_DATA"
    assert res["chat_data"].get("name") == "Kunal Wandhare"
    assert res["pending_field"] == "father_name"
    resp = res["latest_assistant_response"]
    # Should casually acknowledge Kunal and ask for father's name
    assert "Kunal" in resp or "legal name" in resp
    assert "father" in resp.lower()
