import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  FileText, 
  Sparkles, 
  FileEdit, 
  Award, 
  Coins, 
  Home, 
  ShieldCheck, 
  X, 
  CheckCircle2, 
  Loader2, 
  AlertCircle 
} from 'lucide-react'
import { applicationsApi } from '../../api/applications'
import styles from './NewApplicationModal.module.css'

const CERTIFICATE_OPTIONS = [
  {
    id: 'caste_certificate',
    name: 'Caste Certificate',
    code: 'CC',
    icon: Award,
    description: 'Statutory certificate validating Scheduled Caste or Scheduled Tribe community status.',
    color: '#8B5CF6',
  },
  {
    id: 'income_certificate',
    name: 'Income Certificate',
    code: 'IC',
    icon: Coins,
    description: 'Official revenue proof of annual family earnings for schemes and scholarships.',
    color: '#10B981',
  },
  {
    id: 'domicile_certificate',
    name: 'Domicile Certificate',
    code: 'DC',
    icon: Home,
    description: 'Proof of permanent residency in the state for education, recruitment and quotas.',
    color: '#0284C7',
  },
  {
    id: 'obc_ncl_certificate',
    name: 'OBC Non Creamy Layer Certificate',
    code: 'NCL',
    icon: ShieldCheck,
    description: 'Certification for Other Backward Classes eligible for non-creamy layer benefits.',
    color: '#F59E0B',
  },
]

