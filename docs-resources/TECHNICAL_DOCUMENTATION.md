# RevGOV Platform — Comprehensive Technical Documentation & Integrations Guide

**Document Identifier:** `REV-DOC-TECH-INT-2026-V1`  
**System Name:** RevGOV Revenue Services & Statutory Certificate Delivery Platform  
**Target Audience:** Enterprise Solutions Architects, Lead Engineers, Government Auditors, DevOps Specialists  
**Classification:** Official Technical Specification & System Architecture Reference  
**Platform Version:** 3.2.0 (Enterprise Omnichannel Release)  
**Standard Compliance:** Information Technology Act 2000, Section 65B Indian Evidence Act, Digital Personal Data Protection Act (DPDPA 2023), Maharashtra Right to Public Services Act (RTS 2015)  
**Language Scope:** 10 Indian Regional Languages (English, Hindi, Marathi, Bengali, Telugu, Tamil, Gujarati, Kannada, Malayalam, Punjabi)

---

## Executive Summary & System Overview

The **RevGOV Platform** is a sovereign digital revenue administration and statutory certificate issuance system designed for state revenue departments, collectorates, and municipal corporations. The platform solves the fundamental barriers of conventional e-governance—illiteracy, complex bureaucratic forms, procedural opacity, upfront financial risk, and document forgery—by synthesizing:

1. **Omnichannel Ingestion & Continuity**: Unified state tracking across Web, WhatsApp Business, Interactive Voice Response (IVR) Telephony, and In-Person Assisted Kiosks.
2. **Zero-Trust Data Guard Firewall**: On-premise runtime security boundary that intercepts, sanitizes, and redacts Personally Identifiable Information (PII) before any external AI orchestration occurs.
3. **Deterministic 14-Stage Finite State Machine (FSM)**: Enforces an immutable legal invariant: **statutory application fees are demanded ONLY after government documentary verification**.
4. **Multi-Role Workstation Portals**: Dedicated, role-based workflows for Citizens, Desk Clerks (Scrutiny), District Officers (SDO/Tahsildar Digital Signing), and Compliance Auditors.
5. **Dual OCR & Automated Discrepancy Matching**: Hybrid extraction pipeline pairing Tesseract Indic OCR and Google Gemini Flash Vision with phonetic/Levenshtein field matching.
6. **MahaTreasury e-Pay Settlement Engine**: Statutory payment integration with automated Government Form TR-5 Treasury Receipt generation and instant QR reconciliation.
7. **Tamper-Evident Cryptographic Sealing**: ReportLab PDF certificate engine embedding anti-copy guilloche watermarks, SHA-256 integrity digests, and zero-auth public 2D verification QR codes.
8. **10-Language Regional Localization**: Native UI parity across 10 official languages with dynamic service translation, localized date formatting, and ₹ (INR) currency representation.

---

## 1. System Topology & Architectural Foundations

### 1.1 Macro Architectural Model

RevGOV operates across three security trust boundaries:

