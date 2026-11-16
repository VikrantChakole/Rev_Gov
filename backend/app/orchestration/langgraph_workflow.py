"""
LangGraph Workflow Engine for Automated Form Fill (v2.0)
Orchestrates:
1. Intent Identification Node (Distinguishing CASUAL chit-chat/questions from PROVIDING_DATA)
2. Certificate-Restricted Casual Response Node (Warm, human, polite answers restricted to the application)
3. Slot-filling Data Extraction & Progressive Normalization
4. Document upload tracking and prompt triggers
5. Isolated OCR extraction & separate storage
6. Field matching comparison & confidence scoring
"""
import os
import re
import logging
from typing import TypedDict, List, Dict, Any, Optional, Tuple
from langgraph.graph import StateGraph, START, END

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────
# 1. State Definition
# ─────────────────────────────────────────────────────────────

class AutomatedFormState(TypedDict, total=False):
    draft_id: str
    service_id: str
    messages: List[Dict[str, Any]]
    chat_data: Dict[str, Any]
    ocr_data: Dict[str, Any]
    uploaded_documents: Dict[str, Any]
    comparison_scores: Dict[str, Any]
    pending_field: Optional[str]
    progress_percent: int
    current_phase: str       # "chat" | "documents" | "ready_for_review"
    last_user_message: str
    latest_assistant_response: str
    can_view_form: bool
    detected_intent: Optional[str]   # "CASUAL" | "PROVIDING_DATA" | "BACKTRACK" | "RECTIFY_DATA"
    intent_reason: Optional[str]
    casual_reply: Optional[str]
    rectifying_field: Optional[str]
    rectified_field: Optional[str]
    rectified_value: Optional[str]


# ─────────────────────────────────────────────────────────────
# 2. Certificate Knowledge Base (Restricted Application Context)
# ─────────────────────────────────────────────────────────────

CERTIFICATE_KNOWLEDGE: Dict[str, Dict[str, Any]] = {
    "domicile_certificate": {
        "name": "Domicile Certificate (महाराष्ट्र अधिवास प्रमाणपत्र)",
        "purpose": "A Domicile Certificate proves that you have been continuously residing in Maharashtra for at least 2 years. It is essential for claiming Maharashtra State quota in college admissions, government recruitments (MPSC), and state welfare schemes.",
        "eligibility": "Continuous residence in Maharashtra for a minimum of 2 years, verified via electricity bills, ration card, rent agreements, or school leaving records.",
        "timeline_fee": "Standard statutory fee is ₹50 with a delivery timeline of 15 working days under the Maharashtra Right to Public Services Act (RTS).",
        "documents": [
            "Proof of Identity (Aadhaar / Voter ID / PAN Card)",
            "Proof of Residence (15-year continuous proof like Electricity Bill / Ration Card / Rent Agreement)",
            "Age Proof (Birth Certificate / School Leaving Certificate)",
            "Scanned Signature and Passport-size Photograph"
        ],
    },
    "income_certificate": {
        "name": "Income Certificate (वार्षिक उत्पन्न प्रमाणपत्र)",
        "purpose": "An Income Certificate officially certifies your family's annual gross income from all legitimate sources. It is required when applying for government scholarships (MahaDBT), tuition fee waivers, education concessions, and welfare schemes.",
        "eligibility": "Issued based on revenue inquiry, salary slips, employer certificate, or Talathi / Circle Officer verification report.",
        "timeline_fee": "Standard statutory fee is ₹50 with an SLA turnaround of 15 working days.",
        "documents": [
            "Proof of Identity (Aadhaar / PAN Card)",
            "Proof of Address (Ration Card / Electricity Bill)",
            "Income Proof (Salary Slip / Form 16 / Talathi Income Report / IT Return)",
            "Scanned Signature and Passport-size Photograph"
        ],
    },
    "caste_certificate": {
        "name": "Caste Certificate (जातीचे प्रमाणपत्र)",
        "purpose": "A Caste Certificate formally validates that you belong to a recognized Scheduled Caste (SC), Scheduled Tribe (ST), VJNT, or Other Backward Class (OBC) in Maharashtra, allowing you to claim constitutional reservations in higher education and government employment.",
        "eligibility": "Applicant or their paternal family must have proof of residency in Maharashtra prior to the deemed date (1950 for SC/ST, 1967 for VJNT/OBC).",
        "timeline_fee": "Statutory processing fee is ₹50 with a delivery timeline of 21 working days under RTS.",
        "documents": [
            "Identity Proof (Aadhaar / Voter ID)",
            "Caste Proof of Applicant or Father/Grandfather (School Leaving Certificate with caste mentioned, 7/12 extract)",
            "Residence Proof (Ration card / Electricity bill)",
            "Affidavit & Scanned Signature and Photograph"
        ],
    },
    "obc_ncl_certificate": {
        "name": "Non-Creamy Layer Certificate (उन्नत आणि प्रगत गट नसलेले प्रमाणपत्र)",
        "purpose": "A Non-Creamy Layer (NCL) Certificate verifies that an applicant belonging to OBC, VJNT, or SBC categories has a family annual income below ₹8 Lakhs from non-agricultural sources, making them eligible for reservation benefits in admissions and competitive examinations.",
        "eligibility": "Belong to a valid OBC/VJNT/SBC category and family gross annual income must be under ₹8 Lakhs for the past 3 consecutive financial years.",
        "timeline_fee": "Standard government fee is ₹50, processed within 21 working days.",
        "documents": [
            "Valid Caste Certificate",
            "Income Proof for past 3 years (ITRs / Form 16 / Tahsildar Income Certificate)",
            "Identity & Address Proof (Aadhaar, Ration card)",
            "Scanned Signature and Passport Photograph"
        ],
    },
}


# ─────────────────────────────────────────────────────────────
# 3. Particulars Definition (from application form format.txt)
# ─────────────────────────────────────────────────────────────

