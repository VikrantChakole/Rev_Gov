import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck,
  CreditCard,
  ShieldCheck,
  Award,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  Download,
  FileText,
  AlertCircle,
  User,
  Calendar,
  Building,
} from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './TrackStatusModal.module.css'

// Helper to resolve localized certificate / service names
const getLocalizedServiceName = (name, id = '', t) => {
  if (typeof name === 'object' && name !== null) {
    name = name.en || Object.values(name)[0] || id
  }
  if (id === 'income_certificate' || name === 'Income Certificate') return t('dashboard.incomeCertificate', 'Income Certificate')
  if (id === 'caste_certificate' || name === 'Caste Certificate') return t('dashboard.casteCertificate', 'Caste Certificate')
  if (id === 'domicile_certificate' || name === 'Domicile Certificate') return t('dashboard.domicileCertificate', 'Domicile Certificate')
  if (id === 'non_creamy_layer' || name === 'Non-Creamy Layer Certificate') return t('dashboard.nonCreamyLayer', 'Non-Creamy Layer Certificate')
  if (id === 'character_certificate' || name === 'Character Certificate') return t('dashboard.characterCertificate', 'Character Certificate')
  if (id === 'ews_certificate' || name === 'EWS Certificate') return t('dashboard.ewsCertificate', 'Economically Weaker Section (EWS) Certificate')
  if (id === 'disability_certificate' || name === 'Disability Certificate') return t('dashboard.disabilityCertificate', 'Disability Certificate')
  if (id === 'birth_certificate' || name === 'Birth Certificate') return t('dashboard.birthCertificate', 'Birth Certificate')
  if (id === 'death_certificate' || name === 'Death Certificate') return t('dashboard.deathCertificate', 'Death Certificate')
  if (id === 'marriage_certificate' || name === 'Marriage Certificate') return t('dashboard.marriageCertificate', 'Marriage Certificate')
  if (id === 'land_possession' || name === 'Land Possession Certificate') return t('dashboard.landPossession', 'Land Possession Certificate')
  if (id === 'legal_heir' || name === 'Legal Heir Certificate') return t('dashboard.legalHeir', 'Legal Heir Certificate')
  return name || id || t('dashboard.statutoryCertificate', 'Statutory Certificate')
}

// Ordered lifecycle milestones for the visual pipeline
const PIPELINE_STAGES = [
  {
    id: 'submission',
    titleKey: 'stageSubmissionTitle',
    descKey: 'stageSubmissionDesc',
    defaultTitle: 'Application Submission',
    defaultDesc: 'Citizen particulars registered and documents isolated via OCR engine.',
    icon: FileText,
  },
  {
    id: 'verification',
    titleKey: 'stageVerificationTitle',
    descKey: 'stageVerificationDesc',
    defaultTitle: 'Desk Clerk Scrutiny',
    defaultDesc: 'Revenue officer cross-verifies OCR data against uploaded government proofs.',
    icon: FileCheck,
  },
  {
    id: 'payment',
    titleKey: 'stageFeeTitle',
    descKey: 'stageFeeDesc',
    defaultTitle: 'Treasury Fee Payment',
    defaultDesc: 'Settlement of government statutory fee of ₹50 under Maharashtra Right to Services.',
    icon: CreditCard,
  },
  {
    id: 'officer_approval',
    titleKey: 'stageApprovalTitle',
    descKey: 'stageApprovalDesc',
    defaultTitle: 'District Officer Scrutiny',
    defaultDesc: 'Final administrative review and digital seal approval by Tahsildar / SDO.',
    icon: ShieldCheck,
  },
  {
    id: 'certificate_ready',
    titleKey: 'stageCertificateTitle',
    descKey: 'stageCertificateDesc',
    defaultTitle: 'Digitally Signed Certificate',
    defaultDesc: 'Tamper-evident certificate with 2D cryptographic barcode ready for instant download.',
    icon: Award,
  },
]