```
                            ZONE 2: UNTRUSTED PUBLIC & CLOUD
 ┌──────────────────┬─────────────────┬──────────────────┬──────────────────┐
 │  Web Portal UI   │  WhatsApp Cloud │  Telephony IVR   │  External LLMs   │
 └────────┬─────────┴────────┬────────┴────────┬─────────┴────────┬─────────┘
          │                  │                 │                  │
          ▼                  ▼                 ▼                  ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                  SECURITY PERIMETER & FASTAPI GATEWAY                      │
│   • TLS 1.3 Termination              • Sliding-Window Rate Limiter         │
│   • Magic MIME Type Verification     • Strict Content Security Policy      │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │
                                      ▼
                        ZONE 1: SECURE ORCHESTRATION
┌────────────────────────────────────────────────────────────────────────────┐
│                    DATA GUARD TRUST BOUNDARY FIREWALL                      │
│   • Rego / OPA & Regex PII Sanitizer • Quasi-Identifier Anonymization     │
│   • Reversible Token Vault           • Audit Event Publisher               │
└──────────────────┬─────────────────────────────────────┬───────────────────┘
                   │                                     │
                   ▼                                     ▼
┌──────────────────────────────────────┐ ┌──────────────────────────────────┐
│     CONVERSATION & FORM ENGINE       │ │    DOCUMENT INTELLIGENCE (OCR)    │
│   • Deterministic Slot Filling       │ │   • Multi-Provider Orchestrator  │
│   • YAML Service Spec Validation     │ │   • Tesseract Indic OCR          │
│   • 5-Pillar Readiness Engine        │ │   • PyMuPDF Rasterizer           │
│   • Explainable Fraud Risk Engine    │ │   • Gemini Flash Vision AI       │
└──────────────────┬───────────────────┘ └──────────────────┬───────────────┘
                   │                                        │
                   └──────────────────┬─────────────────────┘
                                      │
                                      ▼
                        ZONE 0: ON-PREMISE SOVEREIGN CORE
┌────────────────────────────────────────────────────────────────────────────┐
│                  PERSISTENCE, CRYPTOGRAPHY & AUDIT TRAIL                   │
│   • SQLite WAL / PostgreSQL Engine   • Field-Level AES-256-GCM Encryption │
│   • 14-State Deterministic FSM       • MahaTreasury e-Pay Adapter         │
│   • ReportLab PDF & QR Generator     • Real-Time SSE Broadcast EventBus   │
│   • Append-Only Audit Log Trail      • CSV Compliance Export Pipeline     │
└────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Rationale & Responsibility |
|---|---|---|
| **Backend Core** | Python 3.10+ / FastAPI / Uvicorn | High-concurrency async I/O, OpenAPI auto-documentation, enterprise typing |
| **Data Persistence** | SQLite 3 (WAL mode) / PostgreSQL | Sovereign on-premise transactional ACID persistence, zero external db lock |
| **ORM & Schema** | SQLAlchemy 2.0+ / Pydantic v2 | Declarative models, field validation, JSON schema serialization |
| **Frontend Framework** | React 18 / Vite 5 | Reactive component architecture, SPA routing, zero runtime lag |
| **Styling Architecture** | Modular CSS / CSS Tokens | High-contrast accessibility, dark/light modes, zero CSS framework bloat |
| **Internationalization** | i18next / react-i18next | Multi-catalog key resolution, fallback cascading, 10-language parity |
| **PDF Generation** | ReportLab Enterprise Toolkit | Vector graphics, dynamic flowables, official government seals |
| **Vision & OCR** | Tesseract 5 + PyMuPDF + Gemini Vision | Multilingual Indic text extraction, PDF rasterization, high-fidelity AI OCR |
| **Realtime Pub/Sub** | Server-Sent Events (SSE) / EventSource | Zero-overhead lightweight push notifications to workstations |
| **Cryptography** | `cryptography` (AES-256-GCM), hashlib | Field-level encryption, tamper-evident SHA-256 digests, HMAC webhooks |

---

## 2. Core Technical Integrations

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       REVGOV INTEGRATION ECOSYSTEM                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│       ┌───────────────┐     ┌────────────────┐     ┌───────────────┐       │
│       │  OpenRouter   │     │  Google Gemini │     │ Tesseract OCR │       │
│       │  Cloud LLM    │     │  Vision AI     │     │ & PyMuPDF     │       │
│       └───────▲───────┘     └───────▲────────┘     └───────▲───────┘       │
│               │                     │                      │               │
│               └──────────────┐      │      ┌───────────────┘               │
│                              ▼      ▼      ▼                               │
│                      ┌─────────────────────────────┐                       │
│                      │       FASTAPI BACKEND       │                       │
│                      │    RevGOV Core Services     │                       │
│                      └───────▲──────▲──────▲───────┘                       │
│                              │      │      │                               │
│               ┌──────────────┘      │      └───────────────┐               │
│               ▼                     ▼                      ▼               │
│       ┌───────────────┐     ┌────────────────┐     ┌───────────────┐       │
│       │ Meta WhatsApp │     │ Twilio Telephony│     │ MahaTreasury  │       │
│       │ Business API  │     │ IVR Voice Stream│     │ e-Pay Gateway │       │
│       └───────────────┘     └────────────────┘     └───────────────┘       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Cloud & Local AI LLM Integration

RevGOV employs an intelligent, privacy-preserving hybrid LLM architecture:

- **Provider**: OpenRouter API (`https://openrouter.ai/api/v1`) with fallback to direct Google Gemini (`gemini-2.5-flash`, `gemini-1.5-pro`) and on-premise Ollama instances (`llama3`, `mistral`).
- **Implementation File**: `backend/app/llm/openrouter_provider.py` & `backend/app/services/gemini_dialogue.py`.
- **Functionality**:
  - Extracts structured demographic and statutory slots from free-form citizen transcripts.
  - Generates conversational voice responses tailored to citizen literacy level.
  - Parses vernacular text and maps colloquial colloquialisms (e.g., "माझं उत्पन्न पन्नास हजार आहे" -> `annual_income: 50000`).
- **Data Guard Enforcement**: The backend ensures that no raw citizen PII (Aadhaar, Phone, Full Name, Physical Address) is ever transmitted to OpenRouter or Google Gemini. All requests route through the Data Guard Sanitizer, substituting raw identifiers with reversible surrogate tokens (`CITIZEN_ALPHA`, `TOKEN_AADHAAR_01`).

```python
# Conceptual Flow in openrouter_provider.py
async def generate_chat_completion(sanitized_prompt: str) -> Dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://revgov.maharashtra.gov.in",
        "X-Title": "RevGOV Sovereign Platform"
    }
    payload = {
        "model": settings.PRIMARY_LLM_MODEL,
        "messages": [{"role": "user", "content": sanitized_prompt}],
        "temperature": 0.1,  # Low temperature for strict statutory fidelity
        "response_format": {"type": "json_object"}
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(OPENROUTER_ENDPOINT, json=payload, headers=headers)
        return response.json()
```

### 2.2 Dual OCR & Document Intelligence Pipeline

- **Implementation Files**: `backend/app/services/ocr_service.py` & `backend/app/api/routes/ocr_admin.py`.
- **Engines Supported**:
  1. **Tesseract 5 OCR**: Local on-premise binary. Configured with Indic language packs: `hin` (Hindi), `mar` (Marathi), `tam` (Tamil), `tel` (Telugu), `mal` (Malayalam), `eng` (English).
  2. **PyMuPDF (`fitz`)**: High-speed vector PDF parser and 300 DPI rasterization pipeline for scanned government annexures.
  3. **Google Gemini Flash Vision**: Multimodal visual model for parsing low-contrast government seals, blurred rubber stamps, and handwritten revenue ledgers.
  4. **Mock Simulator**: Built-in deterministic OCR mock for zero-dependency offline air-gapped deployments.
- **Image Preprocessing Pipeline**:
  - Grayscale contrast equalization.
  - Adaptive Gaussian thresholding.
  - Skew correction via Hough line transform.
  - Bounding box isolation for document labels (`Father's Name`, `Aadhaar No`, `Annual Income`).
