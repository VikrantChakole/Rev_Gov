import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// ── LAYOUTS ──
import PublicLayout             from './layouts/PublicLayout'
import CitizenLayout            from './layouts/CitizenLayout'           // kept for legacy routes
import CitizenDashboardLayout   from './layouts/CitizenDashboardLayout'  // new 3-col dashboard
import RootLayout               from './layouts/RootLayout'
import AuthGuard                from './layouts/AuthGuard'

// ── PUBLIC PAGES ──
import LandingPage      from './pages/LandingPage/LandingPage'
import StatusTracker    from './pages/StatusTracker/StatusTracker'
import ServiceCatalogue from './pages/ServiceCatalogue/ServiceCatalogue'

// ── AUTH ──
import AuthPage from './pages/AuthPage/AuthPage'

// ── CITIZEN DASHBOARD PAGES (authenticated) ──
import CitizenDashboard     from './pages/CitizenDashboard/CitizenDashboard'
import CitizenChat           from './pages/CitizenChat/CitizenChat'
import ProfilePage           from './pages/CitizenDashboard/ProfilePage'
import MyApplicationsPage    from './pages/CitizenDashboard/MyApplicationsPage'
import ApplicationDetailsPage from './pages/CitizenDashboard/ApplicationDetailsPage'
import ManualApplicationForm  from './pages/CitizenDashboard/ManualApplicationForm'
import AutomatedApplicationForm from './pages/CitizenDashboard/AutomatedApplicationForm'
import FormFillingPage        from './pages/CitizenDashboard/FormFillingPage'

// ── DOCUMENTS TAB ──
import DocumentsPage from './pages/CitizenDashboard/DocumentsPage'

// ── OMNICHANNEL (standalone, no layout) ──
import WhatsAppChat      from './pages/WhatsAppChat/WhatsAppChat'
import IVRSimulator      from './pages/IVRSimulator/IVRSimulator'
import ApplicationReview from './pages/ApplicationReview/ApplicationReview'

// ── ADMIN & OFFICER PORTAL ──
import AdminLogin           from './pages/AdminLogin/AdminLogin'
import ServiceOfficerLogin  from './pages/ServiceOfficerLogin/ServiceOfficerLogin'
import AdminDashboard       from './pages/AdminDashboard/AdminDashboard'
import AdminApplications    from './pages/AdminApplications/AdminApplications'
import OCRConfigPage        from './pages/AdminDashboard/OCRConfigPage'
import MessageConfigPage    from './pages/AdminDashboard/MessageConfigPage'
import IVRConfigPage        from './pages/AdminDashboard/IVRConfigPage'
import AdminUsers           from './pages/AdminUsers/AdminUsers'
import DataGuardDemo     from './pages/DataGuardDemo/DataGuardDemo'
import AuditLog          from './pages/AuditLog/AuditLog'
import OfficerReview     from './pages/OfficerReview/OfficerReview'
import EscalationPanel   from './pages/EscalationPanel/EscalationPanel'

// ── DESK CLERK WORKSTATION ──
import ClerkLayout       from './layouts/ClerkLayout'
import ClerkDashboard    from './pages/ClerkDashboard/ClerkDashboard'
import ClerkApplications from './pages/ClerkApplications/ClerkApplications'
import ClerkAuditLog     from './pages/ClerkAuditLog/ClerkAuditLog'
import ClerkEscalations  from './pages/ClerkEscalations/ClerkEscalations'

// ── DISTRICT OFFICER WORKSTATION ──
import DistrictLayout       from './layouts/DistrictLayout'
import DistrictDashboard    from './pages/DistrictDashboard/DistrictDashboard'
import DistrictApplications from './pages/DistrictApplications/DistrictApplications'
import DistrictAuditLog     from './pages/DistrictAuditLog/DistrictAuditLog'
import DistrictEscalations  from './pages/DistrictEscalations/DistrictEscalations'

import CertificateVerifier from './pages/CertificateVerifier/CertificateVerifier'

// ── NEW HACKATHON DEMO ROUTES ──
import HackathonPitchBar from './components/HackathonPitchBar/HackathonPitchBar'
import OmnichannelDemo from './pages/OmnichannelDemo/OmnichannelDemo'
import MultilingualEval from './pages/MultilingualEval/MultilingualEval'
import OfficerDashboard from './pages/OfficerDashboard/OfficerDashboard'
import ReviewerApproverDashboard from './pages/ReviewerApproverDashboard/ReviewerApproverDashboard'