export default function TrackStatusModal({
  isOpen,
  onClose,
  app,
  onOpenPayment,
  onOpenCorrection,
}) {
  const { t, i18n } = useTranslation()
  const [copied, setCopied] = useState(false)

  if (!isOpen || !app) return null

  const status = (app.status || 'SUBMITTED').toUpperCase()
  const paymentStatus = (app.payment_status || 'PENDING').toUpperCase()
  const isPaid = paymentStatus === 'PAID'
  const isCorrection = status === 'CORRECTION_NEEDED' || status === 'CLARIFICATION_REQUIRED' || app.has_rejected_documents
  const isRejected = status === 'REJECTED'

  const trackId = app.tracking_id || app.application_number || app.id
  const appNumber = app.application_number || app.id
  const serviceName = getLocalizedServiceName(app.service_name, app.service_id, t)
  const citizenName = app.citizen_name || app.applicant_name || app.citizen_ref || t('tracking.applicant', 'Citizen Applicant')
  const submittedDate = app.created_at || app.submitted_at || new Date().toISOString()

  // Determine stage progress level (0 to 4 index)
  let currentStageIndex = 0
  if (['CERTIFICATE_READY', 'COMPLETED', 'CERTIFICATE_GENERATION'].includes(status)) {
    currentStageIndex = 4
  } else if (['DISTRICT_OFFICER_APPROVAL', 'APPROVED'].includes(status)) {
    currentStageIndex = isPaid ? 3 : 2
  } else if (status === 'PAYMENT_REQUIRED') {
    currentStageIndex = isPaid ? 3 : 2
  } else if (['UNDER_REVIEW', 'CORRECTION_NEEDED', 'CLARIFICATION_REQUIRED'].includes(status)) {
    currentStageIndex = 1
  } else {
    currentStageIndex = 0
  }

  // Copy tracking ID
  const handleCopyTrackId = () => {
    navigator.clipboard.writeText(trackId)
    setCopied(true)
    toast.success(t('tracking.trackingIdCopied', 'Tracking ID copied to clipboard'))
    setTimeout(() => setCopied(false), 2000)
  }

  // Formatted date using active locale
  const formattedSubmittedDate = new Date(submittedDate).toLocaleDateString(
    i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  )

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.emblemIcon}>🏛️</div>
            <div>
              <div className={styles.metaRow}>
                <span className={styles.trackingIdLabel}>{t('tracking.trackingIdLabel', 'Tracking ID:')}</span>
                <span className={styles.trackingIdValue}>{trackId}</span>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={handleCopyTrackId}
                  title={t('tracking.copyTrackingIdTooltip', 'Copy Tracking ID')}
                >
                  {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                </button>
              </div>
              <h2 className={styles.serviceTitle}>{serviceName}</h2>
            </div>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            title={t('tracking.closeTrackingWindow', 'Close tracking window')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Overview Bar */}
        <div className={styles.overviewBar}>
          <div className={styles.overviewItem}>
            <User size={14} className={styles.overviewIcon} />
            <div>
              <span className={styles.overviewLabel}>{t('tracking.applicant', 'Applicant')}</span>
              <span className={styles.overviewValue}>{citizenName}</span>
            </div>
          </div>
          <div className={styles.overviewItem}>
            <Calendar size={14} className={styles.overviewIcon} />
            <div>
              <span className={styles.overviewLabel}>{t('tracking.submittedOn', 'Submitted On')}</span>
              <span className={styles.overviewValue}>{formattedSubmittedDate}</span>
            </div>
          </div>
          <div className={styles.overviewItem}>
            <Building size={14} className={styles.overviewIcon} />
            <div>
              <span className={styles.overviewLabel}>{t('tracking.jurisdiction', 'Jurisdiction')}</span>
              <span className={styles.overviewValue}>
                {app.district
                  ? `${app.district} ${t('certificate.districtSuffix', 'District')}`
                  : t('common.puneDistrict', 'Pune District')}
              </span>
            </div>
          </div>
          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>{t('tracking.currentStatus', 'Current Status')}</span>
            <span className={`${styles.currentStatusBadge} ${
              isCorrection ? styles.statusBadgeCorrection :
              isRejected ? styles.statusBadgeRejected :
              status === 'CERTIFICATE_READY' ? styles.statusBadgeComplete :
              styles.statusBadgeActive
            }`}>
              {isCorrection ? t('common.correctionNeeded', 'Correction Needed') :
               isRejected ? t('statuses.REJECTED', 'Rejected') :
               status === 'PAYMENT_REQUIRED' ? (isPaid ? t('common.paymentCompleted', 'Fee Paid — In Review') : t('common.paymentRequired', 'Payment Required')) :
               status === 'UNDER_REVIEW' ? t('common.readyReview', 'Under Desk Review') :
               status === 'DISTRICT_OFFICER_APPROVAL' ? t('common.officerReview', 'Officer Scrutiny') :
               status === 'CERTIFICATE_READY' ? t('statuses.COMPLETED', 'Certificate Issued') :
               t(`statuses.${status}`, status.replace(/_/g, ' '))}
            </span>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className={styles.modalBody}>
          {/* Correction Notice Alert if applicable */}
          {isCorrection && (
            <div className={styles.alertBannerWarning}>
              <AlertTriangle size={20} className={styles.alertIcon} />
              <div className={styles.alertContent}>
                <div className={styles.alertTitle}>
                  {t('tracking.documentCorrectionRequested', 'Document Correction Requested')}
                </div>
                <p className={styles.alertMessage}>
                  {app.rejection_reason ||
                    app.verification_notes ||
                    t('tracking.deskClerkCorrectionNotice', 'The Desk Clerk reviewed your application and requested updated document(s). Please re-upload the highlighted document to resume processing.')}
                </p>
                {onOpenCorrection && (
                  <button
                    type="button"
                    className={styles.alertActionBtn}
                    onClick={() => {
                      onClose()
                      onOpenCorrection(app)
                    }}
                  >
                    <span>{t('tracking.updateInformationReUpload', 'Update Information & Re-upload')}</span>
                    <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Connected Stage Nodes Timeline */}
          <div className={styles.pipelineSection}>
            <div className={styles.pipelineSectionHeader}>
              <h3 className={styles.pipelineTitle}>
                {t('tracking.processMilestonesProgress', 'Process Milestones & Progress')}
              </h3>
              <span className={styles.progressCounter}>
                {t('tracking.stageCounter', 'Stage {{current}} of {{total}}', {
                  current: Math.min(currentStageIndex + 1, PIPELINE_STAGES.length),
                  total: PIPELINE_STAGES.length,
                })}
              </span>
            </div>

            <div className={styles.nodesContainer}>
              {PIPELINE_STAGES.map((stage, idx) => {
                const isCompleted = idx < currentStageIndex || (idx === currentStageIndex && status === 'CERTIFICATE_READY')
                const isCurrent = idx === currentStageIndex && status !== 'CERTIFICATE_READY'
                const isPending = idx > currentStageIndex
                const IconComponent = stage.icon

                let nodeStateClass = styles.nodePending
                if (isCompleted) nodeStateClass = styles.nodeCompleted
                if (isCurrent) nodeStateClass = styles.nodeCurrent

                return (
                  <div key={stage.id} className={`${styles.stageNodeCard} ${nodeStateClass}`}>
                    {/* Visual Connector Line to next node */}
                    {idx < PIPELINE_STAGES.length - 1 && (
                      <div
                        className={`${styles.connectorLine} ${
                          idx < currentStageIndex ? styles.connectorCompleted : ''
                        }`}
                      />
                    )}

                    {/* Node Circle */}
                    <div className={styles.nodeCircleWrapper}>
                      <div className={styles.nodeCircle}>
                        {isCompleted ? (
                          <Check size={18} strokeWidth={2.5} />
                        ) : (
                          <IconComponent size={18} />
                        )}
                      </div>
                      {isCurrent && <div className={styles.pulseRing} />}
                    </div>

                    {/* Node Content */}
                    <div className={styles.nodeContent}>
                      <div className={styles.nodeHeaderRow}>
                        <h4 className={styles.nodeTitle}>
                          {t(`tracking.${stage.titleKey}`, stage.defaultTitle)}
                        </h4>
                        <span className={styles.nodeStatusPill}>
                          {isCompleted && t('tracking.stageCompleted', 'Completed')}
                          {isCurrent && (isCorrection ? t('tracking.stageActionNeeded', 'Action Needed') : t('tracking.stageInProgress', 'In Progress'))}
                          {isPending && t('tracking.stageUpcoming', 'Upcoming')}
                        </span>
                      </div>
                      <p className={styles.nodeDescription}>
                        {t(`tracking.${stage.descKey}`, stage.defaultDesc)}
                      </p>

                      {/* Interactive context details inside the active node */}
                      {isCurrent && stage.id === 'payment' && (
                        <div className={styles.activeNodeActionCard}>
                          <div className={styles.paymentCallout}>
                            <div className={styles.feeInfo}>
                              <span className={styles.feeLabel}>
                                {t('tracking.statutoryTreasuryFee', 'Statutory Treasury Fee:')}
                              </span>
                              <span className={styles.feeAmount}>₹{app.fee_amount || 50}.00</span>
                            </div>
                            {onOpenPayment && (
                              <button
                                type="button"
                                className={styles.btnPayInNode}
                                onClick={() => {
                                  onClose()
                                  onOpenPayment(app)
                                }}
                              >
                                <CreditCard size={14} />
                                <span>{t('tracking.payStatutoryFee', 'Pay Statutory Fee')}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {isCurrent && stage.id === 'verification' && (
                        <div className={styles.activeNodeInfoCard}>
                          <Clock size={14} color="#0284c7" />
                          <span>
                            {t('tracking.deskClerkReviewingIsolation', 'Desk Clerk is reviewing your isolation records. Estimated SLA: 24-48 hours.')}
                          </span>
                        </div>
                      )}

                      {isCompleted && stage.id === 'payment' && (
                        <div className={styles.completedNodeBadge}>
                          <CheckCircle2 size={13} color="#16a34a" />
                          <span>
                            {t('tracking.paymentSettledBadge', 'Payment settled (₹{{amount}}.00) • Verified in Treasury', {
                              amount: app.fee_amount || 50,
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter}>
          <div className={styles.footerHelp}>
            <span>{t('tracking.needAssistanceRevenueHelpline', 'Need assistance? Revenue Helpline: 1800-120-8040')}</span>
          </div>

          <div className={styles.footerActions}>
            {status === 'CERTIFICATE_READY' && (
              <a
                href={`/api/v1/applications/${appNumber}/certificate`}
                target="_blank"
                rel="noreferrer"
                className={styles.btnDownloadCert}
              >
                <Download size={15} />
                <span>{t('dashboard.downloadCertificate', 'Download Certificate')}</span>
              </a>
            )}

            {status === 'PAYMENT_REQUIRED' && !isPaid && onOpenPayment && (
              <button
                type="button"
                className={styles.btnPrimaryAction}
                onClick={() => {
                  onClose()
                  onOpenPayment(app)
                }}
              >
                <CreditCard size={15} />
                <span>{t('tracking.payFee50', 'Pay Fee (₹50)')}</span>
              </button>
            )}

            <button type="button" className={styles.btnCloseModal} onClick={onClose}>
              {t('common.close', 'Close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
