import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  Search,
  Filter,
  ArrowUpDown,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  MapPin,
  FileText,
  UserCheck,
  CheckCircle,
  XCircle,
  AlertTriangle,
  X,
  Eye,
  Send,
  Building2,
  FileSearch,
  Check,
  CheckCheck,
  ExternalLink,
  CreditCard,
  Maximize2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import useAuthStore from '../../store/authStore'
import { applicationsApi } from '../../api/applications'
import { documentsApi } from '../../api/documents'
import { STATUS_CONFIG } from '../../utils/constants'
import styles from './ClerkApplications.module.css'

const formatServiceName = (name, id = '', t) => {
  if (id && t) {
    const key = `services.${id}.name`
    const translated = t(key, '')
    if (translated && translated !== key) return translated
  }
  if (!name) return (id || '').replace(/_/g, ' ')
  if (typeof name === 'object') return name.en || Object.values(name)[0] || id
  return String(name).replace(/_/g, ' ')
}

const STATUS_FILTERS = [
  { id: 'SUBMITTED', labelKey: 'submittedQueue', label: 'Submitted (Queue)' },
  { id: 'UNDER_REVIEW', labelKey: 'underReview', label: 'Under Review' },
  { id: 'ESCALATED', labelKey: 'escalations', label: 'Escalations' },
  { id: 'PAYMENT_REQUIRED', labelKey: 'paymentRequired', label: 'Payment Required' },
  { id: 'CORRECTION_NEEDED', labelKey: 'correctionNeeded', label: 'Correction Needed' },
  { id: 'DISTRICT_OFFICER_APPROVAL', labelKey: 'districtOfficerApproval', label: 'District Officer Approval' },
  { id: 'ALL', labelKey: 'allApplications', label: 'All Applications' },
]