- **Dynamic Admin Configuration**:
  - District administrators can switch providers on the fly via `POST /api/v1/admin/ocr/config`.
  - Includes real-time testing sandbox (`POST /api/v1/admin/ocr/test`) to validate extraction accuracy against live document uploads.

### 2.3 Conversational Voice & Audio Processing

- **Implementation Files**: `backend/app/services/stt_service.py`, `tts_service.py`, `stt_tts_adapter.py`.
- **Speech-to-Text (STT)**:
  - Inbound citizen audio captured via Web MediaRecorder (`audio/webm;codecs=opus`), WhatsApp voice notes (`audio/ogg;codecs=opus`), or IVR streams (`audio/x-mulaw`).
  - Audio resampled to 16kHz mono WAV.
  - Transcribed using OpenAI Whisper API or on-premise Whisper.cpp models with native language detection.
- **Text-to-Speech (TTS)**:
  - Multi-backend TTS synthesizer supporting `edge-tts`, `gTTS`, and native Windows SAPI / Linux `pyttsx3`.
  - Synthesizes dynamic prompts in target regional language with natural pacing and phoneme clarity.

### 2.4 Omnichannel Messaging & Webhook Integration

- **Implementation Files**: `backend/app/api/routes/whatsapp.py`, `backend/app/services/notification_service.py`, `backend/app/api/routes/config_admin.py`.
- **Supported Gateways**:
  1. **Meta Cloud WhatsApp Business API**:
     - Webhook endpoint: `POST /api/v1/webhook/whatsapp`.
     - Inbound HMAC-SHA256 signature verification (`X-Hub-Signature-256`).
     - Supports interactive button messages, document delivery (PDF download), and voice note ingestion.
  2. **CDAC Mobile Seva / Indian Government SMS Gateway**:
     - Standard HTTP/REST integration with DLT template approval headers.
     - Fallback mechanism: If WhatsApp delivery fails or citizen does not use WhatsApp, automatically triggers SMS broadcast.
- **Dynamic Notification Rules**:
  - Administrators configure triggers per application state (`SUBMITTED`, `UNDER_REVIEW`, `CORRECTION_NEEDED`, `PAYMENT_REQUIRED`, `APPROVED`, `REJECTED`).
  - Multilingual templates with runtime parameter interpolation (`{service_name}`, `{tracking_id}`, `{portal_url}`, `{officer_remarks}`).

### 2.5 IVR Telephony Gateway

- **Implementation Files**: `backend/app/api/routes/ivr.py` & `backend/app/pages/AdminDashboard/IVRConfigPage.jsx`.
- **Telephony Provider**: Twilio Voice / Asterisk PBX / Indian National Informatics Centre (NIC) Telephony Hub.
- **Protocol**: HTTP Webhooks returning TwiML / Asterisk XML:
  - `POST /api/v1/ivr/incoming`: Greets caller in selected language, reads DTMF menu.
  - `POST /api/v1/ivr/process-menu`: Routes keypresses (1 = Income Certificate, 2 = Domicile, 3 = Status Check).
  - `POST /api/v1/ivr/status-check`: Synthesizes dynamic speech reading out real-time application milestone.
  - `<Record>` callback: Ingests citizen voice recording for automated slot-filling.

### 2.6 Statutory Payment & MahaTreasury Gateway

- **Implementation Files**: `backend/app/api/routes/payment.py` & `backend/app/services/payment_service.py`.
- **Statutory Gateway**: MahaTreasury e-Pay (Integrated State Treasury Portal).
- **Payment Modalities**: UPI Dynamic QR Code, RuPay / Visa / MasterCard, State Bank of India NetBanking.
- **Idempotency & Reconciliation**:
  - Webhook callback endpoint (`POST /api/v1/payment/webhook`) verifies HMAC signature and idempotent transaction references (`txn_ref`).
  - Enforces zero duplicate payments.
  - Automatically generates **Treasury Form TR-5 Statutory Receipt** with treasury head-of-account allocation, CIN (Challan Identification Number), and digital verification QR code.

### 2.7 Mock External Statutory Registries

- **Implementation File**: `backend/app/api/routes/mock_government.py`.
- **Purpose**: Simulates state and national databases for instant cross-verification:
  1. **MahaBhulekh (Land Revenue Records 7/12 & 8A)**: Cross-verifies agricultural landholding, survey numbers, and annual crop yield for rural Income certificates.
  2. **DigiLocker Integration API**: Allows citizens to pull pre-verified Aadhaar, Driving License, and Secondary School Leaving Certificates (SSLC).
  3. **UIDAI Aadhaar e-KYC Verification**: Simulates biometric / OTP-based demographic validation returning masked Aadhaar details (`XXXXXXXX9012`).
  4. **PDS National Food Security / Ration Card Registry**: Verifies BPL / Antyodaya status for statutory fee waiver eligibility.

### 2.8 Tamper-Proof Certificate & Cryptographic Sealing Engine

- **Implementation File**: `backend/app/services/certificate_service.py`.
- **Engine**: ReportLab Enterprise Flowable Engine.
- **Security Features**:
  - High-resolution State Government Emblem (*सत्यमेव जयते*).
  - Guilloche pattern background anti-copy security watermark.
  - SHA-256 digital stamp digest calculated over certificate metadata and officer's private signing key.
  - 2D High-Density QR code encoding verification URI: `https://revgov.maharashtra.gov.in/verify-certificate/{certNumber}`.

### 2.9 Real-Time Event Streaming (SSE)

