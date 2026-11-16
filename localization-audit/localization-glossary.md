# Government & Domain Terminology Glossary

This glossary documents critical domain terms across the **Revenue Government Platform**.
These definitions must be used to ensure authoritative, uniform, and legally sound translations across all 10 target languages:
- **English (`en`)** [Source/Master]
- **Hindi (`hi`)**
- **Marathi (`mr`)**
- **Bengali (`bn`)**
- **Telugu (`te`)**
- **Tamil (`ta`)**
- **Gujarati (`gu`)**
- **Kannada (`kn`)**
- **Malayalam (`ml`)**
- **Punjabi (`pa`)**

| Term | Context / Meaning | Usage Scope | Target Language Preservation Rule |
| --- | --- | --- | --- |
| **Income Certificate** | Official certificate validating an individual or family's annual income for subsidy and quota eligibility. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Domicile Certificate** | Legal document certifying that a person has resided in Maharashtra/relevant state for a specified statutory period. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Caste Certificate** | Statutory proof of membership in Scheduled Caste (SC), Scheduled Tribe (ST), or Other Backward Classes (OBC). | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **OBC-NCL Certificate** | Other Backward Classes Non-Creamy Layer certificate certifying income is below statutory creamy layer threshold. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Solvency Certificate** | Financial certificate proving personal solvency for court bail, tenders, or government contracts. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Nativity Certificate** | Legal certificate proving birth/origin in a specific jurisdiction. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Revenue Department** | State governmental department governing land revenue, certificates, tenancy, and citizen civil records. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Desk Clerk** | Municipal / Tahsil level operational officer handling initial verification, physical filings, and escalations. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **District Officer** | Senior administrative officer (SDO/Sub-Divisional Officer/Collectorate) authorized to grant statutory certificate approval. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Service Officer** | Government official assigned to scrutinize citizen applications. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Tracking ID** | Unique alphanumeric reference code issued to citizens upon application submission (e.g. MH-REV-2026-XXXXX). | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Application** | Formal statutory request submitted by a citizen for a government service or certificate. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Applicant** | Citizen who creates and signs the service application. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Escalation** | Citizen grievance mechanism elevating delayed or stuck applications to human clerk scrutiny. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Scrutiny** | Administrative verification of submitted documents and applicant eligibility criteria. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Digital Signature** | Cryptographic signature certifying authenticity of the generated government PDF certificate. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Aadhaar** | 12-digit Indian national unique identity number. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Ration Card** | Official state document issued for subsidized foodgrains and proof of household identity/residence. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Tahsildar** | Executive magistrate and revenue officer in charge of a revenue taluka/tahsil. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Talathi** | Village-level revenue officer responsible for local land records and 7/12 extracts. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **7/12 Extract** | Land register extract (Saat Baara Utara) maintained by Maharashtra Revenue Department. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |
| **Service Level Agreement (SLA)** | Government stipulated turnaround duration (e.g. 3–15 working days) for service delivery. | Portal-wide, Citizen & Officer | Use official statutory gazetted translations; never transliterate phonetically. |

## Official Certificate Types Reference

| Certificate Type | English | Official Hindi Term | Official Marathi Term | Key Statutory Purpose |
| --- | --- | --- | --- | --- |
| Income Certificate | Income Certificate | आय प्रमाण पत्र | उत्पन्न प्रमाणपत्र | Validates family annual income for fee waivers, scholarships & subsidies. |
| Domicile Certificate | Domicile Certificate | निवास / अधिवास प्रमाण पत्र | अधिवास प्रमाणपत्र | Confirms statutory continuous residence in Maharashtra. |
| Caste Certificate | Caste Certificate | जाति प्रमाण पत्र | जात प्रमाणपत्र | Validates official constitutional category (SC/ST/VJNT). |
| OBC-NCL Certificate | OBC-NCL Certificate | अन्य पिछड़ा वर्ग गैर-क्रीमी लेयर प्रमाण पत्र | इतर मागासवर्गीय नॉन-क्रिमीलेअर | Validates non-creamy layer quota status under central/state rules. |
| Solvency Certificate | Solvency Certificate | ऋणशोधन क्षमता प्रमाण पत्र | सॉल्व्हन्सी प्रमाणपत्र | Certifies financial solvency for legal sureties and tenders. |

## Content That MUST NOT Be Translated (Do-Not-Translate Registry)

The following items must strictly remain identical in all target language files:
1. **Application Tracking Codes**: `MH-REV-2026-XXXXX`, `APP-IC-2026-XXXXX`
2. **Technical State Machine Statuses**: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `CORRECTION_NEEDED`, `APPROVED`, `PAYMENT_REQUIRED`, `CERTIFICATE_READY`, `COMPLETED`, `REJECTED`, `ESCALATED`
3. **API Endpoints & URLs**: `/api/v1/...`, `http://localhost:...`, `https://revgov.maharashtra.gov.in/...`
4. **Telephone Numbers & Toll-Free DIDs**: `1800-120-8040`, `022-2202-9999`
5. **Hardware & Engine Identifiers**: `Tesseract`, `gTTS`, `Edge-TTS`, `Whisper`, `Google Speech`, `Meta Cloud API`, `Twilio`
6. **Programming Tokens & Currency Symbol**: Keep `₹` prefix or place next to localized numerals.
