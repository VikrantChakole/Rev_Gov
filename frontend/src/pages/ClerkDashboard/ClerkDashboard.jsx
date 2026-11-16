import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Shield,
  MapPin,
  Flag,
  UserCheck,
  Building2,
  Calendar,
  CreditCard,
} from 'lucide-react'
import useAuthStore from '../../store/authStore'
import { dashboardApi } from '../../api/dashboard'
import { applicationsApi } from '../../api/applications'
import styles from './ClerkDashboard.module.css'

const getLocalizedServiceName = (serviceIdOrName, t) => {
  if (!serviceIdOrName) return ''
  const key = `services.${serviceIdOrName}.name`
  const translated = t(key, '')
  if (translated && translated !== key) return translated
  return String(serviceIdOrName).replace(/_/g, ' ')
}

export default function ClerkDashboard() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const assignedState = user?.state || 'Maharashtra'
  const clerkName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user?.username || 'Desk Clerk')

  // Query metrics scoped to this clerk's state
  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
    isFetching,
  } = useQuery({
    queryKey: ['clerk-overview', assignedState],
    queryFn: () => dashboardApi.getOverview(assignedState),
    refetchInterval: 12000,
  })

  // Query recent applications awaiting review in this clerk's state
  const { data: awaitingData, isLoading: awaitingLoading } = useQuery({
    queryKey: ['clerk-awaiting-apps', assignedState],
    queryFn: () =>
      applicationsApi.getAdminList({
        state: assignedState,
        status: 'SUBMITTED',
        limit: 5,
      }),
    refetchInterval: 12000,
  })

  // Query recent audit feed in this clerk's state
  const { data: auditData } = useQuery({
    queryKey: ['clerk-audit-feed', assignedState],
    queryFn: () => dashboardApi.getAuditLog(8, null, assignedState),
    refetchInterval: 12000,
  })

  // Query escalations in this clerk's state
  const { data: escalationData } = useQuery({
    queryKey: ['clerk-escalations', assignedState],
    queryFn: () => dashboardApi.getEscalations(assignedState),
    refetchInterval: 15000,
  })

  const submittedQueueCount = (overview?.by_status?.SUBMITTED || 0) + (overview?.by_status?.SUBMITTED_FOR_VERIFICATION || overview?.submitted || 0)
  const underReviewCount = overview?.under_review ?? (overview?.by_status?.UNDER_REVIEW || 0)
  const paymentRequiredCount = overview?.payment_required ?? (overview?.by_status?.PAYMENT_REQUIRED || 0)
  const correctionCount = (overview?.by_status?.CORRECTION_NEEDED || 0) + (overview?.clarification_required ?? 0)

  const awaitingList = awaitingData?.applications || []
  const auditEvents = auditData?.events || []
  const escalations = escalationData?.escalations || []

  // Current date formatted according to active localization language
  const currentLang = i18n.language || 'en'
  const localeMap = {
    hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN', te: 'te-IN', ta: 'ta-IN',
    gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', en: 'en-IN'
  }
  const todayDate = new Date().toLocaleDateString(localeMap[currentLang] || 'en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className={styles.container}>
      {/* ── PERSONALIZED GREETING CARD ── */}
      <div className={styles.greetingCard}>
        <div className={styles.greetingContent}>
          <div className={styles.greetingTop}>
            <span className={styles.greetingBadge}>
              <UserCheck size={14} />
              {t('clerk.deskClerkWorkstation', 'Desk Clerk Workstation')}
            </span>
            <span className={styles.dateBadge}>
              <Calendar size={13} />
              {todayDate}
            </span>
          </div>

          <h1 className={styles.greetingTitle}>
            {t('clerk.greetingTitle', { name: clerkName, defaultValue: `Namaste, ${clerkName}!` })} <span className={styles.wave}>👋</span>
          </h1>

          <p className={styles.greetingSubtitle}>
            {t('clerk.greetingSubtitle', {
              state: assignedState,
              defaultValue: `You are operating the citizen service desk for ${assignedState} State jurisdiction. Review documents, resolve queries, and verify revenue applications.`
            })}
          </p>

          <div className={styles.metaRow}>
            <div className={styles.metaChip}>
              <MapPin size={14} color="#15803d" />
              <span>{t('clerk.assignedStateLabel', 'Assigned State:')} <strong>{assignedState}</strong></span>
            </div>
            <div className={styles.metaChip}>
              <Flag size={14} color="#1d4ed8" />
              <span>{t('clerk.nationalityLabel', 'Nationality:')} <strong>{user?.nationality || 'Indian'}</strong></span>
            </div>
            <div className={styles.metaChip}>
              <Building2 size={14} color="#6b21a8" />
              <span>{t('clerk.jurisdictionRegional', 'Jurisdiction: Regional Revenue Desk')}</span>
            </div>
          </div>
        </div>

        <button
          className={styles.syncBtn}
          onClick={() => refetchOverview()}
          disabled={isFetching}
          title={t('clerk.refreshTooltip', 'Refresh real-time data')}
        >
          <RefreshCw size={16} className={isFetching ? styles.spin : ''} />
          <span>{t('clerk.syncRealtime', 'Sync Realtime')}</span>
        </button>
      </div>

      {/* ── METRIC CARDS (SCOPED TO ASSIGNED STATE & CLERK WORKFLOW) ── */}
      <div className={styles.metricsGrid}>
        <Link to="/clerk/applications?status=SUBMITTED" className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>{t('clerk.submittedQueue', 'Submitted Queue')}</span>
            <div className={styles.metricIcon} style={{ background: '#fef3c7', color: '#b45309' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className={styles.metricCount} style={{ color: '#b45309' }}>
            {overviewLoading ? '…' : submittedQueueCount}
          </div>
          <div className={styles.metricFooter}>
            <span>{t('clerk.unassignedIntakeQueue', 'Unassigned intake queue')}</span>
            <ArrowRight size={13} />
          </div>
        </Link>

        <Link to="/clerk/applications?status=UNDER_REVIEW" className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>{t('clerk.underReview', 'Under Review')}</span>
            <div className={styles.metricIcon} style={{ background: '#e0f2fe', color: '#0284c7' }}>
              <FileText size={18} />
            </div>
          </div>
          <div className={styles.metricCount} style={{ color: '#0284c7' }}>
            {overviewLoading ? '…' : underReviewCount}
          </div>
          <div className={styles.metricFooter}>
            <span>{t('clerk.documentVerification', 'Document verification')}</span>
            <ArrowRight size={13} />
          </div>
        </Link>

        <Link to="/clerk/applications?status=PAYMENT_REQUIRED" className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>{t('clerk.paymentRequired', 'Payment Required')}</span>
            <div className={styles.metricIcon} style={{ background: '#ffedd5', color: '#c2410c' }}>
              <CreditCard size={18} />
            </div>
          </div>
          <div className={styles.metricCount} style={{ color: '#c2410c' }}>
            {overviewLoading ? '…' : paymentRequiredCount}
          </div>
          <div className={styles.metricFooter}>
            <span>{t('clerk.pendingFeeValidation', 'Pending fee / validation')}</span>
            <ArrowRight size={13} />
          </div>
        </Link>

        <Link to="/clerk/applications?status=CORRECTION_NEEDED" className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>{t('clerk.correctionNeeded', 'Correction Needed')}</span>
            <div className={styles.metricIcon} style={{ background: '#fee2e2', color: '#b91c1c' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className={styles.metricCount} style={{ color: '#b91c1c' }}>
            {overviewLoading ? '…' : correctionCount}
          </div>
          <div className={styles.metricFooter}>
            <span>{t('clerk.pendingCitizenResponse', 'Pending citizen response')}</span>
            <ArrowRight size={13} />
          </div>
        </Link>
      </div>

      {/* ── TWO-COLUMN SECTION: RECENT APPS + AUDIT ACTIVITY ── */}
      <div className={styles.sectionsGrid}>
        {/* Left: Applications awaiting verification */}
        <div className={styles.sectionBox}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>
                {t('clerk.awaitingVerificationHeading', {
                  state: assignedState,
                  defaultValue: `Awaiting Verification (${assignedState})`
                })}
              </h2>
              <p className={styles.sectionSub}>{t('clerk.awaitingVerificationSub', 'Applications submitted by citizens requiring desk review.')}</p>
            </div>
            <Link to="/clerk/applications" className={styles.viewAllLink}>
              {t('clerk.viewAll', 'View All')} <ArrowRight size={14} />
            </Link>
          </div>

          {awaitingLoading ? (
            <div className={styles.loadingBox}>
              <RefreshCw size={20} className={styles.spin} />
              <span>{t('clerk.loadingApplications', 'Loading applications...')}</span>
            </div>
          ) : awaitingList.length === 0 ? (
            <div className={styles.emptyBox}>
              <CheckCircle size={28} color="#16a34a" />
              <p>{t('clerk.queueClear', { state: assignedState, defaultValue: `Queue clear! No applications currently awaiting verification in ${assignedState}.` })}</p>
            </div>
          ) : (
            <div className={styles.appsList}>
              {awaitingList.map((app) => (
                <div key={app.id} className={styles.appRow}>
                  <div className={styles.appInfo}>
                    <span className={styles.appNumber}>{app.tracking_id || app.application_number}</span>
                    <span className={styles.applicantName}>{app.applicant_name || app.citizen_name || 'Citizen'}</span>
                    <span className={styles.appService}>{getLocalizedServiceName(app.service_id || app.service_name, t)}</span>
                  </div>
                  <div className={styles.appMeta}>
                    <span className={styles.stateBadge}>
                      <MapPin size={11} />
                      {app.state || assignedState}
                    </span>
                    <span className={styles.statusBadgeWarning}>{t('clerk.awaitingReview', 'Awaiting Review')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: State Audit Activity & Escalations */}
        <div className={styles.sectionBox}>
          <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.sectionTitle}>
                {t('clerk.complianceFeedHeading', {
                  state: assignedState,
                  defaultValue: `Compliance & Security Feed (${assignedState})`
                })}
              </h2>
              <p className={styles.sectionSub}>{t('clerk.complianceFeedSub', 'Real-time Data Guard, submission, and consent logs.')}</p>
            </div>
            <Link to="/clerk/audit" className={styles.viewAllLink}>
              {t('clerk.viewLogs', 'View Logs')} <ArrowRight size={14} />
            </Link>
          </div>

          {auditEvents.length === 0 ? (
            <div className={styles.emptyBox}>
              <Shield size={28} color="#94a3b8" />
              <p>{t('clerk.noAuditRecords', { state: assignedState, defaultValue: `No recent audit records for ${assignedState}.` })}</p>
            </div>
          ) : (
            <div className={styles.auditFeed}>
              {auditEvents.slice(0, 6).map((item) => (
                <div key={item.id} className={styles.auditItem}>
                  <div className={styles.auditIconWrap}>
                    <Shield size={14} color="#00355f" />
                  </div>
                  <div className={styles.auditContent}>
                    <div className={styles.auditTopRow}>
                      <span className={styles.auditType}>{item.event_type}</span>
                      <span className={item.outcome === 'BLOCK' ? styles.outcomeBlock : styles.outcomeAllow}>
                        {item.outcome}
                      </span>
                    </div>
                    <p className={styles.auditAction}>{item.action}</p>
                    <span className={styles.auditTime}>
                      {new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Open Escalations Widget */}
          {escalations.length > 0 && (
            <div className={styles.escalationWarningBox}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color="#b91c1c" />
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#b91c1c' }}>
                  {t('clerk.activeEscalationsCount', {
                    count: escalations.length,
                    state: assignedState,
                    defaultValue: `${escalations.length} Active Escalation(s) in ${assignedState}`
                  })}
                </span>
              </div>
              <Link to="/clerk/escalations" className={styles.escalationLink}>
                {t('clerk.reviewTickets', 'Review Tickets →')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