export default function App() {
  return (
    <BrowserRouter>
      {/* <HackathonPitchBar /> - Hidden as requested */}
      <Routes>

        {/* ══════════════════════════════════════════════════
            PUBLIC ROUTES — No sidebar, clean top nav
            ══════════════════════════════════════════════════ */}
        <Route element={<PublicLayout />}>
          <Route path="/"         element={<LandingPage />} />
          <Route path="/status"   element={<StatusTracker />} />
          <Route path="/services" element={<ServiceCatalogue />} />
        </Route>
        
        <Route path="/verify-certificate/:certNumber" element={<CertificateVerifier />} />

        {/* ══════════════════════════════════════════════════
            HACKATHON DEMO & PRESENTATION ROUTES
            ══════════════════════════════════════════════════ */}
        <Route path="/demo"                element={<OmnichannelDemo />} />
        <Route path="/multilingual-eval"  element={<MultilingualEval />} />
        <Route path="/officer-dashboard"   element={<OfficerDashboard />} />
        <Route path="/reviewer-dashboard"  element={<ReviewerApproverDashboard />} />
        <Route path="/approver-dashboard"  element={<ReviewerApproverDashboard />} />

        {/* ══════════════════════════════════════════════════
            AUTH PAGE — standalone, no layout wrapper
            ══════════════════════════════════════════════════ */}
        <Route path="/login" element={<AuthPage />} />

        {/* ══════════════════════════════════════════════════
            CITIZEN DASHBOARD — 3-column responsive layout
            All routes require CITIZEN auth
            ══════════════════════════════════════════════════ */}
        <Route
          element={
            <AuthGuard requiredRole="CITIZEN">
              <CitizenDashboardLayout />
            </AuthGuard>
          }
        >
          <Route path="/dashboard"        element={<CitizenDashboard />} />
          <Route path="/assistant"        element={<CitizenChat />} />
          <Route path="/chat"             element={<Navigate to="/assistant" replace />} />
          <Route path="/applications"     element={<MyApplicationsPage />} />
          <Route path="/form-filling"     element={<FormFillingPage />} />
          <Route path="/applications/manual-form" element={<ManualApplicationForm />} />
          <Route path="/applications/manual-form/:draftId" element={<ManualApplicationForm />} />
          <Route path="/applications/automated-form" element={<AutomatedApplicationForm />} />
          <Route path="/applications/automated-form/:draftId" element={<AutomatedApplicationForm />} />
          <Route path="/applications/:id" element={<ApplicationDetailsPage />} />
          <Route path="/documents"        element={<DocumentsPage />} />
          <Route path="/profile"          element={<ProfilePage />} />
        </Route>

        {/* ══════════════════════════════════════════════════
            APPLICATION REVIEW / TRACKING — citizen layout
            ══════════════════════════════════════════════════ */}
        <Route element={<CitizenLayout />}>
          <Route path="/applications/:id/review" element={<ApplicationReview />} />
          <Route path="/tracking/:id"            element={<ApplicationReview />} />
        </Route>

        {/* ══════════════════════════════════════════════════
            STANDALONE CHANNEL UIs — no layout wrapper
            ══════════════════════════════════════════════════ */}
        <Route path="/whatsapp" element={<WhatsAppChat />} />
        <Route path="/ivr"      element={<IVRSimulator />} />

        {/* ══════════════════════════════════════════════════
            STAFF & ADMIN AUTH
            ══════════════════════════════════════════════════ */}
        <Route path="/admin/login"            element={<AdminLogin />} />
        <Route path="/officer/login"          element={<ServiceOfficerLogin />} />
        <Route path="/service-officers/login" element={<Navigate to="/officer/login" replace />} />
        <Route
          element={
            <AuthGuard requiredRole="ADMIN">
              <RootLayout />
            </AuthGuard>
          }
        >
          <Route path="/admin"                   element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard"         element={<AdminDashboard />} />
          <Route path="/admin/applications"      element={<AdminApplications />} />
          <Route path="/admin/ocr-config"        element={<OCRConfigPage />} />
          <Route path="/admin/message-config"    element={<MessageConfigPage />} />
          <Route path="/admin/ivr-config"        element={<IVRConfigPage />} />
          <Route path="/admin/users"             element={<AdminUsers />} />
          <Route path="/admin/review/:appNumber" element={<OfficerReview />} />
          <Route path="/admin/documents"         element={<DataGuardDemo />} />
          <Route path="/admin/data-guard"        element={<DataGuardDemo />} />
          <Route path="/admin/audit"             element={<AuditLog />} />
          <Route path="/admin/escalations"       element={<EscalationPanel />} />
          <Route path="/admin/live-events"       element={<AuditLog />} />
        </Route>

        {/* ══════════════════════════════════════════════════
            DESK CLERK WORKSTATION — Scoped to Assigned State
            ══════════════════════════════════════════════════ */}
        <Route
          element={
            <AuthGuard requiredRole="DESK_CLERK">
              <ClerkLayout />
            </AuthGuard>
          }
        >
          <Route path="/clerk"              element={<Navigate to="/clerk/dashboard" replace />} />
          <Route path="/clerk/dashboard"    element={<ClerkDashboard />} />
          <Route path="/clerk/applications" element={<ClerkApplications />} />
          <Route path="/clerk/audit"        element={<ClerkAuditLog />} />
          <Route path="/clerk/escalations"  element={<ClerkEscalations />} />
        </Route>

        {/* ══════════════════════════════════════════════════
            DISTRICT OFFICER WORKSTATION — Scoped to Assigned State
            ══════════════════════════════════════════════════ */}
        <Route
          element={
            <AuthGuard requiredRole="DISTRICT_OFFICER">
              <DistrictLayout />
            </AuthGuard>
          }
        >
          <Route path="/district"              element={<Navigate to="/district/dashboard" replace />} />
          <Route path="/district/dashboard"    element={<DistrictDashboard />} />
          <Route path="/district/applications" element={<DistrictApplications />} />
          <Route path="/district/review/:appNumber" element={<OfficerReview />} />
          <Route path="/district/audit"        element={<DistrictAuditLog />} />
          <Route path="/district/escalations"  element={<DistrictEscalations />} />
        </Route>

        {/* ══════════════════════════════════════════════════
            CATCH-ALL
            ══════════════════════════════════════════════════ */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  )
}