PARTICULARS_SPEC = [
    {
        "field": "name",
        "label": "Full Legal Name",
        "question": "Hey there! 👋 I am your RevenueGov Assistant. Let's get your application prepared together. To begin, what is your full legal name as per government records?",
        "example": "e.g. Ramesh Shankar Pawar",
    },
    {
        "field": "father_name",
        "label": "Father's Full Name",
        "question": "Could you tell me your father's full name next?",
        "example": "e.g. Shankar Babu Pawar",
    },
    {
        "field": "mother_name",
        "label": "Mother's Full Name",
        "question": "And what is your mother's full name?",
        "example": "e.g. Shanta Shankar Pawar",
    },
    {
        "field": "dob",
        "label": "Date of Birth",
        "question": "When were you born? Please share your Date of Birth in DD-MM-YYYY format.",
        "example": "e.g. 15-08-1995",
    },
    {
        "field": "sex",
        "label": "Sex / Gender",
        "question": "What is your gender? (Male / Female / Others)",
        "example": "Male, Female, or Others",
    },
    {
        "field": "marital_status",
        "label": "Marital Status",
        "question": "Are you married, or currently single? (Yes for Married, No for Unmarried)",
        "example": "Yes or No",
    },
    {
        "field": "husband_name",
        "label": "Husband's Name",
        "question": "Since you are married, what is your husband's full name?",
        "example": "Enter husband's full legal name",
        "conditional": lambda d, s: d.get("marital_status") == "Yes" and d.get("sex") == "Female",
    },
    {
        "field": "address",
        "label": "Present Residential Address",
        "question": "Where are you currently staying? Please drop your complete residential address (House/Door No, Street/Area, Taluka, District, Pincode).",
        "example": "e.g. 42 Shanti Nagar, Pune, Maharashtra - 411001",
    },
    {
        "field": "years_of_residence",
        "label": "Years of Residence",
        "question": "For your Domicile Certificate, about how many years have you been continuously residing in Maharashtra?",
        "example": "e.g. 15",
        "conditional": lambda d, s: s == "domicile_certificate",
    },
    {
        "field": "purpose",
        "label": "Purpose of Certificate",
        "question": "What are you planning to use this Income Certificate for? (e.g. Higher Education Scholarship, Fee Concession, Welfare Scheme)",
        "example": "e.g. Higher Education Scholarship, Fee Concession",
        "conditional": lambda d, s: s == "income_certificate",
    },
]


def get_required_fields_for_service(service_id: str, chat_data: Dict[str, Any]) -> List[str]:
    """Returns the ordered list of required field names for the given service & current data."""
    required = []
    for p in PARTICULARS_SPEC:
        cond = p.get("conditional")
        if cond is None or cond(chat_data, service_id):
            required.append(p["field"])
    return required


def calculate_progress(chat_data: Dict[str, Any], service_id: str, uploaded_docs: Dict[str, Any]) -> int:
    """Calculates completion progress (0 - 100%)."""
    required_fields = get_required_fields_for_service(service_id, chat_data)
    if not required_fields:
        return 0

    filled_fields = sum(1 for f in required_fields if chat_data.get(f) and str(chat_data[f]).strip())
    particulars_pct = (filled_fields / len(required_fields)) * 70.0  # 70% max for particulars

    DOC_KEYS = ["identity_proof", "residential_proof", "age_proof", "signature", "passport_image"]
    uploaded_count = sum(1 for k in DOC_KEYS if uploaded_docs.get(k))
    docs_pct = (uploaded_count / len(DOC_KEYS)) * 30.0  # 30% max for documents

    total = int(round(particulars_pct + docs_pct))
    return min(100, max(0, total))


# ─────────────────────────────────────────────────────────────
# 4. Extraction Logic
# ─────────────────────────────────────────────────────────────

def extract_field_value(field: str, raw_text: str) -> Optional[str]:
    """Extracts and normalizes user input for a specific field."""
    text = (raw_text or "").strip()
    if not text:
        return None

    if field in ("name", "father_name", "mother_name", "husband_name"):
        # Remove conversational fluff
        clean = re.sub(
            r"^(my\s+(legal\s+|full\s+)?(name|father|mother|husband)('?s)?(\s+name)?\s+is|"
            r"(father|mother|husband)('?s)?(\s+name)?\s+is|"
            r"my\s+name\s+is|"
            r"it\s+is|"
            r"name\s+is|"
            r"i\s+am|"
            r"mr\.?|mrs\.?|ms\.?|shri\.?|smt\.?)\s+",
            "",
            text,
            flags=re.IGNORECASE,
        ).strip()
        clean = re.sub(r"[,\.\?!]+$", "", clean)
        return " ".join(w.capitalize() for w in clean.split()) if clean else text

    elif field == "dob":
        m = re.search(r"\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b", text)
        if m:
            d, mth, y = m.group(1).zfill(2), m.group(2).zfill(2), m.group(3)
            return f"{d}-{mth}-{y}"
        m2 = re.search(r"\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b", text)
        if m2:
            y, mth, d = m2.group(1), m2.group(2).zfill(2), m2.group(3).zfill(2)
            return f"{d}-{mth}-{y}"
        return text

    elif field == "sex":
        lower = text.lower()
        if "fem" in lower or "mahila" in lower or "woman" in lower:
            return "Female"
        elif "male" in lower or "purush" in lower or "man" in lower:
            return "Male"
        elif "other" in lower or "third" in lower:
            return "Others"
        return "Male" if "m" in lower else "Female" if "f" in lower else text.capitalize()

    elif field == "marital_status":
        lower = text.lower()
        if any(w in lower for w in ["unmarried", "single", "no", "nahi", "avivahit"]):
            return "No"
        elif any(w in lower for w in ["yes", "married", "haan", "ha", "shadi", "vivahit"]):
            return "Yes"
        return "Yes" if "y" in lower else "No"

    elif field == "years_of_residence":
        nums = re.findall(r"\b\d+\b", text)
        return nums[0] if nums else text

    elif field == "purpose":
        clean = re.sub(r"^(purpose\s+is|for|it\s+is\s+for)\s+", "", text, flags=re.IGNORECASE).strip()
        return clean or text

    return text


# ─────────────────────────────────────────────────────────────
# 4b. Backtrack & Data Rectification Intent Detector
# ─────────────────────────────────────────────────────────────

