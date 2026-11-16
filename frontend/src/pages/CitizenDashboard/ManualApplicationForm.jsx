import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Calendar,
  User,
  MapPin,
  FileCheck,
  Trash2,
  Eye,
  ShieldAlert,
  Loader2,
  Sparkles,
  Send,
  Clock,
  Printer,
  ChevronRight,
  Lock,
  Hash,
  Check,
  ShieldCheck,
} from 'lucide-react'
import useAuthStore from '../../store/authStore'
import { applicationsApi } from '../../api/applications'
import ApplicationReceiptModal from '../../components/ApplicationReceipt/ApplicationReceiptModal'
import styles from './ManualApplicationForm.module.css'

function getLocalizedServiceName(id, t) {
  const cleanId = (id || '').toLowerCase().replace(/_certificate$/, '')
  if (cleanId === 'income' || cleanId === 'income_certificate') return t('services.income', 'Income Certificate')
  if (cleanId === 'caste' || cleanId === 'caste_certificate') return t('services.caste', 'Caste Certificate')
  if (cleanId === 'domicile' || cleanId === 'domicile_certificate') return t('services.domicile', 'Domicile Certificate')
  if (cleanId === 'obc_ncl' || cleanId === 'obc_ncl_certificate' || cleanId === 'non_creamy_layer') return t('services.obc_ncl', 'OBC Non Creamy Layer Certificate')
  return id
}

const CERT_DISPLAY_NAMES = {
  caste_certificate: 'Caste Certificate',
  income_certificate: 'Income Certificate',
  domicile_certificate: 'Domicile Certificate',
  obc_ncl_certificate: 'OBC Non Creamy Layer Certificate',
}

const IDENTITY_PROOF_OPTIONS = [
  'Aadhaar card',
  'PAN card',
  'Voter ID',
  'Passport',
]

const RESIDENTIAL_PROOF_OPTIONS = [
  'Water Bill',
  'Electricity Bill',
  'Land papers',
  'Rent agreement paper',
]

const AGE_PROOF_OPTIONS = [
  'Birth Certificate',
  'School Leaving Certificate',
]

const DOC_LABEL_MAP = {
  identity_proof: 'Identity Proof',
  residential_proof: 'Residential Proof',
  age_proof: 'Proof of Age',
  signature: 'Signature',
  passport_image: 'Passport Photo',
}