- **Implementation File**: `backend/app/api/routes/stream.py`.
- **Transport**: Server-Sent Events (`text/event-stream`).
- **Pub/Sub Bus**: In-memory thread-safe `EventBus` broadcasting events to connected browsers:
  - `APPLICATION_UPDATED`: Instant table refresh on clerk/officer queues.
  - `DOCUMENT_VERIFIED`: Updates inspection progress.
  - `PAYMENT_RECEIVED`: Triggers workstation approval routing.
  - `CERTIFICATE_ISSUED`: Triggers citizen download alert.

---

## 3. Zero-Trust Security & Data Guard Architecture

The RevGOV Data Guard enforces an impenetrable boundary between citizen personal data and external untrusted networks:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        DATA GUARD FIREWALL TOPOLOGY                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   RAW CITIZEN DATA (Zone 0 Core)                                           │
│   • Name: "Sanjay Tukaram Patil"                                           │
│   • Aadhaar: "9481-2049-3819"                                              │
│   • Income: "₹ 65,000"                                                     │
│   • Address: "Plot 42, Shivajinagar, Pune"                                 │
│                                │                                           │
│                                ▼                                           │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │ DATA GUARD INSPECTION & CLASSIFICATION ENGINE                      │   │
│   │                                                                    │   │
│   │  [RESTRICTED]        Aadhaar, Full Name, Phone, Street Address     │   │
│   │  [QUASI-IDENTIFIER]  Age, Gender, District, Pin Code, Income Tier   │   │
│   │  [NON-SENSITIVE]     Service Code, SLA Milestone, Timestamp        │   │
│   └────────────────────────────┬───────────────────────────────────────┘   │
│                                │                                           │
│                                ▼                                           │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │ REVERSIBLE TOKEN VAULT (On-Premise In-Memory + Encrypted Store)    │   │
│   │                                                                    │   │
│   │  "Sanjay Tukaram Patil" ──> TOKEN_APPLICANT_A1                     │   │
│   │  "9481-2049-3819"       ──> TOKEN_UID_9921                         │   │
│   │  "Plot 42, Shivajinagar"──> TOKEN_ADDR_PUNE                        │   │
│   └────────────────────────────┬───────────────────────────────────────┘   │
│                                │                                           │
│                                ▼                                           │
│   SANITIZED ZERO-PII PROMPT DISPATCHED TO EXTERNAL CLOUD LLM               │
│   "Citizen TOKEN_APPLICANT_A1 with ID TOKEN_UID_9921 from District Pune    │
│    declares agricultural income bracket 50k-75k. Format statutory note."   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Data Classification Matrix

| Classification | Attributes | Allowed Scope | Storage Cryptography |
|---|---|---|---|
| **RESTRICTED** | Aadhaar Number, Full Legal Name, Phone Number, Email, Bank Details, Physical Street Address, Signature | Zone 0 Sovereign Core Only (Never egresses on-premise boundary) | AES-256-GCM authenticated encryption |
| **QUASI-IDENTIFIER** | Age, Year of Birth, District, Taluka, Pin Code, Broad Income Tier, Caste Category | Zone 1 Internal Orchestration (k-anonymized before cloud sharing) | SHA-256 salted hashes |
| **NON-SENSITIVE** | Application Tracking ID, Certificate Type, State FSM Code, SLA Milestone, Departmental Fee | Public / Zone 2 Cloud AI Allowed | Standard TLS 1.3 in transit |

### 3.2 Field-Level AES-256-GCM Storage Cryptography

- **Key Derivation**: 32-byte Departmental Master Key (`REVENUE_MASTER_KEY`) utilizes HKDF (HMAC-based Key Derivation Function) with record-specific salts.
- **Cipher**: Advanced Encryption Standard in Galois/Counter Mode (AES-256-GCM).
- **Authentication**: Generates a 16-byte cryptographic MAC tag appended to the ciphertext:
  $$\text{Storage Format} = \text{"enc::v1::gcm::"} \parallel \text{Base64}(\text{IV}) \parallel \text{Base64}(\text{Ciphertext}) \parallel \text{Base64}(\text{Tag})$$
- Prevents database administrators or unauthorized file inspectors from inspecting plain citizen identity details.

---

## 4. Application Lifecycle & Deterministic State Machine (FSM)

RevGOV governs certificate processing through a rigorous, legally compliant 14-state deterministic Finite State Machine:

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Citizen Initiates (Web/WhatsApp/IVR)
    DRAFT --> OCR_PROCESSING: Citizen Uploads Documents
    OCR_PROCESSING --> SUBMITTED: Particulars Confirmed & Ingested
    
    SUBMITTED --> UNDER_REVIEW: Desk Clerk Takes Queue Ownership
    
    UNDER_REVIEW --> CORRECTION_NEEDED: Clerk Detects Defect / Blurry Doc
    CORRECTION_NEEDED --> SUBMITTED: Citizen Uploads Rectified Enclosure
    
    UNDER_REVIEW --> CLARIFICATION_REQUIRED: Inquiry on Particulars
    CLARIFICATION_REQUIRED --> UNDER_REVIEW: Citizen Provides Response Note
    
    UNDER_REVIEW --> PAYMENT_REQUIRED: Desk Clerk Scrutiny Verified & Approved
    
    PAYMENT_REQUIRED --> PAYMENT_COMPLETED: Citizen Settles Statutory Fee (MahaTreasury)
    
    PAYMENT_COMPLETED --> DISTRICT_OFFICER_APPROVAL: Queued for SDO / Tahsildar
    
    DISTRICT_OFFICER_APPROVAL --> APPROVED: Officer Signs with Digital Seal
    
    APPROVED --> CERTIFICATE_GENERATION: Background PDF Engine Triggered
    CERTIFICATE_GENERATION --> CERTIFICATE_READY: Signed PDF Sealed with 2D QR
    CERTIFICATE_READY --> COMPLETED: Citizen Downloads Official Certificate
    
    UNDER_REVIEW --> REJECTED: Ineligible / Incompatible Jurisdictional Records
    DISTRICT_OFFICER_APPROVAL --> REJECTED: Rejected by Statutory Authority
    
    UNDER_REVIEW --> ESCALATED: Citizen Escalation or SLA Breach (>36 hrs)
    ESCALATED --> UNDER_REVIEW: Grievance Officer Resolves Escalation