def detect_rectification_or_backtrack(
    message: str,
    chat_data: Dict[str, Any],
    pending_field: Optional[str],
    service_id: str = "domicile_certificate",
) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """
    Analyzes citizen message to detect if they want to:
    1. 'BACKTRACK' to previous question/field
    2. 'RECTIFY_DATA' to modify an already provided (or specific) field, either directly with a new value
       or as an explicit request to edit/change.

    Returns:
      (intent, target_field, extracted_new_value, reason)
    """
    text = (message or "").strip()
    if not text:
        return (None, None, None, None)

    lower = text.lower()

    # 1. Backtrack detection
    backtrack_patterns = [
        r"^\s*(?:go\s+back|backtrack|previous(?:\s+question|\s+step|\s+field)?|take\s+me\s+back|can\s+(?:we|i)\s+go\s+back|undo(?:\s+last)?|step\s+back|back\s+please)\b",
        r"^\s*back\s*$",
        r"^\s*previous\s*$",
        r"\b(?:go\s+back|backtrack|undo)\b",
    ]
    if any(re.search(pat, lower) for pat in backtrack_patterns):
        # Guard: don't confuse an address like "back of temple" with backtrack
        if pending_field == "address" and any(k in lower for k in ["street", "nagar", "road", "flat", "house", "behind", "near"]):
            pass
        else:
            return ("BACKTRACK", None, None, "user_requested_backtrack")

    # 2. Canonical Field Patterns in order of priority (specific to generic)
    FIELD_PATTERNS = [
        ("father_name", [r"\bfather('?s)?(\s+full)?\s+name\b", r"\bfather('?s)?\b", r"\bdad('?s)?(\s+name)?\b", r"\bpitaji\b", r"\bvadil\b"]),
        ("mother_name", [r"\bmother('?s)?(\s+full)?\s+name\b", r"\bmother('?s)?\b", r"\bmom('?s)?(\s+name)?\b", r"\baai\b", r"\bmataji\b"]),
        ("husband_name", [r"\bhusband('?s)?(\s+full)?\s+name\b", r"\bhusband('?s)?\b", r"\bspouse('?s)?(\s+name)?\b", r"\bpati\b", r"\bnavra\b"]),
        ("dob", [r"\bdate\s+of\s+birth\b", r"\bbirth\s*date\b", r"\bbirthday\b", r"\bbirthdate\b", r"\bdob\b", r"\bjanam\s+tarikh\b"]),
        ("sex", [r"\bgender\b", r"\bsex\b", r"\bling\b"]),
        ("marital_status", [r"\bmarital\s+status\b", r"\bmarriage\s+status\b", r"\bmarital\b", r"\bmarriage\b", r"\bshadi\b", r"\bvivah\b"]),
        ("years_of_residence", [r"\byears?\s+of\s+residence\b", r"\bresidence\s+years?\b", r"\byears?\s+in\s+maharashtra\b", r"\byears?\s+of\s+stay\b", r"\bresidence\s+duration\b", r"\bstaying\s+years?\b"]),
        ("address", [r"\bresidential\s+address\b", r"\bresidence\s+address\b", r"\bpresent\s+address\b", r"\bhome\s+address\b", r"\baddress\b", r"\bpata\b"]),
        ("purpose", [r"\bpurpose(\s+of\s+certificate)?\b", r"\breason(\s+for\s+certificate)?\b", r"\bcertificate\s+purpose\b", r"\bhetu\b", r"\bkaran\b"]),
        ("name", [r"\bmy\s+name\b", r"\bfull\s+name\b", r"\blegal\s+name\b", r"\bapplicant\s+name\b", r"\bown\s+name\b", r"\bname\b", r"\bnaam\b"]),
    ]

    CHANGE_TRIGGERS = [
        "change", "update", "correct", "correction", "rectify", "rectification",
        "edit", "modify", "mistake", "wrong", "actually", "instead", "replace",
        "re-enter", "fix", "err"
    ]

    def find_target_field(s: str) -> Optional[str]:
        for field, patterns in FIELD_PATTERNS:
            for pat in patterns:
                if re.search(pat, s, re.IGNORECASE):
                    return field
        return None

    # Pattern A: "change/update/correct/rectify/edit/set <field> to/as/into/is/= <val>"
    # Example: "Change my name to Rajesh Ramesh Pawar", "Update father's name to Suresh Pawar"
    m_direct = re.search(
        r"(?:change|update|correct|rectify|edit|modify|replace|fix|set)\s+(?:my\s+)?([a-z'\s]+?)\s+(?:to|as|into|is|=)\s+(.+)",
        text,
        re.IGNORECASE,
    )
    if m_direct:
        field_str, val_str = m_direct.group(1), m_direct.group(2).strip()
        matched_field = find_target_field(field_str)
        if matched_field and val_str:
            clean_val = extract_field_value(matched_field, val_str)
            return ("RECTIFY_DATA", matched_field, clean_val, "direct_change_to")

    # Pattern B: "actually/in fact [my] <field> is/should be/= <val>"
    # Example: "Actually my father's name is Suresh Pawar"
    m_actually = re.search(
        r"(?:actually|in\s+fact|instead\s+of\s+that)\s*[,]?\s*(?:my\s+)?([a-z'\s]+?)\s+(?:is|should\s+be|=)\s+(.+)",
        text,
        re.IGNORECASE,
    )
    if m_actually:
        field_str, val_str = m_actually.group(1), m_actually.group(2).strip()
        matched_field = find_target_field(field_str)
        if matched_field and val_str:
            clean_val = extract_field_value(matched_field, val_str)
            return ("RECTIFY_DATA", matched_field, clean_val, "direct_actually_is")

    # Pattern C: "wrong/mistake in <field> [it is/should be/to] <val>"
    # Example: "Mistake in DOB, correct to 14-07-1996", "Wrong name, it is Rajesh Pawar"
    m_wrong = re.search(
        r"(?:wrong|mistake\s+in|correction\s+in|error\s+in)\s+(?:my\s+)?([a-z'\s]+?)(?:[,:]\s*|\s+(?:it\s+is|it\s+should\s+be|to|=)\s*)(.+)?",
        text,
        re.IGNORECASE,
    )
    if m_wrong:
        field_str = m_wrong.group(1)
        val_str = (m_wrong.group(2) or "").strip()
        matched_field = find_target_field(field_str)
        if matched_field:
            if val_str and len(val_str) > 1:
                clean_val = extract_field_value(matched_field, val_str)
                return ("RECTIFY_DATA", matched_field, clean_val, "direct_mistake_with_val")
            return ("RECTIFY_DATA", matched_field, None, "request_to_edit_field")

    # Pattern D: "<field> [: =] <val>" (colon or equals format for an existing or earlier field)
    # Example: "Father Name: Suresh Pawar", "DOB: 15-08-1995"
    m_colon = re.search(r"^([a-z'\s]+?)\s*[:=]\s*(.+)$", text, re.IGNORECASE)
    if m_colon:
        field_str, val_str = m_colon.group(1), m_colon.group(2).strip()
        matched_field = find_target_field(field_str)
        if matched_field and (matched_field in chat_data or matched_field != pending_field):
            clean_val = extract_field_value(matched_field, val_str)
            return ("RECTIFY_DATA", matched_field, clean_val, "colon_format_override")

    # Pattern E: Change trigger present with target field mentioned (Request to edit)
    # Example: "I want to change my name", "Can I update my father's name?", "Wrong DOB entered"
    has_change_trigger = any(re.search(rf"\b{t}\b", lower) for t in CHANGE_TRIGGERS)
    if has_change_trigger:
        matched_field = find_target_field(lower)
        if matched_field:
            after_pattern = rf"\b{matched_field.replace('_', ' ')}\b\s*(?:is\s+|to\s+)?(.+)"
            m_after = re.search(after_pattern, lower)
            if m_after:
                potential_val = m_after.group(1).strip()
                if potential_val and not any(w in potential_val for w in ["please", "assistant", "instead", "sir", "madam"]):
                    clean_val = extract_field_value(matched_field, potential_val)
                    if clean_val and len(clean_val) >= 2:
                        return ("RECTIFY_DATA", matched_field, clean_val, "trigger_with_trailing_val")
            return ("RECTIFY_DATA", matched_field, None, "request_to_edit_field")

    # Pattern F: "actually <val>" without field name (e.g. "Actually Suresh Pawar")
    if re.search(r"^\s*(?:actually|in fact|sorry\s*,?\s*it(?:'?s)?)\s*[,]?\s*(.+)", text, re.IGNORECASE):
        sub_text = re.sub(r"^\s*(?:actually|in fact|sorry\s*,?\s*it(?:'?s)?)\s*[,]?\s*", "", text, flags=re.IGNORECASE).strip()
        req_fields = get_required_fields_for_service(service_id, chat_data)
        filled_order = [f for f in req_fields if chat_data.get(f)]
        last_filled = filled_order[-1] if filled_order else None
        if last_filled and sub_text:
            clean_val = extract_field_value(last_filled, sub_text)
            return ("RECTIFY_DATA", last_filled, clean_val, "implicit_actually_last_field")

    return (None, None, None, None)


