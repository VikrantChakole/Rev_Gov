import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Layers,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  MapPin,
  Flag,
  Calendar,
  ArrowRight,
  ExternalLink,
  Download,
  FileText,
  Sparkles,
  PlusCircle,
  CreditCard,
  Award,
  AlertCircle,
  Check,
  Building2,
  Copy,
  ChevronRight,
  User,
  Send,
  FileEdit,
  Trash2,
  AlertTriangle,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import useChatStore from '../../store/chatStore'
import { applicationsApi } from '../../api/applications'
import { getCitizenProfile } from '../../api/auth'
import { STATUS_CONFIG } from '../../utils/constants'
import NewApplicationModal from '../../components/NewApplicationModal/NewApplicationModal'
import ResumeApplicationModal from '../../components/ResumeApplicationModal/ResumeApplicationModal'
import PaymentGatewayModal from '../../components/PaymentGatewayModal/PaymentGatewayModal'
import TrackStatusModal from '../../components/TrackStatusModal/TrackStatusModal'
import styles from './CitizenDashboard.module.css'

const formatServiceName = (name, id = '') => {
  if (!name) return (id || '').replace(/_/g, ' ')
  if (typeof name === 'object') return name.en || Object.values(name)[0] || id
  return String(name).replace(/_/g, ' ')
}

const getLocalizedServiceName = (name, id = '', t) => {
  const cleanId = String(id || name || '').toLowerCase().replace(/_certificate$/, '')
  if (cleanId === 'income' || cleanId === 'caste' || cleanId === 'obc_ncl' || cleanId === 'domicile') {
    return t(`services.${cleanId}`, formatServiceName(name, id))
  }
  if (name && typeof name === 'object') {
    return name[t.language] || name.en || Object.values(name)[0] || id
  }
  return formatServiceName(name, id)
}

const DRAFT_STATUSES = ['DRAFT']

const SUBMITTED_STATUSES = [
  'SUBMITTED',
  'SUBMITTED_FOR_VERIFICATION',
]

const APPROVED_STATUSES = [
  'APPROVED',
  'PAYMENT_COMPLETED',
  'CERTIFICATE_GENERATION',
  'CERTIFICATE_READY',
  'COMPLETED',
]

const UNDER_REVIEW_STATUSES = [
  'UNDER_REVIEW',
  'PAYMENT_REQUIRED',
  'PAYMENT_PENDING',
  'CLARIFICATION_REQUIRED',
  'CORRECTION_NEEDED',
  'DISTRICT_OFFICER_APPROVAL',
  'READY_FOR_REVIEW',
  'FINAL_REVIEW',
  'CONSENT_CONFIRMED',
]

const REJECTED_STATUSES = ['REJECTED']

