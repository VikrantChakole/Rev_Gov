# TCS RevGOV — Live Demo Walkthrough Script

This script provides step-by-step instructions for presenting **RevGOV: Multilingual Voice-First Revenue Services Platform** during jury evaluations.

---

## Seed Accounts & Login Credentials

| Role | Username | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Citizen** | `citizen` | `Citizen123!` | Income Certificate application & Malayalam chat |
| **Assisted Operator** | `operator` | `Operator123!` | Assisted kiosk filing for low-literacy citizens |
| **Officer** | `officer` | `Officer123!` | Evidence inspection, OCR comparison & risk evaluation |
| **Reviewer** | `reviewer` | `Reviewer123!` | Independent verification of officer recommendations |
| **Approver** | `approver` | `Approver123!` | Final certificate signing & issuance (District Collector) |
| **Auditor** | `auditor` | `Auditor123!` | Immutable audit log trail inspection |
| **Administrator** | `admin` | `Admin123!` | Service catalogue & SLA configuration |

---

## 36-Step Live Demo Scenario

### Phase 1: Citizen Discovery & Malayalam Voice Chat
1. Open `http://localhost:5173/` and select **Malayalam** language.
2. Click **⚡ Live Presentation Control Bar** in bottom right and click **⚡ Auto-Fill Income Certificate**.
3. View Malayalam voice assistant message bubble with audio playback button: `🔊 Listen in Malayalam`.
4. Click microphone icon to test voice input recording waveform.
5. Ingest Malayalam utterance with low-confidence speech confirmation prompt: `"നിങ്ങൾ പറഞ്ഞത് രണ്ട് ലക്ഷം രൂപയാണോ?"`.
6. Confirm or correct recognized value.

### Phase 2: Form Sync & Document OCR Discrepancy
7. Switch to **Application Form Tab**; observe chat values pre-filling form automatically.
8. Upload sample Aadhaar document (`demo_aadhaar.png`).
9. Click **⚠️ Trigger OCR Discrepancy** on pitch bar.
10. Observe side-by-side discrepancy resolution prompt:
    - **Form Value**: `Rajesh Kumar Sharma`
    - **OCR Value**: `Rajesh K. Sharma`
11. Select **Use Form Value (`Rajesh Kumar Sharma`)**; observe audit event logged.

### Phase 3: Synthetic Registry & Resilient Payment
12. Click **Validate with Synthetic Registry**; observe successful verification response.
13. Click **Initiate Payment (₹25)**.
14. Click **💳 Simulate Payment Callback Fail** on pitch bar; observe `PENDING (Callback Timeout)` status.
15. Click **Safe Retry Payment**; verify idempotency key prevents duplicate transaction creation.
16. Submit application; receive unique permanent ID `REV-DEMO-2026-0001` and payment receipt.

### Phase 4: Omnichannel Command Center
17. Navigate to `http://localhost:5173/demo`.
18. View 3-column split view displaying **Web Chat**, **WhatsApp Business Mode**, and **IVR Phone Helpline**.
19. Send a message on WhatsApp simulator; verify instant real-time synchronization across all 3 columns via SSE.

### Phase 5: Officer Review & Explainable Fraud Scoring
20. Log in as **Officer** (`officer` / `Officer123!`) or navigate to `http://localhost:5173/officer-dashboard`.
21. Select application `REV-DEMO-2026-0001`.
22. Inspect **Transparent Risk Score (42/100 MEDIUM RISK)** and contributing signal breakdown:
    - `NAME_MISMATCH (+25 pts)`
    - `LOW_OCR_CONFIDENCE (+17 pts)`
23. Inspect SLA countdown timer badge.
24. Click **Recommend Approval** to forward application to Reviewer queue.

### Phase 6: Multi-Level Approval & Certificate Issuance
25. Log in as **Approver** (`approver` / `Approver123!`) or navigate to `http://localhost:5173/approver-dashboard`.
26. Verify **Separation of Duties** checklist (Processing Officer != Approver).
27. Click **Authorize Digital Signing & Issue Certificate**.
28. View generated official **Income Certificate** with watermark, state seal, digital signature hash, and dynamic QR code.
29. Scan or click QR code verification URL; confirm authenticity verification success.

### Phase 7: Auditor Audit Trail
30. Log in as **Auditor** (`auditor` / `Auditor123!`) at `http://localhost:5173/admin/audit`.
31. View append-only audit trail displaying all lifecycle state transitions, Data Guard redactions, consent records, and payment reconciliations.
