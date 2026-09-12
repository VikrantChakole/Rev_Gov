# PROJECT AUDIT REPORT — RevGOV Platform

**Project Name:** RevGOV — Multilingual Voice-First Revenue Services Platform  
**Audit Date:** September 12, 2026  
**Auditor:** Senior Full-Stack Architect & AI Systems Engineer  

---

## 1. Executive Summary

An in-depth empirical audit of the existing **RevGOV** repository was conducted. The codebase contains a highly sophisticated, enterprise-grade architecture supporting a 14-state application lifecycle, PII Data Guard firewall, SQLite ORM database, Tesseract OCR integration, Gemini LLM dialogue engine, and multi-channel simulators (WhatsApp, IVR).

Out of **209 automated pytest unit tests**, **201 tests passed successfully (96.2% pass rate)**.

This document details existing features, identified bugs/test failures, missing features required for the final live demo, full database schema, API route inventory, and the recommended implementation roadmap.

---

## 2. Existing Working Features

| Module | Status | Description |
| :--- | :--- | :--- |
| **Application State Machine** | ✅ Working | 14-state FSM (`DRAFT` → `COMPLETED`/`REJECTED`) with strict transition rules and progress percentage tracking. |
| **PII Data Guard Engine** | ✅ Working | AES-256 field encryption (`ApplicationData`), classification (`RESTRICTED`, `QUASI_IDENTIFIER`, `NON_SENSITIVE`), and redaction firewall. |
| **Omnichannel Identity** | ✅ Working | Tokenized `citizen_ref` (e.g., `CIT-001`) with SHA-256 hashed channel linkage (`ChannelIdentity`) for Web, WhatsApp, IVR, and Mobile. |
| **WhatsApp Simulator** | ✅ Working | Multi-turn WhatsApp web simulator UI (`/whatsapp-chat`) synchronized with backend application sessions. |
| **IVR Phone Helpline** | ✅ Working | Interactive Voice Response simulator (`/ivr-simulator`) with DTMF keypad, call state management, and status tracking. |
| **OCR Pipeline** | ✅ Working | Tesseract OCR engine with fallback regex field extraction, document normalization, and confidence scoring. |
| **Data Layer & Repositories** | ✅ Working | Repository pattern for Citizens, Applications, Documents, Sessions, Payments, Events, and Audit Logs. |
| **Real-Time Streaming** | ✅ Working | Server-Sent Events (SSE) router (`/api/v1/stream`) for live cross-channel update broadcasting. |
| **Service Catalogue** | ✅ Working | YAML-backed service specs (`income_certificate`, `caste_certificate`, `domicile_certificate`, `solvency_certificate`). |
| **Certificate Verification** | ✅ Working | Verification route (`/api/v1/verify/{certificate_number}`) with tamper detection and public lookup. |

---

## 3. Broken / Failing Features (Audit Diagnostics)

Empirical test execution identified **8 failing tests out of 209**:

1. `tests/test_citizen_auth_and_recovery.py::test_1_registration`: Name validation in `auth.py` strictly requires 3 name parts (First, Middle, Last), rejecting standard 2-part inputs like "Citizen Alpha".
2. `tests/test_citizen_auth_and_recovery.py::test_4_citizen_isolation`: Status code assertion mismatch on cross-citizen application lookup (expected 403 vs 401).
3. `tests/test_citizen_auth_and_recovery.py::test_6_multi_channel_identity`: Channel identity lookup fallback when resolving phone/email in isolation test fixtures.
4. `tests/test_citizen_auth_and_recovery.py::test_7_multi_channel_application`: Session recovery active application mapping mismatch.
5. `tests/test_citizen_auth_and_recovery.py::test_8_protected_routes`: Authorization header missing handling on `/my-applications`.
6. `tests/test_citizen_data_isolation.py::test_citizen_A_cannot_access_citizen_B_by_application_id`: Unhandled exception on cross-tenant document fetching.
7. `tests/test_ocr_state_sync_and_progression.py::test_16_openrouter_model_is_configured_model`: Test mock configuration fallback value mismatch.
8. `tests/test_tesseract_ocr_live.py::test_tesseract_live_ocr`: Tesseract binary path environment variable fallback when binary is not in system PATH.

---

## 4. Missing Features & Jury Gaps

To fully meet the **TCS Hackathon Round 2 Requirements**, the following key modules must be enhanced or built:

1. **Malayalam-First Voice Pipeline**:
   - Live Audio Recording & Playback controls in Citizen Chat using Web Audio API.
   - Malayalam Speech-to-Text (STT) and Text-to-Speech (TTS) adapter with low-confidence fallback dialog ("നിങ്ങൾ പറഞ്ഞത്...?").
   - Native Multilingual Evaluation Dashboard showing WER, latency, and rating metrics.

2. **Role-Based Workflow & Separation of Duties**:
   - Explicit persona dashboards for **Officer**, **Reviewer**, **Approver**, **Auditor**, and **Assisted Operator**.
   - Enforce separation of duties (Approver cannot be the processing Officer; Citizen cannot approve own application).

3. **SLA Escalation Timers**:
   - Configurable SLA thresholds in Admin settings.
   - Automated SLA overdue badges, supervisor notifications, and escalation event audit logs.

4. **Explainable Risk & Fraud Scoring**:
   - Transparent risk scoring breakdown UI showing individual contributing risk signals (e.g., Name Mismatch: +25, Low OCR Confidence: +20, Duplicate Document: +17).
   - Officer/Reviewer false-positive override workflow with mandatory reason logging.

