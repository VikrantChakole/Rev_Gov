"""
Admin Message / WhatsApp and IVR Configuration Routes.
Manages:
1. SMS & WhatsApp Gateway credentials, provider selection, triggers, and multilingual templates.
2. IVR Helpline parameters, DTMF menu rules, voice/TTS engine, and greeting prompts.
3. Test dispatch sandbox for SMS/WhatsApp and real-time TTS audio generation for IVR.
"""
import os
import json
import uuid
import datetime
import logging
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.tts_service import TTSService
from app.models.db_models import ConversationSession, ConversationMessage, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/config", tags=["admin-config"])

CONFIG_DIR = "data/config"
MESSAGE_CONFIG_FILE = os.path.join(CONFIG_DIR, "message_config.json")
IVR_CONFIG_FILE = os.path.join(CONFIG_DIR, "ivr_config.json")

_tts = TTSService()

# ─────────────────────────────────────────────────────────────
# Default Configurations
# ─────────────────────────────────────────────────────────────

DEFAULT_MESSAGE_CONFIG: Dict[str, Any] = {
    "sms_provider": "cdac_gov",
    "whatsapp_provider": "meta_cloud",
    "sms_api_key": "gov_sms_sec_99348a28",
    "whatsapp_phone_number_id": "109847291048201",
    "whatsapp_access_token": "EAAOx92govRevenuePortalSecKeyToken",
    "sender_id": "REVGOV",
    "enable_sms": True,
    "enable_whatsapp": True,
    "fallback_to_sms": True,
    "triggers": {
        "SUBMITTED": {
            "name": "Application Submitted",
            "enabled": True,
            "channels": ["whatsapp", "sms"],
            "priority": "HIGH",
            "templates": {
                "en": "✅ Application Submitted!\n\nYour application for {service_name} has been received successfully.\nTracking ID: {tracking_id}\n\nTrack progress anytime at {portal_url}.",
                "hi": "✅ आवेदन जमा हो गया!\n\n{service_name} के लिए आपका आवेदन प्राप्त हो गया है।\nट्रैकिंग ID: {tracking_id}\n\nप्रगति ट्रैक करें: {portal_url}",
                "mr": "✅ अर्ज सादर झाला!\n\n{service_name} साठी तुमचा अर्ज यशस्वीरित्या प्राप्त झाला आहे.\nट्रॅकिंग ID: {tracking_id}\n\nप्रगती पहा: {portal_url}",
            },
        },
        "UNDER_REVIEW": {
            "name": "Under Government Review",
            "enabled": True,
            "channels": ["whatsapp", "sms"],
            "priority": "NORMAL",
            "templates": {
                "en": "📋 Scrutiny in Progress: Your {service_name} application is currently under review by the designated Revenue Officer.\n\nTracking ID: {tracking_id}",
                "hi": "📋 समीक्षा प्रगति पर: आपका {service_name} आवेदन संबंधित राजस्व अधिकारी द्वारा जांच में है।\n\nट्रैकिंग ID: {tracking_id}",
                "mr": "📋 छाननी सुरू आहे: तुमचा {service_name} अर्ज संबंधित महसूल अधिकाऱ्यांच्या पुनरावलोकनाखाली आहे.\n\nट्रॅकिंग ID: {tracking_id}",
            },
        },
        "CORRECTION_NEEDED": {
            "name": "Action / Clarification Required",
            "enabled": True,
            "channels": ["whatsapp", "sms"],
            "priority": "HIGH",
            "templates": {
                "en": "⚠️ Action Required: Additional clarification or document re-upload is needed for your {service_name} application.\n\nReason: {reason}\nTracking ID: {tracking_id}\nUpdate here: {portal_url}",
                "hi": "⚠️ कार्रवाई आवश्यक: आपके {service_name} आवेदन के लिए अतिरिक्त जानकारी या दस्तावेज़ की आवश्यकता है।\n\nकारण: {reason}\nट्रैकिंग ID: {tracking_id}\nयहाँ अपडेट करें: {portal_url}",
                "mr": "⚠️ कृती आवश्यक: तुमच्या {service_name} अर्जासाठी अतिरिक्त कागदपत्रे किंवा माहिती आवश्यक आहे.\n\nकारण: {reason}\nट्रॅकिंग ID: {tracking_id}\nयेथे दुरुस्त करा: {portal_url}",
            },
        },
        "APPROVED": {
            "name": "Application Approved",
            "enabled": True,
            "channels": ["whatsapp", "sms"],
            "priority": "HIGH",
            "templates": {
                "en": "🎉 Application Approved! Your {service_name} application has been officially approved by the Sub-Divisional Officer.\n\nTracking ID: {tracking_id}\nPlease complete fee payment to issue the certificate: {portal_url}",
                "hi": "🎉 आवेदन स्वीकृत! आपका {service_name} आवेदन अनुविभागीय अधिकारी द्वारा स्वीकृत कर दिया गया है।\n\nट्रैकिंग ID: {tracking_id}\nकृपया शुल्क भुगतान पूर्ण करें: {portal_url}",
                "mr": "🎉 अर्ज मंजूर! तुमचा {service_name} अर्ज उपविभागीय अधिकाऱ्याने अधिकृतपणे मंजूर केला आहे.\n\nट्रॅकिंग ID: {tracking_id}\nप्रमाणपत्रासाठी कृपया शुल्क भरा: {portal_url}",
            },
        },
        "PAYMENT_REQUIRED": {
            "name": "Payment Required",
            "enabled": True,
            "channels": ["whatsapp", "sms"],
            "priority": "HIGH",
            "templates": {
                "en": "💳 Statutory Payment Pending: Fee of ₹{amount} is required for {service_name}.\n\nTracking ID: {tracking_id}\nPay online securely: {portal_url}",
                "hi": "💳 वैधानिक भुगतान लंबित: {service_name} के लिए ₹{amount} का शुल्क देय है।\n\nट्रैकिंग ID: {tracking_id}\nसुरक्षित भुगतान करें: {portal_url}",
                "mr": "💳 शासकीय शुल्क भरणे बाकी: {service_name} साठी ₹{amount} शुल्क भरणे आवश्यक आहे.\n\nट्रॅकिंग ID: {tracking_id}\nऑनलाइन शुल्क भरा: {portal_url}",
            },
        },
        "CERTIFICATE_READY": {
            "name": "Certificate Issued & Ready",
            "enabled": True,
            "channels": ["whatsapp", "sms"],
            "priority": "HIGH",
            "templates": {
                "en": "🏛️ Official Certificate Issued! Your digitally signed {service_name} certificate is ready for download.\n\nTracking ID: {tracking_id}\nDownload Certificate: {portal_url}",
                "hi": "🏛️ आधिकारिक प्रमाण पत्र जारी! आपका डिजिटल हस्ताक्षरित {service_name} प्रमाण पत्र तैयार है।\n\nट्रैकिंग ID: {tracking_id}\nडाउनलोड करें: {portal_url}",
                "mr": "🏛️ अधिकृत प्रमाणपत्र जारी! तुमचे डिजिटल स्वाक्षरी केलेले {service_name} प्रमाणपत्र डाउनलोडसाठी तयार आहे.\n\nट्रॅकिंग ID: {tracking_id}\nप्रमाणपत्र डाउनलोड करा: {portal_url}",
            },
        },
        "ESCALATED": {
            "name": "Application Escalated",
            "enabled": True,
            "channels": ["whatsapp", "sms"],
            "priority": "HIGH",
            "templates": {
                "en": "⚡ Application Escalated: Your application #{tracking_id} has been forwarded to the local Desk Clerk for fast-track resolution.\n\nReason: {reason}",
                "hi": "⚡ आवेदन एस्केलेट किया गया: आपका आवेदन #{tracking_id} त्वरित समाधान के लिए स्थानीय डेस्क क्लर्क को भेज दिया गया है।\n\nकारण: {reason}",
                "mr": "⚡ अर्ज निवारणासाठी वर्ग: तुमचा अर्ज #{tracking_id} जलद कार्यवाहीसाठी स्थानिक डेस्क लिपिकाकडे वर्ग करण्यात आला आहे.\n\nकारण: {reason}",
            },
        },
        "REJECTED": {
            "name": "Application Rejected",
            "enabled": True,
            "channels": ["whatsapp", "sms"],
            "priority": "HIGH",
            "templates": {
                "en": "❌ Application Rejected: Your {service_name} application could not be approved after scrutiny.\n\nReason: {reason}\nTracking ID: {tracking_id}\nYou may appeal or file fresh via {portal_url}.",
                "hi": "❌ आवेदन अस्वीकृत: आपका {service_name} आवेदन अस्वीकृत कर दिया गया है।\n\nकारण: {reason}\nट्रैकिंग ID: {tracking_id}",
                "mr": "❌ अर्ज नाकारला: तुमचा {service_name} अर्ज छाननीनंतर नाकारण्यात आला आहे.\n\nकारण: {reason}\nट्रॅकिंग ID: {tracking_id}",
            },
        },
    },
    "placeholders": [
        {"key": "{citizen_name}", "description": "Applicant full legal name", "sample": "Ramesh Patil"},
        {"key": "{tracking_id}", "description": "Application tracking code", "sample": "MH-REV-2026-88392"},
        {"key": "{service_name}", "description": "Official service title", "sample": "Income Certificate"},
        {"key": "{status}", "description": "Current processing state", "sample": "Approved"},
        {"key": "{portal_url}", "description": "Direct link to citizen portal action", "sample": "https://revgov.maharashtra.gov.in/track"},
        {"key": "{amount}", "description": "Fee payable in INR", "sample": "55"},
        {"key": "{reason}", "description": "Officer / system reason text", "sample": "Clarification required on ration card address"},
    ],
}