export default function ClerkApplications() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const assignedState = user?.state || 'Maharashtra'
  const queryClient = useQueryClient()

  const [searchParams, setSearchParams] = useSearchParams()
  const initialStatus = searchParams.get('status') || 'SUBMITTED'

  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [searchTerm, setSearchTerm] = useState('')
  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const limit = 15

  // Modals state
  const [assignModalApp, setAssignModalApp] = useState(null) // App to confirm review assignment
  const [assigning, setAssigning] = useState(false)
  const [selectedAppId, setSelectedAppId] = useState(null) // App to view/review
  const [enlargedDoc, setEnlargedDoc] = useState(null) // Document preview popup

  // Decision state inside Review Modal
  const [activeDecisionType, setActiveDecisionType] = useState(null)
  const [decisionNotes, setDecisionNotes] = useState('')

  // Current date formatting helper
  const currentLang = i18n.language || 'en'
  const localeMap = {
    hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN', te: 'te-IN', ta: 'ta-IN',
    gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', en: 'en-IN'
  }
  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString(localeMap[currentLang] || 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString(localeMap[currentLang] || 'en-IN')
  }

  // 1. Query applications list
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['clerk-apps-list', assignedState, statusFilter, serviceFilter, searchTerm, sortBy, page],
    queryFn: () =>
      applicationsApi.getAdminList({
        state: assignedState,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        service_id: serviceFilter !== 'ALL' ? serviceFilter : undefined,
        search: searchTerm.trim() || undefined,
        sort_by: sortBy,
        page,
        limit,
      }),
    refetchInterval: 10000,
  })

  // 2. Query services for filter dropdown
  const { data: servicesData } = useQuery({
    queryKey: ['services-list'],
    queryFn: applicationsApi.listServices,
  })

  // 3. Query details for selected application in Information Modal
  const { data: appDetail, isLoading: detailLoading, refetch: refetchDetail } = useQuery({
    queryKey: ['clerk-app-detail', selectedAppId],
    queryFn: () => applicationsApi.getAdminDetail(selectedAppId),
    enabled: !!selectedAppId,
  })

  const applications = data?.applications || []
  const total = data?.total || 0
  const totalPages = data?.total_pages || 1
  const statusCounts = data?.status_counts || {}

  const handleStatusChange = (st) => {
    setStatusFilter(st)
    setPage(1)
    if (st === 'ALL') {
      searchParams.delete('status')
    } else {
      searchParams.set('status', st)
    }
    setSearchParams(searchParams)
  }

  // Confirm assigning application to current clerk
  const handleConfirmAssign = async () => {
    if (!assignModalApp) return
    setAssigning(true)
    const toastId = toast.loading(t('clerk.assigning', 'Assigning application to your review...'))
    try {
      const idOrNumber = assignModalApp.application_number || assignModalApp.id
      await applicationsApi.assignApplication(idOrNumber)
      toast.success(t('clerk.assignedSuccess', 'Application assigned under your review!'), { id: toastId })
      setAssignModalApp(null)
      queryClient.invalidateQueries(['clerk-apps-list'])
      queryClient.invalidateQueries(['clerk-overview'])
      handleStatusChange('UNDER_REVIEW')
    } catch (err) {
      toast.error(err.message || 'Failed to assign application', { id: toastId })
    } finally {
      setAssigning(false)
    }
  }

  // Document verification mutation
  const verifyDocMutation = useMutation({
    mutationFn: ({ docId, status }) => {
      const idOrNumber = appDetail?.application?.application_number || appDetail?.application?.id || selectedAppId
      return documentsApi.verifyDocument(idOrNumber, docId, status)
    },
    onSuccess: (data, vars) => {
      toast.success(`Document marked as ${vars.status}`)
      queryClient.invalidateQueries(['clerk-app-detail', selectedAppId])
      queryClient.invalidateQueries(['clerk-apps-list'])
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update document verification status')
    },
  })

  // Fast verify all documents handler
  const handleVerifyAllDocs = async () => {
    const docs = appDetail?.documents || []
    const unverified = docs.filter((d) => d.verification_status !== 'VERIFIED')
    if (unverified.length === 0) {
      toast.success('All documents are already verified.')
      return
    }
    const idOrNumber = appDetail?.application?.application_number || appDetail?.application?.id || selectedAppId
    const toastId = toast.loading(`Verifying ${unverified.length} documents...`)
    try {
      for (const d of unverified) {
        await documentsApi.verifyDocument(idOrNumber, d.id, 'VERIFIED')
      }
      toast.success('All supporting documents marked as VERIFIED!', { id: toastId })
      queryClient.invalidateQueries(['clerk-app-detail', selectedAppId])
      queryClient.invalidateQueries(['clerk-apps-list'])
    } catch (err) {
      toast.error(err.message || 'Failed to verify some documents', { id: toastId })
    }
  }

  // Decision mutation inside review viewer
  const decisionMutation = useMutation({
    mutationFn: ({ idOrNumber, decision, reason, adminNotes }) =>
      applicationsApi.submitDecision(idOrNumber, decision, reason, adminNotes),
    onSuccess: (res, vars) => {
      const msg =
        vars.decision === 'CORRECTION_NEEDED'
          ? 'Corrections requested from citizen.'
          : vars.decision === 'PAYMENT_REQUIRED'
          ? 'Documents approved! Status updated to Payment Required.'
          : vars.decision === 'VALIDATE_PAYMENT_FORWARD_DISTRICT' || vars.decision === 'DISTRICT_OFFICER_APPROVAL'
          ? 'Payment validated & forwarded to District Officer for approval.'
          : vars.decision === 'REJECT'
          ? 'Application rejected.'
          : 'Decision processed successfully.'
      toast.success(msg)
      queryClient.invalidateQueries(['clerk-apps-list'])
      queryClient.invalidateQueries(['clerk-overview'])
      refetchDetail()
      setActiveDecisionType(null)
      setDecisionNotes('')
    },
    onError: (err) => {
      toast.error(err.message || 'Decision action failed')
    },
  })

  const handleExecuteDecision = (decisionType) => {
    if ((decisionType === 'CORRECTION_NEEDED' || decisionType === 'REJECT') && !decisionNotes.trim()) {
      toast.error(decisionType === 'REJECT' ? 'Please provide a reason for rejection.' : 'Please provide details for the requested correction.')
      return
    }
    if (decisionType === 'PAYMENT_REQUIRED') {
      const docs = appDetail?.documents || []
      const unverified = docs.filter((d) => d.verification_status !== 'VERIFIED')
      if (unverified.length > 0) {
        toast.error(`All supporting documents must be marked VERIFIED before requesting payment (${unverified.length} pending).`)
        return
      }
    }
    if (decisionType === 'VALIDATE_PAYMENT_FORWARD_DISTRICT') {
      const isPaid = appDetail?.application?.payment_status === 'PAID' || appDetail?.application?.payment_status === 'SUCCESS'
      if (!isPaid) {
        toast.error('Citizen has not completed statutory payment yet.')
        return
      }
    }
    const idOrNumber = appDetail?.application?.application_number || appDetail?.application?.id || selectedAppId
    decisionMutation.mutate({
      idOrNumber,
      decision: decisionType,
      reason: decisionNotes.trim(),
      adminNotes: decisionNotes.trim(),
    })
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className={styles.headerTag}>
            <MapPin size={13} color="#15803d" />
            <span>{t('clerk.stateWorkstation', { state: assignedState, defaultValue: `${assignedState} State Workstation` })}</span>
          </div>
          <h1 className={styles.title}>{t('clerk.revenueApplications', 'Applications Directory')}</h1>
          <p className={styles.subtitle}>
            {t('clerk.applicationsHeaderSub', {
              state: assignedState,
              defaultValue: `Citizen applications originating from ${assignedState} jurisdiction.`
            })}
          </p>
        </div>
        <button
          className={styles.refreshBtn}
          onClick={() => refetch()}
          disabled={isFetching}
          title={t('clerk.refreshTooltip', 'Refresh applications')}
        >
          <RefreshCw size={16} className={isFetching ? styles.spin : ''} />
          <span>{t('clerk.refresh', 'Refresh')}</span>
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className={styles.tabsWrapper}>
        <div className={styles.tabsList}>
          {STATUS_FILTERS.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tabBtn} ${statusFilter === tab.id ? styles.activeTab : ''}`}
              onClick={() => handleStatusChange(tab.id)}
            >
              <span>{t(`clerk.${tab.labelKey}`, t(`common.${tab.labelKey}`, tab.label))}</span>
              {statusCounts[tab.id] !== undefined && (
                <span className={styles.tabBadge}>{statusCounts[tab.id]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search and Secondary Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t('clerk.searchPlaceholder', 'Search by Tracking ID, citizen name, phone, or Aadhaar...')}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <div className={styles.selectGroup}>
          <div className={styles.filterItem}>
            <Filter size={15} color="#64748b" />
            <select
              className={styles.selectInput}
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="ALL">{t('clerk.allServices', 'All Services')}</option>
              {(servicesData?.services || []).map((srv) => (
                <option key={srv.id} value={srv.id}>
                  {formatServiceName(srv.name, srv.id, t)}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterItem}>
            <ArrowUpDown size={15} color="#64748b" />
            <select
              className={styles.selectInput}
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value)
                setPage(1)
              }}
            >
              <option value="newest">{t('clerk.newestFirst', 'Newest First')}</option>
              <option value="oldest">{t('clerk.oldestFirst', 'Oldest First')}</option>
              <option value="readiness">{t('clerk.readinessSort', 'Readiness (High to Low)')}</option>
              <option value="updated">{t('clerk.recentlyUpdated', 'Recently Updated')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Applications Table */}
      <div className={styles.tableCard}>
        {isLoading ? (
          <div className={styles.loadingBox}>
            <RefreshCw size={24} className={styles.spin} color="#15803d" />
            <p>{t('clerk.loadingApplicationsState', { state: assignedState, defaultValue: `Loading applications for ${assignedState}...` })}</p>
          </div>
        ) : applications.length === 0 ? (
          <div className={styles.emptyBox}>
            <FileCheck size={40} color="#94a3b8" />
            <p className={styles.emptyTitle}>{t('clerk.noAppsFoundState', { state: assignedState, defaultValue: `No applications found in ${assignedState}` })}</p>
            <p className={styles.emptySubtitle}>{t('clerk.tryChangingFilter', 'Try changing the status filter or search keywords.')}</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('clerk.colTrackingId', 'Tracking ID')}</th>
                <th>{t('clerk.colCitizenDetails', 'Citizen Details')}</th>
                <th>{t('clerk.colServiceType', 'Service Name')}</th>
                <th>{t('clerk.colAssignedState', 'Jurisdiction')}</th>
                <th>{t('clerk.colCurrentStatus', 'Status')}</th>
                <th>{t('clerk.colAssignedClerk', 'Assigned To')}</th>
                <th>{t('clerk.colRiskLevel', 'Risk Level')}</th>
                <th>{t('clerk.colSubmittedDate', 'Submitted')}</th>
                <th>{t('clerk.colAction', 'Action')}</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => {
                const conf = STATUS_CONFIG[app.status] || {
                  label: app.status,
                  color: '#475569',
                  bg: '#f1f5f9',
                }

                const isSubmitted = app.status === 'SUBMITTED' || app.status === 'SUBMITTED_FOR_VERIFICATION'

                return (
                  <tr key={app.id}>
                    <td>
                      <span className={styles.trackingId}>
                        {app.tracking_id || app.application_number}
                      </span>
                    </td>
                    <td>
                      <div className={styles.citizenCell}>
                        <span className={styles.citizenName}>
                          {app.applicant_name || app.citizen_name || 'Citizen'}
                        </span>
                        <span className={styles.citizenRef}>{app.citizen_ref}</span>
                      </div>
                    </td>
                    <td>
                      <span className={styles.serviceName}>
                        {formatServiceName(app.service_name, app.service_id, t)}
                      </span>
                    </td>
                    <td>
                      <span className={styles.stateBadge}>
                        <MapPin size={11} />
                        {app.state || assignedState}
                      </span>
                    </td>
                    <td>
                      <span
                        className={styles.statusBadge}
                        style={{ color: conf.color, backgroundColor: conf.bg }}
                      >
                        {conf.label || app.status}
                      </span>
                    </td>
                    <td>
                      {app.assigned_to ? (
                        <span className={styles.assignedBadge}>
                          <UserCheck size={11} />
                          {app.assigned_to === user?.username ? t('clerk.you', 'You') : app.assigned_to}
                        </span>
                      ) : (
                        <span className={styles.unassignedBadge}>{t('clerk.unassigned', 'Unassigned')}</span>
                      )}
                    </td>
                    <td>
                      {app.risk_level ? (
                        <span
                          className={`${styles.riskBadge} ${
                            app.risk_level === 'HIGH'
                              ? styles.riskHigh
                              : app.risk_level === 'MEDIUM'
                              ? styles.riskMedium
                              : styles.riskLow
                          }`}
                        >
                          {app.risk_level}
                        </span>
                      ) : (
                        <span className={styles.scoreNull}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={styles.dateText}>
                        {formatDate(app.submitted_at)}
                      </span>
                    </td>
                    <td>
                      {(isSubmitted || app.status === 'ESCALATED') && !app.assigned_to ? (
                        <button
                          className={styles.reviewAssignBtn}
                          onClick={() => setAssignModalApp(app)}
                          title={t('clerk.assignModalTitle', 'Assign application under your review')}
                        >
                          {t('clerk.review', 'Review')}
                        </button>
                      ) : (
                        <button
                          className={styles.viewInfoBtn}
                          onClick={() => setSelectedAppId(app.application_number || app.id)}
                          title={t('clerk.review', 'Review application')}
                        >
                          <FileSearch size={13} />
                          <span>{t('clerk.review', 'Review')}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>
            {t('clerk.paginationText', {
              start: (page - 1) * limit + 1,
              end: Math.min(page * limit, total),
              total,
              defaultValue: `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total} applications`
            })}
          </span>
          <div className={styles.pageBtns}>
            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft size={16} />
              <span>{t('clerk.previous', 'Previous')}</span>
            </button>
            <span className={styles.pageNumber}>
              {t('clerk.pageOf', { current: page, total: totalPages, defaultValue: `Page ${page} of ${totalPages}` })}
            </span>
            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <span>{t('clerk.next', 'Next')}</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── ASSIGNMENT CONFIRMATION POPUP ── */}
      {assignModalApp && (
        <div className={styles.modalOverlay} onClick={() => !assigning && setAssignModalApp(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIconWrap}>
              <UserCheck size={28} color="#15803d" />
            </div>
            <h3 className={styles.confirmTitle}>{t('clerk.assignModalTitle', 'Assign Application')}</h3>
            <p className={styles.confirmText}>
              {t('clerk.assignModalQuestion', 'Are you sure you want to assign this application under your review?')}
            </p>

            <div className={styles.confirmAppDetails}>
              <div className={styles.confirmRow}>
                <span className={styles.confirmRowLabel}>{t('clerk.modalTrackingId', 'Tracking ID:')}</span>
                <span className={styles.confirmRowVal}>{assignModalApp.tracking_id || assignModalApp.application_number}</span>
              </div>
              <div className={styles.confirmRow}>
                <span className={styles.confirmRowLabel}>{t('clerk.modalApplicant', 'Applicant:')}</span>
                <span className={styles.confirmRowVal}>{assignModalApp.applicant_name || assignModalApp.citizen_name || 'Citizen'}</span>
              </div>
              <div className={styles.confirmRow}>
                <span className={styles.confirmRowLabel}>{t('clerk.modalService', 'Service:')}</span>
                <span className={styles.confirmRowVal}>{formatServiceName(assignModalApp.service_name, assignModalApp.service_id, t)}</span>
              </div>
            </div>

            <div className={styles.confirmActions}>
              <button
                className={styles.noBtn}
                onClick={() => setAssignModalApp(null)}
                disabled={assigning}
              >
                {t('common.no', 'No')}
              </button>
              <button
                className={styles.yesBtn}
                onClick={handleConfirmAssign}
                disabled={assigning}
              >
                {assigning ? (
                  <>
                    <RefreshCw size={14} className={styles.spin} />
                    <span>{t('clerk.assigning', 'Assigning…')}</span>
                  </>
                ) : (
                  t('common.yes', 'Yes')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── APPLICATION REVIEW MODAL (UNDER REVIEW & DETAILS) ── */}
      {selectedAppId && (
        <div className={styles.modalOverlay} onClick={() => setSelectedAppId(null)}>
          <div className={styles.infoModal} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className={styles.infoModalHeader}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 className={styles.infoModalTitle}>
                    {t('clerk.reviewModalHeader', {
                      trackingId: appDetail?.application?.tracking_id || selectedAppId,
                      defaultValue: `Application Review: ${appDetail?.application?.tracking_id || selectedAppId}`
                    })}
                  </h2>
                  {appDetail?.application?.status && (
                    <span
                      className={styles.statusBadge}
                      style={{
                        color: STATUS_CONFIG[appDetail.application.status]?.color,
                        backgroundColor: STATUS_CONFIG[appDetail.application.status]?.bg,
                      }}
                    >
                      {STATUS_CONFIG[appDetail.application.status]?.label || appDetail.application.status}
                    </span>
                  )}
                </div>
                <p className={styles.infoModalSub}>
                  {t('clerk.assignedClerkLabel', 'Assigned Desk Clerk:')} <strong>{appDetail?.application?.assigned_to || user?.username || t('clerk.you', 'You')}</strong> · {t('clerk.jurisdictionStateIndicator', { state: assignedState, defaultValue: `Jurisdiction: ${assignedState} State` })}
                </p>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setSelectedAppId(null)}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className={styles.infoModalBody}>
              {detailLoading ? (
                <div className={styles.loadingBox}>
                  <RefreshCw size={24} className={styles.spin} color="#15803d" />
                  <p>{t('clerk.loadingApplications', 'Loading application information...')}</p>
                </div>
              ) : !appDetail ? (
                <div className={styles.emptyBox}>
                  <AlertTriangle size={32} color="#dc2626" />
                  <p>{t('officer.appNotFound', 'Unable to load details for this application.')}</p>
                </div>
              ) : (
                <>
                  {/* Section 1: Citizen Profile */}
                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionHeading}>
                      <UserCheck size={16} color="#15803d" />
                      {t('clerk.citizenProfileHeading', 'Citizen Profile & Overview')}
                    </h3>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoField}>
                        <span className={styles.fieldLabel}>{t('clerk.applicantName', 'Applicant Name')}</span>
                        <span className={styles.fieldVal}>{appDetail.citizen?.name || 'Citizen'}</span>
                      </div>
                      <div className={styles.infoField}>
                        <span className={styles.fieldLabel}>{t('clerk.mobileNumber', 'Mobile Number')}</span>
                        <span className={styles.fieldVal}>{appDetail.citizen?.phone || '—'}</span>
                      </div>
                      <div className={styles.infoField}>
                        <span className={styles.fieldLabel}>{t('clerk.emailAddress', 'Email Address')}</span>
                        <span className={styles.fieldVal}>{appDetail.citizen?.email || '—'}</span>
                      </div>
                      <div className={styles.infoField}>
                        <span className={styles.fieldLabel}>{t('clerk.colAssignedState', 'Assigned State')}</span>
                        <span className={styles.fieldVal}>{appDetail.citizen?.state || assignedState}</span>
                      </div>
                      <div className={styles.infoField}>
                        <span className={styles.fieldLabel}>{t('clerk.nationalityLabel', 'Nationality')}</span>
                        <span className={styles.fieldVal}>{appDetail.citizen?.nationality || 'Indian'}</span>
                      </div>
                      <div className={styles.infoField}>
                        <span className={styles.fieldLabel}>{t('clerk.citizenRef', 'Citizen Reference')}</span>
                        <span className={styles.fieldVal}>{appDetail.application?.citizen_ref || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Service & Submission Details */}
                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionHeading}>
                      <Building2 size={16} color="#15803d" />
                      {t('clerk.serviceMetadataHeading', 'Service & Submission Metadata')}
                    </h3>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoField}>
                        <span className={styles.fieldLabel}>{t('clerk.serviceRequested', 'Service Requested')}</span>
                        <span className={styles.fieldVal}>{formatServiceName(appDetail.service?.name, appDetail.application?.service_id, t)}</span>
                      </div>
                      <div className={styles.infoField}>
                        <span className={styles.fieldLabel}>{t('clerk.department', 'Department')}</span>
                        <span className={styles.fieldVal}>{appDetail.service?.department || 'Revenue Department'}</span>
                      </div>
                      <div className={styles.infoField}>
                        <span className={styles.fieldLabel}>{t('clerk.colSubmittedDate', 'Submission Date')}</span>
                        <span className={styles.fieldVal}>
                          {formatDateTime(appDetail.application?.submitted_at)}
                        </span>
                      </div>
                      <div className={styles.infoField}>
                        <span className={styles.fieldLabel}>{t('clerk.statutoryFee', 'Statutory Fee')}</span>
                        <span className={styles.fieldVal}>₹{appDetail.application?.fee_amount || 50} ({appDetail.application?.payment_status || 'PENDING'})</span>
                      </div>
                      <div className={styles.infoField}>
                        <span className={styles.fieldLabel}>{t('clerk.anomalyRiskLevel', 'Anomaly Risk Level')}</span>
                        <span className={styles.fieldVal}>
                          {appDetail.fraud?.risk_level || 'LOW'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Declared Form Fields */}
                  <div className={styles.infoSection}>
                    <h3 className={styles.sectionHeading}>
                      <FileText size={16} color="#15803d" />
                      {t('clerk.applicantParticulars', 'Applicant Declared Information')}
                    </h3>
                    {Object.keys(appDetail.raw_slots || {}).length === 0 ? (
                      <p className={styles.noDataNotice}>{t('clerk.noFormDataDeclared', 'No form data declared for this application.')}</p>
                    ) : (
                      <div className={styles.infoGrid}>
                        {Object.entries(appDetail.raw_slots || {}).map(([key, val]) => (
                          <div key={key} className={styles.infoField}>
                            <span className={styles.fieldLabel}>{t(`formFields.${key}.label`, key.replace(/_/g, ' '))}</span>
                            <span className={styles.fieldVal}>{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 4: Uploaded Documents & Verification */}
                  <div className={styles.infoSection}>
                    <div className={styles.docsHeaderRow}>
                      <h3 className={styles.sectionHeading} style={{ margin: 0, border: 'none', padding: 0 }}>
                        <FileCheck size={16} color="#15803d" />
                        {t('clerk.documentVerificationHeading', 'Uploaded Documents & Verification')}
                      </h3>
                      {appDetail?.application?.status === 'UNDER_REVIEW' && (appDetail.documents || []).length > 0 && (
                        <button
                          type="button"
                          className={styles.verifyAllBtn}
                          onClick={handleVerifyAllDocs}
                          title={t('clerk.verifyAllDocuments', 'Mark all supporting documents as verified')}
                        >
                          <CheckCheck size={14} />
                          <span>{t('clerk.verifyAllDocuments', 'Verify All Documents')}</span>
                        </button>
                      )}
                    </div>

                    {(appDetail.documents || []).length === 0 ? (
                      <p className={styles.noDataNotice}>{t('clerk.noDocumentsAttached', 'No documents attached to this application.')}</p>
                    ) : (
                      <div className={styles.docsList}>
                        {appDetail.documents.map((doc) => {
                          const docFileName = doc.filename || doc.file_name || ''
                          const docImageUrl = documentsApi.getDocumentImageUrl(
                            appDetail?.application?.application_number || appDetail?.application?.id || selectedAppId,
                            doc.id
                          )
                          const isPdf = docFileName.toLowerCase().endsWith('.pdf') || (doc.file_ref && doc.file_ref.toLowerCase().endsWith('.pdf'))
                          const isVerified = doc.verification_status === 'VERIFIED'
                          const isRejected = doc.verification_status === 'REJECTED'

                          const rawConf = doc.confidence_score !== undefined && doc.confidence_score !== null ? doc.confidence_score : 95
                          const confScore = Math.round(rawConf <= 1.0 ? rawConf * 100 : rawConf)
                          const confLevel = confScore >= 85 ? 'HIGH' : confScore >= 70 ? 'MEDIUM' : 'LOW'
                          const confColor = confLevel === 'HIGH' ? '#15803d' : confLevel === 'MEDIUM' ? '#b45309' : '#b91c1c'
                          const confBg = confLevel === 'HIGH' ? '#f0fdf4' : confLevel === 'MEDIUM' ? '#fffbeb' : '#fef2f2'
                          const confBorder = confLevel === 'HIGH' ? '#bbf7d0' : confLevel === 'MEDIUM' ? '#fde68a' : '#fecaca'

                          const extractedEntries = Object.entries(doc.extracted_fields || {})
                            .filter(([k, v]) => v && typeof v !== 'object')
                            .slice(0, 10)

                          return (
                            <div key={doc.id} className={styles.docCard}>
                              {/* Card Header Bar */}
                              <div className={styles.docCardHeader}>
                                <div className={styles.docLeft}>
                                  <FileText size={20} color="#15803d" />
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <span className={styles.docTitle}>{doc.doc_type || 'Identity Document'}</span>
                                      {/* OCR Confidence Pill in Header */}
                                      <span
                                        className={styles.ocrConfidencePill}
                                        style={{
                                          color: confColor,
                                          backgroundColor: confBg,
                                          borderColor: confBorder,
                                        }}
                                        title={`Vision AI OCR Accuracy: ${confScore}% (${confLevel} Confidence)`}
                                      >
                                        <Sparkles size={11} />
                                        <span>{confScore}% {t('clerk.ocrConf', 'OCR Conf.')}</span>
                                      </span>
                                    </div>
                                    <span className={styles.docSub}>{docFileName || 'Attached document'}</span>
                                  </div>
                                </div>
                                <div className={styles.docRight}>
                                  {isVerified ? (
                                    <span className={styles.docVerifiedBadge}>
                                      <Check size={12} />
                                      {t('clerk.verifiedStatus', 'VERIFIED')}
                                    </span>
                                  ) : isRejected ? (
                                    <span className={styles.docRejectedBadge}>
                                      <X size={12} />
                                      {t('clerk.rejectedStatus', 'REJECTED')}
                                    </span>
                                  ) : (
                                    <span className={styles.docPendingBadge}>
                                      <AlertTriangle size={12} />
                                      {doc.verification_status || t('clerk.pendingStatus', 'PENDING')}
                                    </span>
                                  )}

                                  {/* Inline verification actions for Clerk */}
                                  <div style={{ display: 'flex', gap: 6, marginLeft: 6 }}>
                                    {!isVerified && (
                                      <button
                                        type="button"
                                        className={styles.docVerifyBtn}
                                        onClick={() => verifyDocMutation.mutate({ docId: doc.id, status: 'VERIFIED' })}
                                        disabled={verifyDocMutation.isPending}
                                        title={t('clerk.verify', 'Verify')}
                                      >
                                        <Check size={12} />
                                        <span>{t('clerk.verify', 'Verify')}</span>
                                      </button>
                                    )}
                                    {!isRejected && (
                                      <button
                                        type="button"
                                        className={styles.docRejectBtn}
                                        onClick={() => verifyDocMutation.mutate({ docId: doc.id, status: 'REJECTED' })}
                                        disabled={verifyDocMutation.isPending}
                                        title={t('clerk.reject', 'Reject')}
                                      >
                                        <X size={12} />
                                        <span>{t('clerk.reject', 'Reject')}</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Document Visual Preview directly below document name */}
                              <div className={styles.docPreviewSection}>
                                <div className={styles.docPreviewLabel}>
                                  <Eye size={13} />
                                  <span>{t('clerk.documentPreview', 'Document Preview')}</span>
                                </div>

                                <div className={styles.docPreviewContent}>
                                  {isPdf ? (
                                    <div className={styles.docPdfContainer}>
                                      <object
                                        data={docImageUrl}
                                        type="application/pdf"
                                        className={styles.docPdfObject}
                                      >
                                        <div className={styles.pdfFallback}>
                                          <FileText size={28} color="#64748b" />
                                          <p>{t('clerk.pdfPreviewLoaded', 'PDF preview loaded. Use button below to view document.')}</p>
                                          <a
                                            href={docImageUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={styles.openDocBtn}
                                          >
                                            <ExternalLink size={13} />
                                            <span>{t('clerk.openPdfFullWindow', 'Open PDF in Full Window')}</span>
                                          </a>
                                        </div>
                                      </object>
                                    </div>
                                  ) : (
                                    <div className={styles.docImageWrapper}>
                                      <img
                                        src={docImageUrl}
                                        alt={doc.doc_type || 'Uploaded document'}
                                        className={styles.docPreviewImg}
                                        onClick={() => setEnlargedDoc({ url: docImageUrl, title: doc.doc_type || docFileName })}
                                        title={t('clerk.enlargePreview', 'Click to enlarge preview')}
                                        onError={(e) => {
                                          e.target.style.display = 'none'
                                          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'
                                        }}
                                      />
                                      <div className={styles.docPreviewFallback} style={{ display: 'none' }}>
                                        <FileText size={22} color="#94a3b8" />
                                        <span>Preview unavailable or document placeholder.</span>
                                      </div>
                                    </div>
                                  )}

                                  <div className={styles.docControlButtons}>
                                    {!isPdf && (
                                      <button
                                        type="button"
                                        className={styles.zoomDocBtn}
                                        onClick={() => setEnlargedDoc({ url: docImageUrl, title: doc.doc_type || docFileName })}
                                      >
                                        <Maximize2 size={13} />
                                        <span>{t('clerk.enlargePreview', 'Enlarge Preview')}</span>
                                      </button>
                                    )}
                                    <a
                                      href={docImageUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={styles.openDocBtn}
                                    >
                                      <ExternalLink size={13} />
                                      <span>{t('clerk.openNewTab', 'Open in New Tab')}</span>
                                    </a>
                                  </div>

                                  {/* OCR Extracted fields summary with Confidence Indicator */}
                                  {extractedEntries.length > 0 && (
                                    <div className={styles.ocrSummaryBox}>
                                      <div className={styles.ocrSummaryHeader}>
                                        <div className={styles.ocrSummaryTitleGroup}>
                                          <Sparkles size={13} color={confColor} />
                                          <span className={styles.ocrSummaryTitle}>{t('clerk.ocrExtractedFields', 'OCR Extracted Fields')}</span>
                                        </div>
                                        <div className={styles.ocrConfidenceMeter}>
                                          <span className={styles.ocrConfidenceMeterLabel}>{t('clerk.modelConfidence', 'Model Confidence:')}</span>
                                          <span className={styles.ocrConfidenceMeterVal} style={{ color: confColor }}>
                                            {confScore}%
                                          </span>
                                          <div className={styles.ocrMiniBarTrack}>
                                            <div
                                              className={styles.ocrMiniBarFill}
                                              style={{ width: `${Math.min(confScore, 100)}%`, backgroundColor: confColor }}
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      <div className={styles.ocrChipsGrid}>
                                        {extractedEntries.map(([k, v]) => {
                                          const fieldConfRaw = doc.normalization_confidence?.[k]
                                          const fieldConf = fieldConfRaw !== undefined
                                            ? Math.round(fieldConfRaw <= 1.0 ? fieldConfRaw * 100 : fieldConfRaw)
                                            : null

                                          return (
                                            <div key={k} className={styles.ocrChip}>
                                              <span className={styles.ocrChipKey}>{t(`formFields.${k}.label`, k.replace(/_/g, ' '))}:</span>
                                              <span className={styles.ocrChipVal}>{String(v)}</span>
                                              {fieldConf !== null && (
                                                <span
                                                  className={styles.ocrFieldConfidenceTag}
                                                  style={{
                                                    color: fieldConf >= 85 ? '#15803d' : fieldConf >= 70 ? '#b45309' : '#b91c1c',
                                                    backgroundColor: fieldConf >= 85 ? '#dcfce7' : fieldConf >= 70 ? '#fef3c7' : '#fee2e2',
                                                  }}
                                                  title={`Field extraction confidence: ${fieldConf}%`}
                                                >
                                                  {fieldConf}%
                                                </span>
                                              )}
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Section 5: Review Actions & Next Status */}
                  <div className={styles.actionsSection}>
                    <h3 className={styles.sectionHeading}>
                      <Send size={16} color="#15803d" />
                      {t('clerk.reviewActionsHeading', 'Review Actions & Next Status')}
                    </h3>

                    {activeDecisionType ? (
                      <div className={styles.decisionFormBox}>
                        <div className={styles.decisionFormHeader}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                            {activeDecisionType === 'CORRECTION_NEEDED'
                              ? t('clerk.requestCorrection', 'Request Citizen Correction')
                              : activeDecisionType === 'PAYMENT_REQUIRED'
                              ? t('clerk.approveRequirePayment', 'Approve Documents & Require Payment')
                              : activeDecisionType === 'VALIDATE_PAYMENT_FORWARD_DISTRICT' || activeDecisionType === 'DISTRICT_OFFICER_APPROVAL'
                              ? t('clerk.validatePaymentForward', 'Validate Payment & Forward to District Officer')
                              : t('clerk.statutoryRejection', 'Statutory Rejection')}
                          </span>
                          <button
                            type="button"
                            className={styles.cancelActionBtn}
                            onClick={() => {
                              setActiveDecisionType(null)
                              setDecisionNotes('')
                            }}
                          >
                            {t('common.cancel', 'Cancel')}
                          </button>
                        </div>

                        <textarea
                          className={styles.decisionTextarea}
                          rows={3}
                          placeholder={
                            activeDecisionType === 'CORRECTION_NEEDED'
                              ? 'Specify which documents or information the citizen needs to update...'
                              : activeDecisionType === 'PAYMENT_REQUIRED'
                              ? 'Notes for citizen regarding verified documents and payment...'
                              : activeDecisionType === 'VALIDATE_PAYMENT_FORWARD_DISTRICT' || activeDecisionType === 'DISTRICT_OFFICER_APPROVAL'
                              ? 'Add summary verification notes for the District Officer...'
                              : 'Provide statutory reason for rejection...'
                          }
                          value={decisionNotes}
                          onChange={(e) => setDecisionNotes(e.target.value)}
                        />

                        <button
                          type="button"
                          className={
                            activeDecisionType === 'REJECT'
                              ? styles.executeRejectBtn
                              : activeDecisionType === 'CORRECTION_NEEDED'
                              ? styles.executeCorrectionBtn
                              : styles.executePaymentBtn
                          }
                          onClick={() => handleExecuteDecision(activeDecisionType)}
                          disabled={decisionMutation.isPending}
                        >
                          {decisionMutation.isPending ? (
                            <>
                              <RefreshCw size={14} className={styles.spin} />
                              <span>{t('common.processing', 'Processing...')}</span>
                            </>
                          ) : (
                            <span>{t('clerk.confirmUpdateStatus', 'Confirm & Update Status')}</span>
                          )}
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* PHASE 1: UNDER REVIEW (DOCUMENT VERIFICATION) */}
                        {appDetail?.application?.status === 'UNDER_REVIEW' && (() => {
                          const docs = appDetail.documents || []
                          const verifiedCount = docs.filter((d) => d.verification_status === 'VERIFIED').length
                          const allDocsVerified = docs.length > 0 && verifiedCount === docs.length

                          return (
                            <div>
                              {!allDocsVerified ? (
                                <div className={styles.noticeAlert}>
                                  <AlertTriangle size={16} />
                                  <span>
                                    {t('clerk.docVerificationPendingAlert', {
                                      verified: verifiedCount,
                                      total: docs.length,
                                      defaultValue: `Document Verification Pending: ${verifiedCount} of ${docs.length} supporting documents are marked as VERIFIED.`
                                    })}
                                  </span>
                                </div>
                              ) : (
                                <div className={styles.noticeSuccess}>
                                  <CheckCircle size={16} />
                                  <span>
                                    {t('clerk.allDocsVerifiedAlert', {
                                      total: docs.length,
                                      defaultValue: `All Documents Verified: All ${docs.length} supporting documents have been verified by you.`
                                    })}
                                  </span>
                                </div>
                              )}

                              <div className={styles.decisionButtonsRow}>
                                <button
                                  type="button"
                                  className={styles.actionBtnPayment}
                                  onClick={() => {
                                    setActiveDecisionType('PAYMENT_REQUIRED')
                                    setDecisionNotes('All supporting documents verified. Statutory fee payment required.')
                                  }}
                                  disabled={!allDocsVerified}
                                  title={allDocsVerified ? 'Approve documents and request statutory payment' : 'Verify all documents above first'}
                                >
                                  <CreditCard size={15} />
                                  <span>{t('clerk.approveRequirePayment', 'Approve Documents & Require Payment')}</span>
                                </button>

                                <button
                                  type="button"
                                  className={styles.actionBtnCorrection}
                                  onClick={() => {
                                    setActiveDecisionType('CORRECTION_NEEDED')
                                    setDecisionNotes('')
                                  }}
                                >
                                  <AlertTriangle size={15} />
                                  <span>{t('clerk.correctionNeeded', 'Correction Needed')}</span>
                                </button>

                                <button
                                  type="button"
                                  className={styles.actionBtnReject}
                                  onClick={() => {
                                    setActiveDecisionType('REJECT')
                                    setDecisionNotes('')
                                  }}
                                >
                                  <XCircle size={15} />
                                  <span>{t('clerk.reject', 'Reject')}</span>
                                </button>
                              </div>
                            </div>
                          )
                        })()}

                        {/* PHASE 2: PAYMENT REQUIRED (PENDING PAYMENT OR VALIDATE PAYMENT) */}
                        {appDetail?.application?.status === 'PAYMENT_REQUIRED' && (() => {
                          const isPaid = appDetail.application?.payment_status === 'PAID' || appDetail.application?.payment_status === 'SUCCESS'
                          const feeAmount = appDetail.application?.fee_amount || 50

                          return (
                            <div>
                              <div className={styles.paymentCard}>
                                <div className={styles.paymentCardHeader}>
                                  <span className={styles.paymentCardTitle}>
                                    <CreditCard size={16} color="#15803d" />
                                    {t('clerk.statutoryFeeValidation', 'Statutory Fee Validation')}
                                  </span>
                                  {isPaid ? (
                                    <span className={styles.paymentStatusBadgePaid}>
                                      <Check size={13} />
                                      {t('clerk.paidStatusAmount', { amount: feeAmount, defaultValue: `PAID: ₹${feeAmount}` })}
                                    </span>
                                  ) : (
                                    <span className={styles.paymentStatusBadgePending}>
                                      <AlertTriangle size={13} />
                                      {t('clerk.pendingStatusAmount', { amount: feeAmount, defaultValue: `PAYMENT PENDING: ₹${feeAmount}` })}
                                    </span>
                                  )}
                                </div>
                                <p className={styles.paymentCardBody}>
                                  {isPaid
                                    ? t('clerk.paidCardBody', {
                                        amount: feeAmount,
                                        defaultValue: `Citizen has completed the statutory fee payment (₹${feeAmount}). You may now validate the payment receipt and forward this application to the District Officer for final certificate issuance.`
                                      })
                                    : t('clerk.pendingCardBody', {
                                        amount: feeAmount,
                                        defaultValue: `The citizen has been notified to pay the statutory fee of ₹${feeAmount} via their portal. Once payment is completed, you will be able to validate it here and approve the application for the District Officer.`
                                      })}
                                </p>
                              </div>

                              <div className={styles.decisionButtonsRow}>
                                <button
                                  type="button"
                                  className={styles.actionBtnPayment}
                                  onClick={() => {
                                    setActiveDecisionType('VALIDATE_PAYMENT_FORWARD_DISTRICT')
                                    setDecisionNotes('Payment validated by Desk Clerk. Forwarded to District Officer for final endorsement.')
                                  }}
                                  disabled={!isPaid}
                                  title={isPaid ? 'Validate payment and forward to District Officer' : 'Statutory fee has not been paid yet'}
                                >
                                  <ShieldCheck size={15} />
                                  <span>{t('clerk.validatePaymentForward', 'Validate Payment & Forward to District Officer')}</span>
                                </button>

                                <button
                                  type="button"
                                  className={styles.actionBtnCorrection}
                                  onClick={() => {
                                    setActiveDecisionType('CORRECTION_NEEDED')
                                    setDecisionNotes('')
                                  }}
                                >
                                  <AlertTriangle size={15} />
                                  <span>{t('clerk.correctionNeeded', 'Correction Needed')}</span>
                                </button>

                                <button
                                  type="button"
                                  className={styles.actionBtnReject}
                                  onClick={() => {
                                    setActiveDecisionType('REJECT')
                                    setDecisionNotes('')
                                  }}
                                >
                                  <XCircle size={15} />
                                  <span>{t('clerk.reject', 'Reject')}</span>
                                </button>
                              </div>
                            </div>
                          )
                        })()}

                        {/* PHASE 3: FORWARDED TO DISTRICT OFFICER */}
                        {appDetail?.application?.status === 'DISTRICT_OFFICER_APPROVAL' && (
                          <div className={styles.noticeInfo}>
                            <Building2 size={16} />
                            <span>
                              <strong>{t('clerk.forwardedDistrictOfficer', 'Forwarded to District Officer:')}</strong> {t('clerk.forwardedDistrictOfficerAlert', 'Payment has been validated by the Desk Clerk. This application is currently in the District Officer queue for final review and digital signature endorsement.')}
                            </span>
                          </div>
                        )}

                        {/* PHASE 4: CORRECTION NEEDED */}
                        {appDetail?.application?.status === 'CORRECTION_NEEDED' && (
                          <div>
                            <div className={styles.noticeAlert}>
                              <AlertTriangle size={16} />
                              <span>
                                <strong>{t('clerk.correctionNeeded', 'Correction Needed')}:</strong> {t('clerk.awaitingCitizenCorrectionsAlert', 'The citizen has been requested to provide updates.')} Reason: <em>{appDetail?.application?.validation_summary?.clarification_reason || 'Correction requested'}</em>
                              </span>
                            </div>

                            <div className={styles.decisionButtonsRow}>
                              <button
                                type="button"
                                className={styles.actionBtnForward}
                                onClick={() => {
                                  setActiveDecisionType('CORRECTION_NEEDED')
                                  setDecisionNotes(appDetail?.application?.validation_summary?.clarification_reason || '')
                                }}
                              >
                                <AlertTriangle size={15} />
                                <span>{t('clerk.updateCorrectionNotes', 'Update Correction Notes')}</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* OTHER STATUSES */}
                        {!['UNDER_REVIEW', 'PAYMENT_REQUIRED', 'DISTRICT_OFFICER_APPROVAL', 'CORRECTION_NEEDED'].includes(appDetail?.application?.status) && (
                          <div className={styles.decisionButtonsRow}>
                            <button
                              type="button"
                              className={styles.actionBtnCorrection}
                              onClick={() => {
                                setActiveDecisionType('CORRECTION_NEEDED')
                                setDecisionNotes('')
                              }}
                            >
                              <AlertTriangle size={15} />
                              <span>{t('clerk.correctionNeeded', 'Correction Needed')}</span>
                            </button>

                            <button
                              type="button"
                              className={styles.actionBtnReject}
                              onClick={() => {
                                setActiveDecisionType('REJECT')
                                setDecisionNotes('')
                              }}
                            >
                              <XCircle size={15} />
                              <span>{t('clerk.reject', 'Reject')}</span>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Document Image Modal */}
      {enlargedDoc && (
        <div className={styles.enlargeModalOverlay} onClick={() => setEnlargedDoc(null)}>
          <div className={styles.enlargeModalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.enlargeModalHeader}>
              <h4 className={styles.enlargeModalTitle}>{enlargedDoc.title}</h4>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setEnlargedDoc(null)}
                aria-label="Close enlarged preview"
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.enlargeModalBody}>
              <img src={enlargedDoc.url} alt={enlargedDoc.title} className={styles.enlargeImg} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