```

### 4.1 The Pre-Payment Officer Scrutiny Guarantee Invariant

> **STATUTORY LEGAL INVARIANT:**  
> In conventional government portals, citizens pay application fees before any officer examines their eligibility. If the application is subsequently rejected due to a minor defect, the citizen loses their money without recourse.  
>  
> In RevGOV, the state transition `PAYMENT_REQUIRED` can **NEVER** be triggered by the citizen or system. It can **ONLY** be emitted when an authorized Desk Clerk marks all mandatory documents as `VERIFIED`. If an application is rejected during preliminary scrutiny, **the citizen is charged ₹0.00**.

### 4.2 Comprehensive State Transition Table

| Transition ID | Current State | Target State | Permitted Actor Role | Trigger / Precondition |
|---|---|---|---|---|
| `TR-01` | `[*] ` | `DRAFT` | Citizen / Operator | Citizen initiates conversational session or manual form |
| `TR-02` | `DRAFT` | `OCR_PROCESSING` | System | Citizen uploads document attachments |
| `TR-03` | `OCR_PROCESSING` | `SUBMITTED` | Citizen | Discrepancy checks accepted; application officially lodged |
| `TR-04` | `SUBMITTED` | `UNDER_REVIEW` | Desk Clerk | Clerk claims application from district queue |
| `TR-05` | `UNDER_REVIEW` | `CORRECTION_NEEDED` | Desk Clerk | Specific document rejected with explanatory defect note |
| `TR-06` | `CORRECTION_NEEDED` | `SUBMITTED` | Citizen | Replaced document uploaded and verified |
| `TR-07` | `UNDER_REVIEW` | `CLARIFICATION_REQUIRED` | Desk Clerk | Narrative inquiry raised regarding conflicting details |
| `TR-08` | `CLARIFICATION_REQUIRED` | `UNDER_REVIEW` | Citizen | Citizen responds with textual explanation |
| `TR-09` | `UNDER_REVIEW` | `PAYMENT_REQUIRED` | Desk Clerk | All documents marked `VERIFIED`; fee demand note emitted |
| `TR-10` | `PAYMENT_REQUIRED` | `PAYMENT_COMPLETED` | System (Treasury Webhook) | MahaTreasury confirms statutory fee receipt |
| `TR-11` | `PAYMENT_COMPLETED` | `DISTRICT_OFFICER_APPROVAL` | System | Application routed to Collector/SDO executive queue |
| `TR-12` | `DISTRICT_OFFICER_APPROVAL` | `APPROVED` | District Officer | Officer inspects 5-Pillar Score and applies digital seal |
| `TR-13` | `APPROVED` | `CERTIFICATE_GENERATION` | System | ReportLab vector generation worker launched |
| `TR-14` | `CERTIFICATE_GENERATION` | `CERTIFICATE_READY` | System | PDF generated, SHA-256 hashed, and QR linked |
| `TR-15` | `CERTIFICATE_READY` | `COMPLETED` | Citizen / System | Certificate downloaded or delivered via WhatsApp |
| `TR-16` | `UNDER_REVIEW` | `REJECTED` | Desk Clerk | Fraudulent application or ineligible applicant |
| `TR-17` | `DISTRICT_OFFICER_APPROVAL` | `REJECTED` | District Officer | Administrative rejection by competent statutory authority |
| `TR-18` | `UNDER_REVIEW` | `ESCALATED` | Citizen / SLA Monitor | SLA elapsed 36h without review or citizen grievance filed |
| `TR-19` | `ESCALATED` | `UNDER_REVIEW` | Supervisory Officer | Escalation triaged and returned to priority review |

---

## 5. Decision Support & Intelligence Engines

### 5.1 5-Pillar Application Readiness Scoring Engine

- **Implementation File**: `backend/app/services/readiness_engine.py`.
- **Purpose**: Evaluates holistic application completeness on a deterministic scale of $0 \text{ to } 100$:

$$\text{Readiness Score} = w_1 S_{\text{identity}} + w_2 S_{\text{residence}} + w_3 S_{\text{income}} + w_4 S_{\text{affidavit}} + w_5 S_{\text{registry}}$$

| Pillar | Weight | Verification Criteria |
|---|---|---|
| **Identity Fidelity** ($S_{\text{identity}}$) | 25% | Aadhaar / Voter ID match, OCR name fuzzy confidence $\ge 90\%$, unexpired document |
| **Residential Continuity** ($S_{\text{residence}}$) | 25% | Domicile tenure $\ge 15$ years, utility bill / ration card address matches declared Taluka |
| **Income Verification** ($S_{\text{income}}$) | 20% | Salary slip, Form 16, or Land Revenue 7/12 crop revenue correlates with declared annual income |
| **Affidavit Completeness** ($S_{\text{affidavit}}$) | 15% | Notarized self-declaration uploaded with valid stamp date and legible signature |
| **Registry Consistency** ($S_{\text{registry}}$) | 15% | Cross-match against MahaBhulekh land records and PDS National Food Security database |

### 5.2 Explainable Fraud & Anomaly Risk Engine

- **Implementation File**: `backend/app/services/risk_scoring_service.py`.
- **Outputs**:
  - **Risk Tier**: `LOW` (Score $<25$), `MEDIUM` ($25 \le \text{Score} < 65$), `HIGH` ($\text{Score} \ge 65$).
  - **Anomaly Detection Indicators**:
    - `DUPLICATE_IDENTITY`: Detected identical Aadhaar hash across multiple active drafts.
    - `METADATA_DISCREPANCY`: PDF creation timestamp post-dates declared document issuance date.
    - `EXCESSIVE_FILE_COMPRESSION`: Indicates potential digital artifact manipulation or photo-editing.
    - `PHONETIC_MISMATCH`: High phonetic distance between citizen declared name and OCR identity string.

---

## 6. Government Workstation Portals & Workflows

RevGOV provides tailored, responsive web interfaces for each administrative persona:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       MULTI-PERSONA WORKSTATION ROLES                      │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  1. CITIZEN PORTAL (`/dashboard`, `/citizen/chat`)                         │
│     • Manual Wizard & AI Conversational Filing Form                        │
│     • Real-time Tracking Modal & Form Submission Receipt                   │
│     • MahaTreasury e-Pay Modal & Digital Certificate Viewer                │
│                                                                            │
│  2. DESK CLERK WORKSTATION (`/clerk/dashboard`, `/clerk/review/:appNum`)   │
│     • Prioritized First-Mile Scrutiny Application Queue                    │
│     • Side-by-Side High-Res Zoomed Document Viewer                         │
│     • Enclosure Verification / Defect Tagging / Payment Demand Trigger     │
│     • Departmental Escalations & Audit Trail                               │
│                                                                            │
│  3. DISTRICT OFFICER PORTAL (`/district/dashboard`, `/district/review`)    │
│     • Executive Review Queue (Post-Payment Applications Only)              │
│     • 5-Pillar Readiness Score & Explainable Fraud Risk Radar              │
│     • Authorize Digital Signing & Issue Cryptographic Certificate          │
│     • SLA Performance Oversight & Grievance Resolution                     │
│                                                                            │
│  4. ADMIN CONTROL CENTER (`/admin`, `/admin/users`, `/admin/config`)       │
│     • Dynamic WhatsApp & SMS Gateway Trigger Configuration                 │
│     • IVR Telephony Menu Rules & Multi-Engine Voice Generator              │
│     • OCR Multi-Provider Switcher & Real-Time Test Sandbox                 │
│     • Role-Based Access Control (RBAC) Management                          │
│                                                                            │
│  5. ZERO-AUTH PUBLIC VERIFICATION PORTAL (`/verify-certificate/:certNo`)   │
│     • Instant Public QR Verification for Employers & Universities          │
│     • Displays Tamper-Proof Metadata & Authoritative State Seal            │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Citizen Portal

- **Filing Modes**:
  1. **Manual Application Form** (`ManualApplicationForm.jsx`): Standard accessible multi-step wizard (Personal Details $\rightarrow$ Address $\rightarrow$ Income/Category Particulars $\rightarrow$ Document Uploads $\rightarrow$ Declaration).
  2. **AI-Assisted Automated Form** (`AutomatedApplicationForm.jsx`): Voice-first conversational dialog extracting slots naturally in any of the 10 Indian languages.
- **Interactive Modals**:
  - `TrackStatusModal.jsx`: Visual 5-stage milestone stepper with real-time SSE updates and dynamic stage counter.
  - `ApplicationReceiptModal.jsx`: Official statutory submission receipt bearing citizen photo, barcode, tracking number, and timestamp.
  - `PaymentGatewayModal.jsx`: MahaTreasury gateway simulator supporting UPI QR, Cards, and NetBanking with zero convenience fee policy.
  - `DigitalCertificateModal.jsx`: Vector preview of issued certificate with direct print and high-res PDF download.

### 6.2 Desk Clerk Workstation

- **Route**: `/clerk/dashboard` & `/clerk/review/:appNumber`.
- **First-Mile Scrutiny**:
  - Side-by-side comparison of citizen declared values vs. high-resolution scanned attachments.
  - Granular enclosure decisioning (`VERIFIED`, `REJECTED`, `INSPECTION_PENDING`).
  - Automated defect tagging: Generates specific guidance to the citizen (e.g., "Electricity bill older than 3 months. Upload current bill.").
  - Payment clearance button: Transitions state to `PAYMENT_REQUIRED`.

### 6.3 District Officer Workstation

- **Route**: `/district/dashboard`.
- **Administrative Clearance**:
  - Exclusively processes pre-verified, fee-paid applications.
  - Comprehensive inspection card displaying:
    - 5-Pillar Readiness Score (Visual color-coded meters).
    - Explainable Fraud Risk Indicators.
    - Full clerk scrutiny audit history.
  - Digital Signature Authorization: Calculates SHA-256 digest and triggers certificate generation.

### 6.4 Administrative Control Center

- **Dynamic Messaging Config** (`IVRConfigPage.jsx`, `MessageConfigPage.jsx`):
  - District administrators can modify SMS/WhatsApp provider credentials (CDAC, Meta Cloud).
  - Configures localized notification templates across 10 languages for each FSM state.
- **Dynamic OCR Engine Config** (`OCRConfigPage.jsx`):
  - Live toggling between Tesseract, Gemini Vision, and PyMuPDF.
  - Real-time diagnostic sandbox: Administrators drag-and-drop sample identity cards to test OCR field extraction accuracy and latency.

### 6.5 Public Certificate Verifier

- **Route**: `/verify-certificate/:certNumber`.
- **Public Zero-Auth Security**:
  - Third-party verifiers (embassies, universities, banks) scan the printed certificate QR code.
  - Endpoint `GET /api/v1/certificates/verify/:certNumber` validates cryptographic registration in state database.
  - Renders official authenticity portal confirming valid issuance, holder name, district, and issuing magistrate.

---

## 7. 10-Language Regional Localization Architecture

RevGOV guarantees linguistic equity across **10 official Indian languages**:

1. **English** (`en`)
2. **Hindi** (`hi` — हिंदी)
3. **Marathi** (`mr` — मराठी)
4. **Bengali** (`bn` — বাংলা)
5. **Telugu** (`te` — తెలుగు)
6. **Tamil** (`ta` — தமிழ்)
7. **Gujarati** (`gu` — ગુજરાતી)
8. **Kannada** (`kn` — ಕನ್ನಡ)
9. **Malayalam** (`ml` — മലയാളം)
10. **Punjabi** (`pa` — ਪੰਜਾਬੀ)

### 7.1 Catalog Parity & Dynamic Pipelines

- **Locale Location**: `frontend/src/i18n/locales/{lang}.json`.
- **Strict Parity**: Each catalog contains exactly **2,471+ keys** covering all modals, dashboards, tooltips, alert messages, and form labels.
- **Dynamic Resolvers**:
  - `getLocalizedServiceName(serviceName, serviceId, t)`: Translates certificate service names dynamically across all 10 languages.
  - `t('statuses.' + status, status)`: Resolves state machine pills.
  - Regional Date & Currency: Built-in `Intl.DateTimeFormat` and `Intl.NumberFormat('en-IN' / 'hi-IN', { style: 'currency', currency: 'INR' })`.

---

## 8. Relational Persistence & Data Model

The RevGOV relational schema (SQLite WAL / PostgreSQL) consists of 15 interconnected entities:

```
┌─────────────────┐       ┌────────────────────────┐       ┌─────────────────┐
│      User       │       │    ChannelIdentity     │       │     Citizen     │
│─────────────────│       │────────────────────────│       │─────────────────│
│ id (PK)         │       │ id (PK)                │       │ id (PK)         │
│ username        │       │ channel (WHATSAPP/IVR) │       │ citizen_ref(UK) ◄───┐
│ hashed_password │       │ channel_user_id (Hash) │       │ phone_hash      │   │
│ role            │       │ citizen_ref (FK) ──────┼──────>│ name_encrypted  │   │
│ citizen_ref(FK)─┼───┐   │ is_verified            │       │ address_enc     │   │
└─────────────────┘   │   └────────────────────────┘       └────────▲────────┘   │
                      │                                             │            │
                      │   ┌─────────────────────────────────────────┘            │
                      │   │                                                      │
                      ▼   ▼                                                      │
             ┌─────────────────────────┐                                         │
             │       Application       │                                         │
             │─────────────────────────│                                         │
             │ id (PK)                 │                                         │
             │ application_number (UK) │                                         │
             │ tracking_id (UK)        │                                         │
             │ citizen_ref (FK)        │                                         │
             │ service_id / cert_type  │                                         │
             │ current_state (FSM)     │                                         │
             │ district / taluka       │                                         │
             │ readiness_score         │                                         │
             │ fraud_risk_score        │                                         │
             │ payment_status          │                                         │
             │ assigned_clerk_id       │                                         │
             │ assigned_officer_id     │                                         │
             └───────────┬─────────────┘                                         │
                         │                                                       │
         ┌───────────────┼───────────────┬──────────────────────┐                │
         ▼               ▼               ▼                      ▼                │