DEFAULT_IVR_CONFIG: Dict[str, Any] = {
    "helpline_number": "1800-120-8040",
    "alternative_number": "022-2202-9999",
    "operating_hours": "24x7",
    "default_language": "en",
    "tts_engine": "gtts",
    "stt_engine": "google",
    "voice_gender": "female",
    "speech_rate": 1.0,
    "max_silence_timeout_sec": 5,
    "fallback_action": "TRANSFER_TO_CLERK",
    "dtmf_menu": {
        "1": {"label": "Application Status Check", "action": "CHECK_STATUS", "enabled": True},
        "2": {"label": "Service Catalogue & Requirements", "action": "SERVICE_INFO", "enabled": True},
        "3": {"label": "Payment Status & Fee Verification", "action": "CHECK_PAYMENT", "enabled": True},
        "9": {"label": "Connect with Desk Clerk", "action": "TRANSFER_CLERK", "enabled": True},
        "0": {"label": "Repeat Menu Prompts", "action": "REPEAT_MENU", "enabled": True},
    },
    "greetings": {
        "en": "Welcome to the Revenue Department Citizen Helpline! For application status, press 1. For service requirements, press 2. For payment status, press 3. To connect with a desk clerk, press 9. To repeat this menu, press 0.",
        "hi": "राजस्व विभाग नागरिक हेल्पलाइन में आपका स्वागत है! आवेदन की स्थिति के लिए 1 दबाएं। सेवा संबंधी जानकारी के लिए 2 दबाएं। भुगतान स्थिति के लिए 3 दबाएं। डेस्क क्लर्क से बात करने के लिए 9 दबाएं। मेनू दोहराने के लिए 0 दबाएं।",
        "mr": "महसूल विभाग नागरिक हेल्पलाइनमध्ये आपले स्वागत आहे! अर्जाच्या स्थितीसाठी 1 दाबा. सेवांच्या माहितीसाठी 2 दाबा. पेमेंट स्थितीसाठी 3 दाबा. डेस्क लिपिकाशी संपर्क साधण्यासाठी 9 दाबा. मेनू पुन्हा ऐकण्यासाठी 0 दाबा.",
    },
}


