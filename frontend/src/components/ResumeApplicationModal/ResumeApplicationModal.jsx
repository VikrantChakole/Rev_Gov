import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  FileEdit, 
  Sparkles, 
  X, 
  ArrowRight,
  Layers,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react'
import styles from '../NewApplicationModal/NewApplicationModal.module.css'

function getLocalizedServiceName(name, id, t) {
  const cleanId = (id || '').toLowerCase().replace(/_certificate$/, '')
  if (cleanId === 'income' || cleanId === 'income_certificate') return t('services.income', 'Income Certificate')
  if (cleanId === 'caste' || cleanId === 'caste_certificate') return t('services.caste', 'Caste Certificate')
  if (cleanId === 'domicile' || cleanId === 'domicile_certificate') return t('services.domicile', 'Domicile Certificate')
  if (cleanId === 'obc_ncl' || cleanId === 'obc_ncl_certificate' || cleanId === 'non_creamy_layer') return t('services.obc_ncl', 'OBC Non Creamy Layer Certificate')
  return typeof name === 'string' && name ? name : id
}

export default function ResumeApplicationModal({ isOpen, onClose, application }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [fillMode, setFillMode] = useState('manual') // 'manual' | 'ai'

  React.useEffect(() => {
    if (isOpen) {
      setFillMode('manual')
    }
  }, [isOpen])

  if (!isOpen || !application) return null

  const appId = application.id || application.application_number
  const serviceId = application.service_id || 'caste_certificate'
  const serviceName = getLocalizedServiceName(
    typeof application.service_name === 'object'
      ? (application.service_name?.en || Object.values(application.service_name || {})[0] || serviceId)
      : (application.service_name || serviceId.replace(/_/g, ' ')),
    serviceId,
    t
  )

  const clerkComment =
    application.clerk_notes ||
    application.rejection_reason ||
    (application.validation_summary && (
      application.validation_summary.admin_notes ||
      application.validation_summary.rejection_reason ||
      application.validation_summary.clarification_reason ||
      application.validation_summary.desk_clerk_notes
    ))

  const isCorrectionMode =
    application.status === 'CORRECTION_NEEDED' ||
    application.status === 'REJECTED' ||
    application.status === 'CLARIFICATION_REQUIRED' ||
    application.has_rejected_documents ||
    Boolean(clerkComment)

  const rejectedDocs = application.rejected_doc_types || []

  const handleContinue = (overrideMode) => {
    // Only accept overrideMode if it is an explicit string ('manual' or 'ai')
    // and NOT an event object from onClick
    const selectedMode = (typeof overrideMode === 'string' && (overrideMode === 'manual' || overrideMode === 'ai'))
      ? overrideMode
      : fillMode

    onClose()
    if (selectedMode === 'manual') {
      const targetUrl = appId 
        ? `/applications/manual-form/${appId}?service=${serviceId}` 
        : `/applications/manual-form?service=${serviceId}`
      navigate(targetUrl)
    } else {
      const targetUrl = appId 
        ? `/applications/automated-form/${appId}?service=${serviceId}` 
        : `/applications/automated-form?service=${serviceId}`
      navigate(targetUrl)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div 
        className={styles.modalCard} 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: 580 }}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitleWrap}>
            <div className={styles.headerIcon} style={isCorrectionMode ? { background: '#fee2e2', color: '#dc2626' } : {}}>
              {isCorrectionMode ? <AlertCircle size={22} /> : <Layers size={22} />}
            </div>
            <div>
              <h2 className={styles.title}>
                {isCorrectionMode ? t('application.updateApplicationInfo', 'Update Application Information') : t('application.resumeApplication', 'Resume Application')}
              </h2>
              <p className={styles.subtitle}>
                {isCorrectionMode
                  ? t('application.correctReuploadSubtitle', 'Correct and re-upload required documents for {{serviceName}} (#{{appId}})', { serviceName, appId: application.application_number || appId })
                  : t('application.continueSubtitle', 'Continue {{serviceName}} (#{{appId}})', { serviceName, appId: application.application_number || appId })}
              </p>
            </div>
          </div>

          <button 
            type="button" 
            className={styles.closeBtn} 
            onClick={onClose}
            title={t('accessibility.closeDialog', 'Close dialog')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className={styles.body} style={{ padding: '1.5rem 1.65rem' }}>

          {/* Reviewing Officer Feedback Banner */}
          {clerkComment && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', fontWeight: 700, fontSize: '0.875rem' }}>
                <AlertTriangle size={17} />
                <span>{t('officer.reviewingOfficerFeedback', 'Reviewing Officer Feedback')}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#7f1d1d', fontStyle: 'italic', lineHeight: 1.45 }}>
                "{clerkComment}"
              </p>
              {rejectedDocs.length > 0 && (
                <div style={{ marginTop: '4px', fontSize: '0.8125rem', color: '#991b1b' }}>
                  <strong>{t('documents.docsRequiringReupload', 'Document(s) Requiring Re-upload')}:</strong>{' '}
                  <span style={{ fontWeight: 600 }}>{rejectedDocs.map(d => d.replace(/_/g, ' ').toUpperCase()).join(', ')}</span>
                </div>
              )}
            </div>
          )}
          
          {/* Section: Mode Selection Cards */}
          <div className={styles.section}>
            <label className={styles.sectionHeading}>
              {t('forms.chooseFilingMode', 'Choose Filing Mode')}
            </label>
            <div className={styles.modeGrid}>
              
              {/* Card 1: Manual Form Fill */}
              <button
                type="button"
                id="resume-manual-form-card"
                className={`${styles.modeCard} ${fillMode === 'manual' ? styles.modeCardActive : ''}`}
                onClick={() => setFillMode('manual')}
                onDoubleClick={() => handleContinue('manual')}
              >
                <div className={styles.modeBadgeRecommended}>{t('forms.standardFlow', 'Standard Flow')}</div>
                <div className={styles.modeIconWrap}>
                  <FileEdit size={22} className={styles.modeIcon} />
                </div>
                <div className={styles.modeContent}>
                  <h4 className={styles.modeTitle}>{t('forms.manualFormFill', 'Manual Form Fill')}</h4>
                  <p className={styles.modeDesc}>
                    {t('forms.manualFormDesc', 'Directly enter 10 particulars, upload identity & address proofs, and submit via structured form.')}
                  </p>
                </div>
                <div className={styles.modeCheckWrap}>
                  <div className={styles.modeRadioDot} />
                </div>
              </button>

              {/* Card 2: AI Assisted Form Fill */}
              <button
                type="button"
                id="resume-ai-form-card"
                className={`${styles.modeCard} ${fillMode === 'ai' ? styles.modeCardActive : ''}`}
                onClick={() => setFillMode('ai')}
                onDoubleClick={() => handleContinue('ai')}
              >
                <div className={styles.modeBadgeAi}>{t('forms.voiceAndChat', 'Voice & Chat')}</div>
                <div className={styles.modeIconWrap}>
                  <Sparkles size={22} className={styles.modeIcon} />
                </div>
                <div className={styles.modeContent}>
                  <h4 className={styles.modeTitle}>{t('forms.aiAssistedFormFill', 'AI Assisted Form Fill')}</h4>
                  <p className={styles.modeDesc}>
                    {t('forms.aiAssistedDesc', 'Converse with multilingual AI assistant in Hindi, Marathi, Tamil or English to fill your application.')}
                  </p>
                </div>
                <div className={styles.modeCheckWrap}>
                  <div className={styles.modeRadioDot} />
                </div>
              </button>

            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
          >
            {t('common.cancel', 'Cancel')}
          </button>

          <button
            type="button"
            id="resume-continue-btn"
            className={styles.applyBtn}
            onClick={() => handleContinue()}
          >
            <span>{fillMode === 'manual' ? t('forms.continueManual', 'Continue with Manual Form') : t('forms.continueAi', 'Continue with AI Assisted Form')}</span>
            <span className={styles.applyArrow}>→</span>
          </button>
        </div>

      </div>
    </div>
  )
}