┌─────────────────┐ ┌─────────┐ ┌──────────────────┐ ┌────────────────────┐      │
│ ApplicationData │ │Document │ │  PaymentRecord   │ │  ApplicationEvent  │      │
│─────────────────│ │─────────│ │──────────────────│ │────────────────────│      │
│ id (PK)         │ │ id (PK) │ │ id (PK)          │ │ id (PK)            │      │
│ application_id  │ │ app_id  │ │ application_id   │ │ application_id     │      │
│ field_name      │ │ doc_type│ │ challan_number   │ │ event_type         │      │
│ field_value_enc │ │ file_url│ │ amount (₹50.00)  │ │ from_state         │      │
│ ocr_extracted   │ │ match_sc│ │ transaction_ref │ │ to_state           │      │
│ confidence      │ │ status  │ │ treasury_receipt │ │ actor_id / role    │      │
└─────────────────┘ └─────────┘ └──────────────────┘ └────────────────────┘      │
                                                                                 │
┌─────────────────────────┐                            ┌─────────────────────┐   │
│        AuditLog         │                            │ ConversationSession │   │
│─────────────────────────│                            │─────────────────────│   │
│ id (PK)                 │                            │ session_id (PK)     │   │
│ timestamp               │                            │ citizen_ref (FK) ───┼───┘
│ actor_id / actor_role   │                            │ channel (WEB/WA/IVR)│
│ action_type             │                            │ current_step        │
│ resource_id             │                            │ slots_json          │
│ ip_address / outcome    │                            │ is_active           │
└─────────────────────────┘                            └─────────────────────┘
```

---

## 9. Comprehensive API Reference & Endpoint Registry

| Route Prefix | Method & Endpoint | Auth Role | Description & Primary Function |
|---|---|---|---|
| `/api/v1/auth` | `POST /register` | Public | Register citizen account with encrypted credentials |
| | `POST /login` | Public | Authenticate user; returns JWT Bearer token |
| | `GET /me` | Any | Inspect currently authenticated session identity |
| `/api/v1/applications` | `POST /submit-manual` | Citizen / Operator | Submit multi-step manual application form |
| | `POST /submit-automated` | Citizen | Finalize conversational form draft into formal submission |
| | `GET /` | Any Auth | List filtered applications (paged by role & district) |
| | `GET /{appNumber}` | Any Auth | Inspect application details, document proofs, and status |
| | `POST /{id}/transition` | Clerk / Officer | Execute state transition in 14-stage deterministic FSM |
| | `POST /{id}/verify-document` | Clerk | Mark specific document enclosure as VERIFIED or REJECTED |
| | `POST /{id}/escalate` | Citizen / Clerk | Raise SLA or grievance escalation ticket |
| | `DELETE /{id}` | Admin / Citizen | Hard delete draft application or administrative purge |
| `/api/v1/conversation` | `POST /message` | Citizen | Ingest conversational voice transcript or text message |
| | `GET /session/{sessionId}` | Citizen | Fetch active draft slots from Context Vault |
| `/api/v1/documents` | `POST /upload` | Any Auth | Ingest document attachment with MIME magic byte scan |
| | `POST /ocr/extract` | Any Auth | Run OCR extraction pipeline and fuzzy match score |
| `/api/v1/payment` | `POST /create-demand` | Clerk / System | Generate statutory demand note (₹50.00) |
| | `POST /simulate-success/{id}`| Citizen | Execute MahaTreasury e-Pay simulation & generate TR-5 |
| | `POST /webhook` | Treasury Gateway | Idempotent treasury payment settlement callback |
| `/api/v1/certificates` | `GET /generate/{appId}` | District Officer | Generate vector PDF certificate with 2D QR seal |
| | `GET /verify/{certNumber}` | Public (Zero-Auth)| Public certificate verification portal endpoint |
| `/api/v1/tracking` | `GET /{trackingId}` | Public | Real-time tracking pipeline milestone inspection |
| `/api/v1/stream` | `GET /events` | Any Auth | Server-Sent Events (SSE) live broadcast stream |
| `/api/v1/admin/config` | `GET /message` | Admin | Fetch SMS/WhatsApp provider config and templates |
| | `POST /message` | Admin | Update SMS/WhatsApp gateway credentials & triggers |
| | `GET /ivr` | Admin | Fetch IVR telephony helpline parameters & menu rules |
| | `POST /ivr` | Admin | Update IVR telephony config and test TTS generator |
| `/api/v1/admin/ocr` | `GET /config` | Admin | Inspect active OCR provider status & Tesseract path |
| | `POST /config` | Admin | Switch active OCR provider (Vision AI / Tesseract) |
| | `POST /test` | Admin | Run real-time OCR extraction sandbox test |
| `/api/v1/dashboard` | `GET /stats` | Clerk / Officer | Fetch aggregated district KPIs, SLA age, and queue loads |
| `/api/v1/audit` | `GET /logs` | Auditor / Admin | Query tamper-resistant audit logs |
| | `GET /export` | Auditor / Admin | Download cryptographically sealed CSV audit manifest |

---

## 10. Operational Runbook & Production Deployment

### 10.1 Environment Configuration (`.env`)

```ini
# Sovereign Departmental Secret Keys
SECRET_KEY=gov_enterprise_revenue_master_jwt_secret_2026
REVENUE_MASTER_KEY=gov_aes_256_master_encryption_key_32_bytes!