def _load_json_config(file_path: str, default: Dict[str, Any]) -> Dict[str, Any]:
    os.makedirs(CONFIG_DIR, exist_ok=True)
    if not os.path.exists(file_path):
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(default, f, indent=2, ensure_ascii=False)
        return json.loads(json.dumps(default))
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Error loading {file_path}, falling back to defaults: {e}")
        return json.loads(json.dumps(default))


def _save_json_config(file_path: str, data: Dict[str, Any]) -> None:
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ─────────────────────────────────────────────────────────────
# Request Models
# ─────────────────────────────────────────────────────────────

class UpdateMessageConfigRequest(BaseModel):
    sms_provider: Optional[str] = None
    whatsapp_provider: Optional[str] = None
    sms_api_key: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_access_token: Optional[str] = None
    sender_id: Optional[str] = None
    enable_sms: Optional[bool] = None
    enable_whatsapp: Optional[bool] = None
    fallback_to_sms: Optional[bool] = None
    triggers: Optional[Dict[str, Any]] = None


class TestMessageRequest(BaseModel):
    recipient_phone: str = "9876543210"
    channel: str = "whatsapp"   # "whatsapp" | "sms"
    trigger_event: str = "SUBMITTED"
    language: str = "en"        # "en" | "hi" | "mr"
    custom_vars: Optional[Dict[str, str]] = None