5. **Payment Callback Failure & Reconciliation Adapter**:
   - Simulated payment callback failure / timeout scenario with safe citizen retry mechanism.
   - Idempotency key protection preventing duplicate payment entries.

6. **Interactive Document Discrepancy Resolution**:
   - Visual side-by-side mismatch comparison prompt ("Declared Value vs Extracted OCR Value") in chat and form tab.

7. **Omnichannel Command Center (`/demo`) & 1-Click Pitch Toolbar**:
   - 3-column split view displaying Web, WhatsApp, and IVR synced in real time via SSE.
   - Floating Pitch Toolbar (`Auto-Fill Application`, `Trigger Mismatch`, `Inspect Data Guard`, `Simulate Callback Failure`).

8. **Expo Go Mobile App Support**:
   - Touch-friendly React Native / Expo mobile application structure for Android testing.

---

## 5. Database Schema Inventory

The SQLite database (`revenue_services.db`) implements 15 tables:

| Table Name | Entity Description | Key Columns |
| :--- | :--- | :--- |
| `users` | System accounts | `id`, `username`, `hashed_password`, `role`, `citizen_ref` |
| `citizens` | Citizen registry | `id`, `citizen_ref`, `name`, `phone`, `email`, `preferred_language` |
| `channel_identities` | External channel hashes | `id`, `citizen_ref`, `channel`, `identifier_hash`, `verified` |
| `services` | Service catalogue | `id`, `name_en`, `name_hi`, `department`, `fee_amount`, `sla_days` |
| `applications` | Core application records | `id`, `application_number`, `citizen_ref`, `status`, `current_step` |
| `application_data` | Encrypted PII form fields | `id`, `application_id`, `field_name`, `field_value_encrypted`, `source` |
| `documents` | Uploaded document metadata | `id`, `application_id`, `doc_type`, `file_ref`, `confidence_score` |
| `application_events` | Lifecycle event stream | `id`, `application_id`, `event_type`, `source_channel`, `event_data` |
| `payments` | Transaction records | `id`, `application_id`, `transaction_id`, `amount`, `status` |
| `conversation_sessions` | Cross-channel Context Vault | `id`, `citizen_ref`, `application_id`, `filled_slots`, `pending_question` |
| `conversation_messages` | Session message history | `id`, `session_id`, `role`, `content`, `language`, `modality` |
| `ivr_sessions` | IVR call tracking | `id`, `call_id`, `caller_phone_hash`, `current_state`, `call_status` |
| `escalations` | Officer escalation tickets | `id`, `ticket_id`, `application_id`, `reason`, `priority`, `status` |
| `certificates` | Issued certificates | `id`, `certificate_number`, `application_id`, `file_ref`, `qr_data` |
| `audit_logs` | Immutable audit trail | `id`, `event_type`, `actor`, `action`, `outcome`, `metadata_json` |

---

## 6. Existing API Endpoints Inventory

| Route Prefix | Purpose | Key Endpoints |
| :--- | :--- | :--- |
| `/api/v1/auth` | User & Citizen Auth | `/login`, `/citizen/register`, `/citizen/login`, `/citizen/profile` |
| `/api/v1/conversation` | Conversational Engine | `/message`, `/session/{citizen_id}`, `/audio` |
| `/api/v1/applications` | Application Management | `/create`, `/my-applications`, `/status/{app_num}`, `/override-mismatch` |
| `/api/v1/dashboard` | Role Analytics | `/citizen`, `/admin`, `/officer` |
| `/api/v1/data-guard` | PII Firewall | `/inspect`, `/logs`, `/rules` |
| `/api/v1/verify` | Public Verification | `/{certificate_number}` |
| `/api/v1/whatsapp` | WhatsApp Web Simulator | `/webhook`, `/send`, `/session` |
| `/api/v1/ivr` | IVR Phone Simulator | `/incoming`, `/dtmf`, `/status` |
| `/api/v1/tracking` | Public Status Lookup | `/lookup` |
| `/api/v1/documents` | Document Upload & OCR | `/upload`, `/ocr-results`, `/resolve-mismatch` |
| `/api/v1/payment` | Payment Processing | `/initiate`, `/callback`, `/status`, `/verify-receipt` |
| `/api/v1/stream` | Real-time SSE Events | `/events/{citizen_ref}` |
| `/api/v1/mock-government` | Synthetic Registry Adapter | `/validate-citizen`, `/registry-match` |

---

## 7. Recommended Implementation Order

1. **Phase 1 — Audit & Stabilization**: Fix the 8 failing pytest unit tests to achieve 100% test suite pass rate.
2. **Phase 2 — Omnichannel Identity & Session Continuity**: Verify seamless citizen recovery across Web, WhatsApp, and IVR without duplicate application creation.
3. **Phase 3 — Malayalam-First Voice & Audio Engine**: Integrate Web Audio recorder, STT/TTS fallback adapters, low-confidence voice confirmation prompt, and accuracy evaluation page.
4. **Phase 4 — Complete Citizen Journey (Income Certificate)**: Implement side-by-side OCR discrepancy resolution, synthetic registry consent, payment callback failure & retry, and instant receipt/application ID generation.
5. **Phase 5 — Role-Based Workflows & Explainable Fraud Scoring**: Separate Officer, Reviewer, Approver, Auditor, and Operator personas with SLA timers and transparent risk scoring breakdowns.
6. **Phase 6 — Omnichannel Command Center (`/demo`) & Certificates**: Build 3-column split view, floating pitch toolbar, digital certificate PDF/QR generator, and mobile Expo setup.
7. **Phase 7 — Seed Data, Observability & Verification**: Provide 1-click seed scripts, comprehensive automated tests, system metrics dashboard, and full project documentation.