# Database Configuration
DATABASE_URL=sqlite:///./data/revgov_enterprise.db
# DATABASE_URL=postgresql://revgov_admin:secure_pwd@localhost:5432/revgov_db

# LLM & AI Engine
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxx
PRIMARY_LLM_MODEL=google/gemini-2.5-flash
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxx

# OCR Configuration
OCR_PROVIDER=auto
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe

# Messaging & Telephony
WHATSAPP_PHONE_NUMBER_ID=109847291048201
WHATSAPP_ACCESS_TOKEN=EAAOx92govRevenuePortalSecKeyToken
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Departmental Policy
DEFAULT_SLA_HOURS=48
STATUTORY_FEE_AMOUNT=50.00
CONVENIENCE_FEE_AMOUNT=0.00
```

### 10.2 Service Execution

1. **Launch Sovereign Backend**:
   ```bash
   cd backend
   # Using virtual environment
   & "moana/Scripts/python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

2. **Launch Enterprise Web Workstation**:
   ```bash
   cd frontend
   npm run dev
   # Production build verification
   npm run build
   ```

3. **Verify Health & Parity**:
   - Backend OpenAPI Docs: `http://localhost:8000/docs`
   - Public Web Portal: `http://localhost:5173/`
   - Zero-Auth Certificate Verifier: `http://localhost:5173/verify-certificate/CERT-REV-2026-9041`
   - Admin Control Center: `http://localhost:5173/admin`

---

*Authored and Approved by the RevGOV Enterprise Digital Revenue Infrastructure Taskforce.*  
*Maintained under State Digital Transformation and Public Services Guarantee Directives.*