class UpdateIVRConfigRequest(BaseModel):
    helpline_number: Optional[str] = None
    alternative_number: Optional[str] = None
    operating_hours: Optional[str] = None
    default_language: Optional[str] = None
    tts_engine: Optional[str] = None
    stt_engine: Optional[str] = None
    voice_gender: Optional[str] = None
    speech_rate: Optional[float] = None
    max_silence_timeout_sec: Optional[int] = None
    fallback_action: Optional[str] = None
    dtmf_menu: Optional[Dict[str, Any]] = None
    greetings: Optional[Dict[str, str]] = None


class TestTTSRequest(BaseModel):
    text: str
    language: str = "en"
    tts_engine: Optional[str] = "gtts"


# ─────────────────────────────────────────────────────────────
# Message & WhatsApp Config Endpoints
# ─────────────────────────────────────────────────────────────

@router.get("/message")
def get_message_configuration():
    """Retrieve full SMS and WhatsApp status notification configuration."""
    config = _load_json_config(MESSAGE_CONFIG_FILE, DEFAULT_MESSAGE_CONFIG)
    return {
        "success": True,
        "config": config,
        "timestamp": datetime.datetime.utcnow().isoformat(),
    }


@router.post("/message")
def update_message_configuration(body: UpdateMessageConfigRequest):
    """Update SMS/WhatsApp gateway, status triggers, and multilingual templates."""
    current = _load_json_config(MESSAGE_CONFIG_FILE, DEFAULT_MESSAGE_CONFIG)
    
    update_data = body.dict(exclude_unset=True)
    for k, v in update_data.items():
        if v is not None:
            current[k] = v

    _save_json_config(MESSAGE_CONFIG_FILE, current)

    # Synchronize with in-memory NOTIFICATION_TEMPLATES if present
    try:
        from app.services import notification_service
        if hasattr(notification_service, "NOTIFICATION_TEMPLATES") and "triggers" in current:
            # Map trigger keys to EventType if matching
            from app.channels.base import EventType
            for evt in EventType:
                trig_key = evt.value
                if trig_key in current["triggers"]:
                    notification_service.NOTIFICATION_TEMPLATES[evt] = current["triggers"][trig_key].get("templates", {})
    except Exception as e:
        logger.warning(f"Could not hot-reload NOTIFICATION_TEMPLATES: {e}")

    return {
        "success": True,
        "message": "Message & WhatsApp configuration saved successfully.",
        "config": current,
    }