export default function ManualApplicationForm() {
  const { t } = useTranslation()
  const { draftId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { citizenUser } = useAuthStore()

  const serviceParam = searchParams.get('service') || 'caste_certificate'
  const [serviceId, setServiceId] = useState(serviceParam)

  // Step state: 'form' | 'confirm' | 'success'
  const [currentStep, setCurrentStep] = useState('form')

  // Form State for 10 Particulars
  const [particulars, setParticulars] = useState({
    name: citizenUser?.name || '',
    father_name: '',
    mother_name: '',
    dob: '',
    sex: 'Male',
    marital_status: 'No',
    husband_name: '',
    address: citizenUser?.address || '',
    years_of_residence: '',
    purpose: '',
  })

  // Enclosed Documents selection & uploaded files
  const [docSubtypes, setDocSubtypes] = useState({
    identity_proof: 'Aadhaar card',
    residential_proof: 'Electricity Bill',
    age_proof: 'Birth Certificate',
  })

  const [uploadedDocs, setUploadedDocs] = useState({
    identity_proof: null,
    residential_proof: null,
    age_proof: null,
    signature: null,
    passport_image: null,
  })

  const [uploadingSlots, setUploadingSlots] = useState({})
  const [declarationAccepted, setDeclarationAccepted] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionResult, setSubmissionResult] = useState(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [initializingDraft, setInitializingDraft] = useState(!draftId)
  const [draftApp, setDraftApp] = useState(null)
  const [clerkFeedback, setClerkFeedback] = useState(null)

  // Screen-blocking OCR Feedback Modal State
  const [ocrModal, setOcrModal] = useState({
    isOpen: false,
    docType: '',
    docName: '',
    fileName: '',
    fileSize: '',
    step: 1,
    isBypassed: false,
    error: null,
    isComplete: false,
  })

  // Toast / flash notification for OCR Auto-fill
  const [autoFillToast, setAutoFillToast] = useState('')

  const certName = getLocalizedServiceName(serviceId, t)

  // Fetch draft application details or auto-initialize if draftId is missing
  useEffect(() => {
    let mounted = true

    if (!draftId) {
      setInitializingDraft(true)
      // Check if citizen already has an active draft
      applicationsApi.getActiveDraft()
        .then(async (res) => {
          if (!mounted) return
          if (res?.has_draft && res.draft?.id) {
            setDraftApp(res.draft)
            navigate(`/applications/manual-form/${res.draft.id}?service=${res.draft.service_id || serviceParam}`, { replace: true })
          } else {
            // Create a fresh draft
            const draftRes = await applicationsApi.createDraft(serviceParam, 'WEB_MANUAL')
            if (mounted && draftRes?.draft_id) {
              setDraftApp(draftRes)
              navigate(`/applications/manual-form/${draftRes.draft_id}?service=${serviceParam}`, { replace: true })
            } else {
              throw new Error('Could not initialize application draft.')
            }
          }
        })
        .catch((err) => {
          console.error('Failed to initialize draft for manual form:', err)
          if (mounted) {
            setLoadError('Failed to initialize application form. Please try again.')
            setInitializingDraft(false)
          }
        })
      return () => { mounted = false }
    }

    setInitializingDraft(false)
    applicationsApi.getById(draftId)
      .then((res) => {
        if (!mounted) return
        setDraftApp(res)
        if (res?.service_id) {
          setServiceId(res.service_id)
        }

        // Pre-populate form particulars from existing slots/fields
        const rawParticulars = res.slots_data || res.fields || {}
        if (rawParticulars && typeof rawParticulars === 'object' && Object.keys(rawParticulars).length > 0) {
          setParticulars((prev) => ({
            ...prev,
            name: rawParticulars.name || rawParticulars.applicant_name || rawParticulars.full_name || prev.name,
            father_name: rawParticulars.father_name || rawParticulars.father || prev.father_name,
            mother_name: rawParticulars.mother_name || rawParticulars.mother || prev.mother_name,
            dob: rawParticulars.dob || rawParticulars.date_of_birth || prev.dob,
            sex: rawParticulars.sex || rawParticulars.gender || prev.sex,
            marital_status: rawParticulars.marital_status || prev.marital_status,
            husband_name: rawParticulars.husband_name || prev.husband_name,
            address: rawParticulars.address || rawParticulars.residential_address || prev.address,
            years_of_residence: rawParticulars.years_of_residence || rawParticulars.residence_years || prev.years_of_residence,
            purpose: rawParticulars.purpose || rawParticulars.purpose_of_certificate || prev.purpose,
          }))

          if (rawParticulars.identity_proof_type) {
            setDocSubtypes((prev) => ({ ...prev, identity_proof: rawParticulars.identity_proof_type }))
          }
          if (rawParticulars.residential_proof_type) {
            setDocSubtypes((prev) => ({ ...prev, residential_proof: rawParticulars.residential_proof_type }))
          }
          if (rawParticulars.age_proof_type) {
            setDocSubtypes((prev) => ({ ...prev, age_proof: rawParticulars.age_proof_type }))
          }
        }

        // Extract any Reviewing Officer / Desk Clerk notes or rejection reasons
        const feedback =
          res.clerk_notes ||
          res.rejection_reason ||
          res.validation_summary?.clarification_reason ||
          res.validation_summary?.rejection_reason ||
          res.validation_summary?.desk_clerk_notes ||
          null
        if (feedback) {
          setClerkFeedback(feedback)
        }

        if (res?.documents && Array.isArray(res.documents)) {
          setUploadedDocs((prev) => {
            const nextDocs = { ...prev }
            res.documents.forEach((d) => {
              if (d.doc_type && nextDocs.hasOwnProperty(d.doc_type)) {
                nextDocs[d.doc_type] = {
                  id: d.id,
                  doc_type: d.doc_type,
                  subtype: d.extracted_fields?.subtype || d.doc_type,
                  filename: d.filename || d.extracted_fields?.original_filename || 'document',
                  file_ref: d.file_ref,
                  extracted_fields: d.extracted_fields || {},
                  confidence_score: d.confidence_score,
                  verification_status: d.verification_status,
                  rejection_notes: d.rejection_notes || (d.mismatch_resolutions || {}).rejection_reason || null,
                  sizeKb: '—',
                }
              }
            })
            return nextDocs
          })
        }
      })
      .catch((err) => {
        console.warn('Could not fetch existing draft details:', err)
      })

    return () => { mounted = false }
  }, [draftId, serviceParam, navigate])

  // Field change handler
  const handleFieldChange = (field, value) => {
    setParticulars((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'marital_status' && value === 'No') {
        next.husband_name = ''
      }
      return next
    })
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  // Document file upload handler with Async OCR & Feedback Modal
  const handleFileUpload = async (slotKey, file) => {
    if (!file || !draftId) return
    const isBypassed = ['passport_image', 'signature'].includes(slotKey)
    const docName = docSubtypes[slotKey] || DOC_LABEL_MAP[slotKey] || slotKey

    const fileSizeStr = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`

    // Open screen-blocking OCR feedback modal
    setOcrModal({
      isOpen: true,
      docType: slotKey,
      docName,
      fileName: file.name,
      fileSize: fileSizeStr,
      step: 1,
      isBypassed,
      error: null,
      isComplete: false,
    })

    setUploadingSlots((prev) => ({ ...prev, [slotKey]: true }))
    setFormErrors((prev) => {
      const next = { ...prev }
      delete next[slotKey]
      return next
    })

    // Multi-step progress animation while async OCR runs
    let stepTimer1 = null
    let stepTimer2 = null
    if (!isBypassed) {
      stepTimer1 = setTimeout(() => {
        setOcrModal((prev) => (prev.isOpen && !prev.isComplete ? { ...prev, step: 2 } : prev))
      }, 1100)
      stepTimer2 = setTimeout(() => {
        setOcrModal((prev) => (prev.isOpen && !prev.isComplete ? { ...prev, step: 3 } : prev))
      }, 3200)
    }

    try {
      const formData = new FormData()
      formData.append('doc_type', slotKey)
      if (docSubtypes[slotKey]) {
        formData.append('doc_subtype', docSubtypes[slotKey])
      }
      formData.append('file', file)

      const res = await applicationsApi.uploadDraftDocument(draftId, formData)
      if (stepTimer1) clearTimeout(stepTimer1)
      if (stepTimer2) clearTimeout(stepTimer2)

      if (res?.document) {
        setOcrModal((prev) => ({
          ...prev,
          step: 4,
          isComplete: true,
        }))

        const extractedFields = res.document.extracted_fields || res.ocr_result?.extracted_fields || {}
        const confidence = res.document.confidence_score ?? res.ocr_result?.confidence ?? 1.0

        setUploadedDocs((prev) => ({
          ...prev,
          [slotKey]: {
            ...res.document,
            extracted_fields: extractedFields,
            confidence_score: confidence,
            ocr_result: res.ocr_result,
            fileObj: file,
            sizeKb: (file.size / 1024).toFixed(1),
          },
        }))

        // Auto-close modal after brief completion animation
        setTimeout(() => {
          setOcrModal((prev) => ({ ...prev, isOpen: false }))
        }, 850)
      } else {
        throw new Error(res?.detail || 'Document upload failed.')
      }
    } catch (err) {
      if (stepTimer1) clearTimeout(stepTimer1)
      if (stepTimer2) clearTimeout(stepTimer2)
      console.error(`Failed to upload ${slotKey}:`, err)
      let msg = err.message || 'File upload failed. Please try again.'
      if (msg.toLowerCase().includes('timeout')) {
        msg = 'OCR document scanning timed out. Please try re-uploading with a clearer or smaller file.'
      }
      setFormErrors((prev) => ({
        ...prev,
        [slotKey]: msg,
      }))
      setOcrModal((prev) => ({
        ...prev,
        error: msg,
      }))
    } finally {
      setUploadingSlots((prev) => ({ ...prev, [slotKey]: false }))
    }
  }

  // Auto-fill form particulars from extracted OCR fields
  const handleAutoFillFromOcr = (slotKey) => {
    const doc = uploadedDocs[slotKey]
    if (!doc || !doc.extracted_fields) return

    const fields = doc.extracted_fields
    const updated = { ...particulars }
    let filledCount = 0

    // Match Applicant Name
    const rawName = fields.name || fields.applicant_name || fields.full_name
    if (rawName && typeof rawName === 'string' && rawName.trim()) {
      updated.name = rawName.trim()
      filledCount++
    }

    // Match Father's Name
    const rawFather = fields.father_name || fields.care_of
    if (rawFather && typeof rawFather === 'string' && rawFather.trim()) {
      const cleanedFather = rawFather.replace(/^(S\/O|D\/O|W\/O|C\/O)[:\s-]*/i, '').trim()
      if (cleanedFather) {
        updated.father_name = cleanedFather
        filledCount++
      }
    }

    // Match Mother's Name
    const rawMother = fields.mother_name
    if (rawMother && typeof rawMother === 'string' && rawMother.trim()) {
      updated.mother_name = rawMother.trim()
      filledCount++
    }

    // Match DOB (parse DD-MM-YYYY or DD/MM/YYYY into YYYY-MM-DD for date input)
    const rawDob = fields.dob || fields.date_of_birth || fields.birth_date
    if (rawDob && typeof rawDob === 'string' && rawDob.trim()) {
      let isoDate = rawDob.trim()
      const dmyMatch = isoDate.match(/^(\d{2})[-/.](\d{2})[-/.](\d{4})$/)
      if (dmyMatch) {
        isoDate = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
        updated.dob = isoDate
        filledCount++
      }
    }

    // Match Gender / Sex
    const rawGender = fields.gender || fields.sex
    if (rawGender && typeof rawGender === 'string') {
      const g = rawGender.trim().toLowerCase()
      if (g.startsWith('m')) {
        updated.sex = 'Male'
        filledCount++
      } else if (g.startsWith('f')) {
        updated.sex = 'Female'
        filledCount++
      } else if (g.startsWith('o')) {
        updated.sex = 'Others'
        filledCount++
      }
    }

    // Match Address
    const rawAddress = fields.address || fields.permanent_address || fields.present_address
    if (rawAddress && typeof rawAddress === 'string' && rawAddress.trim()) {
      updated.address = rawAddress.trim()
      filledCount++
    }

    if (filledCount > 0) {
      setParticulars(updated)
      setAutoFillToast(`Auto-filled ${filledCount} field${filledCount > 1 ? 's' : ''} from ${docSubtypes[slotKey] || DOC_LABEL_MAP[slotKey]}!`)
      setTimeout(() => setAutoFillToast(''), 4000)
    } else {
      setAutoFillToast(`No matching standard identity fields found to auto-fill.`)
      setTimeout(() => setAutoFillToast(''), 3000)
    }
  }

  // Render OCR Extraction Summary Box
  const renderOcrSummary = (slotKey) => {
    const doc = uploadedDocs[slotKey]
    if (!doc) return null

    const isBypassed = ['passport_image', 'signature'].includes(slotKey)
    if (isBypassed) {
      return (
        <div className={styles.biometricBypassBadge}>
          <ShieldCheck size={14} />
          <span>Biometric Fidelity Verified &bull; Direct Proof</span>
        </div>
      )
    }

    const fields = doc.extracted_fields || {}
    const displayEntries = Object.entries(fields).filter(
      ([k, v]) => !['original_filename', 'subtype'].includes(k) && v !== null && v !== undefined && String(v).trim() !== ''
    )

    const hasParticularsMatch = Boolean(
      fields.name || fields.applicant_name || fields.father_name || fields.dob || fields.date_of_birth || fields.address || fields.gender
    )

    const confidencePct = doc.confidence_score ? Math.round(doc.confidence_score * 100) : null

    return (
      <div className={styles.ocrExtractedBox}>
        <div className={styles.ocrExtractedHeader}>
          <div className={styles.ocrExtractedTitleWrap}>
            <span className={styles.ocrBadge}>
              <Sparkles size={13} />
              AI Vision OCR Extracted
            </span>
            {confidencePct !== null && (
              <span className={styles.ocrConfidenceBadge}>
                ({confidencePct}% confidence)
              </span>
            )}
          </div>

          {hasParticularsMatch && (
            <button
              type="button"
              className={styles.autoFillBtn}
              onClick={() => handleAutoFillFromOcr(slotKey)}
              title="Transfer detected fields into form particulars"
            >
              <Sparkles size={13} />
              Auto-fill matching form fields
            </button>
          )}
        </div>

        {displayEntries.length > 0 ? (
          <div className={styles.ocrChipsGrid}>
            {displayEntries.map(([key, val]) => {
              const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
              return (
                <div key={key} className={styles.ocrChip}>
                  <span className={styles.ocrChipLabel}>{formattedKey}:</span>
                  <span className={styles.ocrChipVal}>{String(val)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: '0.76rem', color: '#166534', fontStyle: 'italic' }}>
            Optical scan completed & verified. Document text indexed into application storage.
          </div>
        )}
      </div>
    )
  }

  // Render Reviewing Officer Rejection Alert for a specific document
  const renderRejectedNotice = (slotKey) => {
    const doc = uploadedDocs[slotKey]
    if (doc?.verification_status !== 'REJECTED') return null
    return (
      <div className={styles.rejectedDocAlert}>
        <AlertCircle size={18} className={styles.feedbackIcon} />
        <div>
          <div className={styles.rejectedAlertTitle}>
            ⚠️ REJECTED BY REVIEWING OFFICER — RE-UPLOAD REQUIRED
          </div>
          {doc.rejection_notes && (
            <p className={styles.rejectedDocReason}>
              Officer Comment: "{doc.rejection_notes}"
            </p>
          )}
        </div>
      </div>
    )
  }

  // Delete uploaded document
  const handleDeleteDoc = async (slotKey) => {
    const doc = uploadedDocs[slotKey]
    if (doc?.id && draftId) {
      try {
        await applicationsApi.deleteDraftDocument(draftId, doc.id)
      } catch (err) {
        console.warn('Delete error:', err)
      }
    }
    setUploadedDocs((prev) => ({ ...prev, [slotKey]: null }))
  }

  // Validation before confirmation
  const validateForm = () => {
    const errors = {}

    if (!particulars.name?.trim()) errors.name = 'Name is required'
    if (!particulars.father_name?.trim()) errors.father_name = "Father's Name is required"
    if (!particulars.mother_name?.trim()) errors.mother_name = "Mother's Name is required"
    if (!particulars.dob) errors.dob = 'Date of Birth is required'
    if (!particulars.address?.trim()) errors.address = 'Present Residential Address is required'

    if (particulars.marital_status === 'Yes' && !particulars.husband_name?.trim()) {
      errors.husband_name = "Husband's Name is required if married"
    }

    if (serviceId === 'domicile_certificate' && !particulars.years_of_residence) {
      errors.years_of_residence = 'Years of residence is required for Domicile certificate'
    }

    if (serviceId === 'income_certificate' && !particulars.purpose?.trim()) {
      errors.purpose = 'Purpose of certificate is required for Income certificate'
    }

    // Check enclosed documents
    if (!uploadedDocs.identity_proof) errors.identity_proof = 'Identity proof document is required'
    if (!uploadedDocs.residential_proof) errors.residential_proof = 'Residential proof document is required'
    if (!uploadedDocs.age_proof) errors.age_proof = 'Proof of Age document is required'
    if (!uploadedDocs.signature) errors.signature = 'Signature file is required'
    if (!uploadedDocs.passport_image) errors.passport_image = 'Passport image is required'

    // Prevent submission if any document remains in REJECTED state
    Object.entries(uploadedDocs).forEach(([slotKey, doc]) => {
      if (doc?.verification_status === 'REJECTED') {
        errors[slotKey] = `The ${DOC_LABEL_MAP[slotKey] || slotKey} was rejected by the reviewing officer. Please re-upload a valid document before submitting.`
      }
    })

    // Statutory declaration
    if (!declarationAccepted) {
      errors.declaration = 'You must confirm the statutory declaration before proceeding'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle proceed to confirmation
  const handleProceedToConfirm = (e) => {
    e.preventDefault()
    if (validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setCurrentStep('confirm')
    } else {
      window.scrollTo({ top: 400, behavior: 'smooth' })
    }
  }

  // Final Submit
  const handleFinalSubmit = async () => {
    setIsSubmitting(true)
    setLoadError('')

    try {
      const payload = {
        service_id: serviceId,
        fields: {
          applicant_name: particulars.name,
          father_name: particulars.father_name,
          mother_name: particulars.mother_name,
          date_of_birth: particulars.dob,
          sex: particulars.sex,
          marital_status: particulars.marital_status,
          husband_name: particulars.husband_name,
          address: particulars.address,
          years_of_residence: particulars.years_of_residence,
          purpose_of_certificate: particulars.purpose,
          identity_proof_type: docSubtypes.identity_proof,
          residential_proof_type: docSubtypes.residential_proof,
          age_proof_type: docSubtypes.age_proof,
        },
        declaration_confirmed: declarationAccepted,
      }

      const res = await applicationsApi.manualSubmit(draftId, payload)
      if (res?.success) {
        setSubmissionResult(res)
        setCurrentStep('success')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (err) {
      console.error('Final submit failed:', err)
      setLoadError(err.message || 'Submission failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Discard draft and exit
  const handleDiscardAndExit = async () => {
    if (window.confirm('Are you sure you want to discard this application draft? Any unsaved changes will be lost.')) {
      try {
        await applicationsApi.discardDraft(draftId)
      } catch (err) {
        console.warn('Discard warning:', err)
      }
      navigate('/dashboard')
    }
  }

  if (initializingDraft) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '360px', gap: '16px', background: '#ffffff', borderRadius: '16px', border: '1.5px solid #e2e8f0', padding: '48px 24px', textAlign: 'center' }}>
          <Loader2 size={40} className={styles.spin} style={{ color: '#2563eb' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Initializing Application Form...</h3>
          <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Preparing your statutory form session. Please wait a moment...</p>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // 1. SUBMISSION SUCCESS VIEW
  // ════════════════════════════════════════════════════════════════
  if (currentStep === 'success' && submissionResult) {
    return (
      <div className={styles.container}>
        <div className={styles.successCard}>
          <div className={styles.successIconWrap}>
            <CheckCircle2 size={48} className={styles.successIcon} />
          </div>

          <h1 className={styles.successTitle}>{t("manualForm.successTitle", "Application Submitted Successfully!")}</h1>
          <p className={styles.successSubtitle}>
            Your statutory application for <strong>{submissionResult.service_name}</strong> has been received by the Revenue Department.
          </p>

          <div className={styles.receiptBox}>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Tracking ID</span>
              <strong className={styles.receiptValueTracking}>{submissionResult.tracking_id}</strong>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Certificate ID</span>
              <span className={styles.receiptValue}>{submissionResult.certificate_id || submissionResult.application_number}</span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Citizen ID</span>
              <span className={styles.receiptValue}>{citizenUser?.citizen_id || citizenUser?.citizen_ref || submissionResult.citizen_id || 'N/A'}</span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Application Number</span>
              <span className={styles.receiptValue}>{submissionResult.application_number}</span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Current Status</span>
              <span className={styles.receiptStatusPill}>Submitted</span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.receiptLabel}>Submission Date</span>
              <span className={styles.receiptValue}>
                {new Date(submissionResult.submitted_at).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          </div>

          <div className={styles.infoAlert}>
            <Clock size={18} className={styles.infoAlertIcon} />
            <div>
              <strong>{t('manualForm.nextStepsTitle', 'Next Steps:')}</strong> {t('manualForm.nextStepsDesc', 'Your application is queued in the Submitted directory for initial desk clerk verification. You can track real-time progression in your Citizen Dashboard.')}
            </div>
          </div>

          <div className={styles.successActions}>
            <button
              type="button"
              className={styles.btnPrintReceipt}
              onClick={() => setShowReceiptModal(true)}
            >
              <Printer size={18} />
              <span>{t("manualForm.printReceipt", "Print Application Receipt")}</span>
            </button>
            <Link to="/dashboard" className={styles.btnPrimary}>
              {t("manualForm.returnDashboard", "Return to Dashboard")}
            </Link>
            <Link to="/applications" className={styles.btnSecondary}>
              {t("profile.myApplications", "View My Applications")}
            </Link>
          </div>

          <ApplicationReceiptModal
            isOpen={showReceiptModal}
            onClose={() => setShowReceiptModal(false)}
            data={{
              certificateId: submissionResult.certificate_id || submissionResult.application_number,
              citizenId: citizenUser?.citizen_id || citizenUser?.citizen_ref || submissionResult.citizen_id || 'CIT-USER',
              trackingId: submissionResult.tracking_id,
              applicationNumber: submissionResult.application_number,
              serviceName: submissionResult.service_name || certName,
              submittedAt: submissionResult.submitted_at || new Date().toISOString(),
              status: 'Submitted',
              formType: 'Manual Application Form',
              particulars: particulars,
              enclosedDocs: uploadedDocs,
              docSubtypes: docSubtypes,
            }}
          />
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // 2. PRE-SUBMISSION CONFIRMATION VIEW
  // ════════════════════════════════════════════════════════════════
  if (currentStep === 'confirm') {
    return (
      <div className={styles.container}>
        {/* Navigation Breadcrumb */}
        <div className={styles.breadcrumb}>
          <button 
            type="button" 
            className={styles.backBtn}
            onClick={() => setCurrentStep('form')}
          >
            <ArrowLeft size={16} />
            <span>{t("manualForm.backEdit", "Back to Edit Form")}</span>
          </button>
          <span className={styles.breadSep}>/</span>
          <span className={styles.breadCurrent}>{t("manualForm.stepReview", "Confirmation Review")}</span>
        </div>

        {/* Confirmation Card */}
        <div className={styles.formPaper}>
          <div className={styles.confirmHeader}>
            <div className={styles.govtInsigniaWrap}>
              <div className={styles.govtEmblem}>सत्यमेव जयते</div>
              <span className={styles.govtSubtitle}>{t("manualForm.revenueDeptHeader", "GOVERNMENT REVENUE SERVICES • VERIFICATION PORTAL")}</span>
            </div>
            <h1 className={styles.confirmTitle}>{t("manualForm.reviewTitle", "Review & Confirm Application Details")}</h1>
            <p className={styles.confirmNotice}>
              {t("manualForm.reviewSubtitle", "Please verify all entered particulars and enclosed documents before final statutory submission.")}
            </p>
          </div>

          {loadError && (
            <div className={styles.errorBanner}>
              <AlertCircle size={18} />
              <span>{loadError}</span>
            </div>
          )}

          {/* Certificate Banner & Statutory Identifiers */}
          <div className={styles.certBanner}>
            <div className={styles.certBannerLeft}>
              <span className={styles.certBannerLabel}>{t("manualForm.targetService", "Target Service")}</span>
              <h2 className={styles.certBannerName}>{certName}</h2>
            </div>
            <div className={styles.certBannerRight}>
              <div className={styles.certBannerIdTag}>
                <span className={styles.certBannerIdLabel}>Tracking ID:</span>
                <span className={styles.certBannerIdValue}>{draftApp?.tracking_id || 'Generating...'}</span>
              </div>
              <div className={styles.certBannerIdTag}>
                <span className={styles.certBannerIdLabel}>Certificate ID:</span>
                <span className={styles.certBannerIdValue}>{draftApp?.certificate_id || draftApp?.application_number || 'Generating...'}</span>
              </div>
            </div>
          </div>

          {/* Particulars Review Table */}
          <div className={styles.reviewSection}>
            <h3 className={styles.reviewSectionTitle}>
              <User size={18} />
              {t("manualForm.applicantParticulars", "Applicant Particulars")}
            </h3>
            <div className={styles.reviewGrid}>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>1. Name</span>
                <span className={styles.reviewValue}>{particulars.name || '—'}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>2. Father's Name</span>
                <span className={styles.reviewValue}>{particulars.father_name || '—'}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>3. Mother's Name</span>
                <span className={styles.reviewValue}>{particulars.mother_name || '—'}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>4. Date of Birth</span>
                <span className={styles.reviewValue}>{particulars.dob || '—'}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>5. Sex</span>
                <span className={styles.reviewValue}>{particulars.sex || '—'}</span>
              </div>
              <div className={styles.reviewItem}>
                <span className={styles.reviewLabel}>6. Marital Status</span>
                <span className={styles.reviewValue}>{particulars.marital_status}</span>
              </div>
              {particulars.marital_status === 'Yes' && (
                <div className={styles.reviewItem}>
                  <span className={styles.reviewLabel}>7. Husband's Name</span>
                  <span className={styles.reviewValue}>{particulars.husband_name || '—'}</span>
                </div>
              )}
              <div className={`${styles.reviewItem} ${styles.reviewItemFull}`}>
                <span className={styles.reviewLabel}>8. Present Residential Address</span>
                <span className={styles.reviewValue}>{particulars.address || '—'}</span>
              </div>
              {serviceId === 'domicile_certificate' && (
                <div className={styles.reviewItem}>
                  <span className={styles.reviewLabel}>9. Years of residence</span>
                  <span className={styles.reviewValue}>{particulars.years_of_residence} years</span>
                </div>
              )}
              {serviceId === 'income_certificate' && (
                <div className={styles.reviewItem}>
                  <span className={styles.reviewLabel}>10. Purpose of certificate</span>
                  <span className={styles.reviewValue}>{particulars.purpose || '—'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Enclosed Documents Review */}
          <div className={styles.reviewSection}>
            <h3 className={styles.reviewSectionTitle}>
              <FileCheck size={18} />
              {t("manualForm.enclosedDocuments", "Enclosed Documents Verification")}
            </h3>
            <div className={styles.docsReviewGrid}>
              <div className={styles.docReviewItem}>
                <div className={styles.docReviewHeader}>
                  <span className={styles.docReviewCategory}>Identity Proof</span>
                  <span className={styles.docReviewSubtype}>{docSubtypes.identity_proof}</span>
                </div>
                <div className={styles.docFileStatus}>
                  <CheckCircle2 size={16} className={styles.docSuccessIcon} />
                  <span className={styles.docFileName}>{uploadedDocs.identity_proof?.filename}</span>
                </div>
              </div>

              <div className={styles.docReviewItem}>
                <div className={styles.docReviewHeader}>
                  <span className={styles.docReviewCategory}>Residential Proof</span>
                  <span className={styles.docReviewSubtype}>{docSubtypes.residential_proof}</span>
                </div>
                <div className={styles.docFileStatus}>
                  <CheckCircle2 size={16} className={styles.docSuccessIcon} />
                  <span className={styles.docFileName}>{uploadedDocs.residential_proof?.filename}</span>
                </div>
              </div>

              <div className={styles.docReviewItem}>
                <div className={styles.docReviewHeader}>
                  <span className={styles.docReviewCategory}>Proof of Age</span>
                  <span className={styles.docReviewSubtype}>{docSubtypes.age_proof}</span>
                </div>
                <div className={styles.docFileStatus}>
                  <CheckCircle2 size={16} className={styles.docSuccessIcon} />
                  <span className={styles.docFileName}>{uploadedDocs.age_proof?.filename}</span>
                </div>
              </div>

              <div className={styles.docReviewItem}>
                <div className={styles.docReviewHeader}>
                  <span className={styles.docReviewCategory}>Applicant Signature</span>
                </div>
                <div className={styles.docFileStatus}>
                  <CheckCircle2 size={16} className={styles.docSuccessIcon} />
                  <span className={styles.docFileName}>{uploadedDocs.signature?.filename}</span>
                </div>
              </div>

              <div className={styles.docReviewItem}>
                <div className={styles.docReviewHeader}>
                  <span className={styles.docReviewCategory}>Passport Image</span>
                </div>
                <div className={styles.docFileStatus}>
                  <CheckCircle2 size={16} className={styles.docSuccessIcon} />
                  <span className={styles.docFileName}>{uploadedDocs.passport_image?.filename}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Statutory Declaration Review Box */}
          <div className={styles.declarationConfirmBox}>
            <div className={styles.declIconWrap}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <h4 className={styles.declHeading}>{t("manualForm.declarationTitle", "Statutory Declaration Acknowledged")}</h4>
              <p className={styles.declText}>
                "The above particulars are correct as per the best of my knowledge. In case of any false information, I shall be held responsible and appropriate action may be taken against me."
              </p>
            </div>
          </div>

          {/* Bottom Confirmation Actions */}
          <div className={styles.confirmActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setCurrentStep('form')}
              disabled={isSubmitting}
            >
              <ArrowLeft size={16} />
              <span>{t("manualForm.backEdit", "Back to Edit Form")}</span>
            </button>

            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className={styles.spin} />
                  <span>{t("manualForm.submitting", "Submitting to Government Portal...")}</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>{t("manualForm.submitApplication", "Submit Application")}</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // 3. MAIN FORM FILL VIEW (from docs-resources/application form format.txt)
  // ════════════════════════════════════════════════════════════════
  return (
    <div className={styles.container}>
      {/* Top Header / Bar */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button 
            type="button" 
            className={styles.backBtn}
            onClick={handleDiscardAndExit}
            title={t("manualForm.discardDraftTooltip", "Discard draft and go back")}
          >
            <ArrowLeft size={16} />
            <span>{t("manualForm.cancelReturn", "Cancel & Return")}</span>
          </button>
          <div className={styles.draftPill}>
            <span className={styles.draftDot} />
            <span>Draft Session • Ref: {draftApp?.tracking_id || draftId?.slice(0, 8)}</span>
          </div>
        </div>

        <button 
          type="button" 
          className={styles.discardBtn}
          onClick={handleDiscardAndExit}
        >
          <Trash2 size={15} />
          <span>{t("manualForm.discardDraft", "Discard Draft")}</span>
        </button>
      </div>

      {/* Official Form Sheet Paper */}
      <div className={styles.formPaper}>

        {/* Reviewing Officer Feedback Banner */}
        {(clerkFeedback || draftApp?.status === 'CORRECTION_NEEDED' || draftApp?.status === 'REJECTED' || draftApp?.has_rejected_documents) && (
          <div className={styles.officerFeedbackBanner}>
            <div className={styles.feedbackHeader}>
              <AlertCircle size={22} className={styles.feedbackIcon} />
              <div className={styles.feedbackHeaderText}>
                <span>Reviewing Officer Action / Feedback Notice</span>
                <span className={styles.feedbackStatusBadge}>
                  {draftApp?.status === 'REJECTED' ? 'Application Rejected' : 'Correction Needed'}
                </span>
              </div>
            </div>
            <div className={styles.feedbackBody}>
              {clerkFeedback && (
                <p className={styles.feedbackComment}>
                  "{clerkFeedback}"
                </p>
              )}
              <p className={styles.feedbackInstruction}>
                Please review the feedback above, rectify any particulars, re-upload the highlighted rejected document(s), and proceed to re-submit your application for officer verification.
              </p>
            </div>
          </div>
        )}
        
        {/* Emblem & Official Header */}
        <div className={styles.paperHeader}>
          <div className={styles.emblemText}>सत्यमेव जयते</div>
          <h2 className={styles.stateHeading}>{t("manualForm.revenueDeptHeader", "GOVERNMENT OF MAHARASHTRA • REVENUE DEPARTMENT")}</h2>
          
          {/* Dynamic Certificate Title */}
          <h1 className={styles.formMainTitle}>
            Application form for {certName}
          </h1>

          {/* Dynamic Preamble from format.txt */}
          <p className={styles.formPreamble}>
            I do hereby apply for issue of <strong>{certName}</strong>. my particulars are as under -
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleProceedToConfirm} className={styles.formContent}>

          {/* Official Administrative Section: Tracking ID & Certificate ID (Non-Editable) */}
          <div className={styles.identifierBox}>
            <div className={styles.identifierHeader}>
              <div className={styles.identifierHeaderTitle}>
                <Lock size={15} className={styles.lockIcon} />
                <span>{t("manualForm.officialIdentifiers", "Official Application Identifiers (Non-Editable)")}</span>
              </div>
              <span className={styles.systemGeneratedTag}>{t("manualForm.systemGenerated", "System Generated")}</span>
            </div>

            <div className={styles.twoColGrid}>
              {/* Tracking ID */}
              <div className={styles.formGroup}>
                <div className={styles.fieldLabelRow}>
                  <label className={styles.fieldLabel} htmlFor="form-tracking-id">
                    Tracking ID
                  </label>
                  <span className={styles.nonEditableBadge}>{t("manualForm.nonEditable", "Non-Editable")}</span>
                </div>
                <div className={styles.inputIconWrap}>
                  <Hash size={17} className={styles.inputIcon} />
                  <input
                    id="form-tracking-id"
                    type="text"
                    readOnly
                    disabled
                    aria-readonly="true"
                    className={`${styles.textInput} ${styles.readonlyInput}`}
                    value={draftApp?.tracking_id || 'Generating...'}
                    title="Unique Tracking ID allocated for this application (Non-editable)"
                  />
                </div>
                <span className={styles.fieldHelpText}>
                  Citizen tracking reference for lifecycle status queries
                </span>
              </div>

              {/* Certificate ID */}
              <div className={styles.formGroup}>
                <div className={styles.fieldLabelRow}>
                  <label className={styles.fieldLabel} htmlFor="form-certificate-id">
                    Certificate ID
                  </label>
                  <span className={styles.nonEditableBadge}>{t("manualForm.nonEditable", "Non-Editable")}</span>
                </div>
                <div className={styles.inputIconWrap}>
                  <FileCheck size={17} className={styles.inputIcon} />
                  <input
                    id="form-certificate-id"
                    type="text"
                    readOnly
                    disabled
                    aria-readonly="true"
                    className={`${styles.textInput} ${styles.readonlyInput}`}
                    value={draftApp?.certificate_id || draftApp?.application_number || 'Generating...'}
                    title="Statutory Certificate Application ID (Non-editable)"
                  />
                </div>
                <span className={styles.fieldHelpText}>
                  Statutory registration number for the requested certificate
                </span>
              </div>
            </div>
          </div>

          <div className={styles.sectionDivider}>
            <span>{t("manualForm.applicantParticulars", "Applicant Particulars")}</span>
          </div>

          {/* 1. Name */}
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>
              {t("manualForm.legalName", "1. Name")} <span className={styles.requiredStar}>*</span>
            </label>
            <div className={styles.inputIconWrap}>
              <User size={18} className={styles.inputIcon} />
              <input
                type="text"
                className={`${styles.textInput} ${formErrors.name ? styles.inputError : ''}`}
                value={particulars.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder={t("manualForm.legalNamePlaceholder", "Enter full legal name as per government records")}
              />
            </div>
            {formErrors.name && <span className={styles.errorText}>{formErrors.name}</span>}
          </div>

          {/* 2. Father's Name & 3. Mother's Name */}
          <div className={styles.twoColGrid}>
            <div className={styles.formGroup}>
              <label className={styles.fieldLabel}>
                {t("manualForm.fatherName", "2. Father's Name")} <span className={styles.requiredStar}>*</span>
              </label>
              <input
                type="text"
                className={`${styles.textInput} ${formErrors.father_name ? styles.inputError : ''}`}
                value={particulars.father_name}
                onChange={(e) => handleFieldChange('father_name', e.target.value)}
                placeholder={t("manualForm.fatherNamePlaceholder", "Enter father's full name")}
              />
              {formErrors.father_name && <span className={styles.errorText}>{formErrors.father_name}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.fieldLabel}>
                {t("manualForm.motherName", "3. Mother's Name")} <span className={styles.requiredStar}>*</span>
              </label>
              <input
                type="text"
                className={`${styles.textInput} ${formErrors.mother_name ? styles.inputError : ''}`}
                value={particulars.mother_name}
                onChange={(e) => handleFieldChange('mother_name', e.target.value)}
                placeholder={t("manualForm.motherNamePlaceholder", "Enter mother's full name")}
              />
              {formErrors.mother_name && <span className={styles.errorText}>{formErrors.mother_name}</span>}
            </div>
          </div>

          {/* 4. Date of Birth & 5. Sex */}
          <div className={styles.twoColGrid}>
            <div className={styles.formGroup}>
              <label className={styles.fieldLabel}>
                {t("manualForm.dob", "4. Date of Birth")} <span className={styles.requiredStar}>*</span>
              </label>
              <div className={styles.inputIconWrap}>
                <Calendar size={18} className={styles.inputIcon} />
                <input
                  type="date"
                  className={`${styles.textInput} ${formErrors.dob ? styles.inputError : ''}`}
                  value={particulars.dob}
                  onChange={(e) => handleFieldChange('dob', e.target.value)}
                />
              </div>
              {formErrors.dob && <span className={styles.errorText}>{formErrors.dob}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.fieldLabel}>
                {t("manualForm.sex", "5. Sex (Male/Female/others)")} <span className={styles.requiredStar}>*</span>
              </label>
              <select
                className={styles.selectInput}
                value={particulars.sex}
                onChange={(e) => handleFieldChange('sex', e.target.value)}
              >
                <option value="Male">{t("manualForm.male", "Male")}</option>
                <option value="Female">{t("manualForm.female", "Female")}</option>
                <option value="Others">{t("manualForm.others", "Others")}</option>
              </select>
            </div>
          </div>

          {/* 6. Marital Status & 7. If Yes Husband's Name */}
          <div className={styles.twoColGrid}>
            <div className={styles.formGroup}>
              <label className={styles.fieldLabel}>
                {t("manualForm.maritalStatus", "6. Marital Status (Yes/No)")} <span className={styles.requiredStar}>*</span>
              </label>
              <div className={styles.radioGroup}>
                <label className={`${styles.radioLabel} ${particulars.marital_status === 'No' ? styles.radioSelected : ''}`}>
                  <input
                    type="radio"
                    name="marital_status"
                    value="No"
                    checked={particulars.marital_status === 'No'}
                    onChange={() => handleFieldChange('marital_status', 'No')}
                  />
                  <span>{t("manualForm.unmarried", "No (Unmarried)")}</span>
                </label>
                <label className={`${styles.radioLabel} ${particulars.marital_status === 'Yes' ? styles.radioSelected : ''}`}>
                  <input
                    type="radio"
                    name="marital_status"
                    value="Yes"
                    checked={particulars.marital_status === 'Yes'}
                    onChange={() => handleFieldChange('marital_status', 'Yes')}
                  />
                  <span>{t("manualForm.married", "Yes (Married)")}</span>
                </label>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.fieldLabel}>
                {t("manualForm.husbandName", "7. If Yes Husband's Name")} {particulars.marital_status === 'Yes' && <span className={styles.requiredStar}>*</span>}
              </label>
              <input
                type="text"
                disabled={particulars.marital_status !== 'Yes'}
                className={`${styles.textInput} ${formErrors.husband_name ? styles.inputError : ''}`}
                value={particulars.husband_name}
                onChange={(e) => handleFieldChange('husband_name', e.target.value)}
                placeholder={particulars.marital_status === 'Yes' ? "Enter husband's full name" : 'Applicable only if married'}
              />
              {formErrors.husband_name && <span className={styles.errorText}>{formErrors.husband_name}</span>}
            </div>
          </div>

          {/* 8. Present Residential Address */}
          <div className={styles.formGroup}>
            <label className={styles.fieldLabel}>
              {t("manualForm.address", "8. Present Residential Address")} <span className={styles.requiredStar}>*</span>
            </label>
            <div className={styles.inputIconWrap}>
              <MapPin size={18} className={styles.inputIconTop} />
              <textarea
                rows={3}
                className={`${styles.textAreaInput} ${formErrors.address ? styles.inputError : ''}`}
                value={particulars.address}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                placeholder={t("manualForm.addressPlaceholder", "Enter complete door no, street, taluka, district, state & pincode")}
              />
            </div>
            {formErrors.address && <span className={styles.errorText}>{formErrors.address}</span>}
          </div>

          {/* 9. Years of residence (Only for Domicile certificate) */}
          {serviceId === 'domicile_certificate' && (
            <div className={styles.conditionalGroup}>
              <div className={styles.conditionalTag}>{t("manualForm.domicileSpecific", "Domicile Specific Field")}</div>
              <label className={styles.fieldLabel}>
                {t("manualForm.yearsOfResidence", "9. Years of residence (Only for Domicile certificate)")} <span className={styles.requiredStar}>*</span>
              </label>
              <input
                type="number"
                min="1"
                max="100"
                className={`${styles.textInput} ${formErrors.years_of_residence ? styles.inputError : ''}`}
                value={particulars.years_of_residence}
                onChange={(e) => handleFieldChange('years_of_residence', e.target.value)}
                placeholder="e.g. 2 (Minimum 2-5 years for state domicile)"
              />
              {formErrors.years_of_residence && (
                <span className={styles.errorText}>{formErrors.years_of_residence}</span>
              )}
            </div>
          )}

          {/* 10. Purpose of the certificate (Only for Income certificate) */}
          {serviceId === 'income_certificate' && (
            <div className={styles.conditionalGroup}>
              <div className={styles.conditionalTag}>Income Certificate Specific Field</div>
              <label className={styles.fieldLabel}>
                {t("manualForm.purpose", "10. Purpose of the certificate (Only for Income certificate)")} <span className={styles.requiredStar}>*</span>
              </label>
              <input
                type="text"
                className={`${styles.textInput} ${formErrors.purpose ? styles.inputError : ''}`}
                value={particulars.purpose}
                onChange={(e) => handleFieldChange('purpose', e.target.value)}
                placeholder="e.g. Higher Education Scholarship, Fee Concession, Government Scheme"
              />
              <div className={styles.quickTagsRow}>
                <span className={styles.quickTagLabel}>{t("manualForm.commonPurposes", "Common purposes:")}</span>
                {['Education Scholarship', 'Government Welfare Scheme', 'Bank Loan Subsidy', 'Job Application'].map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    className={styles.quickTag}
                    onClick={() => handleFieldChange('purpose', tag)}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
              {formErrors.purpose && <span className={styles.errorText}>{formErrors.purpose}</span>}
            </div>
          )}

          {/* 11. Enclosed documents */}
          <div className={styles.documentsSection}>
            <div className={styles.docsSectionHeader}>
              <h3 className={styles.docsTitle}>{t("manualForm.enclosedDocuments", "11. Enclosed documents")}</h3>
              <p className={styles.docsSubtitle}>
                Please attach attested scans or digital copies (PDF, JPG, PNG up to 5MB each).
              </p>
            </div>

            {/* Document A: Identity proofs */}
            <div className={`${styles.docUploadCard} ${uploadedDocs.identity_proof?.verification_status === 'REJECTED' ? styles.docUploadCardRejected : ''}`}>
              <div className={styles.docHeaderRow}>
                <div>
                  <h4 className={styles.docCardTitle}>{t("manualForm.identityProof", "Identity proofs (any one)")} <span className={styles.requiredStar}>*</span></h4>
                  <p className={styles.docCardSub}>{t("manualForm.identityProofDesc", "Select any one valid government issued identity proof")}</p>
                </div>
                <select
                  className={styles.docSelect}
                  value={docSubtypes.identity_proof}
                  onChange={(e) => setDocSubtypes((prev) => ({ ...prev, identity_proof: e.target.value }))}
                >
                  {IDENTITY_PROOF_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {renderRejectedNotice('identity_proof')}

              {uploadedDocs.identity_proof ? (
                <>
                  <div className={`${styles.uploadedFileRow} ${uploadedDocs.identity_proof.verification_status === 'REJECTED' ? styles.uploadedFileRowRejected : ''}`}>
                    <div className={styles.uploadedFileInfo}>
                      {uploadedDocs.identity_proof.verification_status === 'REJECTED' ? (
                        <AlertCircle size={18} color="#e11d48" />
                      ) : (
                        <CheckCircle2 size={18} className={styles.docSuccessIcon} />
                      )}
                      <span className={styles.uploadedFileName}>{uploadedDocs.identity_proof.filename}</span>
                      {uploadedDocs.identity_proof.verification_status === 'REJECTED' ? (
                        <span className={styles.rejectedBadge}>REJECTED</span>
                      ) : (
                        <span className={styles.uploadedFileSize}>({uploadedDocs.identity_proof.sizeKb} KB)</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {uploadedDocs.identity_proof.verification_status === 'REJECTED' && (
                        <label className={styles.reuploadBtn} title="Re-upload valid document">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className={styles.hiddenFileInput}
                            onChange={(e) => handleFileUpload('identity_proof', e.target.files[0])}
                            disabled={uploadingSlots.identity_proof}
                          />
                          <Upload size={13} />
                          <span>Re-upload</span>
                        </label>
                      )}
                      <button 
                        type="button" 
                        className={styles.docDeleteBtn}
                        onClick={() => handleDeleteDoc('identity_proof')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {renderOcrSummary('identity_proof')}
                </>
              ) : (
                <label className={styles.uploadDropzone}>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className={styles.hiddenFileInput}
                    onChange={(e) => handleFileUpload('identity_proof', e.target.files[0])}
                    disabled={uploadingSlots.identity_proof}
                  />
                  {uploadingSlots.identity_proof ? (
                    <div className={styles.uploadingState}>
                      <Loader2 size={20} className={styles.spin} />
                      <span>Uploading {docSubtypes.identity_proof}...</span>
                    </div>
                  ) : (
                    <div className={styles.dropzonePrompt}>
                      <Upload size={20} className={styles.dropzoneIcon} />
                      <span>Click or drag to upload <strong>{docSubtypes.identity_proof}</strong></span>
                    </div>
                  )}
                </label>
              )}
              {formErrors.identity_proof && <span className={styles.errorText}>{formErrors.identity_proof}</span>}
            </div>

            {/* Document B: Residential Proof */}
            <div className={`${styles.docUploadCard} ${uploadedDocs.residential_proof?.verification_status === 'REJECTED' ? styles.docUploadCardRejected : ''}`}>
              <div className={styles.docHeaderRow}>
                <div>
                  <h4 className={styles.docCardTitle}>{t("manualForm.residentialProof", "Residential Proof (any one)")} <span className={styles.requiredStar}>*</span></h4>
                  <p className={styles.docCardSub}>{t("manualForm.residentialProofDesc", "Select any one valid address or property proof")}</p>
                </div>
                <select
                  className={styles.docSelect}
                  value={docSubtypes.residential_proof}
                  onChange={(e) => setDocSubtypes((prev) => ({ ...prev, residential_proof: e.target.value }))}
                >
                  {RESIDENTIAL_PROOF_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {renderRejectedNotice('residential_proof')}

              {uploadedDocs.residential_proof ? (
                <>
                  <div className={`${styles.uploadedFileRow} ${uploadedDocs.residential_proof.verification_status === 'REJECTED' ? styles.uploadedFileRowRejected : ''}`}>
                    <div className={styles.uploadedFileInfo}>
                      {uploadedDocs.residential_proof.verification_status === 'REJECTED' ? (
                        <AlertCircle size={18} color="#e11d48" />
                      ) : (
                        <CheckCircle2 size={18} className={styles.docSuccessIcon} />
                      )}
                      <span className={styles.uploadedFileName}>{uploadedDocs.residential_proof.filename}</span>
                      {uploadedDocs.residential_proof.verification_status === 'REJECTED' ? (
                        <span className={styles.rejectedBadge}>REJECTED</span>
                      ) : (
                        <span className={styles.uploadedFileSize}>({uploadedDocs.residential_proof.sizeKb} KB)</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {uploadedDocs.residential_proof.verification_status === 'REJECTED' && (
                        <label className={styles.reuploadBtn} title="Re-upload valid document">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className={styles.hiddenFileInput}
                            onChange={(e) => handleFileUpload('residential_proof', e.target.files[0])}
                            disabled={uploadingSlots.residential_proof}
                          />
                          <Upload size={13} />
                          <span>Re-upload</span>
                        </label>
                      )}
                      <button 
                        type="button" 
                        className={styles.docDeleteBtn}
                        onClick={() => handleDeleteDoc('residential_proof')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {renderOcrSummary('residential_proof')}
                </>
              ) : (
                <label className={styles.uploadDropzone}>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className={styles.hiddenFileInput}
                    onChange={(e) => handleFileUpload('residential_proof', e.target.files[0])}
                    disabled={uploadingSlots.residential_proof}
                  />
                  {uploadingSlots.residential_proof ? (
                    <div className={styles.uploadingState}>
                      <Loader2 size={20} className={styles.spin} />
                      <span>Uploading {docSubtypes.residential_proof}...</span>
                    </div>
                  ) : (
                    <div className={styles.dropzonePrompt}>
                      <Upload size={20} className={styles.dropzoneIcon} />
                      <span>Click or drag to upload <strong>{docSubtypes.residential_proof}</strong></span>
                    </div>
                  )}
                </label>
              )}
              {formErrors.residential_proof && <span className={styles.errorText}>{formErrors.residential_proof}</span>}
            </div>

            {/* Document C: Proof of Age */}
            <div className={`${styles.docUploadCard} ${uploadedDocs.age_proof?.verification_status === 'REJECTED' ? styles.docUploadCardRejected : ''}`}>
              <div className={styles.docHeaderRow}>
                <div>
                  <h4 className={styles.docCardTitle}>{t("manualForm.ageProof", "Proof of Age (any one)")} <span className={styles.requiredStar}>*</span></h4>
                  <p className={styles.docCardSub}>{t("manualForm.ageProofDesc", "Select any one valid age authentication document")}</p>
                </div>
                <select
                  className={styles.docSelect}
                  value={docSubtypes.age_proof}
                  onChange={(e) => setDocSubtypes((prev) => ({ ...prev, age_proof: e.target.value }))}
                >
                  {AGE_PROOF_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {renderRejectedNotice('age_proof')}

              {uploadedDocs.age_proof ? (
                <>
                  <div className={`${styles.uploadedFileRow} ${uploadedDocs.age_proof.verification_status === 'REJECTED' ? styles.uploadedFileRowRejected : ''}`}>
                    <div className={styles.uploadedFileInfo}>
                      {uploadedDocs.age_proof.verification_status === 'REJECTED' ? (
                        <AlertCircle size={18} color="#e11d48" />
                      ) : (
                        <CheckCircle2 size={18} className={styles.docSuccessIcon} />
                      )}
                      <span className={styles.uploadedFileName}>{uploadedDocs.age_proof.filename}</span>
                      {uploadedDocs.age_proof.verification_status === 'REJECTED' ? (
                        <span className={styles.rejectedBadge}>REJECTED</span>
                      ) : (
                        <span className={styles.uploadedFileSize}>({uploadedDocs.age_proof.sizeKb} KB)</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {uploadedDocs.age_proof.verification_status === 'REJECTED' && (
                        <label className={styles.reuploadBtn} title="Re-upload valid document">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className={styles.hiddenFileInput}
                            onChange={(e) => handleFileUpload('age_proof', e.target.files[0])}
                            disabled={uploadingSlots.age_proof}
                          />
                          <Upload size={13} />
                          <span>Re-upload</span>
                        </label>
                      )}
                      <button 
                        type="button" 
                        className={styles.docDeleteBtn}
                        onClick={() => handleDeleteDoc('age_proof')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {renderOcrSummary('age_proof')}
                </>
              ) : (
                <label className={styles.uploadDropzone}>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className={styles.hiddenFileInput}
                    onChange={(e) => handleFileUpload('age_proof', e.target.files[0])}
                    disabled={uploadingSlots.age_proof}
                  />
                  {uploadingSlots.age_proof ? (
                    <div className={styles.uploadingState}>
                      <Loader2 size={20} className={styles.spin} />
                      <span>Uploading {docSubtypes.age_proof}...</span>
                    </div>
                  ) : (
                    <div className={styles.dropzonePrompt}>
                      <Upload size={20} className={styles.dropzoneIcon} />
                      <span>Click or drag to upload <strong>{docSubtypes.age_proof}</strong></span>
                    </div>
                  )}
                </label>
              )}
              {formErrors.age_proof && <span className={styles.errorText}>{formErrors.age_proof}</span>}
            </div>

            {/* Document D & E: Signature & Passport Image */}
            <div className={styles.twoColGrid}>
              
              {/* Signature */}
              <div className={`${styles.docUploadCard} ${uploadedDocs.signature?.verification_status === 'REJECTED' ? styles.docUploadCardRejected : ''}`}>
                <h4 className={styles.docCardTitle}>Signature <span className={styles.requiredStar}>*</span></h4>
                <p className={styles.docCardSub}>Upload scanned signature on white paper</p>

                {renderRejectedNotice('signature')}

                {uploadedDocs.signature ? (
                  <>
                    <div className={`${styles.uploadedFileRow} ${uploadedDocs.signature.verification_status === 'REJECTED' ? styles.uploadedFileRowRejected : ''}`}>
                      <div className={styles.uploadedFileInfo}>
                        {uploadedDocs.signature.verification_status === 'REJECTED' ? (
                          <AlertCircle size={18} color="#e11d48" />
                        ) : (
                          <CheckCircle2 size={18} className={styles.docSuccessIcon} />
                        )}
                        <span className={styles.uploadedFileName}>{uploadedDocs.signature.filename}</span>
                        {uploadedDocs.signature.verification_status === 'REJECTED' && (
                          <span className={styles.rejectedBadge}>REJECTED</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {uploadedDocs.signature.verification_status === 'REJECTED' && (
                          <label className={styles.reuploadBtn} title="Re-upload valid document">
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png"
                              className={styles.hiddenFileInput}
                              onChange={(e) => handleFileUpload('signature', e.target.files[0])}
                              disabled={uploadingSlots.signature}
                            />
                            <Upload size={13} />
                            <span>Re-upload</span>
                          </label>
                        )}
                        <button 
                          type="button" 
                          className={styles.docDeleteBtn}
                          onClick={() => handleDeleteDoc('signature')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    {renderOcrSummary('signature')}
                  </>
                ) : (
                  <label className={styles.uploadDropzoneCompact}>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      className={styles.hiddenFileInput}
                      onChange={(e) => handleFileUpload('signature', e.target.files[0])}
                      disabled={uploadingSlots.signature}
                    />
                    {uploadingSlots.signature ? (
                      <Loader2 size={18} className={styles.spin} />
                    ) : (
                      <div className={styles.compactPrompt}>
                        <Upload size={18} />
                        <span>Upload Signature</span>
                      </div>
                    )}
                  </label>
                )}
                {formErrors.signature && <span className={styles.errorText}>{formErrors.signature}</span>}
              </div>

              {/* Passport image */}
              <div className={`${styles.docUploadCard} ${uploadedDocs.passport_image?.verification_status === 'REJECTED' ? styles.docUploadCardRejected : ''}`}>
                <h4 className={styles.docCardTitle}>Passport image <span className={styles.requiredStar}>*</span></h4>
                <p className={styles.docCardSub}>{t("manualForm.passportPhotoDesc", "Recent colour passport-size photograph")}</p>

                {renderRejectedNotice('passport_image')}

                {uploadedDocs.passport_image ? (
                  <>
                    <div className={`${styles.uploadedFileRow} ${uploadedDocs.passport_image.verification_status === 'REJECTED' ? styles.uploadedFileRowRejected : ''}`}>
                      <div className={styles.uploadedFileInfo}>
                        {uploadedDocs.passport_image.verification_status === 'REJECTED' ? (
                          <AlertCircle size={18} color="#e11d48" />
                        ) : (
                          <CheckCircle2 size={18} className={styles.docSuccessIcon} />
                        )}
                        <span className={styles.uploadedFileName}>{uploadedDocs.passport_image.filename}</span>
                        {uploadedDocs.passport_image.verification_status === 'REJECTED' && (
                          <span className={styles.rejectedBadge}>REJECTED</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {uploadedDocs.passport_image.verification_status === 'REJECTED' && (
                          <label className={styles.reuploadBtn} title="Re-upload valid document">
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png"
                              className={styles.hiddenFileInput}
                              onChange={(e) => handleFileUpload('passport_image', e.target.files[0])}
                              disabled={uploadingSlots.passport_image}
                            />
                            <Upload size={13} />
                            <span>Re-upload</span>
                          </label>
                        )}
                        <button 
                          type="button" 
                          className={styles.docDeleteBtn}
                          onClick={() => handleDeleteDoc('passport_image')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    {renderOcrSummary('passport_image')}
                  </>
                ) : (
                  <label className={styles.uploadDropzoneCompact}>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      className={styles.hiddenFileInput}
                      onChange={(e) => handleFileUpload('passport_image', e.target.files[0])}
                      disabled={uploadingSlots.passport_image}
                    />
                    {uploadingSlots.passport_image ? (
                      <Loader2 size={18} className={styles.spin} />
                    ) : (
                      <div className={styles.compactPrompt}>
                        <Upload size={18} />
                        <span>Upload Photo</span>
                      </div>
                    )}
                  </label>
                )}
                {formErrors.passport_image && <span className={styles.errorText}>{formErrors.passport_image}</span>}
              </div>

            </div>
          </div>

          {/* Statutory Declaration Checkbox (exact text from format.txt) */}
          <div className={`${styles.declarationBox} ${formErrors.declaration ? styles.declarationError : ''}`}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                className={styles.checkboxInput}
                checked={declarationAccepted}
                onChange={(e) => {
                  setDeclarationAccepted(e.target.checked)
                  if (formErrors.declaration) {
                    setFormErrors((prev) => {
                      const next = { ...prev }
                      delete next.declaration
                      return next
                    })
                  }
                }}
              />
              <span className={styles.declarationText}>
                The above particulars are correct as per the best of my knowledge. In case of any false information. I shall be held responsible and appropriate action may be taken against me.
              </span>
            </label>
            {formErrors.declaration && (
              <span className={styles.errorTextDecl}>{formErrors.declaration}</span>
            )}
          </div>

          {/* Form Bottom Submission CTA */}
          <div className={styles.formBottomBar}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={handleDiscardAndExit}
            >
              Cancel
            </button>

            <button
              type="submit"
              className={styles.btnPrimary}
            >
              <span>Review & Proceed to Confirmation</span>
              <ChevronRight size={18} />
            </button>
          </div>

        </form>

      </div>

      {/* Floating Toast Notification */}
      {autoFillToast && (
        <div className={styles.toastBanner}>
          <Sparkles size={18} />
          <span>{autoFillToast}</span>
        </div>
      )}

      {/* Screen-Blocking OCR Processing Modal Overlay */}
      {ocrModal.isOpen && (
        <div className={styles.ocrModalBackdrop}>
          <div className={styles.ocrModalCard}>
            
            {/* Header */}
            <div className={styles.ocrModalHeader}>
              <div className={styles.ocrModalTopBadge}>
                {ocrModal.isBypassed ? (
                  <>
                    <ShieldCheck size={13} />
                    <span>Biometric Fidelity Check</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} />
                    <span>Vision AI OCR Processor</span>
                  </>
                )}
              </div>
              <h3 className={styles.ocrModalTitle}>
                {ocrModal.isComplete 
                  ? 'Upload & Extraction Complete!' 
                  : ocrModal.error 
                  ? 'Document Processing Error' 
                  : ocrModal.isBypassed 
                  ? `Attaching ${ocrModal.docName}...` 
                  : `Scanning ${ocrModal.docName}...`
                }
              </h3>
              <div className={styles.ocrModalFileName}>
                <FileText size={13} />
                <span>{ocrModal.fileName} ({ocrModal.fileSize})</span>
              </div>
            </div>

            {/* Body */}
            <div className={styles.ocrModalBody}>
              
              {/* Error State */}
              {ocrModal.error ? (
                <div style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#991b1b', fontWeight: 600, fontSize: '0.9rem' }}>
                    <AlertCircle size={20} />
                    <span>Processing failed for {ocrModal.docName}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#b91c1c' }}>
                    {ocrModal.error}
                  </p>
                  <button
                    type="button"
                    onClick={() => setOcrModal((prev) => ({ ...prev, isOpen: false }))}
                    style={{
                      alignSelf: 'flex-end',
                      background: '#b91c1c',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              ) : ocrModal.isBypassed ? (
                /* Direct Verification View (Passport Photo / Signature) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className={styles.ocrBypassNotice}>
                    <ShieldCheck size={22} style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '0.84rem', color: '#166534', lineHeight: 1.5 }}>
                      <strong>Direct Visual Verification for {ocrModal.docName}:</strong>
                      <br />
                      Government regulations require exact biometric fidelity. Your photograph / signature is attached directly to the application.
                    </div>
                  </div>

                  <div className={styles.ocrProgressBarWrap}>
                    <div className={styles.ocrProgressBarFill} style={{ width: ocrModal.isComplete ? '100%' : '75%' }} />
                  </div>
                </div>
              ) : (
                /* Full OCR Processing View with Laser Scanner */
                <>
                  <div className={styles.ocrScanVisual}>
                    <div className={styles.ocrLaser} />
                    <div className={styles.ocrDocLines}>
                      <div className={styles.ocrDocLine} style={{ width: '85%' }} />
                      <div className={styles.ocrDocLine} style={{ width: '100%' }} />
                      <div className={styles.ocrDocLine} style={{ width: '60%' }} />
                      <div className={styles.ocrDocLine} style={{ width: '90%' }} />
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className={styles.ocrProgressBarWrap}>
                    <div
                      className={styles.ocrProgressBarFill}
                      style={{
                        width: ocrModal.isComplete ? '100%' : ocrModal.step === 1 ? '30%' : ocrModal.step === 2 ? '65%' : ocrModal.step === 3 ? '85%' : '95%',
                      }}
                    />
                  </div>

                  {/* Steps List */}
                  <div className={styles.ocrStepsList}>
                    {[
                      { step: 1, title: 'Document Upload & Checksum Verification', sub: 'Encrypting and saving file into application storage' },
                      { step: 2, title: 'AI Vision OCR Text Recognition', sub: 'Scanning optical characters and extracting data streams' },
                      { step: 3, title: 'Identity Particulars Normalization', sub: 'Standardizing Name, DOB, and registration numbers' },
                      { step: 4, title: 'Data Extraction & Storage Complete', sub: 'Attaching extracted metadata to your manual application' },
                    ].map((s) => {
                      const isDone = ocrModal.isComplete || ocrModal.step > s.step
                      const isActive = !ocrModal.isComplete && ocrModal.step === s.step
                      return (
                        <div key={s.step} className={styles.ocrStepRow}>
                          <div
                            className={`${styles.ocrStepIconWrap} ${
                              isDone
                                ? styles.ocrStepIconComplete
                                : isActive
                                ? styles.ocrStepIconActive
                                : styles.ocrStepIconPending
                            }`}
                          >
                            {isDone ? (
                              <Check size={15} />
                            ) : isActive ? (
                              <Loader2 size={15} className={styles.spin} />
                            ) : (
                              <span style={{ fontSize: '0.72rem', fontWeight: 700 }}>{s.step}</span>
                            )}
                          </div>
                          <div>
                            <div
                              className={
                                isDone
                                  ? styles.ocrStepTextComplete
                                  : isActive
                                  ? styles.ocrStepTextActive
                                  : styles.ocrStepTextPending
                              }
                            >
                              {s.title}
                            </div>
                            <div style={{ fontSize: '0.73rem', color: '#64748b' }}>{s.sub}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

            </div>

            {/* Footer */}
            <div className={styles.ocrModalFooter}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={14} style={{ color: '#16a34a' }} />
                ISO 27001 Certified &bull; 256-Bit Encrypted
              </span>
              <span>RevenueGov AI Platform</span>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
