import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  FileEdit,
  Award,
  Coins,
  Home,
  ShieldCheck,
  ArrowRight,
  Clock,
  CheckCircle2,
  FileText,
  AlertCircle,
  Loader2,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import useAuthStore from '../../store/authStore'
import { applicationsApi } from '../../api/applications'
import styles from './FormFillingPage.module.css'

function getLocalizedServiceName(id, t) {
  const cleanId = (id || '').toLowerCase().replace(/_certificate$/, '')
  if (cleanId === 'income' || cleanId === 'income_certificate') return t('services.income', 'Income Certificate')
  if (cleanId === 'caste' || cleanId === 'caste_certificate') return t('services.caste', 'Caste Certificate')
  if (cleanId === 'domicile' || cleanId === 'domicile_certificate') return t('services.domicile', 'Domicile Certificate')
  if (cleanId === 'obc_ncl' || cleanId === 'obc_ncl_certificate' || cleanId === 'non_creamy_layer') return t('services.obc_ncl', 'OBC Non Creamy Layer Certificate')
  return id
}

const CERTIFICATE_SERVICES = [
  {
    id: 'caste_certificate',
    name: 'Caste Certificate',
    code: 'CC',
    icon: Award,
    description: 'Statutory verification certifying candidate belonging to Scheduled Caste (SC) or Scheduled Tribe (ST) category.',
    slaDays: 21,
    dept: 'Revenue Department',
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
  },
  {
    id: 'income_certificate',
    name: 'Income Certificate',
    code: 'IC',
    icon: Coins,
    description: 'Official certification of annual gross family income for government schemes, admissions and fee waivers.',
    slaDays: 15,
    dept: 'Revenue Department',
    color: '#10b981',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  {
    id: 'domicile_certificate',
    name: 'Domicile Certificate',
    code: 'DC',
    icon: Home,
    description: 'Statutory residency certificate establishing permanent state residence for educational quotas and public jobs.',
    slaDays: 15,
    dept: 'Revenue Department',
    color: '#0284c7',
    bgColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  {
    id: 'obc_ncl_certificate',
    name: 'OBC Non Creamy Layer Certificate',
    code: 'NCL',
    icon: ShieldCheck,
    description: 'Official proof certifying belonging to Other Backward Class with income under statutory non-creamy layer threshold.',
    slaDays: 21,
    dept: 'Revenue Department',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
  },
]

export default function FormFillingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { citizenUser } = useAuthStore()
  const citizenIdentifier = citizenUser?.citizen_id || citizenUser?.citizen_ref

  const [checkingDraft, setCheckingDraft] = useState(true)
  const [loadingService, setLoadingService] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Check if an application is currently in drafted status
  useEffect(() => {
    let mounted = true
    applicationsApi.getActiveDraft()
      .then((res) => {
        if (!mounted) return
        if (res?.has_draft && res.draft?.id) {
          // Immediately redirect to manual form page
          navigate(`/applications/manual-form/${res.draft.id}?service=${res.draft.service_id || 'caste_certificate'}`, { replace: true })
        } else {
          setCheckingDraft(false)
        }
      })
      .catch((err) => {
        console.warn('Failed to check active draft:', err)
        if (mounted) setCheckingDraft(false)
      })

    return () => {
      mounted = false
    }
  }, [navigate])

  // Query recent applications
  const { data: appsData } = useQuery({
    queryKey: ['citizenRecentApps', citizenIdentifier],
    queryFn: () => applicationsApi.getMyApplications(citizenIdentifier, 10),
    enabled: !!citizenIdentifier && !checkingDraft,
  })

  const recentApplications = appsData?.applications || []

  // Handle starting a manual application form
  const handleStartManualForm = async (serviceId) => {
    setLoadingService(serviceId + '_manual')
    setErrorMsg('')

    try {
      const res = await applicationsApi.createDraft(serviceId, 'WEB_MANUAL')
      if (res?.draft_id) {
        navigate(`/applications/manual-form/${res.draft_id}?service=${serviceId}`)
      } else {
        throw new Error('Could not initialize application draft')
      }
    } catch (err) {
      console.error('Failed to create draft:', err)
      setErrorMsg(err.message || 'Failed to initialize form. Please try again.')
    } finally {
      setLoadingService(null)
    }
  }

  // Handle starting an AI assisted application form
  const handleStartAiForm = async (serviceId) => {
    setLoadingService(serviceId + '_ai')
    setErrorMsg('')

    try {
      const res = await applicationsApi.createDraft(serviceId, 'WEB_AUTOMATED_AI')
      if (res?.draft_id) {
        navigate(`/applications/automated-form/${res.draft_id}?service=${serviceId}`)
      } else {
        throw new Error('Could not initialize application draft')
      }
    } catch (err) {
      console.error('Failed to create draft:', err)
      setErrorMsg(err.message || 'Failed to initialize AI form. Please try again.')
    } finally {
      setLoadingService(null)
    }
  }

  if (checkingDraft) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingCard}>
          <Loader2 size={36} className={styles.spin} style={{ color: '#2563eb' }} />
          <h3 className={styles.loadingTitle}>{t('forms.checkingStatus', 'Checking Form Status...')}</h3>
          <p className={styles.loadingSubtitle}>{t('forms.resumingDrafts', 'Resuming any active drafted applications...')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      
      {/* ── 1. GREETING / HERO BANNER ── */}
      <div className={styles.heroBanner}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <FileEdit size={14} />
            <span>{t('forms.statutoryFilingPortal', 'Statutory Filing Portal')}</span>
          </div>
          <h1 className={styles.heroTitle}>{t('forms.formFillingServices', 'Form Filling Services')}</h1>
          <p className={styles.heroSubtitle}>
            {t('forms.formFillingSubtitle', 'Directly fill and file statutory government application forms with document attachments. Select a certificate below to begin your application.')}
          </p>
        </div>

        <div className={styles.heroQuickInfo}>
          <div className={styles.infoChip}>
            <CheckCircle2 size={16} className={styles.infoIcon} />
            <span>{t('forms.directCitizenSubmission', 'Direct Citizen Submission')}</span>
          </div>
          <div className={styles.infoChip}>
            <Clock size={16} className={styles.infoIcon} />
            <span>{t('forms.slaRange', 'SLA: 15 – 21 Working Days')}</span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className={styles.errorBanner}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── 2. CERTIFICATE SELECTION SECTION ── */}
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>{t('forms.selectCertToApply', 'Select Certificate to Apply')}</h2>
          <p className={styles.sectionSub}>{t('forms.chooseFromPrimary', 'Choose from the 4 primary revenue certificates authorized for online filing')}</p>
        </div>
      </div>

      <div className={styles.certGrid}>
        {CERTIFICATE_SERVICES.map((cert) => {
          const IconComp = cert.icon
          const localizedTitle = getLocalizedServiceName(cert.id, t)
          const localizedDesc =
            cert.id === 'caste_certificate' ? t('services.casteDesc', cert.description) :
            cert.id === 'income_certificate' ? t('services.incomeDesc', cert.description) :
            cert.id === 'domicile_certificate' ? t('services.domicileDesc', cert.description) :
            t('services.obcNclDesc', cert.description)

          return (
            <div 
              key={cert.id} 
              className={styles.certCard}
              style={{ '--cert-theme': cert.color }}
            >
              <div className={styles.cardTop}>
                <div 
                  className={styles.certIconWrap}
                  style={{ background: cert.bgColor, color: cert.color, borderColor: cert.borderColor }}
                >
                  <IconComp size={24} />
                </div>
                <span className={styles.certCode}>{cert.code}</span>
              </div>

              <div className={styles.cardBody}>
                <h3 className={styles.certTitle}>{localizedTitle}</h3>
                <p className={styles.certDept}>{t('forms.revenueDept', cert.dept)}</p>
                <p className={styles.certDesc}>{localizedDesc}</p>
              </div>

              <div className={styles.cardMetaRow}>
                <div className={styles.slaTag}>
                  <Clock size={13} />
                  <span>{t('forms.slaDays', { days: cert.slaDays })}</span>
                </div>
                <span className={styles.statutoryBadge}>{t('forms.statutoryForm', 'Statutory Form')}</span>
              </div>

              <div className={styles.cardFooter}>
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <button
                    type="button"
                    className={styles.fillFormBtn}
                    onClick={() => handleStartManualForm(cert.id)}
                    disabled={loadingService !== null}
                    style={{ flex: 1 }}
                    title={t('forms.manualForm', 'Manual Form')}
                  >
                    {loadingService === cert.id + '_manual' ? (
                      <Loader2 size={15} className={styles.spin} />
                    ) : (
                      <span>{t('forms.manualForm', 'Manual Form')}</span>
                    )}
                  </button>

                  <button
                    type="button"
                    className={styles.fillFormBtn}
                    onClick={() => handleStartAiForm(cert.id)}
                    disabled={loadingService !== null}
                    style={{
                      flex: 1.15,
                      background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
                      borderColor: '#3b82f6',
                      color: '#ffffff',
                    }}
                    title={t('forms.aiForm', 'AI Form')}
                  >
                    {loadingService === cert.id + '_ai' ? (
                      <Loader2 size={15} className={styles.spin} />
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>{t('forms.aiForm', 'AI Form')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 3. RECENT APPLICATIONS (IF ANY) ── */}
      {recentApplications.length > 0 && (
        <div className={styles.recentSection}>
          <div className={styles.recentHeader}>
            <h3 className={styles.recentTitle}>{t('forms.recentApplications', 'Your Recent Applications')}</h3>
            <Link to="/applications" className={styles.viewAllLink}>
              {t('forms.viewAllApplications', 'View All Applications →')}
            </Link>
          </div>

          <div className={styles.recentList}>
            {recentApplications.slice(0, 3).map((app) => {
              const localizedAppName = getLocalizedServiceName(app.service_id, t)
              return (
                <div key={app.id} className={styles.recentItem}>
                  <div className={styles.recentItemLeft}>
                    <div className={styles.recentIconWrap}>
                      <FileText size={18} />
                    </div>
                    <div>
                      <h4 className={styles.recentAppName}>{localizedAppName || app.service_name || app.service_id}</h4>
                      <span className={styles.recentAppRef}>{t('forms.trackingRef', { id: app.tracking_id || app.application_number })}</span>
                    </div>
                  </div>

                  <div className={styles.recentItemRight}>
                    <span className={`${styles.statusBadge} styles[status_${app.status}]`}>
                      {t('statuses.' + app.status, app.status)}
                    </span>
                    <Link to={`/applications/${app.id}`} className={styles.recentDetailBtn}>
                      <span>{t('forms.details', 'Details')}</span>
                      <ExternalLink size={13} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
