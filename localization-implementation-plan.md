# React Multilingual Localization Implementation Plan

This plan documents the audit findings and implementation strategy for enabling comprehensive multilingual localization across **10 target Indian regional languages** in the Revenue Department Portal (`Rev_Gov`).

---

## 1. Project Audit Findings (Phase 1)

| Metric / Parameter | Value / Finding |
| :--- | :--- |
| **Frontend Framework** | React 19 (`react` 19.2.8, `react-dom` 19.2.8) |
| **Bundler & Build Tool** | Vite 6 (`vite` 6.4.3) |
| **Language & Dialect** | JavaScript (ESModules) with JSX |
| **Routing** | React Router DOM v7 (`react-router-dom` 7.18.2) |
| **Global State** | Zustand (`authStore.js`, `chatStore.js`, `uiStore.js`) |
| **Async Data / Caching** | TanStack React Query 5.102.0 |
| **Styling** | Vanilla CSS Modules (`*.module.css`) + CSS Custom Properties in `tokens.css` |
| **Existing i18n Solution** | Custom module `src/i18n/index.js` exporting static `t(lang, key)` with 72 keys; used in only 6 files |
| **Existing Language Selector** | `LanguageSwitcher.jsx` (supports state detection + English, Hindi, and 3rd state language) |
| **Locale Catalogs Status** | `src/i18n/locales/` contains all 10 language files (`en`, `hi`, `mr`, `bn`, `te`, `ta`, `gu`, `kn`, `ml`, `pa`), each with **1,977 matching leaf keys** across 38 domain categories |
| **Persistence Mechanism** | `localStorage` (`revgov_lang`, `rsp_citizen_user_state`) |
| **Target Languages** | English (`en`), Hindi (`hi`), Marathi (`mr`), Bengali (`bn`), Telugu (`te`), Tamil (`ta`), Gujarati (`gu`), Kannada (`kn`), Malayalam (`ml`), Punjabi (`pa`) |

---

## 2. Implementation Strategy by Phase

### Phase 2 — Install i18next & react-i18next
Install the standard production React localization packages:
```bash
npm install i18next react-i18next i18next-browser-languagedetector
```

### Phase 3 & 4 — Unified i18next Configuration (`src/i18n/index.js`)
- Configure `i18next` with `initReactI18next` and `LanguageDetector`.
- Resource bundle configured directly from `./locales/{en,hi,mr,bn,te,ta,gu,kn,ml,pa}.json`.
- Persistence in `localStorage` under `revgov_lang`.
- Fallback language: `en`.
- Support seamless re-rendering across the application without page reload.
- Initialize in `src/main.jsx` before root render.

### Phase 5 & 6 — Key Hierarchy & Content Preservation
- Strict adherence to the 1,977 keys established in `en.json`.
- Preserve the exact statutory English wording already present in the portal.

### Phase 7 & 8 — UI Component String Conversion
Convert hardcoded strings and dynamic strings in:
1. **Layouts**: `PublicLayout.jsx`, `CitizenDashboardLayout.jsx`, `CitizenLayout.jsx`, `RootLayout.jsx`, `ClerkLayout.jsx`, `DistrictLayout.jsx`.
2. **Citizen Pages & Modals**: `LandingPage.jsx`, `ServiceCatalogue.jsx`, `StatusTracker.jsx`, `CitizenDashboard.jsx`, `AutomatedApplicationForm.jsx`, `ManualApplicationForm.jsx`, `CitizenChat.jsx`, `NewApplicationModal.jsx`, `ResumeApplicationModal.jsx`, `PaymentGatewayModal.jsx`, `TrackStatusModal.jsx`.
3. **Staff Pages**: `DistrictApplications.jsx`, `ClerkApplications.jsx`, `OfficerReview.jsx`, `AdminApplications.jsx`.

### Phase 10, 11, 12, 13 — Technical Integrity & Government Terminology
- Protect all technical state machine codes (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, etc.). Display localized labels via `t(`statuses.${status}`)`.
- Protect tracking codes (`MH-REV-...`), phone numbers, URLs, and hardware/API tokens.
- Maintain authoritative statutory terminology (Income Certificate, Domicile Certificate, Caste Certificate, OBC-NCL, Tahsildar, Desk Clerk).

### Phase 14 & 15 — Upgraded Multi-Language Selector (`LanguageSwitcher.jsx`)
- Upgrade `LanguageSwitcher.jsx` to provide native names for all 10 languages:
  `English`, `हिन्दी`, `मराठी`, `বাংলা`, `తెలుగు`, `தமிழ்`, `ગુજરાતી`, `ಕನ್ನಡ`, `മലയാളം`, `ਪੰਜਾਬੀ`.
- Support one-click switching across all 10 languages with immediate UI reactivity and zero page reload.
- Keep the intelligent state recommendation badge.

### Phase 16, 17, 18 — Accessibility & CSS Responsiveness
- Localize `aria-label`, `alt`, and `title` attributes.
- Ensure buttons and pills use `min-width: max-content` and responsive flex-wrap to prevent text clipping with wider Indic text.

### Phase 19 & 20 — Validation & Fallback
- Automated verification script checking zero missing keys across all 10 locales.
- Graceful English fallback for any undefined keys.

### Phase 26 & 27 — Build & Verification
- `npm run build` production verification ensuring zero compilation errors.
- Visual verification of language switching across citizen and staff portals.
