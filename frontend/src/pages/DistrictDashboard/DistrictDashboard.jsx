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
  ShieldCheck,
  Building2,
  Calendar,
} from 'lucide-react'
import useAuthStore from '../../store/authStore'
import { dashboardApi } from '../../api/dashboard'
import { applicationsApi } from '../../api/applications'
import styles from './DistrictDashboard.module.css'

const getLocalizedServiceName = (serviceIdOrName, t) => {
  if (!serviceIdOrName) return ''
  const key = `services.${serviceIdOrName}.name`
  const translated = t(key, '')
  if (translated && translated !== key) return translated
  return String(serviceIdOrName).replace(/_/g, ' ')
}

export default function DistrictDashboard() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const assignedState = user?.state || 'Maharashtra'
  const officerName = user?.first_name
    ? `${user.first_name} ${user.last_name || ''}`.trim()
    : (user?.username || 'District Officer')

  // Query metrics scoped to this District Officer's state
  const {
    data: overview,
    isLoading: overviewLoading,
    refetch: refetchOverview,
    isFetching,
  } = useQuery({
    queryKey: ['district-overview', assignedState],
    queryFn: () => dashboardApi.getOverview(assignedState),
    refetchInterval: 12000,
  })

  // Query recent applications awaiting review in this state
  const { data: awaitingData, isLoading: awaitingLoading } = useQuery({
    queryKey: ['district-awaiting-apps', assignedState],
    queryFn: () =>
      applicationsApi.getAdminList({
        state: assignedState,
        status: 'SUBMITTED_FOR_VERIFICATION',
        limit: 5,
      }),
    refetchInterval: 12000,
  })

  // Query recent audit feed in this state
  const { data: auditData } = useQuery({
    queryKey: ['district-audit-feed', assignedState],
    queryFn: () => dashboardApi.getAuditLog(8, null, assignedState),
    refetchInterval: 12000,
  })

  // Query escalations in this state
  const { data: escalationData } = useQuery({
    queryKey: ['district-escalations', assignedState],
    queryFn: () => dashboardApi.getEscalations(assignedState),
    refetchInterval: 15000,
  })

  const totalApps = overview?.total_applications ?? 0
  const awaitingCount = overview?.submitted ?? (overview?.by_status?.SUBMITTED_FOR_VERIFICATION || 0)
  const clarificationCount = overview?.clarification_required ?? (overview?.by_status?.CLARIFICATION_REQUIRED || 0)
  const approvedCount = overview?.approved ?? (overview?.by_status?.APPROVED || 0)

  const awaitingList = awaitingData?.applications || []
  const auditEvents = auditData?.events || []
  const escalations = escalationData?.escalations || []

  // Current date formatted according to active locale
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
              <ShieldCheck size={14} />
              {t('district.districtOfficerWorkstation', 'District Officer Administration')}
            </span>
            <span className={styles.dateBadge}>
              <Calendar size={13} />
              {todayDate}
            </span>
          </div>

          <h1 className={styles.greetingTitle}>
            {t('district.greetingTitle', { name: officerName, defaultValue: `Namaste, ${officerName}!` })} <span className={styles.landmark}>🏛️</span>
          </h1>

          <p className={styles.greetingSubtitle}>
            {t('district.executiveOversightGreeting', {
              state: assignedState,
              defaultValue: `District Officer executive oversight for ${assignedState} State jurisdiction. Monitor state revenue compliance, review escalations, and manage regional application processing.`
            })}
          </p>

          <div className={styles.metaRow}>
            <div className={styles.metaChip}>
              <MapPin size={14} color="#1e40af" />
              <span>{t('clerk.assignedStateLabel', 'Assigned State:')} <strong>{assignedState}</strong></span>
            </div>
            <div className={styles.metaChip}>
              <Flag size={14} color="#ea580c" />
              <span>{t('clerk.nationalityLabel', 'Nationality:')} <strong>{user?.nationality || 'Indian'}</strong></span>
            </div>
            <div className={styles.metaChip}>
              <Building2 size={14} color="#0f294a" />
              <span>{t('district.jurisdictionDistrictOffice', 'Jurisdiction: District Executive Office')}</span>
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

      {/* ── METRIC CARDS (SCOPED TO ASSIGNED STATE) ── */}
      <div className={styles.metricsGrid}>
        <Link to="/district/applications" className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>{t('district.totalApplications', 'Total Applications')}</span>
            <div className={styles.metricIcon} style={{ background: '#dbeafe', color: '#1e40af' }}>
              <FileText size={18} />
            </div>
          </div>
          <div className={styles.metricCount} style={{ color: '#1e40af' }}>
            {overviewLoading ? '…' : totalApps}
          </div>
          <div className={styles.metricFooter}>
            <span>{t('district.allRecordsInState', { state: assignedState, defaultValue: `All records in ${assignedState}` })}</span>
            <ArrowRight size={13} />
          </div>
        </Link>

        <Link to="/district/applications" className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>{t('district.awaitingVerification', 'Awaiting Verification')}</span>
            <div className={styles.metricIcon} style={{ background: '#fef3c7', color: '#b45309' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className={styles.metricCount} style={{ color: '#b45309' }}>
            {overviewLoading ? '…' : awaitingCount}
          </div>
          <div className={styles.metricFooter}>
            <span>{t('district.stateQueueReview', 'State queue review')}</span>
            <ArrowRight size={13} />
          </div>
        </Link>

        <Link to="/district/applications" className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>{t('district.clarificationRequired', 'Clarification Required')}</span>
            <div className={styles.metricIcon} style={{ background: '#fee2e2', color: '#b91c1c' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className={styles.metricCount} style={{ color: '#b91c1c' }}>
            {overviewLoading ? '…' : clarificationCount}
          </div>
          <div className={styles.metricFooter}>
            <span>{t('district.pendingCitizenDocs', 'Pending citizen documents')}</span>
            <ArrowRight size={13} />
          </div>
        </Link>

        <Link to="/district/applications" className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>{t('district.approvedCompleted', 'Approved / Completed')}</span>
            <div className={styles.metricIcon} style={{ background: '#dcfce7', color: '#15803d' }}>
              <CheckCircle size={18} />
            </div>
          </div>
          <div className={styles.metricCount} style={{ color: '#15803d' }}>
            {overviewLoading ? '…' : approvedCount}
          </div>
          <div className={styles.metricFooter}>
            <span>{t('district.certifiedInState', { state: assignedState, defaultValue: `Certified in ${assignedState}` })}</span>
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
                {t('district.stateQueueOverview', { state: assignedState, defaultValue: `State Queue Overview (${assignedState})` })}
              </h2>
              <p className={styles.sectionSub}>{t('district.stateQueueSub', 'Citizen submissions requiring departmental verification.')}</p>
            </div>
            <Link to="/district/applications" className={styles.viewAllLink}>
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
                {t('district.complianceTrailTitle', { state: assignedState, defaultValue: `Executive Compliance Trail (${assignedState})` })}
              </h2>
              <p className={styles.sectionSub}>{t('district.complianceTrailSub', 'State Data Guard, verification actions, and consent logs.')}</p>
            </div>
            <Link to="/district/audit" className={styles.viewAllLink}>
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
                    <Shield size={14} color="#1e40af" />
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
                  {t('district.activeEscalations', {
                    count: escalations.length,
                    state: assignedState,
                    defaultValue: `${escalations.length} Active Escalation(s) in ${assignedState}`
                  })}
                </span>
              </div>
              <Link to="/district/escalations" className={styles.escalationLink}>
                {t('district.reviewTickets', 'Review Tickets →')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