export default function NewApplicationModal({ isOpen, onClose }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [selectedCertificate, setSelectedCertificate] = useState('caste_certificate')
  const [fillMode, setFillMode] = useState('manual') // 'manual' | 'ai'
  const [draftInstance, setDraftInstance] = useState(null)
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // On modal open: instantiate a new temporary draft application
  useEffect(() => {
    let mounted = true

    if (isOpen) {
      setSelectedCertificate('caste_certificate')
      setFillMode('manual')
      setErrorMsg('')
      setIsCreatingDraft(true)

      applicationsApi.createDraft('caste_certificate', 'WEB_MANUAL')
        .then((res) => {
          if (mounted && res?.draft_id) {
            setDraftInstance(res)
          }
        })
        .catch((err) => {
          console.error('Failed to create draft application instance:', err)
          if (mounted) {
            setErrorMsg(err.message || t('application.initError', 'Unable to initialize draft application. Please check your connection.'))
          }
        })
        .finally(() => {
          if (mounted) setIsCreatingDraft(false)
        })
    } else {
      setDraftInstance(null)
      setIsCreatingDraft(false)
      setIsApplying(false)
      setIsCancelling(false)
      setErrorMsg('')
    }

    return () => {
      mounted = false
    }
  }, [isOpen, t])

  if (!isOpen) return null

  // Handle Cancel: discard temporary draft instance
  const handleCancel = async () => {
    if (draftInstance?.draft_id) {
      setIsCancelling(true)
      try {
        await applicationsApi.discardDraft(draftInstance.draft_id)
      } catch (err) {
        console.warn('Draft cleanup warning:', err)
      } finally {
        setIsCancelling(false)
        setDraftInstance(null)
        onClose()
      }
    } else {
      onClose()
    }
  }

  // Handle Apply: move to manual form page or AI assistant
  const handleApply = async () => {
    if (!draftInstance?.draft_id) {
      setErrorMsg(t('application.instanceNotReady', 'Temporary application instance is not ready. Please try again.'))
      return
    }

    setIsApplying(true)
    setErrorMsg('')

    try {
      // Update service type if different from initial creation
      if (draftInstance.service_id !== selectedCertificate) {
        await applicationsApi.updateDraftService(draftInstance.draft_id, selectedCertificate)
      }

      if (fillMode === 'manual') {
        // Navigate to the manual form page
        navigate(`/applications/manual-form/${draftInstance.draft_id}?service=${selectedCertificate}`)
      } else {
        // AI Assisted form fill
        navigate(`/applications/automated-form/${draftInstance.draft_id}?service=${selectedCertificate}`)
      }
      onClose()
    } catch (err) {
      console.error('Failed to apply draft:', err)
      setErrorMsg(err.message || t('application.proceedError', 'Failed to proceed to application form.'))
      setIsApplying(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && !isApplying && handleCancel()}>
      <div className={styles.modalCard} role="dialog" aria-modal="true">
        
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitleWrap}>
            <div className={styles.headerIcon}>
              <FileText size={20} />
            </div>
            <div>
              <h2 className={styles.title}>{t('application.newApplication', 'New Application')}</h2>
              <p className={styles.subtitle}>
                {t('application.selectCertSubtitle', 'Select the required government certificate and preferred filing mode')}
              </p>
            </div>
          </div>
          <button 
            className={styles.closeBtn} 
            onClick={handleCancel}
            disabled={isApplying || isCancelling}
            title={t('accessibility.cancelAndClose', 'Cancel and close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Temporary Draft Banner */}
        <div className={styles.draftBadgeRow}>
          {isCreatingDraft ? (
            <span className={styles.draftLoading}>
              <Loader2 size={13} className={styles.spin} />
              {t('application.generatingDraftInstance', 'Generating temporary application instance...')}
            </span>
          ) : draftInstance ? (
            <span className={styles.draftSuccess}>
              <CheckCircle2 size={13} />
              {t('application.temporaryRef', 'Temporary Ref')}: <strong>{draftInstance.tracking_id || draftInstance.application_number}</strong>
            </span>
          ) : errorMsg ? (
            <span className={styles.draftError}>
              <AlertCircle size={13} />
              {errorMsg}
            </span>
          ) : null}
        </div>

        {/* Content Body */}
        <div className={styles.body}>

          {/* Section 1: Certificate Selection */}
          <div className={styles.section}>
            <label className={styles.sectionHeading}>
              {t('application.whichCertHeading', 'Which certificate need to be applied for?')}
            </label>
            <div className={styles.certGrid}>
              {CERTIFICATE_OPTIONS.map((cert) => {
                const isSelected = selectedCertificate === cert.id
                const IconComp = cert.icon
                return (
                  <button
                    type="button"
                    key={cert.id}
                    className={`${styles.certCard} ${isSelected ? styles.certCardActive : ''}`}
                    onClick={() => setSelectedCertificate(cert.id)}
                    style={{ '--cert-color': cert.color }}
                  >
                    <div className={styles.certHeader}>
                      <div className={styles.certBadgeCode}>{cert.code}</div>
                      <div className={styles.certIconWrap}>
                        <IconComp size={22} className={styles.certIcon} />
                      </div>
                    </div>
                    <div className={styles.certContent}>
                      <h4 className={styles.certTitle}>
                        {cert.id === 'caste_certificate' ? t('services.caste', cert.name) :
                         cert.id === 'income_certificate' ? t('services.income', cert.name) :
                         cert.id === 'domicile_certificate' ? t('services.domicile', cert.name) :
                         t('services.obc_ncl', cert.name)}
                      </h4>
                      <p className={styles.certDesc}>
                        {cert.id === 'caste_certificate' ? t('services.casteDesc', cert.description) :
                         cert.id === 'income_certificate' ? t('services.incomeDesc', cert.description) :
                         cert.id === 'domicile_certificate' ? t('services.domicileDesc', cert.description) :
                         t('services.obcNclDesc', cert.description)}
                      </p>
                    </div>
                    <div className={styles.certCheckWrap}>
                      <div className={styles.certRadioDot} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 2: Mode Selection */}
          <div className={styles.section}>
            <label className={styles.sectionHeading}>
              {t('forms.chooseFilingMode', 'Choose Filing Mode')}
            </label>
            <div className={styles.modeGrid}>
              
              {/* Card 1: Manual Form Fill */}
              <button
                type="button"
                className={`${styles.modeCard} ${fillMode === 'manual' ? styles.modeCardActive : ''}`}
                onClick={() => setFillMode('manual')}
              >
                <div className={styles.modeBadgeRecommended}>{t('forms.standardFlow', 'Standard Flow')}</div>
                <div className={styles.modeIconWrap}>
                  <FileEdit size={22} className={styles.modeIcon} />
                </div>
                <div className={styles.modeContent}>
                  <h4 className={styles.modeTitle}>{t('forms.manualFormFill', 'Manually form fill')}</h4>
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
                className={`${styles.modeCard} ${fillMode === 'ai' ? styles.modeCardActive : ''}`}
                onClick={() => setFillMode('ai')}
              >
                <div className={styles.modeBadgeAi}>{t('forms.voiceAndChat', 'Voice & Chat')}</div>
                <div className={styles.modeIconWrap}>
                  <Sparkles size={22} className={styles.modeIcon} />
                </div>
                <div className={styles.modeContent}>
                  <h4 className={styles.modeTitle}>{t('forms.aiAssistedFormFill', 'AI Assisted form fill')}</h4>
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
            onClick={handleCancel}
            disabled={isApplying || isCancelling}
          >
            {isCancelling ? (
              <>
                <Loader2 size={15} className={styles.spin} />
                {t('common.discarding', 'Discarding...')}
              </>
            ) : (
              t('common.cancel', 'Cancel')
            )}
          </button>

          <button
            type="button"
            className={styles.applyBtn}
            onClick={handleApply}
            disabled={isCreatingDraft || isApplying || isCancelling || !draftInstance}
          >
            {isApplying ? (
              <>
                <Loader2 size={15} className={styles.spin} />
                {t('common.openingForm', 'Opening Form...')}
              </>
            ) : (
              <>
                <span>{t('common.apply', 'Apply')}</span>
                <span className={styles.applyArrow}>→</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