# ─────────────────────────────────────────────────────────────
# 5. Intent Classification Engine (Casual vs Providing Data vs Backtrack/Rectify)
# ─────────────────────────────────────────────────────────────

def classify_citizen_intent(
    message: str,
    pending_field: Optional[str],
    service_id: str,
    chat_data: Dict[str, Any],
    rectifying_field: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Classifies user message into:
    - 'BACKTRACK': Returning to previous question/field
    - 'RECTIFY_DATA': Direct modification or guided request to edit a particular
    - 'CASUAL': Greeting, small talk, questions, clarifications about certificate, social fillers.
    - 'PROVIDING_DATA': Answering the current form slot (or multiple slots).
    """
    text = (message or "").strip()
    if not text:
        return ("CASUAL", "empty_message")

    # 1. Backtrack & Rectification Detection (Highest Priority)
    b_intent, b_field, b_val, b_reason = detect_rectification_or_backtrack(
        message=text,
        chat_data=chat_data,
        pending_field=pending_field,
        service_id=service_id,
    )
    if b_intent:
        return (b_intent, b_reason or "detected_backtrack_or_rectify")

    lower = text.lower()

    # 2. If in active guided rectifying mode
    if rectifying_field:
        if any(w in lower for w in ["cancel", "keep it", "never mind", "leave it", "no change", "keep"]):
            return ("PROVIDING_DATA", "keep_original_value")
        return ("PROVIDING_DATA", f"providing_revision_for_{rectifying_field}")

    # If all particulars are already filled, general queries are CASUAL
    if not pending_field:
        if any(w in lower for w in ["hi", "hello", "hey", "what", "why", "how", "thanks", "ok"]):
            return ("CASUAL", "post_particulars_query")
        return ("PROVIDING_DATA", "document_or_form_action")

    # Token set definitions for greetings and social fillers
    GREETING_WORDS = {
        "hi", "hello", "hey", "namaste", "namaskar", "good", "morning", "afternoon",
        "evening", "yo", "sup", "kem", "cho", "kaise", "ho", "howdy", "there",
        "bot", "assistant", "bhai", "sir", "madam", "mam", "how", "are", "you"
    }

    SOCIAL_WORDS = {
        "ok", "okay", "sure", "got", "it", "thanks", "thank", "you", "dhanyawad",
        "shukriya", "cool", "nice", "alright", "wait", "hold", "on", "one", "sec",
        "second", "minute", "give", "me", "a", "moment", "haha", "hang", "hmm", "hmmm"
    }

    raw_words = [w.lower() for w in re.sub(r"[^a-zA-Z0-9\s]", " ", text).split() if w.strip()]
    if not raw_words:
        return ("CASUAL", "empty_message")

    # 1. Pure greetings (e.g. "hey there", "good morning", "hello bot")
    if all(w in GREETING_WORDS for w in raw_words):
        return ("CASUAL", "pure_greeting")

    # 2. Pure social fillers / acknowledgments (e.g. "wait a sec", "ok sure", "thank you")
    if all(w in SOCIAL_WORDS for w in raw_words) and pending_field not in ("marital_status",):
        return ("CASUAL", "social_filler")

    # 3. Explicit inquiries / questions (contains "?" or starts with question words)
    has_question_mark = "?" in text
    question_starters = [
        "what", "why", "how", "which", "where", "who", "when", "can you", "tell me", "is it",
        "do i", "kya", "kyu", "kaise", "kab", "konsa", "kaha", "batao", "samjhao", "explain"
    ]
    is_question = has_question_mark or any(lower.startswith(q) or f" {q} " in f" {lower} " for q in question_starters)
    if is_question:
        return ("CASUAL", "detected_question")

    # 4. Check for specific data patterns matching the pending field
    if pending_field == "dob":
        if re.search(r"\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b", text):
            return ("PROVIDING_DATA", "matches_dob_pattern")
        if re.search(r"\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\b", lower):
            return ("PROVIDING_DATA", "matches_dob_text")

    elif pending_field == "sex":
        if any(w in lower for w in ["male", "female", "transgender", "purush", "mahila", "other", "m", "f", "man", "woman"]):
            return ("PROVIDING_DATA", "matches_sex_choice")

    elif pending_field == "marital_status":
        if any(w in lower for w in ["yes", "no", "married", "unmarried", "single", "divorced", "widowed", "shadi", "vivahit", "nahi", "haan"]):
            return ("PROVIDING_DATA", "matches_marital_choice")

    elif pending_field == "years_of_residence":
        if re.search(r"\b\d+\b", text):
            return ("PROVIDING_DATA", "matches_years_digits")

    elif pending_field in ("name", "father_name", "mother_name", "husband_name"):
        name_phrase = bool(re.search(r"\b(my\s+name\s+is|it('?s)?|name\s+is|i\s+am)\s+[A-Za-z]+", lower))
        non_name_tokens = GREETING_WORDS.union({"my", "name", "is", "father", "fathers", "mother", "mothers", "husband", "husbands", "i", "am"})
        cleaned_words = [w for w in raw_words if w not in non_name_tokens]

        # Valid name: has name phrase, or 2+ alphabetic words
        if name_phrase or (2 <= len(cleaned_words) <= 5 and all(w.isalpha() for w in cleaned_words)):
            return ("PROVIDING_DATA", "matches_name_pattern")
        elif len(cleaned_words) == 1 and cleaned_words[0].isalpha() and len(cleaned_words[0]) >= 3:
            # Single substantive name like "Kunal" or "Rahul"
            return ("PROVIDING_DATA", "matches_single_name")

    elif pending_field == "address":
        if len(text) >= 10:
            return ("PROVIDING_DATA", "matches_address_text")

    elif pending_field == "purpose":
        if len(text) >= 4:
            return ("PROVIDING_DATA", "matches_purpose_text")

    # If message is very short (< 3 chars) and not a recognized answer -> CASUAL
    if len(text) <= 3 and pending_field not in ("sex", "marital_status"):
        return ("CASUAL", "short_unrecognized_text")

    # Default fallback: treat as data attempt
    return ("PROVIDING_DATA", "default_data_attempt")


# ─────────────────────────────────────────────────────────────
# 6. LangGraph Nodes
# ─────────────────────────────────────────────────────────────

def intent_identifier_node(state: AutomatedFormState) -> Dict[str, Any]:
    """
    Node 1 (Intent Classifier): Analyzes citizen prompt to determine if they are
    making small talk / asking about the certificate (CASUAL), backtracking (BACKTRACK),
    rectifying an already filled field (RECTIFY_DATA), or answering the form slot (PROVIDING_DATA).
    """
    last_msg = state.get("last_user_message", "").strip()
    pending = state.get("pending_field")
    service_id = state.get("service_id", "domicile_certificate")
    chat_data = state.get("chat_data") or {}
    rectifying = state.get("rectifying_field")
    messages = list(state.get("messages") or [])

    # Record user message in conversational history
    if last_msg:
        messages.append({
            "role": "user",
            "content": last_msg,
        })

    intent, reason = classify_citizen_intent(
        message=last_msg,
        pending_field=pending,
        service_id=service_id,
        chat_data=chat_data,
        rectifying_field=rectifying,
    )
    logger.info(f"[LangGraph Node: intent_identifier] classified as '{intent}' ({reason}) for msg: '{last_msg}'")

    return {
        "messages": messages,
        "detected_intent": intent,
        "intent_reason": reason,
    }


def route_intent(state: AutomatedFormState) -> str:
    """Conditional Edge: Routes flow based on detected intent."""
    intent = state.get("detected_intent", "PROVIDING_DATA")
    if intent == "CASUAL":
        return "chatbot_node"
    elif intent in ("BACKTRACK", "RECTIFY_DATA"):
        return "backtrack_rectify_node"
    return "process_user_message"


# ─────────────────────────────────────────────────────────────
# 5b. Chatbot Node System Prompt & LLM API Invocation
# ─────────────────────────────────────────────────────────────

def build_chatbot_system_prompt(
    service_id: str,
    pending_field: Optional[str],
    chat_data: Dict[str, Any],
) -> Tuple[str, str, Dict[str, Any]]:
    """
    Builds the system instructions and restrictions for the Chatbot LLM node.
    Returns (system_prompt, pending_prompt, cert_info).
    """
    cert_info = CERTIFICATE_KNOWLEDGE.get(service_id, {
        "name": service_id.replace("_", " ").title(),
        "purpose": "Official statutory certificate issued by the Revenue Department of Maharashtra.",
        "eligibility": "Subject to Maharashtra statutory documentation and verification.",
        "timeline_fee": "Standard government statutory fee is ₹50 under Maharashtra Right to Public Services Act (RTS).",
        "documents": [
            "Identity Proof (Aadhaar / PAN / Voter ID)",
            "Proof of Residence",
            "Age Proof (Birth Certificate / School Leaving Certificate)",
            "Scanned Signature and Passport-size Photograph"
        ],
    })
    service_name = cert_info["name"]

    curr_spec = next((p for p in PARTICULARS_SPEC if p["field"] == pending_field), None)
    pending_label = curr_spec["label"] if curr_spec else (pending_field.replace("_", " ").title() if pending_field else "particulars")
    pending_example = curr_spec.get("example", "") if curr_spec else ""
    field_prompt = (
        f"Whenever you're ready, could you share your {pending_label}? ({pending_example})"
        if pending_field else "Whenever you're ready, we can proceed to document upload!"
    )

    doc_list_str = "\n".join(f"  • {d}" for d in cert_info.get("documents", []))
    filled_items = [f"{k}: {v}" for k, v in (chat_data or {}).items() if v]
    filled_summary = ", ".join(filled_items) if filled_items else "None yet"

    system_prompt = f"""You are the RevenueGov Assistant for the Revenue Department, Government of Maharashtra.
You are in a friendly, conversational intake session with a citizen who is applying for: **{service_name}** (`{service_id}`).

### INSTRUCTIONS & PERSONA:
1. **Tone**: Warm, casual, natural, conversational, polite, and human-like. Use conversational phrasing and light, friendly emojis (e.g. 👋, 😊, 📄, 🏛️).
2. **Never Robotic**: Do NOT speak like a rigid bureaucratic questionnaire or use cold template phrases. Speak naturally like a friendly counselor.
3. **Conciseness**: Keep your answers concise and scannable (2 to 4 sentences maximum).

### STRICT RESTRICTIONS & SCOPE:
1. **Domain Restriction**: Keep the conversation STRICTLY focused on and restricted to this citizen's **{service_name}** application.
2. **Authoritative Maharashtra Rules**:
   - Certificate Purpose: {cert_info.get('purpose')}
   - Eligibility: {cert_info.get('eligibility')}
   - Government Fee & SLA Timeline: {cert_info.get('timeline_fee')}
   - Required Documents:
{doc_list_str}
   - If asked why Father's Name is required: Under Maharashtra Revenue rules, father's full name is required to verify parental lineage and cross-match against birth, school, and land archives to prevent identity duplication.
   - If asked why Mother's Name is required: Maternal lineage is a statutory record requirement on all Maharashtra revenue certificates.
   - If asked why Marital Status is required: Ensures spouse records and statutory post-marriage name changes are legally verified.
3. **Off-Topic Deflection**: If the citizen asks about unrelated topics (e.g. general chit-chat, weather, sports, movies, coding), politely and casually steer them back to completing their {service_name}.
4. **MANDATORY CLOSING DIRECTIVE**:
   You MUST end your response by gently and casually inviting the citizen to answer the current pending question:
   - Current pending particular needed: **{pending_label}** ({pending_example})
   - Phrasing: Gently ask for this detail (e.g., "{field_prompt}").
5. **State Integrity**: Do NOT claim the pending field has been recorded; you are answering their casual chat or question and asking them for the pending field.
Already recorded particulars: {filled_summary}.
"""
    return system_prompt, field_prompt, cert_info


def call_llm_chatbot_api(
    user_message: str,
    system_prompt: str,
    conversation_history: List[Dict[str, Any]],
    cert_info: Dict[str, Any],
    pending_prompt: str,
) -> str:
    """
    Hits the configured live LLM API (Google Gemini 3.6 Flash / OpenRouter)
    with instructions and restrictions provided as system instruction.
    Returns dynamic AI generated response.
    """
    # 1. Primary: Try Google Gemini direct (models/gemini-3.6-flash)
    from app.core.config import settings
    gemini_key = getattr(settings, "GEMINI_API_KEY", None) or os.getenv("GEMINI_API_KEY")
    if gemini_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel(
                model_name="models/gemini-3.6-flash",
                system_instruction=system_prompt,
            )
            chat = model.start_chat(history=[])
            resp = chat.send_message(user_message)
            if resp and resp.text and resp.text.strip():
                return resp.text.strip()
        except Exception as e_gemini:
            logger.warning(f"[ChatbotNode: Gemini API call failed]: {e_gemini}. Trying LLMService...")

    # 2. Secondary: Try LLMService (OpenRouter / Groq / configured provider)
    try:
        from app.llm.llm_service import LLMService
        from app.llm.base import Message
        llm = LLMService()
        messages = [Message(role="system", content=system_prompt)]
        for m in conversation_history[-6:]:
            if m.get("content") and m.get("role") in ("user", "assistant"):
                messages.append(Message(role=m["role"], content=m["content"]))
        messages.append(Message(role="user", content=user_message))
        res = llm.chat(messages, temperature=0.6)
        if res and res.text and res.text.strip():
            return res.text.strip()
    except Exception as e_llm:
        logger.warning(f"[ChatbotNode: LLMService call failed]: {e_llm}")

    # 3. Graceful fallback if offline
    service_name = cert_info.get("name", "Revenue Certificate")
    return (
        f"I'm here to assist you with your **{service_name}** application. 😊\n\n"
        f"{pending_prompt}"
    )


def casual_chatbot_node(state: AutomatedFormState) -> Dict[str, Any]:
    """
    Node 2 (Chatbot Graph Node): Hits the live LLM API with system instructions and restrictions
    to provide dynamic, warm, human, casual replies restricted to the certificate application.
    Preserves pending_field and chat_data without mutating form slots.
    """
    service_id = state.get("service_id", "domicile_certificate")
    last_msg = state.get("last_user_message", "").strip()
    pending = state.get("pending_field")
    chat_data = state.get("chat_data") or {}
    messages = list(state.get("messages") or [])

    system_prompt, pending_prompt, cert_info = build_chatbot_system_prompt(
        service_id=service_id,
        pending_field=pending,
        chat_data=chat_data,
    )

    # Hit the live LLM API with instructions and restrictions
    llm_reply = call_llm_chatbot_api(
        user_message=last_msg,
        system_prompt=system_prompt,
        conversation_history=messages,
        cert_info=cert_info,
        pending_prompt=pending_prompt,
    )

    messages.append({
        "role": "assistant",
        "content": llm_reply,
        "is_casual": True,
        "field": pending,
    })

    return {
        "messages": messages,
        "latest_assistant_response": llm_reply,
        "casual_reply": llm_reply,
        "detected_intent": "CASUAL",
    }


# Backwards compatibility alias
handle_casual_message_node = casual_chatbot_node


def backtrack_rectify_node(state: AutomatedFormState) -> Dict[str, Any]:
    """
    Node 2b (Backtrack & Rectify Handler):
    1. BACKTRACK: Steps back to the previous question slot, retains existing value, and prompts for new answer.
    2. RECTIFY_DATA with Value: Directly modifies the target slot in chat_data, updates progress,
       and sets rectified_field for celebration in evaluate_next_step_node.
    3. RECTIFY_DATA without Value: Prompts the citizen for the new value for that specific slot.
    """
    service_id = state.get("service_id", "domicile_certificate")
    last_msg = state.get("last_user_message", "").strip()
    pending = state.get("pending_field")
    chat_data = dict(state.get("chat_data") or {})
    messages = list(state.get("messages") or [])
    uploaded_docs = state.get("uploaded_documents") or {}

    intent, target_field, new_val, reason = detect_rectification_or_backtrack(
        message=last_msg,
        chat_data=chat_data,
        pending_field=pending,
        service_id=service_id,
    )

    required_fields = get_required_fields_for_service(service_id, chat_data)

    # 1. Handle BACKTRACK
    if intent == "BACKTRACK":
        target_back_field = None
        if pending and pending in required_fields:
            idx = required_fields.index(pending)
            if idx > 0:
                target_back_field = required_fields[idx - 1]
        elif not pending and required_fields:
            # All particulars were filled, step back to last field
            target_back_field = required_fields[-1]

        if not target_back_field:
            # At very first question
            first_f = required_fields[0] if required_fields else "name"
            spec = next((p for p in PARTICULARS_SPEC if p["field"] == first_f), None)
            reply = (
                f"We're currently at the very first step: **{spec['label'] if spec else 'Full Legal Name'}**! 😊\n\n"
                f"{spec['question'] if spec else 'Could you provide your full legal name?'}"
            )
            messages.append({
                "role": "assistant",
                "content": reply,
                "field": first_f,
            })
            return {
                "messages": messages,
                "pending_field": first_f,
                "rectifying_field": None,
                "rectified_field": None,
                "latest_assistant_response": reply,
                "detected_intent": "BACKTRACK",
                "intent_reason": "at_start_of_form",
            }

        spec = next((p for p in PARTICULARS_SPEC if p["field"] == target_back_field), None)
        label = spec["label"] if spec else target_back_field.replace("_", " ").title()
        curr_val = chat_data.get(target_back_field, "Not specified")

        reply = (
            f"No problem! Let's go back to **{label}**. ↩️\n\n"
            f"Currently recorded as: **{curr_val}**\n\n"
            f"What would you like to update it to?"
        )
        messages.append({
            "role": "assistant",
            "content": reply,
            "field": target_back_field,
        })
        return {
            "messages": messages,
            "pending_field": target_back_field,
            "rectifying_field": target_back_field,
            "rectified_field": None,
            "latest_assistant_response": reply,
            "detected_intent": "BACKTRACK",
            "intent_reason": f"backtracked_to_{target_back_field}",
        }

    # 2. Handle RECTIFY_DATA with direct new_val
    if intent == "RECTIFY_DATA" and target_field and new_val:
        chat_data[target_field] = new_val

        # Reactive adjustment: if marital_status changed to 'No', remove husband_name
        if target_field == "marital_status" and new_val in ("No", "Single", "Unmarried"):
            chat_data.pop("husband_name", None)

        progress = calculate_progress(chat_data, service_id, uploaded_docs)

        return {
            "chat_data": chat_data,
            "progress_percent": progress,
            "rectified_field": target_field,
            "rectified_value": new_val,
            "rectifying_field": None,
            "detected_intent": "RECTIFY_DATA",
            "intent_reason": reason or f"direct_rectification_{target_field}",
        }

    # 3. Handle RECTIFY_DATA request without value (Guided)
    if intent == "RECTIFY_DATA" and target_field:
        spec = next((p for p in PARTICULARS_SPEC if p["field"] == target_field), None)
        label = spec["label"] if spec else target_field.replace("_", " ").title()
        example = f" ({spec.get('example', '')})" if spec and spec.get("example") else ""
        curr_val = chat_data.get(target_field)
        curr_str = f" (Currently recorded as: **{curr_val}**)" if curr_val else ""

        reply = (
            f"Sure! Let's update your **{label}**.{curr_str}\n\n"
            f"What should your {label.lower()} be?{example}"
        )
        messages.append({
            "role": "assistant",
            "content": reply,
            "field": target_field,
        })
        return {
            "messages": messages,
            "pending_field": target_field,
            "rectifying_field": target_field,
            "rectified_field": None,
            "latest_assistant_response": reply,
            "detected_intent": "RECTIFY_DATA",
            "intent_reason": f"guided_rectification_{target_field}",
        }

    # Fallback
    return {
        "detected_intent": "PROVIDING_DATA",
    }


def route_after_rectify(state: AutomatedFormState) -> str:
    """
    If direct modification succeeded (rectified_field is populated), proceed to evaluate_next_step
    to celebrate the update and guide to the next missing slot.
    Otherwise (prompting citizen for backtrack/revision value), wait for citizen response (end turn).
    """
    if state.get("rectified_field"):
        return "evaluate_next_step"
    return "end"


def process_user_message_node(state: AutomatedFormState) -> Dict[str, Any]:
    """
    Node 3 (Data Extraction): Processes the user utterance when intent is PROVIDING_DATA,
    extracts the pending slot (or active rectifying slot), and updates chat_data.
    """
    last_msg = state.get("last_user_message", "").strip()
    pending = state.get("pending_field")
    rectifying = state.get("rectifying_field")
    chat_data = dict(state.get("chat_data") or {})

    field_to_extract = rectifying or pending

    # If user was rectifying and chooses to cancel or keep original
    if rectifying and any(w in last_msg.lower() for w in ["cancel", "keep it", "never mind", "leave it", "no change", "keep"]):
        return {
            "chat_data": chat_data,
            "rectifying_field": None,
            "rectified_field": None,
        }

    # Extract pending or rectifying field
    if field_to_extract and last_msg:
        extracted = extract_field_value(field_to_extract, last_msg)
        if extracted:
            chat_data[field_to_extract] = extracted
            logger.info(f"[LangGraph Node: process_user_message] Extracted {field_to_extract} = {extracted}")

            # Reactive adjustment for marital_status
            if field_to_extract == "marital_status" and extracted in ("No", "Single", "Unmarried"):
                chat_data.pop("husband_name", None)

            if rectifying:
                return {
                    "chat_data": chat_data,
                    "rectified_field": rectifying,
                    "rectified_value": extracted,
                    "rectifying_field": None,
                }

    # Co-extraction check: if citizen gave multiple details (e.g. DOB or gender co-mentioned)
    if "dob" not in chat_data:
        m = re.search(r"\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b", last_msg)
        if m:
            d, mth, y = m.group(1).zfill(2), m.group(2).zfill(2), m.group(3)
            chat_data["dob"] = f"{d}-{mth}-{y}"

    return {
        "chat_data": chat_data,
        "rectifying_field": None,
    }


def evaluate_next_step_node(state: AutomatedFormState) -> Dict[str, Any]:
    """
    Node 4 (Conversational Next Step Evaluator): Determines which field to ask next,
    generates warm casual acknowledgments (including rectification celebrations),
    checks document readiness, and frames the next conversational prompt.
    """
    service_id = state.get("service_id", "domicile_certificate")
    chat_data = state.get("chat_data") or {}
    uploaded_docs = state.get("uploaded_documents") or {}
    messages = list(state.get("messages") or [])
    rectified_f = state.get("rectified_field")
    rectified_v = state.get("rectified_value")

    required_fields = get_required_fields_for_service(service_id, chat_data)
    missing_fields = [f for f in required_fields if not chat_data.get(f)]

    progress = calculate_progress(chat_data, service_id, uploaded_docs)

    DOC_KEYS = ["identity_proof", "residential_proof", "age_proof", "signature", "passport_image"]
    missing_docs = [k for k in DOC_KEYS if not uploaded_docs.get(k)]

    # If a field was just rectified, craft a dedicated acknowledgment
    rect_ack = ""
    if rectified_f:
        spec_r = next((p for p in PARTICULARS_SPEC if p["field"] == rectified_f), None)
        r_label = spec_r["label"] if spec_r else rectified_f.replace("_", " ").title()
        rect_ack = f"Got it! Updated your **{r_label}** to **{rectified_v}**! 👍"

    if missing_fields:
        next_f = missing_fields[0]
        spec = next((p for p in PARTICULARS_SPEC if p["field"] == next_f), None)

        # Casual acknowledgments for what was just provided (if not a rectification)
        filled_fields = [f for f in required_fields if f not in missing_fields]
        last_filled = filled_fields[-1] if filled_fields else None

        ack_phrases = {
            "name": f"Awesome, nice to meet you, {str(chat_data.get('name', '')).split()[0]}! 🎉 Got your legal name saved.",
            "father_name": "Perfect, saved your father's name! 👍",
            "mother_name": "Got it, mother's name recorded!",
            "dob": f"Awesome, recorded your birth date ({chat_data.get('dob')})! 📅",
            "sex": f"Noted ({chat_data.get('sex')})!",
            "marital_status": "Got your marital status noted!",
            "husband_name": "Recorded your husband's name!",
            "address": "Great, saved your residential address! 🏡",
            "years_of_residence": f"Got it, {chat_data.get('years_of_residence')} years residing in Maharashtra!",
            "purpose": "Noted down the purpose for your certificate!",
        }

        # Casual next question prompts
        casual_questions = {
            "name": "To start off, what is your full legal name as per government records?",
            "father_name": "Could you share your father's full name next?",
            "mother_name": "And what's your mother's full name?",
            "dob": "When were you born? (In DD-MM-YYYY format, e.g. 15-08-1995)",
            "sex": "What is your gender? (Male, Female, or Others)",
            "marital_status": "Are you married, or currently single? (Yes / No)",
            "husband_name": "Since you're married, what is your husband's full name?",
            "address": "Where are you currently staying? Please drop your full address (house no, street, taluka, district & pincode).",
            "years_of_residence": "For your Domicile Certificate, about how many years have you been living continuously in Maharashtra?",
            "purpose": "What are you planning to use this Income Certificate for? (e.g. Higher Education Scholarship, Fee Concession)",
        }

        q = casual_questions.get(next_f, spec["question"] if spec else f"Could you provide your {next_f.replace('_', ' ').title()}?")

        if rect_ack:
            combined_text = f"{rect_ack}\n\nNow, let's continue:\n{q}"
        else:
            ack = ack_phrases.get(last_filled, "") if last_filled else ""
            combined_text = f"{ack}\n\n{q}" if ack else q

        messages.append({
            "role": "assistant",
            "content": combined_text,
            "field": next_f,
        })

        return {
            "pending_field": next_f,
            "current_phase": "chat",
            "progress_percent": progress,
            "messages": messages,
            "latest_assistant_response": combined_text,
            "can_view_form": progress >= 50,
            "rectified_field": None,
            "rectified_value": None,
        }

    elif missing_docs:
        doc_names = {
            "identity_proof": "Identity Proof (Aadhaar / PAN / Voter ID)",
            "residential_proof": "Residential Proof (Electricity Bill / Water Bill / Rent Agreement)",
            "age_proof": "Proof of Age (Birth Certificate / School Leaving Certificate)",
            "signature": "Applicant Signature (Scanned image)",
            "passport_image": "Passport-size Photograph",
        }
        needed_list = "\n".join(f"• {doc_names.get(d, d)}" for d in missing_docs)
        header = f"{rect_ack}\n\n" if rect_ack else ""
        doc_msg = (
            f"{header}🎉 Woohoo! All your personal particulars have been successfully recorded!\n\n"
            "Now, please upload the required supporting documents using the upload slots below:\n"
            f"{needed_list}\n\n"
            "Our automated OCR engine will instantly process each document and extract relevant details."
        )

        messages.append({
            "role": "assistant",
            "content": doc_msg,
            "is_document_prompt": True,
        })

        return {
            "pending_field": None,
            "current_phase": "documents",
            "progress_percent": progress,
            "messages": messages,
            "latest_assistant_response": doc_msg,
            "can_view_form": True,
            "rectified_field": None,
            "rectified_value": None,
        }

    else:
        header = f"{rect_ack}\n\n" if rect_ack else ""
        ready_msg = (
            f"{header}🎉 All application details and statutory documents have been successfully collected and OCR-verified!\n\n"
            "You can now click the **'View Application Form'** button below to inspect your populated form, "
            "review the side-by-side OCR match scores, and finalize your submission."
        )

        messages.append({
            "role": "assistant",
            "content": ready_msg,
            "is_ready": True,
        })

        return {
            "pending_field": None,
            "current_phase": "ready_for_review",
            "progress_percent": 100,
            "messages": messages,
            "latest_assistant_response": ready_msg,
            "can_view_form": True,
            "rectified_field": None,
            "rectified_value": None,
        }


# ─────────────────────────────────────────────────────────────
# 7. Build and Compile the LangGraph
# ─────────────────────────────────────────────────────────────

def build_automated_form_graph():
    """
    Builds and compiles the StateGraph workflow with Intent Identification,
    Backtrack & Data Rectification, Casual conversational routing,
    and Slot Extraction.
    """
    workflow = StateGraph(AutomatedFormState)

    workflow.add_node("intent_identifier", intent_identifier_node)
    workflow.add_node("chatbot_node", casual_chatbot_node)
    workflow.add_node("backtrack_rectify_node", backtrack_rectify_node)
    workflow.add_node("process_user_message", process_user_message_node)
    workflow.add_node("evaluate_next_step", evaluate_next_step_node)

    workflow.add_edge(START, "intent_identifier")

    workflow.add_conditional_edges(
        "intent_identifier",
        route_intent,
        {
            "chatbot_node": "chatbot_node",
            "backtrack_rectify_node": "backtrack_rectify_node",
            "process_user_message": "process_user_message",
        }
    )

    workflow.add_edge("chatbot_node", END)

    workflow.add_conditional_edges(
        "backtrack_rectify_node",
        route_after_rectify,
        {
            "evaluate_next_step": "evaluate_next_step",
            "end": END,
        }
    )

    workflow.add_edge("process_user_message", "evaluate_next_step")
    workflow.add_edge("evaluate_next_step", END)

    return workflow.compile()


# Singleton compiled graph instance
automated_form_graph = build_automated_form_graph()
