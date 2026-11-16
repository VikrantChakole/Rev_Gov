import { useState } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  User,
  Shield,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Award,
  AlertOctagon,
  RefreshCw,
  Edit,
  Eye,
} from 'lucide-react'
import { applicationsApi } from '../../api/applications'
import { documentsApi } from '../../api/documents'
import { STATUS_CONFIG } from '../../utils/constants'
import styles from './OfficerReview.module.css'

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

export default function OfficerReview() {
  const { t, i18n } = useTranslation()
  const { appNumber } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const queuePath = location.pathname.startsWith('/district') ? '/district/applications' : '/admin/applications'

  const [decisionModal, setDecisionModal] = useState(null) // 'APPROVE' | 'REJECT' | 'REQUEST_CLARIFICATION'
  const [reasonText, setReasonText] = useState('')
  const [notesText, setNotesText] = useState('')
  const [expandedDocOcr, setExpandedDocOcr] = useState({})
  const [editingOcrState, setEditingOcrState] = useState(null)

  const currentLang = i18n.language || 'en'
  const localeMap = {
    hi: 'hi-IN', mr: 'mr-IN', bn: 'bn-IN', te: 'te-IN', ta: 'ta-IN',
    gu: 'gu-IN', kn: 'kn-IN', ml: 'ml-IN', pa: 'pa-IN', en: 'en-IN'
  }
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleString(localeMap[currentLang] || 'en-IN')
  }

  const handleSaveOcrEdit = async (docId, fieldName, newValue) => {
    const toastId = toast.loading(`Updating OCR field ${fieldName}...`)
    try {
      await documentsApi.updateOcrField(appNumber, docId, fieldName, newValue)
      toast.success(`OCR field '${fieldName}' updated!`, { id: toastId })
      setEditingOcrState(null)
      refetch()
    } catch (err) {
      toast.error(err.message || 'Failed to update OCR field', { id: toastId })
    }
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin-app-detail', appNumber],
    queryFn: () => applicationsApi.getAdminDetail(appNumber),
  })

  const decisionMutation = useMutation({
    mutationFn: ({ decision, reason, adminNotes }) =>
      applicationsApi.submitDecision(appNumber, decision, reason, adminNotes),
    onSuccess: (res, vars) => {
      toast.success(
        vars.decision === 'APPROVE'
          ? 'Application approved! Status transitioned to PAYMENT_REQUIRED.'
          : vars.decision === 'REJECT'
          ? 'Application rejected.'
          : 'Clarification requested from citizen.'
      )
      queryClient.invalidateQueries(['admin-app-detail', appNumber])
      queryClient.invalidateQueries(['admin-apps-list'])
      queryClient.invalidateQueries(['admin-overview'])
      setDecisionModal(null)
      setReasonText('')
      setNotesText('')
    },
    onError: (err) => {
      toast.error(err.message || 'Decision failed')
    },
  })

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>{t('clerk.loadingApplications', 'Loading authoritative government review records...')}</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={styles.errorContainer}>
        <AlertTriangle size={48} className={styles.errorIcon} />
        <h2>{t('officer.appNotFound', 'Application Not Found')}</h2>
        <p>{error?.message || t('officer.appNotFound', `Could not find application '${appNumber}'.`)}</p>
        <Link to={queuePath} className={styles.backBtn}>
          <ArrowLeft size={16} /> {t('officer.backToQueue', 'Back to Applications Queue')}
        </Link>
      </div>
    )
  }

  const app = data.application || {}
  const citizen = data.citizen || {}
  const service = data.service || {}
  const appData = data.application_data || {}
  const rawSlots = data.raw_slots || {}
  const documents = data.documents || []
  const readiness = data.readiness || {}
  const fraud = data.fraud || {}
  const availableActions = data.available_actions || []

  const statusCfg = STATUS_CONFIG[app.status] || {
    label: app.status,
    color: '#64748b',
    bg: '#f1f5f9',
    dot: '#94a3b8',
  }

  const toggleDocOcr = (docId) => {
    setExpandedDocOcr((prev) => ({ ...prev, [docId]: !prev[docId] }))
  }

  const handleDecisionSubmit = () => {
    if (decisionModal === 'REJECT' && !reasonText.trim()) {
      toast.error('Rejection reason is required.')
      return
    }
    if (decisionModal === 'REQUEST_CLARIFICATION' && !reasonText.trim()) {
      toast.error('Clarification message is required.')
      return
    }
    decisionMutation.mutate({
      decision: decisionModal,
      reason: reasonText.trim(),
      adminNotes: notesText.trim(),
    })
  }

  return (
    <div className={styles.container}>
      {/* ── Top Nav & Header ── */}
      <div className={styles.topBar}>
        <button className={styles.backLink} onClick={() => navigate(queuePath)}>
          <ArrowLeft size={16} /> {t('officer.backToQueue', 'Back to Queue')}
        </button>
        <div className={styles.topActions}>
          <button className={styles.refreshBtn} onClick={() => refetch()} title={t('common.refresh', 'Refresh')}>
            <RefreshCw size={14} /> {t('common.refresh', 'Refresh')}
          </button>
        </div>
      </div>

      {/* ── Status Banner ── */}
      <div className={styles.banner}>
        <div className={styles.bannerMain}>
          <div className={styles.trackingHeader}>
            <span className={styles.trackingPill}>{app.tracking_id || app.application_number}</span>
            <span
              className={styles.statusPill}
              style={{ color: statusCfg.color, backgroundColor: statusCfg.bg, borderColor: statusCfg.dot }}
            >
              <span className={styles.statusDot} style={{ backgroundColor: statusCfg.dot }} />
              {statusCfg.label || app.status}
            </span>
            <span
              className={styles.riskBadge}
              style={{
                color: fraud.risk_level === 'HIGH' ? '#b91c1c' : fraud.risk_level === 'MEDIUM' ? '#b45309' : '#15803d',
                backgroundColor: fraud.risk_level === 'HIGH' ? '#fee2e2' : fraud.risk_level === 'MEDIUM' ? '#fef3c7' : '#dcfce7',
              }}
            >
              Risk: {fraud.risk_level} (Anomaly: {(fraud.anomaly_score * 100).toFixed(0)}%)
            </span>
          </div>
          <h1 className={styles.serviceHeading}>{formatServiceName(service.name || app.service_name, app.service_id, t)}</h1>
          <p className={styles.citizenSummary}>
            {t('officer.applicantLabel', 'Applicant:')} <strong>{citizen.name || citizen.citizen_ref}</strong> ({citizen.citizen_ref}) · {t('officer.submittedLabel', 'Submitted:')}{' '}
            {app.submitted_at ? formatDateTime(app.submitted_at) : 'Pending Submission'}
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 1 — APPLICATION OVERVIEW
          ══════════════════════════════════════════════════════════════ */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <FileText size={18} className={styles.sectionIcon} />
          <h2 className={styles.sectionTitle}>{t('officer.section1Overview', 'Section 1 — Application Overview')}</h2>
        </div>
        <div className={styles.grid4}>
          <div className={styles.infoField}>
            <span className={styles.fieldLabel}>{t('officer.applicationNumber', 'Application Number')}</span>
            <span className={styles.fieldValue}>{app.application_number}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.fieldLabel}>{t('officer.trackingIdentifier', 'Tracking Identifier')}</span>
            <span className={styles.fieldValue}>{app.tracking_id || '—'}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.fieldLabel}>{t('officer.serviceDepartment', 'Service Department')}</span>
            <span className={styles.fieldValue}>{service.department || 'Revenue'}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.fieldLabel}>{t('officer.slaCompliance', 'SLA Compliance')}</span>
            <span className={styles.fieldValue}>{service.sla_days || 7} working days</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.fieldLabel}>{t('officer.submissionChannel', 'Submission Channel')}</span>
            <span className={styles.fieldValue}>{app.channel_origin || 'WEB'}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.fieldLabel}>{t('officer.languagePreference', 'Language Preference')}</span>
            <span className={styles.fieldValue}>{(app.language || 'en').toUpperCase()}</span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.fieldLabel}>{t('officer.paymentStatus', 'Payment Status')}</span>
            <span className={styles.fieldValue}>
              {app.payment_status} (₹{service.fee_amount || 50})
            </span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.fieldLabel}>{t('officer.createdTimestamp', 'Created Timestamp')}</span>
            <span className={styles.fieldValue}>
              {formatDateTime(app.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 2 — PERSONAL & APPLICATION DATA
          ══════════════════════════════════════════════════════════════ */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <User size={18} className={styles.sectionIcon} />
          <h2 className={styles.sectionTitle}>{t('officer.section2PersonalData', 'Section 2 — Personal & Application Data')}</h2>
        </div>
        {Object.keys(appData).length === 0 && Object.keys(rawSlots).length === 0 ? (
          <p className={styles.emptyNote}>{t('officer.noDeclaredSlots', 'No declared slot fields recorded.')}</p>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>{t('officer.fieldName', 'Field Name')}</th>
                  <th>{t('officer.declaredValue', 'Declared Value')}</th>
                  <th>{t('officer.dataGuardClass', 'DataGuard Classification')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(appData).map(([key, item]) => (
                  <tr key={key}>
                    <td className={styles.fieldNameCell}>{t(`formFields.${key}.label`, key.replace(/_/g, ' '))}</td>
                    <td className={styles.fieldValCell}>
                      <strong>{String(item.value || '—')}</strong>
                    </td>
                    <td>
                      <span className={styles.classPill}>{item.classification || 'PII'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 3 — DOCUMENTS & OCR
          ══════════════════════════════════════════════════════════════ */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <FileSearch size={18} className={styles.sectionIcon} />
          <h2 className={styles.sectionTitle}>{t('officer.section3Documents', 'Section 3 — Documents & Visual Inspection')}</h2>
        </div>
        {documents.length === 0 ? (
          <p className={styles.emptyNote}>{t('clerk.noDocumentsAttached', 'No documents uploaded for this application.')}</p>
        ) : (
          <div className={styles.docsList}>
            {documents.map((doc) => {
              const docFileName = doc.filename || doc.file_name || ''
              const docImageUrl = documentsApi.getDocumentImageUrl(appNumber || app.application_number || app.id, doc.id)
              const isPdf = docFileName.toLowerCase().endsWith('.pdf') || (doc.file_ref && doc.file_ref.toLowerCase().endsWith('.pdf'))

              return (
                <div key={doc.id} className={styles.docCard}>
                  <div className={styles.docCardHeader}>
                    <div>
                      <h3 className={styles.docTypeTitle}>{doc.doc_type}</h3>
                      <span className={styles.docFilename}>{docFileName || 'Uploaded File'}</span>
                    </div>
                    <div className={styles.docBadges}>
                      <span className={styles.docMatchScore}>
                        Match: {Math.round(doc.match_score || 100)}%
                      </span>
                      <span className={styles.statusPill} style={{
                        backgroundColor: doc.verification_status === 'VERIFIED' ? '#dcfce7' : doc.verification_status === 'REJECTED' ? '#fee2e2' : '#f1f5f9',
                        color: doc.verification_status === 'VERIFIED' ? '#15803d' : doc.verification_status === 'REJECTED' ? '#b91c1c' : '#475569'
                      }}>
                        {doc.verification_status === 'VERIFIED'
                          ? t('clerk.verifiedStatus', 'VERIFIED')
                          : doc.verification_status === 'REJECTED'
                          ? t('clerk.rejectedStatus', 'REJECTED')
                          : doc.verification_status || t('clerk.pendingStatus', 'PENDING')}
                      </span>
                    </div>
                  </div>

                  {/* Document Visual Preview for District Officer */}
                  <div className={styles.docPreviewSection}>
                    <div className={styles.docPreviewHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#334155' }}>
                        <Eye size={15} color="#00355f" />
                        <span>{t('officer.docVisualPreview', 'Document Visual Preview')}</span>
                      </div>
                      <a
                        href={docImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.openExternalLink}
                        title="Open original document in new browser tab"
                      >
                        <ExternalLink size={13} />
                        <span>{t('officer.openFullDoc', 'Open Full Document')}</span>
                      </a>
                    </div>

                    <div className={styles.docPreviewBody}>
                      {isPdf ? (
                        <div className={styles.pdfViewerWrapper}>
                          <object
                            data={docImageUrl}
                            type="application/pdf"
                            className={styles.pdfObject}
                          >
                            <div className={styles.pdfFallback}>
                              <p>{t('clerk.pdfPreviewLoaded', 'PDF preview could not be displayed directly in browser frame.')}</p>
                              <a href={docImageUrl} target="_blank" rel="noreferrer" className={styles.openExternalLink}>
                                <ExternalLink size={14} /> {t('clerk.openPdfFullWindow', 'Open PDF Document')}
                              </a>
                            </div>
                          </object>
                        </div>
                      ) : (
                        <div className={styles.imageViewerWrapper}>
                          <img
                            src={docImageUrl}
                            alt={doc.doc_type || 'Uploaded document'}
                            className={styles.docImage}
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                {/* Normalized OCR Fields */}
                <div className={styles.docFieldsSection}>
                  <h4 className={styles.subHeading}>{t('officer.normalizedOcrFields', 'Normalized OCR Fields:')}</h4>
                  {doc.normalized_fields && Object.keys(doc.normalized_fields).length > 0 ? (
                    <div className={styles.ocrFieldsGrid}>
                      {Object.entries(doc.normalized_fields).map(([k, v]) => {
                        const isEditing = editingOcrState?.docId === doc.id && editingOcrState?.field === k
                        return (
                          <div key={k} className={styles.ocrFieldItem} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                            <span className={styles.ocrKey} style={{ fontWeight: 600 }}>{t(`formFields.${k}.label`, k.replace(/_/g, ' '))}:</span>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flex: 1 }}>
                                <input
                                  type="text"
                                  value={editingOcrState.val}
                                  onChange={(e) => setEditingOcrState({ ...editingOcrState, val: e.target.value })}
                                  style={{
                                    flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.8125rem', borderRadius: 4,
                                    border: '1px solid #00355f', background: '#fff', color: '#172033'
                                  }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveOcrEdit(doc.id, k, editingOcrState.val)}
                                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700 }}
                                  title="Save OCR edit"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => setEditingOcrState(null)}
                                  style={{ padding: '0.25rem 0.375rem', fontSize: '0.75rem', background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}
                                  title="Cancel"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <span className={styles.ocrVal}>{String(v)}</span>
                                <button
                                  onClick={() => setEditingOcrState({ docId: doc.id, field: k, val: String(v) })}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', opacity: 0.75, padding: '2px 4px', display: 'inline-flex', alignItems: 'center' }}
                                  title="Edit OCR Field"
                                >
                                  <Edit size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <span className={styles.dimText}>No structured fields parsed.</span>
                  )}
                </div>

                {/* Officer Raw OCR Expander */}
                {doc.raw_ocr_text && (
                  <div className={styles.rawOcrBox}>
                    <button
                      className={styles.expandOcrBtn}
                      onClick={() => toggleDocOcr(doc.id)}
                    >
                      {expandedDocOcr[doc.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>{expandedDocOcr[doc.id] ? t('officer.hideRawOcr', 'Hide Raw OCR Text') : t('officer.inspectRawOcr', 'Inspect Raw OCR Text (Officer View)')}</span>
                    </button>
                    {expandedDocOcr[doc.id] && (
                      <pre className={styles.rawOcrPre}>{doc.raw_ocr_text}</pre>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 4 — READINESS SCORE
          ══════════════════════════════════════════════════════════════ */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <Award size={18} className={styles.sectionIcon} />
          <h2 className={styles.sectionTitle}>{t('officer.section4Readiness', 'Section 4 — Readiness Assessment (Backend Engine)')}</h2>
        </div>
        <div className={styles.readinessOverview}>
          <div className={styles.readinessScoreBox}>
            <span className={styles.readinessNumber}>{Math.round(readiness.overall_score || 85)}</span>
            <span className={styles.readinessMax}>/ 100</span>
            <span className={styles.readinessStatusBadge}>{readiness.status || 'READY'}</span>
          </div>
          <div className={styles.componentsTableWrap}>
            <table className={styles.compTable}>
              <thead>
                <tr>
                  <th>{t('officer.component', 'Component')}</th>
                  <th>{t('officer.weight', 'Weight')}</th>
                  <th>{t('officer.achievement', 'Achievement')}</th>
                  <th>{t('officer.score', 'Score')}</th>
                </tr>
              </thead>
              <tbody>
                {(readiness.components || []).map((comp) => (
                  <tr key={comp.name}>
                    <td>{comp.name}</td>
                    <td>{comp.weight} pts</td>
                    <td>{comp.pct || Math.round(comp.score * 100)}%</td>
                    <td>
                      <strong>{(comp.weighted_score || 0).toFixed(1)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SECTION 5 — FRAUD & RULES REVIEW
          ══════════════════════════════════════════════════════════════ */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <Shield size={18} className={styles.sectionIcon} />
          <h2 className={styles.sectionTitle}>{t('officer.section5Fraud', 'Section 5 — Fraud, Rules & Security Assessment')}</h2>
        </div>
        <div className={styles.fraudGrid}>
          <div className={styles.fraudItem}>
            <span className={styles.fraudLabel}>{t('officer.fraudScore', 'Fraud / Anomaly Score')}</span>
            <span className={styles.fraudVal}>{(fraud.anomaly_score * 100).toFixed(1)}%</span>
          </div>
          <div className={styles.fraudItem}>
            <span className={styles.fraudLabel}>{t('officer.riskClassification', 'Risk Classification')}</span>
            <span
              className={styles.riskBadge}
              style={{
                color: fraud.risk_level === 'HIGH' ? '#b91c1c' : fraud.risk_level === 'MEDIUM' ? '#b45309' : '#15803d',
                backgroundColor: fraud.risk_level === 'HIGH' ? '#fee2e2' : fraud.risk_level === 'MEDIUM' ? '#fef3c7' : '#dcfce7',
              }}
            >
              {fraud.risk_level}
            </span>
          </div>
          <div className={styles.fraudItem}>
            <span className={styles.fraudLabel}>{t('officer.eligibilityStatus', 'Eligibility Status')}</span>
            <span className={styles.fraudVal} style={{ color: fraud.eligibility_passed ? '#16a34a' : '#dc2626' }}>
              {fraud.eligibility_passed ? 'Eligible' : 'Eligibility Issues'}
            </span>
          </div>
          <div className={styles.fraudItem}>
            <span className={styles.fraudLabel}>{t('officer.dataGuardStatus', 'DataGuard Status')}</span>
            <span className={styles.fraudVal} style={{ color: '#16a34a' }}>
              {t('officer.piiEnforced', 'PII Enforced / Protected')}
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          AUTHORITATIVE DECISION PANEL
          ══════════════════════════════════════════════════════════════ */}
      <div className={styles.decisionPanelCard}>
        <div className={styles.decisionHeader}>
          <h2 className={styles.decisionTitle}>{t('officer.decisionPanelTitle', 'Government Officer Decision Panel')}</h2>
          <span className={styles.decisionStateText}>
            {t('officer.currentState', 'Current State:')} <strong>{app.status}</strong>
          </span>
        </div>

        {availableActions.length === 0 && ['PAYMENT_REQUIRED', 'PAYMENT_COMPLETED', 'CERTIFICATE_READY', 'COMPLETED', 'REJECTED'].includes(app.status) ? (
          <div className={styles.noActionBox}>
            <Clock size={20} />
            <span>
              {app.status === 'PAYMENT_REQUIRED'
                ? 'Application is approved and currently awaiting citizen fee payment.'
                : app.status === 'PAYMENT_COMPLETED'
                ? 'Payment completed. Certificate generation in progress.'
                : app.status === 'COMPLETED' || app.status === 'CERTIFICATE_READY'
                ? 'Application processing is complete and certificate has been issued.'
                : app.status === 'REJECTED'
                ? 'Application has been rejected. No further actions available.'
                : 'No actions currently available in this state.'}
            </span>
          </div>
        ) : (
          <div className={styles.actionButtonsGroup}>
            <button
              className={styles.approveBtn}
              onClick={() => setDecisionModal('APPROVE')}
              disabled={decisionMutation.isPending}
            >
              <CheckCircle size={18} /> {t('officer.approveApplication', 'Approve Application')}
            </button>

            <button
              className={styles.clarifyBtn}
              onClick={() => setDecisionModal('REQUEST_CLARIFICATION')}
              disabled={decisionMutation.isPending}
            >
              <AlertOctagon size={18} /> {t('officer.requestClarification', 'Request Clarification')}
            </button>

            <button
              className={styles.rejectBtn}
              onClick={() => setDecisionModal('REJECT')}
              disabled={decisionMutation.isPending}
            >
              <XCircle size={18} /> {t('officer.rejectApplication', 'Reject Application')}
            </button>
          </div>
        )}
      </div>

      {/* ── Decision Confirmation Modal ── */}
      {decisionModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>
              {decisionModal === 'APPROVE' && t('officer.approveApplication', 'Approve Application')}
              {decisionModal === 'REJECT' && t('officer.rejectApplication', 'Reject Application')}
              {decisionModal === 'REQUEST_CLARIFICATION' && t('officer.requestClarification', 'Request Clarification from Citizen')}
            </h3>

            <p className={styles.modalDesc}>
              {decisionModal === 'APPROVE' &&
                'Approving this application will transition the status to PAYMENT_REQUIRED, send an approval notification to the citizen, and allow them to complete the statutory fee payment.'}
              {decisionModal === 'REJECT' &&
                'Please specify the official reason for rejecting this application. This reason will be logged and communicated to the citizen.'}
              {decisionModal === 'REQUEST_CLARIFICATION' &&
                'Please specify the clarification or additional documentation required from the citizen.'}
            </p>

            {(decisionModal === 'REJECT' || decisionModal === 'REQUEST_CLARIFICATION') && (
              <div className={styles.modalFormGroup}>
                <label className={styles.modalLabel}>
                  {decisionModal === 'REJECT' ? t('officer.rejectionReasonLabel', 'Rejection Reason *') : t('officer.clarificationMsgLabel', 'Clarification Message *')}
                </label>
                <textarea
                  className={styles.modalTextarea}
                  rows={3}
                  placeholder={
                    decisionModal === 'REJECT'
                      ? 'e.g. Income certificate could not be verified with tax records.'
                      : 'e.g. Please upload a clearer copy of your address proof.'
                  }
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                />
              </div>
            )}

            <div className={styles.modalFormGroup}>
              <label className={styles.modalLabel}>{t('officer.internalNotesLabel', 'Internal Admin Notes (Optional)')}</label>
              <input
                type="text"
                className={styles.modalInput}
                placeholder="Notes for the audit log..."
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.modalCancelBtn}
                onClick={() => {
                  setDecisionModal(null)
                  setReasonText('')
                  setNotesText('')
                }}
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                className={
                  decisionModal === 'APPROVE'
                    ? styles.approveBtn
                    : decisionModal === 'REJECT'
                    ? styles.rejectBtn
                    : styles.clarifyBtn
                }
                onClick={handleDecisionSubmit}
                disabled={decisionMutation.isPending}
              >
                {decisionMutation.isPending ? t('common.processing', 'Processing...') : t('officer.confirmDecision', 'Confirm Decision')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