export default function CitizenDashboard() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { citizenUser, user } = useAuthStore()
  const citizenIdentifier =
    useChatStore((s) => s.citizenIdentifier) ||
    citizenUser?.citizen_id ||
    citizenUser?.citizen_ref ||
    localStorage.getItem('citizen_identifier')

  const [activeCard, setActiveCard] = useState('TOTAL') // 'TOTAL' | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
  const [searchTerm, setSearchTerm] = useState('')
  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [copiedId, setCopiedId] = useState(null)
  const [isNewAppModalOpen, setIsNewAppModalOpen] = useState(false)
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    app: null,
    isDeleting: false,
  })

  const handleDeleteClick = (app) => {
    setDeleteModal({
      isOpen: true,
      app,
      isDeleting: false,
    })
  }

  const handleConfirmDelete = async () => {
    if (!deleteModal.app) return
    const targetId = deleteModal.app.id || deleteModal.app.application_number
    setDeleteModal((prev) => ({ ...prev, isDeleting: true }))
    try {
      await applicationsApi.deleteApplication(targetId)
      toast.success(`Application #${deleteModal.app.application_number || targetId} deleted successfully`)
      setDeleteModal({ isOpen: false, app: null, isDeleting: false })
      refetch()
    } catch (err) {
      console.error('Failed to delete application:', err)
      toast.error(err.message || 'Failed to delete application.')
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }))
    }
  }

  const [escalateModal, setEscalateModal] = useState({
    isOpen: false,
    app: null,
    reason: '',
    isEscalating: false,
  })

  const handleConfirmEscalation = async () => {
    if (!escalateModal.app) return
    const reason = (escalateModal.reason || '').trim()
    if (!reason) {
      toast.error(t('escalation.pleaseEnterReason', 'Please enter a comment or reason for escalation.'))
      return
    }
    const targetId = escalateModal.app.id || escalateModal.app.application_number
    setEscalateModal((prev) => ({ ...prev, isEscalating: true }))
    try {
      await applicationsApi.escalateApplication(targetId, reason)
      toast.success(t('escalation.escalateSuccess', 'Application successfully escalated to your local desk clerk.'))
      setEscalateModal({ isOpen: false, app: null, reason: '', isEscalating: false })
      refetch()
    } catch (err) {
      console.error('Failed to escalate application:', err)
      toast.error(err?.response?.data?.detail || err.message || t('escalation.escalateFailed', 'Failed to escalate application.'))
      setEscalateModal((prev) => ({ ...prev, isEscalating: false }))
    }
  }

  const [resumeModal, setResumeModal] = useState({
    isOpen: false,
    app: null,
  })

  const [paymentModal, setPaymentModal] = useState({
    isOpen: false,
    app: null,
  })

  const [trackModal, setTrackModal] = useState({
    isOpen: false,
    app: null,
  })

  const handleResumeClick = (app) => {
    setResumeModal({
      isOpen: true,
      app,
    })
  }

  // Fetch full profile for latest state & nationality
  const { data: profile } = useQuery({
    queryKey: ['citizen-profile'],
    queryFn: getCitizenProfile,
    staleTime: 30000,
  })

  // Fetch all applications for the current logged-in citizen
  const {
    data: appsData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['myApplications', citizenIdentifier],
    queryFn: () => applicationsApi.getMyApplications(citizenIdentifier, 100),
    refetchInterval: 12000,
  })

  // Fetch list of services for the service filter dropdown
  const { data: servicesData } = useQuery({
    queryKey: ['services-list'],
    queryFn: applicationsApi.listServices,
  })

  const applications = useMemo(() => appsData?.applications || [], [appsData])

  // Compute counts for the 6 cards
  const counts = useMemo(() => {
    let total = applications.length
    let draft = 0
    let submitted = 0
    let underReview = 0
    let approved = 0
    let rejected = 0

    applications.forEach((app) => {
      const st = (app.status || '').toUpperCase()
      if (DRAFT_STATUSES.includes(st)) {
        draft++
      } else if (SUBMITTED_STATUSES.includes(st)) {
        submitted++
      } else if (UNDER_REVIEW_STATUSES.includes(st)) {
        underReview++
      } else if (APPROVED_STATUSES.includes(st)) {
        approved++
      } else if (REJECTED_STATUSES.includes(st)) {
        rejected++
      }
    })

    return { total, draft, submitted, underReview, approved, rejected }
  }, [applications])

  // Filter applications according to the active card and secondary filters
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const st = (app.status || '').toUpperCase()

      // Primary filter based on clicked card
      if (activeCard === 'DRAFT' && !DRAFT_STATUSES.includes(st)) {
        return false
      }
      if (activeCard === 'SUBMITTED' && !SUBMITTED_STATUSES.includes(st)) {
        return false
      }
      if (activeCard === 'APPROVED' && !APPROVED_STATUSES.includes(st)) {
        return false
      }
      if (activeCard === 'UNDER_REVIEW' && !UNDER_REVIEW_STATUSES.includes(st)) {
        return false
      }
      if (activeCard === 'REJECTED' && !REJECTED_STATUSES.includes(st)) {
        return false
      }

      // Secondary service filter
      if (serviceFilter !== 'ALL' && app.service_id !== serviceFilter) {
        return false
      }

      // Secondary search term
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase()
        const trackId = (app.tracking_id || '').toLowerCase()
        const appNum = (app.application_number || '').toLowerCase()
        const srvName = (app.service_name || app.service_id || '').toLowerCase()
        if (!trackId.includes(q) && !appNum.includes(q) && !srvName.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [applications, activeCard, serviceFilter, searchTerm])

  const [activeUserState, setActiveUserState] = useState(() => {
    return citizenUser?.state || profile?.state || localStorage.getItem('rsp_user_state') || 'Maharashtra'
  })

  useEffect(() => {
    if (citizenUser?.state) setActiveUserState(citizenUser.state)
  }, [citizenUser?.state])

  useEffect(() => {
    const handleStateEvent = (e) => {
      if (e.detail?.state) setActiveUserState(e.detail.state)
    }
    window.addEventListener('rsp_user_state_changed', handleStateEvent)
    return () => window.removeEventListener('rsp_user_state_changed', handleStateEvent)
  }, [])

  const displayName =
    profile?.name || citizenUser?.name || user?.name || 'Citizen'
  const userState = activeUserState
  const nationality =
    profile?.nationality ||
    citizenUser?.nationality ||
    user?.nationality ||
    'Indian'
  const citizenId =
    profile?.citizen_id ||
    citizenUser?.citizen_id ||
    citizenUser?.citizen_ref ||
    'CIT-1001'

  const todayDate = new Date().toLocaleDateString(i18n.language || 'en', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const copyToClipboard = (text) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedId(text)
    toast.success(`Copied "${text}" to clipboard!`, { duration: 1800 })
    setTimeout(() => setCopiedId(null), 2500)
  }

  return (
    <div className={styles.container}>
      {/* ── 1. GREETING CARD ── */}
      <div className={styles.greetingCard}>
        <div className={styles.greetingGlow} />
        <div className={styles.greetingContent}>
          <div className={styles.greetingTop}>
            <span className={styles.greetingBadge}>
              <Sparkles size={14} className={styles.sparkleIcon} />
              {t('dashboard.citizenServicesPortal', 'Citizen Services Portal')}
            </span>
            <span className={styles.dateBadge}>
              <Calendar size={13} />
              {todayDate}
            </span>
          </div>

          <h1 className={styles.greetingTitle}>
            {t('dashboard.greeting', { name: displayName, defaultValue: `Namaste, ${displayName}!` })} <span className={styles.wave}>🙏</span>
          </h1>

          <p className={styles.greetingSubtitle}>
            {t('dashboard.greetingSubtitle', 'Welcome to your official citizen dashboard. Track application statuses, view officer review progress, and access government certificates.')}
          </p>

          <div className={styles.metaRow}>
            <div className={styles.metaChip}>
              <MapPin size={14} color="#15803d" />
              <span>
                {t('dashboard.assignedState', 'Assigned State')}: <strong>{userState}</strong>
              </span>
            </div>
            <div className={styles.metaChip}>
              <Flag size={14} color="#1d4ed8" />
              <span>
                {t('dashboard.nationality', 'Nationality')}: <strong>{t('dashboard.indian', nationality)}</strong>
              </span>
            </div>
            <div className={styles.metaChip}>
              <User size={14} color="#7c3aed" />
              <span>
                {t('dashboard.citizenId', 'Citizen ID')}: <strong>{citizenId}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className={styles.greetingActions}>
          <button 
            type="button"
            className={styles.newAppBtn}
            onClick={() => setIsNewAppModalOpen(true)}
          >
            <PlusCircle size={16} />
            <span>{t('dashboard.newApplication', 'New Application')}</span>
          </button>

          <button
            className={styles.syncBtn}
            onClick={() => refetch()}
            disabled={isFetching}
            title={t('common.syncStatus', 'Sync latest application status')}
          >
            <RefreshCw size={15} className={isFetching ? styles.spin : ''} />
            <span>{isFetching ? t('common.loading', 'Syncing...') : t('common.syncStatus', 'Sync Status')}</span>
          </button>
        </div>
      </div>

      {/* ── 2. THE 6 METRIC CARDS ── */}
      <div className={styles.metricsGrid}>
        {/* Card 1: Total Applications */}
        <div
          className={`${styles.metricCard} ${styles.cardTotal} ${
            activeCard === 'TOTAL' ? styles.cardActive : ''
          }`}
          onClick={() => setActiveCard('TOTAL')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveCard('TOTAL')}
          aria-label="Filter by Total Applications"
        >
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrap} ${styles.iconWrapTotal}`}>
              <Layers size={22} color="#2563eb" />
            </div>
            <span className={styles.cardPill}>
              {activeCard === 'TOTAL' ? t('dashboard.activeFilter', '● Active Filter') : t('dashboard.clickToView', 'Click to View')}
            </span>
          </div>
          <div className={styles.cardValueBox}>
            <span className={styles.cardValue}>{counts.total}</span>
            <span className={styles.cardTitle}>{t('dashboard.totalApplications', 'Total Applications')}</span>
          </div>
          <p className={styles.cardDesc}>{t('dashboard.allCitizenApplications', 'All citizen applications')}</p>
          <div className={styles.cardIndicator} />
        </div>

        {/* Card 2: Draft */}
        <div
          className={`${styles.metricCard} ${styles.cardDraft} ${
            activeCard === 'DRAFT' ? styles.cardActive : ''
          }`}
          onClick={() => setActiveCard('DRAFT')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveCard('DRAFT')}
          aria-label="Filter by Draft Applications"
        >
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrap} ${styles.iconWrapDraft}`}>
              <FileEdit size={22} color="#8b5cf6" />
            </div>
            <span className={styles.cardPill}>
              {activeCard === 'DRAFT' ? t('dashboard.activeFilter', '● Active Filter') : t('dashboard.clickToView', 'Click to View')}
            </span>
          </div>
          <div className={styles.cardValueBox}>
            <span className={styles.cardValue}>{counts.draft}</span>
            <span className={styles.cardTitle}>{t('statuses.DRAFT', 'Draft')}</span>
          </div>
          <p className={styles.cardDesc}>{t('dashboard.inProgressFormFillings', 'In-progress form fillings')}</p>
          <div className={styles.cardIndicator} />
        </div>

        {/* Card 3: Submitted */}
        <div
          className={`${styles.metricCard} ${styles.cardSubmitted} ${
            activeCard === 'SUBMITTED' ? styles.cardActive : ''
          }`}
          onClick={() => setActiveCard('SUBMITTED')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveCard('SUBMITTED')}
          aria-label="Filter by Submitted Applications"
        >
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrap} ${styles.iconWrapSubmitted}`}>
              <Send size={22} color="#4f46e5" />
            </div>
            <span className={styles.cardPill}>
              {activeCard === 'SUBMITTED' ? t('dashboard.activeFilter', '● Active Filter') : t('dashboard.clickToView', 'Click to View')}
            </span>
          </div>
          <div className={styles.cardValueBox}>
            <span className={styles.cardValue}>{counts.submitted}</span>
            <span className={styles.cardTitle}>{t('statuses.SUBMITTED', 'Submitted')}</span>
          </div>
          <p className={styles.cardDesc}>{t('dashboard.awaitingOfficerPickup', 'Awaiting officer pickup')}</p>
          <div className={styles.cardIndicator} />
        </div>

        {/* Card 4: Under Review */}
        <div
          className={`${styles.metricCard} ${styles.cardReview} ${
            activeCard === 'UNDER_REVIEW' ? styles.cardActive : ''
          }`}
          onClick={() => setActiveCard('UNDER_REVIEW')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveCard('UNDER_REVIEW')}
          aria-label="Filter by Under Review Applications"
        >
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrap} ${styles.iconWrapReview}`}>
              <Clock size={22} color="#d97706" />
            </div>
            <span className={styles.cardPill}>
              {activeCard === 'UNDER_REVIEW' ? t('dashboard.activeFilter', '● Active Filter') : t('dashboard.clickToView', 'Click to View')}
            </span>
          </div>
          <div className={styles.cardValueBox}>
            <span className={styles.cardValue}>{counts.underReview}</span>
            <span className={styles.cardTitle}>{t('statuses.UNDER_REVIEW', 'Under Review')}</span>
          </div>
          <p className={styles.cardDesc}>{t('dashboard.inQueueVerification', 'In queue & officer verification')}</p>
          <div className={styles.cardIndicator} />
        </div>

        {/* Card 5: Approved */}
        <div
          className={`${styles.metricCard} ${styles.cardApproved} ${
            activeCard === 'APPROVED' ? styles.cardActive : ''
          }`}
          onClick={() => setActiveCard('APPROVED')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveCard('APPROVED')}
          aria-label="Filter by Approved Applications"
        >
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrap} ${styles.iconWrapApproved}`}>
              <CheckCircle2 size={22} color="#16a34a" />
            </div>
            <span className={styles.cardPill}>
              {activeCard === 'APPROVED' ? t('dashboard.activeFilter', '● Active Filter') : t('dashboard.clickToView', 'Click to View')}
            </span>
          </div>
          <div className={styles.cardValueBox}>
            <span className={styles.cardValue}>{counts.approved}</span>
            <span className={styles.cardTitle}>{t('statuses.APPROVED', 'Approved')}</span>
          </div>
          <p className={styles.cardDesc}>{t('dashboard.readyCertificates', 'Ready certificates & approved')}</p>
          <div className={styles.cardIndicator} />
        </div>

        {/* Card 6: Rejected */}
        <div
          className={`${styles.metricCard} ${styles.cardRejected} ${
            activeCard === 'REJECTED' ? styles.cardActive : ''
          }`}
          onClick={() => setActiveCard('REJECTED')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveCard('REJECTED')}
          aria-label="Filter by Rejected Applications"
        >
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrap} ${styles.iconWrapRejected}`}>
              <XCircle size={22} color="#dc2626" />
            </div>
            <span className={styles.cardPill}>
              {activeCard === 'REJECTED' ? t('dashboard.activeFilter', '● Active Filter') : t('dashboard.clickToView', 'Click to View')}
            </span>
          </div>
          <div className={styles.cardValueBox}>
            <span className={styles.cardValue}>{counts.rejected}</span>
            <span className={styles.cardTitle}>{t('statuses.REJECTED', 'Rejected')}</span>
          </div>
          <p className={styles.cardDesc}>{t('dashboard.statutoryRejection', 'Incomplete or statutory rejection')}</p>
          <div className={styles.cardIndicator} />
        </div>
      </div>

      {/* ── 3. APPLICATION LIST SECTION ── */}
      <div className={styles.listSection}>
        {/* Section Header & Toolbar */}
        <div className={styles.listHeader}>
          <div className={styles.listHeaderLeft}>
            <h2 className={styles.listHeading}>
              {activeCard === 'TOTAL' && t('dashboard.allApplications', 'All Applications')}
              {activeCard === 'DRAFT' && t('dashboard.draftApplications', 'Draft Applications')}
              {activeCard === 'SUBMITTED' && t('dashboard.submittedApplications', 'Submitted Applications')}
              {activeCard === 'UNDER_REVIEW' && t('dashboard.underReviewApplications', 'Under Review Applications')}
              {activeCard === 'APPROVED' && t('dashboard.approvedApplications', 'Approved Applications')}
              {activeCard === 'REJECTED' && t('dashboard.rejectedApplications', 'Rejected Applications')}
              <span className={styles.countBadge}>
                {filteredApplications.length}
              </span>
            </h2>
            <p className={styles.listSubhead}>
              {t('dashboard.displayingForCitizen', {
                name: displayName,
                state: userState,
                defaultValue: `Displaying applications for citizen ${displayName} (${userState} State).`
              })}
            </p>
          </div>

          <div className={styles.listControls}>
            {/* Search Box */}
            <div className={styles.searchBox}>
              <Search size={15} color="#64748b" />
              <input
                type="text"
                className={styles.searchInput}
                placeholder={t('dashboard.searchPlaceholder', 'Search Tracking ID, service...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className={styles.clearSearchBtn}
                  onClick={() => setSearchTerm('')}
                  title={t('common.clear', 'Clear search')}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Service Filter Dropdown */}
            <div className={styles.filterDropdown}>
              <Filter size={14} color="#64748b" />
              <select
                className={styles.selectInput}
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
              >
                <option value="ALL">{t('dashboard.allServices', 'All Services')}</option>
                {(servicesData?.services || []).map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {getLocalizedServiceName(srv.name, srv.id, t)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* List Content */}
        {isLoading ? (
          <div className={styles.loadingBox}>
            <RefreshCw size={28} className={styles.spin} color="#2563eb" />
            <p className={styles.loadingText}>
              {t('dashboard.loadingRecords', 'Loading your government application records...')}
            </p>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className={styles.emptyBox}>
            <div className={styles.emptyIconWrap}>
              {activeCard === 'DRAFT' ? (
                <FileEdit size={36} color="#8b5cf6" />
              ) : activeCard === 'SUBMITTED' ? (
                <Send size={36} color="#4f46e5" />
              ) : activeCard === 'APPROVED' ? (
                <CheckCircle2 size={36} color="#16a34a" />
              ) : activeCard === 'UNDER_REVIEW' ? (
                <Clock size={36} color="#d97706" />
              ) : activeCard === 'REJECTED' ? (
                <XCircle size={36} color="#dc2626" />
              ) : (
                <FileText size={36} color="#64748b" />
              )}
            </div>
            <h3 className={styles.emptyTitle}>
              {searchTerm || serviceFilter !== 'ALL'
                ? t('emptyStates.noMatchingApplications', 'No matching applications found')
                : activeCard === 'DRAFT'
                ? t('emptyStates.noDraftApplications', 'No Draft Applications')
                : activeCard === 'SUBMITTED'
                ? t('emptyStates.noSubmittedApplications', 'No Submitted Applications Waiting in Queue')
                : activeCard === 'APPROVED'
                ? t('emptyStates.noApprovedApplications', 'No Approved Applications Yet')
                : activeCard === 'UNDER_REVIEW'
                ? t('emptyStates.noUnderReviewApplications', 'No Applications Currently Under Review')
                : activeCard === 'REJECTED'
                ? t('emptyStates.noRejectedApplications', 'No Rejected Applications')
                : t('emptyStates.noApplicationsYet', 'No Applications Started Yet')}
            </h3>
            <p className={styles.emptySubtitle}>
              {searchTerm || serviceFilter !== 'ALL'
                ? t('emptyStates.adjustSearchFilter', 'Try adjusting your search terms or clearing the service filter.')
                : activeCard === 'DRAFT'
                ? t('emptyStates.noSavedDrafts', 'You do not have any saved in-progress application drafts.')
                : activeCard === 'SUBMITTED'
                ? t('emptyStates.awaitingClerkQueue', 'Applications will appear here once submitted and awaiting desk clerk pickup.')
                : activeCard === 'APPROVED'
                ? t('emptyStates.awaitingOfficerAuth', 'Applications will appear here once reviewed and authorized by a government officer.')
                : activeCard === 'UNDER_REVIEW'
                ? t('emptyStates.undergoingVerification', 'Applications currently in submission or undergoing officer verification appear here.')
                : activeCard === 'REJECTED'
                ? t('emptyStates.noRejections', 'You do not have any rejected applications.')
                : t('emptyStates.startApplicationPrompt', 'Start an application using our AI Assistant or Manual Form to submit revenue service requests easily.')}
            </p>
            {activeCard !== 'TOTAL' ? (
              <button
                className={styles.resetFilterBtn}
                onClick={() => {
                  setActiveCard('TOTAL')
                  setSearchTerm('')
                  setServiceFilter('ALL')
                }}
              >
                {t('dashboard.viewAllApplications', 'View All Applications')}
              </button>
            ) : (
              <button 
                type="button"
                className={styles.emptyActionBtn}
                onClick={() => setIsNewAppModalOpen(true)}
              >
                <PlusCircle size={16} />
                <span>{t('dashboard.startNewApplication', 'Start New Application')}</span>
              </button>
            )}
          </div>
        ) : (
          <div className={styles.appsList}>
            {filteredApplications.map((app) => {
              const conf = STATUS_CONFIG[app.status] || {
                label: app.status,
                color: '#475569',
                bg: '#f1f5f9',
              }

              const isDraft = app.status === 'DRAFT'
              const isPaymentRequired = app.status === 'PAYMENT_REQUIRED'
              const isCertificateReady =
                app.status === 'CERTIFICATE_READY' ||
                app.status === 'COMPLETED' ||
                app.status === 'APPROVED' ||
                Boolean(app.certificate)
              const isCorrectionNeeded = app.status === 'CORRECTION_NEEDED'
              const isRejected = app.status === 'REJECTED'

              const trackId = app.tracking_id || app.application_number
              const isCopied = copiedId === trackId

              return (
                <div key={app.id || app.application_number} className={styles.appCard}>
                  {/* Left Column: Service & Identifiers */}
                  <div className={styles.appMainInfo}>
                    <div className={styles.serviceRow}>
                      <span className={styles.serviceIcon}>
                        <Building2 size={16} />
                      </span>
                      <h3 className={styles.serviceTitle}>
                        {getLocalizedServiceName(app.service_name, app.service_id, t)}
                      </h3>
                    </div>

                    <div className={styles.idRow}>
                      <div
                        className={styles.trackingChip}
                        onClick={() => copyToClipboard(trackId)}
                        title={t('dashboard.clickCopyTrackingIdTooltip', 'Click to copy Tracking ID')}
                      >
                        <span className={styles.trackingLabel}>{t('confirmation.trackingId', 'Tracking ID')}:</span>
                        <span className={styles.trackingVal}>{trackId}</span>
                        {isCopied ? (
                          <Check size={12} color="#16a34a" />
                        ) : (
                          <Copy size={12} className={styles.copyIcon} />
                        )}
                      </div>

                      {app.application_number &&
                        app.application_number !== app.tracking_id && (
                          <span className={styles.appNumChip}>
                            #{app.application_number}
                          </span>
                        )}
                    </div>

                    <div className={styles.dateMeta}>
                      <Calendar size={12} color="#94a3b8" />
                      <span>
                        {app.submitted_at
                          ? `${t('dashboard.submittedOn', 'Submitted on')} ${new Date(
                              app.submitted_at
                            ).toLocaleDateString(i18n.language || 'en', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : `${t('dashboard.initiatedOn', 'Initiated on')} ${new Date(
                              app.created_at
                            ).toLocaleDateString(i18n.language || 'en', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}`}
                      </span>
                    </div>
                  </div>

                  {/* Middle Column: Status */}
                  <div className={styles.appStatusCol}>
                    <div className={styles.statusBadgeRow}>
                      <span
                        className={styles.statusPill}
                        style={{
                          color: conf.color,
                          backgroundColor: conf.bg,
                          border: `1px solid ${conf.color}30`,
                        }}
                      >
                        <span
                          className={styles.statusDot}
                          style={{ backgroundColor: conf.color }}
                        />
                        {t(`statuses.${app.status}`, conf.label || app.status)}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className={styles.appActionsCol}>
                    {isCertificateReady ? (
                      <a
                        href={`/api/v1/applications/${
                          app.application_number || app.id
                        }/certificate`}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.certDownloadBtn}
                        title="Download Issued Certificate PDF"
                      >
                        <Download size={14} />
                        <span>{t('dashboard.downloadCertificate', 'Download Certificate')}</span>
                      </a>
                    ) : isPaymentRequired ? (
                      <button
                        type="button"
                        className={styles.payFeeBtn}
                        onClick={() => setPaymentModal({ isOpen: true, app })}
                        title="Pay Statutory Fee to Generate Certificate"
                      >
                        <CreditCard size={14} />
                        <span>{t('confirmation.payFee50', 'Pay Statutory Fee (₹50)')}</span>
                      </button>
                    ) : (isCorrectionNeeded || isRejected || app.has_rejected_documents) ? (
                      <button
                        type="button"
                        className={styles.correctionBtn}
                        onClick={() => handleResumeClick(app)}
                        title="Update application and re-upload documents"
                      >
                        <AlertCircle size={14} />
                        <span>{t('confirmation.updateInformationReUpload', 'Update Information')}</span>
                      </button>
                    ) : isDraft ? (
                      <button
                        type="button"
                        className={styles.resumeDraftBtn}
                        onClick={() => handleResumeClick(app)}
                        title="Resume application"
                      >
                        <FileEdit size={14} />
                        <span>{t('dashboard.resumeForm', 'Resume Form')}</span>
                      </button>
                    ) : (
                      <Link
                        to={`/applications/${app.id || app.application_number}`}
                        className={styles.viewDetailBtn}
                        title="View full application details"
                      >
                        <span>{t('dashboard.viewDetails', 'View Details')}</span>
                        <ChevronRight size={15} />
                      </Link>
                    )}

                    <div className={styles.actionSubLinks}>
                      <button
                        type="button"
                        className={styles.trackLink}
                        onClick={() => setTrackModal({ isOpen: true, app })}
                        title={t('dashboard.trackApplicationProgress', 'Track application progress and stages')}
                      >
                        <span>{t('dashboard.trackStatus', 'Track Status')}</span>
                        <ExternalLink size={11} />
                      </button>

                      {/* Escalation button: enabled after form has been submitted */}
                      {!isDraft && app.status !== 'COMPLETED' && (
                        app.status === 'ESCALATED' ? (
                          <span className={styles.escalatedBadge} title={t('dashboard.applicationEscalatedDeskClerk', 'Application has been escalated to desk clerk')}>
                            <AlertTriangle size={11} />
                            <span>{t('statuses.ESCALATED', 'Escalated')}</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={styles.escalateActionLink}
                            onClick={() => setEscalateModal({ isOpen: true, app, reason: '', isEscalating: false })}
                            title={t('dashboard.escalateApplicationTooltip', 'Escalate this application to your local desk clerk')}
                          >
                            <AlertTriangle size={11} />
                            <span>{t('dashboard.escalate', 'Escalate')}</span>
                          </button>
                        )
                      )}

                      {(isCorrectionNeeded || isRejected || app.has_rejected_documents) && (
                        <Link
                          to={`/applications/${app.id || app.application_number}`}
                          className={styles.trackLink}
                          title={t('dashboard.viewDetailsTooltip', 'View application details')}
                        >
                          <span>{t('dashboard.viewDetails', 'View Details')}</span>
                        </Link>
                      )}

                      <button
                        type="button"
                        className={styles.deleteAppBtn}
                        onClick={() => handleDeleteClick(app)}
                        title="Delete application"
                      >
                        <Trash2 size={12} />
                        <span>{t('common.delete', 'Delete')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={() => !deleteModal.isDeleting && setDeleteModal({ isOpen: false, app: null, isDeleting: false })}
        >
          <div className={styles.deleteModalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.deleteModalHeader}>
              <div className={styles.deleteWarningIcon}>
                <Trash2 size={22} />
              </div>
              <h3 className={styles.deleteModalTitle}>{t('dashboard.deleteModalTitle', 'Delete Application')}</h3>
            </div>

            <p className={styles.deleteModalBody}>
              {t('dashboard.deleteModalBody', 'Are you sure you want to permanently delete this application record? All uploaded documents, form particulars, and progress will be completely removed. This action cannot be undone.')}
            </p>

            {deleteModal.app && (
              <div className={styles.deleteModalAppDetails}>
                <div>
                  <strong>{t('common.service', 'Service')}:</strong> {getLocalizedServiceName(deleteModal.app.service_name, deleteModal.app.service_id, t)}
                </div>
                <div>
                  <strong>{t('common.applicationNumber', 'Application Number')}:</strong> #{deleteModal.app.application_number || deleteModal.app.id}
                </div>
                {deleteModal.app.tracking_id && (
                  <div>
                    <strong>{t('confirmation.trackingId', 'Tracking ID')}:</strong> {deleteModal.app.tracking_id}
                  </div>
                )}
                <div>
                  <strong>{t('confirmation.currentStatus', 'Current Status')}:</strong> {t(`statuses.${deleteModal.app.status}`, deleteModal.app.status)}
                </div>
              </div>
            )}

            <div className={styles.deleteModalActions} style={{ marginTop: 20 }}>
              <button
                type="button"
                className={styles.cancelModalBtn}
                onClick={() => setDeleteModal({ isOpen: false, app: null, isDeleting: false })}
                disabled={deleteModal.isDeleting}
              >
                {t('common.cancel', 'Cancel')}
              </button>

              <button
                type="button"
                className={styles.confirmDeleteBtn}
                onClick={handleConfirmDelete}
                disabled={deleteModal.isDeleting}
              >
                {deleteModal.isDeleting ? (
                  <>
                    <RefreshCw size={14} className={styles.spin} />
                    <span>{t('dashboard.deleting', 'Deleting...')}</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>{t('dashboard.deleteApplication', 'Delete Application')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalation Confirmation Modal */}
      {escalateModal.isOpen && (
        <div
          className={styles.modalBackdrop}
          onClick={() => !escalateModal.isEscalating && setEscalateModal({ isOpen: false, app: null, reason: '', isEscalating: false })}
        >
          <div className={styles.escalateModalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.deleteModalHeader}>
              <div className={styles.escalateIconBox}>
                <AlertTriangle size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 className={styles.escalateModalTitle}>{t('escalation.title', 'Escalate Application')}</h3>
                {escalateModal.app && (
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {t('confirmation.trackingId', 'Tracking ID')}: <strong>{escalateModal.app.tracking_id || escalateModal.app.application_number}</strong>
                  </span>
                )}
              </div>
              <button
                type="button"
                className={styles.cancelModalBtn}
                style={{ padding: '4px 8px', borderRadius: 6 }}
                onClick={() => !escalateModal.isEscalating && setEscalateModal({ isOpen: false, app: null, reason: '', isEscalating: false })}
                disabled={escalateModal.isEscalating}
                title={t('common.close', 'Close modal')}
              >
                <X size={16} />
              </button>
            </div>

            <p className={styles.escalateQuestion}>
              {t('escalation.areYouSure', 'Are you sure you want to escalate this application to your local desk clerk?')}
            </p>

            <p className={styles.escalateNotice}>
              {t('escalation.priorityNotice', "Escalation requests priority review by your jurisdiction's revenue desk clerk. Please provide a comment or reason below.")}
            </p>

            <div style={{ marginBottom: 16 }}>
              <label className={styles.reasonLabel}>
                {t('escalation.reasonLabel', 'Comment / Reason for Escalation')} <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                className={styles.reasonTextarea}
                placeholder={t('escalation.reasonPlaceholder', 'Enter your comment or reason for escalating this application...')}
                value={escalateModal.reason || ''}
                onChange={(e) => setEscalateModal((prev) => ({ ...prev, reason: e.target.value }))}
                rows={3}
                disabled={escalateModal.isEscalating}
              />
            </div>

            <div className={styles.deleteModalActions}>
              <button
                type="button"
                className={styles.cancelModalBtn}
                onClick={() => setEscalateModal({ isOpen: false, app: null, reason: '', isEscalating: false })}
                disabled={escalateModal.isEscalating}
              >
                {t('common.cancel', 'Cancel')}
              </button>

              <button
                type="button"
                className={styles.confirmEscalateBtn}
                onClick={handleConfirmEscalation}
                disabled={escalateModal.isEscalating || !(escalateModal.reason || '').trim()}
              >
                {escalateModal.isEscalating ? (
                  <>
                    <RefreshCw size={14} className={styles.spin} />
                    <span>{t('escalation.escalating', 'Escalating...')}</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} />
                    <span>{t('escalation.confirmEscalation', 'Confirm Escalation')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Application Modal */}
      <ResumeApplicationModal
        isOpen={resumeModal.isOpen}
        onClose={() => setResumeModal({ isOpen: false, app: null })}
        application={resumeModal.app}
      />

      {/* New Application Modal */}
      <NewApplicationModal
        isOpen={isNewAppModalOpen}
        onClose={() => setIsNewAppModalOpen(false)}
      />

      {/* Statutory Fee Payment Gateway Modal */}
      <PaymentGatewayModal
        isOpen={paymentModal.isOpen}
        onClose={() => setPaymentModal({ isOpen: false, app: null })}
        app={paymentModal.app}
        onSuccess={() => {
          refetch()
        }}
      />

      {/* Stage Nodes Track Status Modal */}
      <TrackStatusModal
        isOpen={trackModal.isOpen}
        onClose={() => setTrackModal({ isOpen: false, app: null })}
        app={trackModal.app}
        onOpenPayment={(targetApp) => setPaymentModal({ isOpen: true, app: targetApp })}
        onOpenCorrection={(targetApp) => handleResumeClick(targetApp)}
      />
    </div>
  )
}