@router.post("/message/test")
def test_message_dispatch(body: TestMessageRequest, db: Session = Depends(get_db)):
    """
    Test Sandbox for SMS/WhatsApp alert dispatch.
    Interpolates mock variables, formats payload, and simulates delivery.
    If WhatsApp is chosen, optionally records in conversation for simulator view.
    """
    config = _load_json_config(MESSAGE_CONFIG_FILE, DEFAULT_MESSAGE_CONFIG)
    trigger = config.get("triggers", {}).get(body.trigger_event)
    
    if not trigger:
        raise HTTPException(status_code=404, detail=f"Trigger event '{body.trigger_event}' not found.")

    templates = trigger.get("templates", {})
    template = templates.get(body.language, templates.get("en", "Status alert for application {tracking_id}"))

    # Interpolate variables
    defaults = {
        "citizen_name": "Ramesh Patil",
        "tracking_id": f"MH-REV-{datetime.date.today().year}-{str(uuid.uuid4().int)[:5]}",
        "service_name": "Income Certificate",
        "status": body.trigger_event.replace("_", " ").title(),
        "portal_url": "http://localhost:5173/status",
        "amount": "55",
        "reason": "Address proof clarification required by Scrutiny Desk",
        "escalation_id": f"ESC-{str(uuid.uuid4())[:6].upper()}",
    }
    if body.custom_vars:
        defaults.update(body.custom_vars)

    try:
        rendered_text = template.format(**defaults)
    except Exception as e:
        rendered_text = template

    dispatch_id = f"MSG-{body.channel.upper()}-{uuid.uuid4().hex[:8].upper()}"
    timestamp = datetime.datetime.utcnow().isoformat()

    # If WhatsApp, also register a message in the active citizen conversation session if found
    if body.channel.lower() == "whatsapp":
        try:
            active_session = (
                db.query(ConversationSession)
                .order_by(ConversationSession.updated_at.desc())
                .first()
            )
            if active_session:
                msg = ConversationMessage(
                    session_id=active_session.id,
                    role="ASSISTANT",
                    content=rendered_text,
                    message_type="TEXT",
                )
                db.add(msg)
                db.commit()
        except Exception as e:
            logger.warning(f"Could not mirror test WhatsApp message to DB session: {e}")

    return {
        "success": True,
        "dispatch_id": dispatch_id,
        "channel": body.channel.lower(),
        "recipient": body.recipient_phone,
        "trigger_event": body.trigger_event,
        "language": body.language,
        "rendered_message": rendered_text,
        "status": "DELIVERED",
        "latency_ms": 112,
        "provider": config.get("whatsapp_provider" if body.channel.lower() == "whatsapp" else "sms_provider"),
        "timestamp": timestamp,
    }


# ─────────────────────────────────────────────────────────────
# IVR Config Endpoints
# ─────────────────────────────────────────────────────────────

@router.get("/ivr")
def get_ivr_configuration():
    """Retrieve full IVR helpline and DTMF configuration."""
    config = _load_json_config(IVR_CONFIG_FILE, DEFAULT_IVR_CONFIG)
    return {
        "success": True,
        "config": config,
        "timestamp": datetime.datetime.utcnow().isoformat(),
    }


@router.post("/ivr")
def update_ivr_configuration(body: UpdateIVRConfigRequest):
    """Update IVR helpline parameters, DTMF menu options, and greetings."""
    current = _load_json_config(IVR_CONFIG_FILE, DEFAULT_IVR_CONFIG)

    update_data = body.dict(exclude_unset=True)
    for k, v in update_data.items():
        if v is not None:
            current[k] = v

    _save_json_config(IVR_CONFIG_FILE, current)

    # Synchronize with in-memory IVR_GREETINGS
    try:
        from app.api.routes import ivr
        if hasattr(ivr, "IVR_GREETINGS") and "greetings" in current:
            ivr.IVR_GREETINGS.update(current["greetings"])
    except Exception as e:
        logger.warning(f"Could not hot-reload IVR_GREETINGS: {e}")

    return {
        "success": True,
        "message": "IVR configuration saved successfully.",
        "config": current,
    }


@router.post("/ivr/test-tts")
def test_ivr_tts_synthesis(body: TestTTSRequest):
    """
    Synthesize custom prompt text into voice audio for immediate browser playback.
    Returns static URL for the generated MP3.
    """
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    out_dir = "data/audio/ivr"
    os.makedirs(out_dir, exist_ok=True)

    tts_result = _tts.synthesize(
        text=body.text,
        language=body.language,
        output_format="mp3",
        output_dir=out_dir,
    )

    if not tts_result.file_path or not os.path.exists(tts_result.file_path):
        # Fallback empty or mock
        return {
            "success": False,
            "message": "TTS audio synthesis was unable to generate an audio file.",
            "audio_url": None,
        }

    rel_filename = os.path.basename(tts_result.file_path)
    audio_url = f"/data/audio/ivr/{rel_filename}"

    return {
        "success": True,
        "audio_url": audio_url,
        "format": tts_result.format,
        "language": tts_result.language,
        "provider": tts_result.provider,
        "characters": len(body.text),
    }
