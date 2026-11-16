import React, { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom'
import {
  FileText,
  Sparkles,
  Send,
  Upload,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  User,
  Bot,
  FileCheck,
  Trash2,
  Loader2,
  RefreshCw,
  Check,
  X,
  Lock,
  Hash,
  ShieldCheck,
  ChevronRight,
  Eye,
  Award,
  Coins,
  Home,
  Printer,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Edit2,
  RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../store/authStore'
import useChatStore from '../../store/chatStore'
import { LANGUAGE_LOCALES } from '../../i18n'
import { applicationsApi } from '../../api/applications'
import ApplicationReceiptModal from '../../components/ApplicationReceipt/ApplicationReceiptModal'
import styles from './AutomatedApplicationForm.module.css'

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

const DOCUMENT_DEFINITIONS = [
  {
    key: 'identity_proof',
    name: 'Identity Proof',
    desc: 'Aadhaar Card, PAN Card, Voter ID, or Passport',
    accept: '.pdf,.jpg,.jpeg,.png',
  },
  {
    key: 'residential_proof',
    name: 'Residential Proof',
    desc: 'Electricity Bill, Water Bill, Land Papers, or Rent Agreement',
    accept: '.pdf,.jpg,.jpeg,.png',
  },
  {
    key: 'age_proof',
    name: 'Proof of Age',
    desc: 'Birth Certificate or School Leaving Certificate',
    accept: '.pdf,.jpg,.jpeg,.png',
  },
  {
    key: 'signature',
    name: 'Applicant Signature',
    desc: 'Clear scanned signature on white paper',
    accept: '.jpg,.jpeg,.png',
  },
  {
    key: 'passport_image',
    name: 'Passport-Size Photograph',
    desc: 'Recent passport photo with plain background',
    accept: '.jpg,.jpeg,.png',
  },
]

const FIELD_TITLE_MAP = {
  applicant_name: 'Applicant Full Name',
  name: 'Applicant Full Name',
  full_name: 'Applicant Full Name',
  father_name: "Father's Full Name",
  father: "Father's Full Name",
  mother_name: "Mother's Full Name",
  mother: "Mother's Full Name",
  dob: 'Date of Birth (DOB)',
  date_of_birth: 'Date of Birth (DOB)',
  gender: 'Gender / Sex',
  sex: 'Gender / Sex',
  marital_status: 'Marital Status',
  husband_name: "Husband's Full Name",
  address: 'Residential Address',
  residential_address: 'Residential Address',
  years_of_residence: 'Years of Residence in Maharashtra',
  residence_years: 'Years of Residence in Maharashtra',
  purpose: 'Purpose of Certificate',
  purpose_of_certificate: 'Purpose of Certificate',
  annual_income: 'Annual Family Income',
  caste_category: 'Caste Category',
  caste: 'Caste Category',
}

export default function AutomatedApplicationForm() {
  const { t } = useTranslation()
  const { draftId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { citizenUser } = useAuthStore()

  const serviceParam = searchParams.get('service') || 'caste_certificate'
  const [serviceId, setServiceId] = useState(serviceParam)

  // Top-level Phase: 'phase1_chat' | 'phase2_review' | 'success'
  const [activePhase, setActivePhase] = useState('phase1_chat')

  // Core Session State from Backend LangGraph Workflow
  const [sessionState, setSessionState] = useState(null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  // Draft App Identifiers
  const [draftApp, setDraftApp] = useState(null)

  // Chat conversation local state
  const [inputText, setInputText] = useState('')
  const [isSendingChat, setIsSendingChat] = useState(false)
  const chatMessagesEndRef = useRef(null)
  const chatContainerRef = useRef(null)
  const isInitialChatLoadRef = useRef(true)

  const { language } = useChatStore()

  // Speech Recognition (Voice Input / STT)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [speechLang, setSpeechLang] = useState(() => LANGUAGE_LOCALES[language] || 'en-IN')
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (language && LANGUAGE_LOCALES[language]) {
      setSpeechLang(LANGUAGE_LOCALES[language])
    }
  }, [language])

  // Voice Response Output (Text-to-Speech / TTS)
  const [voiceResponseEnabled, setVoiceResponseEnabled] = useState(() => {
    return localStorage.getItem('rg_automated_voice_enabled') === 'true'
  })
  const [isSpeaking, setIsSpeaking] = useState(false)
  const lastSpokenMsgKeyRef = useRef(null)

  // Document Uploads tracking
  const [uploadingDocKey, setUploadingDocKey] = useState(null)
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

  // Phase 2 Form Edits & Declaration
  const [editableFields, setEditableFields] = useState({})
  const [declarationAccepted, setDeclarationAccepted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionResult, setSubmissionResult] = useState(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)

  // Auto-scroll chat to latest message (kept on top on page load, only scrolls on subsequent interaction)
  useEffect(() => {
    if (activePhase === 'phase1_chat') {
      if (isInitialChatLoadRef.current) {
        if (sessionState?.messages?.length > 0) {
          isInitialChatLoadRef.current = false
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = 0
          }
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        }
        return
      }
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth',
        })
      }
    }
  }, [sessionState?.messages, isSendingChat, activePhase])

  // Initial load: create or fetch draft application and state
  useEffect(() => {
    let mounted = true

    async function initDraftAndSession() {
      try {
        setLoadingInitial(true)
        setErrorMsg('')

        let currentDraftId = draftId

        if (!currentDraftId) {
          // Check for active draft or create new one
          const activeRes = await applicationsApi.getActiveDraft()
          if (activeRes?.has_draft && activeRes.draft?.id) {
            currentDraftId = activeRes.draft.id
            setDraftApp(activeRes.draft)
            navigate(`/applications/automated-form/${currentDraftId}?service=${activeRes.draft.service_id || serviceParam}`, { replace: true })
          } else {
            const newDraft = await applicationsApi.createDraft(serviceParam, 'WEB_AUTOMATED_AI')
            currentDraftId = newDraft.draft_id
            setDraftApp(newDraft)
            navigate(`/applications/automated-form/${currentDraftId}?service=${serviceParam}`, { replace: true })
          }
        }

        // Fetch session state from automated form API
        const stateRes = await applicationsApi.getAutomatedState(currentDraftId)
        if (mounted && stateRes?.success) {
          setSessionState(stateRes.state)
          setDraftApp({
            id: stateRes.draft_id,
            application_number: stateRes.application_number,
            certificate_id: stateRes.certificate_id,
            tracking_id: stateRes.tracking_id,
            service_id: stateRes.service_id,
            service_name: stateRes.service_name,
            status: stateRes.status,
          })
          setServiceId(stateRes.service_id)
          setEditableFields(stateRes.state?.chat_data || {})

          // If session state is ready for review, default to phase1 unless user wants review
          if (stateRes.state?.can_view_form && searchParams.get('phase') === 'review') {
            setActivePhase('phase2_review')
          }
        }
      } catch (err) {
        console.error('Failed to initialize automated form session:', err)
        if (mounted) {
          setErrorMsg(err.message || 'Failed to initialize automated form session.')
        }
      } finally {
        if (mounted) setLoadingInitial(false)
      }
    }

    initDraftAndSession()

    return () => {
      mounted = false
    }
  }, [draftId, serviceParam])

  // Sync editableFields with sessionState.chat_data when state updates
  useEffect(() => {
    if (sessionState?.chat_data) {
      setEditableFields((prev) => ({
        ...prev,
        ...sessionState.chat_data,
      }))
    }
  }, [sessionState?.chat_data])

  // Speak text using Web Speech API (TTS)
  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return
    try {
      window.speechSynthesis.cancel()
    } catch (_) {}

    const cleanText = (text || '')
      .replace(/[*#_`~>]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/⚠️/g, 'Warning. ')
      .replace(/✅/g, 'Confirmed. ')
      .replace(/🎉/g, 'Congratulations. ')
      .replace(/₹/g, 'Rupees ')
      .trim()

    if (!cleanText) return

    const utterance = new SpeechSynthesisUtterance(cleanText)

    // Set voice language locale based on active language or script
    const targetLocale = LANGUAGE_LOCALES[language] || speechLang || 'en-IN'
    utterance.lang = targetLocale

    try {
      const voices = window.speechSynthesis.getVoices()
      const matchingVoice = voices.find(
        (v) => v.lang === utterance.lang || v.lang.startsWith(utterance.lang.slice(0, 2))
      )
      if (matchingVoice) {
        utterance.voice = matchingVoice
      }
    } catch (_) {}

    utterance.rate = 1.0
    utterance.pitch = 1.0

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    try {
      window.speechSynthesis.speak(utterance)
    } catch (err) {
      console.warn('Speech synthesis speak error:', err)
      setIsSpeaking(false)
    }
  }

  // Stop speaking
  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
      } catch (_) {}
    }
    setIsSpeaking(false)
  }

  // Toggle Voice Response Output (Enable / Disable)
  const toggleVoiceResponse = () => {
    const nextVal = !voiceResponseEnabled
    setVoiceResponseEnabled(nextVal)
    localStorage.setItem('rg_automated_voice_enabled', String(nextVal))

    if (!nextVal) {
      stopSpeaking()
      toast('Voice response disabled', { icon: '🔇' })
    } else {
      toast('Voice response enabled', { icon: '🔊' })
      // Read out the latest assistant message if present
      if (sessionState?.messages?.length) {
        const lastAssistantMsg = [...sessionState.messages].reverse().find((m) => m.role === 'assistant')
        if (lastAssistantMsg?.content) {
          speakText(lastAssistantMsg.content)
        }
      }
    }
  }

  // Auto-speak new assistant messages when voiceResponseEnabled is true
  useEffect(() => {
    if (!voiceResponseEnabled || !sessionState?.messages?.length) return

    const lastMsg = sessionState.messages[sessionState.messages.length - 1]
    if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content) {
      const msgKey = `${sessionState.messages.length}_${lastMsg.content.slice(0, 40)}`
      if (lastSpokenMsgKeyRef.current !== msgKey) {
        lastSpokenMsgKeyRef.current = msgKey
        speakText(lastMsg.content)
      }
    }
  }, [sessionState?.messages, voiceResponseEnabled])

  // Initialize Speech Recognition (STT)
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRec) {
      setSpeechSupported(false)
      return
    }

    const rec = new SpeechRec()
    rec.continuous = false
    rec.interimResults = true

    rec.onstart = () => {
      setIsListening(true)
    }

    rec.onresult = (e) => {
      let finalTranscript = ''
      let interimTranscript = ''
      for (let i = 0; i < e.results.length; i++) {
        const item = e.results[i]
        if (item.isFinal) {
          finalTranscript += item[0].transcript
        } else {
          interimTranscript += item[0].transcript
        }
      }
      const text = finalTranscript || interimTranscript
      if (text) {
        setInputText(text)
      }
    }

    rec.onerror = (e) => {
      console.warn('Speech recognition error:', e.error)
      setIsListening(false)
      if (e.error === 'not-allowed') {
        toast.error('Microphone permission denied. Please allow microphone in browser.')
      } else if (e.error !== 'no-speech') {
        toast.error(`Speech recognition: ${e.error}`)
      }
    }

    rec.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = rec

    return () => {
      try {
        rec.abort()
      } catch (_) {}
    }
  }, [])

  // Toggle Speech Recognition listening
  const toggleListening = () => {
    if (!speechSupported || !recognitionRef.current) {
      toast.error('Speech recognition is not supported in this browser. Please use Chrome or Edge.')
      return
    }

    // Stop speaking if assistant is speaking
    stopSpeaking()

    if (isListening) {
      try {
        recognitionRef.current.stop()
      } catch (_) {}
      setIsListening(false)
    } else {
      try {
        recognitionRef.current.lang = speechLang
        recognitionRef.current.start()
      } catch (err) {
        console.warn('Failed to start speech recognition:', err)
        try {
          recognitionRef.current.abort()
          setTimeout(() => {
            try {
              recognitionRef.current.start()
            } catch (_) {}
          }, 100)
        } catch (_) {}
      }
    }
  }

  // Cleanup speech audio on phase change or unmount
  useEffect(() => {
    return () => {
      stopSpeaking()
      try {
        recognitionRef.current?.abort()
      } catch (_) {}
    }
  }, [activePhase])

  // Handle sending a chat message to LangGraph
  const handleSendMessage = async (msgOverride = null) => {
    const textToSend = (msgOverride || inputText).trim()
    if (!textToSend || isSendingChat || !draftApp?.id) return

    // Stop listening if active
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop()
      } catch (_) {}
      setIsListening(false)
    }

    // Stop previous voice synthesis if speaking
    stopSpeaking()

    setInputText('')
    setIsSendingChat(true)
    setErrorMsg('')

    try {
      const res = await applicationsApi.sendAutomatedChat(draftApp.id, textToSend)
      if (res?.success) {
        setSessionState((prev) => ({
          ...prev,
          messages: res.messages,
          chat_data: res.chat_data,
          pending_field: res.pending_field,
          progress_percent: res.progress_percent,
          current_phase: res.current_phase,
          can_view_form: res.can_view_form,
          latest_assistant_response: res.latest_assistant_response,
        }))
        setEditableFields((prev) => ({
          ...prev,
          ...res.chat_data,
        }))
      }
    } catch (err) {
      console.error('Chat error:', err)
      setErrorMsg(err.message || 'Failed to send message.')
    } finally {
      setIsSendingChat(false)
    }
  }

  // Handle Document Upload
  const handleDocumentUpload = async (docType, file) => {
    if (!file || !draftApp?.id) return

    const isBypassed = ['passport_image', 'signature'].includes(docType)
    const docDef = DOCUMENT_DEFINITIONS.find((d) => d.key === docType)
    const docName = docDef?.name || docType

    const fileSizeStr = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`

    // Open screen-blocking OCR feedback modal
    setOcrModal({
      isOpen: true,
      docType,
      docName,
      fileName: file.name,
      fileSize: fileSizeStr,
      step: 1,
      isBypassed,
      error: null,
      isComplete: false,
    })

    setUploadingDocKey(docType)
    setErrorMsg('')

    // Multi-step progress animation while async OCR runs
    let stepTimer1 = null
    let stepTimer2 = null
    if (!isBypassed) {
      stepTimer1 = setTimeout(() => {
        setOcrModal((prev) => (prev.isOpen && !prev.isComplete ? { ...prev, step: 2 } : prev))
      }, 1200)
      stepTimer2 = setTimeout(() => {
        setOcrModal((prev) => (prev.isOpen && !prev.isComplete ? { ...prev, step: 3 } : prev))
      }, 3500)
    }

    const formData = new FormData()
    formData.append('doc_type', docType)
    formData.append('file', file)

    try {
      const res = await applicationsApi.uploadAutomatedDocument(draftApp.id, formData)
      if (stepTimer1) clearTimeout(stepTimer1)
      if (stepTimer2) clearTimeout(stepTimer2)

      if (res?.success) {
        setOcrModal((prev) => ({
          ...prev,
          step: 4,
          isComplete: true,
        }))

        // Instantly update session state with returned document and OCR metadata
        setSessionState((prev) => {
          const nextRejected = res.rejected_docs !== undefined
            ? res.rejected_docs
            : (prev?.rejected_docs || []).filter((k) => k !== docType)

          return {
            ...prev,
            uploaded_documents: {
              ...(prev?.uploaded_documents || {}),
              [docType]: {
                ...res.document,
                rejection_notes: null,
              },
            },
            ocr_data: {
              ...(prev?.ocr_data || {}),
              [docType]: res.ocr_result,
            },
            rejected_docs: nextRejected,
            comparison_scores: res.comparison_scores || prev?.comparison_scores || {},
            progress_percent: res.progress_percent ?? prev?.progress_percent ?? 0,
            current_phase: res.current_phase || prev?.current_phase || 'documents',
            can_view_form: res.can_view_form ?? prev?.can_view_form ?? false,
          }
        })

        toast.success(`${docDef ? docDef.name : docType.replace(/_/g, ' ')} uploaded & processed successfully!`)

        // Show completed checkmark briefly then smoothly close modal
        setTimeout(() => {
          setOcrModal((prev) => ({ ...prev, isOpen: false }))
        }, 850)
      } else {
        throw new Error(res?.detail || 'Document upload failed.')
      }
    } catch (err) {
      if (stepTimer1) clearTimeout(stepTimer1)
      if (stepTimer2) clearTimeout(stepTimer2)
      console.error('Document upload error:', err)
      let msg = err.message || 'Failed to upload document and run OCR.'
      if (msg.toLowerCase().includes('timeout')) {
        msg = 'OCR document scanning timed out. Please try re-uploading with a clearer or smaller file.'
      }
      setErrorMsg(msg)
      setOcrModal((prev) => ({
        ...prev,
        error: msg,
      }))
    } finally {
      setUploadingDocKey(null)
    }
  }

  // Handle Document Delete
  const handleDeleteDocument = async (docType, docId) => {
    if (!draftApp?.id || !docId) return

    try {
      const res = await applicationsApi.deleteAutomatedDocument(draftApp.id, docId)
      if (res?.success) {
        setSessionState((prev) => {
          const nextDocs = { ...prev.uploaded_documents }
          delete nextDocs[docType]
          const nextOcr = { ...prev.ocr_data }
          delete nextOcr[docType]
          const nextRejected = res.rejected_docs !== undefined
            ? res.rejected_docs
            : (prev?.rejected_docs || []).filter((k) => k !== docType)

          return {
            ...prev,
            uploaded_documents: nextDocs,
            ocr_data: nextOcr,
            rejected_docs: nextRejected,
            progress_percent: res.progress_percent,
            comparison_scores: res.comparison_scores,
          }
        })
      }
    } catch (err) {
      console.error('Delete document error:', err)
      setErrorMsg(err.message || 'Failed to remove document.')
    }
  }

  // Handle Discrepancy Resolution (Keep Chat vs Use OCR)
  const handleResolveField = async (fieldName, chosenSource, chosenValue = null) => {
    if (!draftApp?.id) return

    try {
      const res = await applicationsApi.resolveAutomatedField(draftApp.id, {
        field_name: fieldName,
        chosen_source: chosenSource,
        chosen_value: chosenValue,
      })
      if (res?.success) {
        setSessionState((prev) => ({
          ...prev,
          chat_data: res.chat_data,
          comparison_scores: res.comparison_scores,
        }))
        setEditableFields((prev) => {
          const updated = { ...prev, ...(res.chat_data || {}) }
          const val = res.current_value
          if (fieldName === 'applicant_name') {
            updated.applicant_name = val
            updated.name = val
          } else if (fieldName === 'gender') {
            updated.gender = val
            updated.sex = val
          } else if (fieldName === 'caste_category') {
            updated.caste_category = val
            updated.caste = val
          } else {
            updated[fieldName] = val
          }
          return updated
        })
      }
    } catch (err) {
      console.error('Field resolution error:', err)
      setErrorMsg(err.message || 'Failed to update field resolution.')
    }
  }

  // Handle Inline Form Field Editing in Phase 2
  const handleFieldChange = async (fieldName, val) => {
    setEditableFields((prev) => ({
      ...prev,
      [fieldName]: val,
    }))
  }

  const handleFieldBlur = async (fieldName) => {
    const val = editableFields[fieldName] || ''
    if (!draftApp?.id) return

    try {
      const res = await applicationsApi.updateAutomatedFormField(draftApp.id, {
        field_name: fieldName,
        value: val,
      })
      if (res?.success) {
        setSessionState((prev) => ({
          ...prev,
          chat_data: res.chat_data,
          comparison_scores: res.comparison_scores,
        }))
      }
    } catch (err) {
      console.warn('Field sync warning:', err)
    }
  }

  // Handle Final Submission
  const handleSubmitApplication = async () => {
    if (!declarationAccepted) {
      setErrorMsg('Please review and check the statutory declaration before submitting.')
      return
    }

    if (hasRejectedDocs) {
      const msg = 'Please re-upload all rejected documents before submitting your application.'
      setErrorMsg(msg)
      toast.error(msg)
      return
    }

    if (!draftApp?.id) return

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const res = await applicationsApi.submitAutomatedForm(draftApp.id, {
        declaration_confirmed: true,
        service_id: serviceId,
        fields: editableFields,
      })

      if (res?.success) {
        setSubmissionResult(res)
        setActivePhase('success')
      }
    } catch (err) {
      console.error('Submission error:', err)
      setErrorMsg(err.message || 'Failed to submit application. Please verify all details.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading Screen
  if (loadingInitial) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center', padding: '100px 20px' }}>
          <Loader2 size={36} className={styles.spin} style={{ color: '#2563eb', margin: '0 auto 16px auto' }} />
          <h3 style={{ fontSize: '1.2rem', color: '#0f172a', margin: '0 0 6px 0' }}>
            Initializing Automated Form Assistant...
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
            Connecting with AI Assistant and loading government particulars
          </p>
        </div>
      </div>
    )
  }

  const certName = CERT_DISPLAY_NAMES[serviceId] || 'Government Certificate'
  const progressVal = sessionState?.progress_percent ?? 0
  const hasRejectedDocs = Boolean(
    (sessionState?.rejected_docs && sessionState.rejected_docs.length > 0) ||
    Object.values(sessionState?.uploaded_documents || {}).some(
      (d) => d?.verification_status === 'REJECTED'
    )
  )
  const canViewForm = Boolean(
    (sessionState?.can_view_form || progressVal >= 30 || Object.keys(sessionState?.chat_data || {}).length >= 5) &&
    !hasRejectedDocs
  )

  // ══════════════════════════════════════════════════════════════
  // RENDER: SUCCESS CONFIRMATION SCREEN
  // ══════════════════════════════════════════════════════════════
  if (activePhase === 'success' && submissionResult) {
    return (
      <div className={styles.container}>
        <div className={styles.successCard}>
          <div className={styles.successIconWrap}>
            <CheckCircle2 size={44} />
          </div>
          <h2 className={styles.successTitle}>{t('automatedForm.appSubmittedSuccess', 'Application Submitted Successfully!')}</h2>
          <p className={styles.successDesc}>
            {t('automatedForm.appSubmittedDesc', 'Your application for {{certName}} has been successfully registered through our AI-assisted form filling workflow.', { certName })}
          </p>

          <div className={styles.successMetaCard}>
            <div className={styles.successMetaItem}>
              <span className={styles.metaItemLabel}>{t('receipt.certIdAppNo', 'Certificate ID / App No')}</span>
              <span className={styles.metaItemValue}>{submissionResult.certificate_id || submissionResult.application_number}</span>
            </div>
            <div className={styles.successMetaItem}>
              <span className={styles.metaItemLabel}>{t('receipt.citizenId', 'Citizen ID')}</span>
              <span className={styles.metaItemValue}>{citizenUser?.citizen_id || citizenUser?.citizen_ref || submissionResult.citizen_id || 'N/A'}</span>
            </div>
            <div className={styles.successMetaItem}>
              <span className={styles.metaItemLabel}>{t('receipt.trackingId', 'Tracking ID')}</span>
              <span className={styles.metaItemValue}>{submissionResult.tracking_id}</span>
            </div>
            <div className={styles.successMetaItem}>
              <span className={styles.metaItemLabel}>{t('receipt.status', 'Status')}</span>
              <span className={styles.metaItemValue} style={{ color: '#16a34a' }}>{submissionResult.status || 'SUBMITTED'}</span>
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
            <Link to="/dashboard" className={styles.backBtn} style={{ background: '#2563eb', color: '#ffffff', border: 'none' }}>
              {t('manualForm.returnDashboard', 'Return to Dashboard')}
            </Link>
            <Link to={`/tracking/${submissionResult.application_id || submissionResult.tracking_id}`} className={styles.backBtn}>
              {t('automatedForm.viewLiveTracking', 'View Live Tracking')}
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
              formType: 'AI-Assisted Automated Form',
              particulars: editableFields,
              enclosedDocs: sessionState?.uploaded_documents || {},
              docSubtypes: {
                identity_proof: 'Identity Proof (AI Processed)',
                residential_proof: 'Residential Proof (AI Processed)',
                age_proof: 'Proof of Age (AI Processed)',
              },
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>

      {/* ── Top Bar with IDs & Phase Toggles ── */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate('/form-filling')}
            title="Return to form filling list"
          >
            <ArrowLeft size={16} />
            <span>{t("forms.formFillingServices", "Form Filling")}</span>
          </button>

          <span className={styles.modeBadgeAi}>
            <Sparkles size={13} />
            {t("forms.aiAssistedFormFill", "AI Assisted Form Fill")}
          </span>

          {draftApp && (
            <div className={styles.draftPill}>
              <span className={styles.draftDot} />
              <span>Cert ID: <strong>{draftApp.certificate_id || draftApp.application_number}</strong></span>
              <span style={{ color: '#93c5fd' }}>|</span>
              <span>Tracking: <strong>{draftApp.tracking_id}</strong></span>
            </div>
          )}
        </div>

        <div className={styles.topBarRight}>
          {activePhase === 'phase1_chat' ? (
            <button
              type="button"
              className={`${styles.phaseToggleBtn} ${canViewForm ? styles.phaseToggleBtnActive : ''}`}
              onClick={() => {
                if (hasRejectedDocs) {
                  toast.error('Please re-upload rejected document(s) before reviewing the application form.')
                  return
                }
                setActivePhase('phase2_review')
              }}
              disabled={!canViewForm && !hasRejectedDocs}
              title={
                hasRejectedDocs
                  ? 'Please re-upload rejected document(s) first'
                  : canViewForm
                  ? 'Review and validate populated form'
                  : 'Provide some information in chat first'
              }
            >
              <span>{t("automatedForm.reviewAndConfirm", "View Application Form")}</span>
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              className={styles.phaseToggleBtn}
              onClick={() => setActivePhase('phase1_chat')}
            >
              <Bot size={16} />
              <span>{t("forms.backAssistant", "Back to AI Chat")}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Top Dynamic Progress Bar ── */}
      <div className={styles.progressCard}>
        <div className={styles.progressHeader}>
          <div className={styles.progressTitleGroup}>
            <Sparkles size={20} className={styles.progressIcon} />
            <div>
              <h3 className={styles.progressTitle}>{t("automatedForm.extractedParticulars", "Application Completion Progress")}</h3>
              <p className={styles.progressSubtitle}>
                {progressVal < 70
                  ? 'Phase 1: Chatting with Assistant to collect 10 statutory particulars'
                  : progressVal < 100
                  ? 'Phase 1: Supporting document upload & OCR extraction in progress'
                  : 'Phase 2: All particulars & documents verified! Ready to review and submit'}
              </p>
            </div>
          </div>

          <div className={styles.progressValueBadge}>
            <span>{progressVal}% Completed</span>
          </div>
        </div>

        <div className={styles.progressBarTrack}>
          <div className={styles.progressBarFill} style={{ width: `${progressVal}%` }} />
        </div>

        <div className={styles.progressSteps}>
          <div className={`${styles.stepItem} ${progressVal >= 10 ? styles.stepItemActive : ''} ${progressVal >= 70 ? styles.stepItemCompleted : ''}`}>
            <span className={`${styles.stepBullet} ${progressVal >= 10 ? styles.stepBulletActive : ''} ${progressVal >= 70 ? styles.stepBulletCompleted : ''}`} />
            <span>1. 10 Particulars ({Math.min(70, Math.round(progressVal))}%)</span>
          </div>

          <div className={`${styles.stepItem} ${progressVal >= 70 ? styles.stepItemActive : ''} ${progressVal >= 95 ? styles.stepItemCompleted : ''}`}>
            <span className={`${styles.stepBullet} ${progressVal >= 70 ? styles.stepBulletActive : ''} ${progressVal >= 95 ? styles.stepBulletCompleted : ''}`} />
            <span>{t("automatedForm.ocrVerification", "2. Enclosed Documents & OCR")}</span>
          </div>

          <div className={`${styles.stepItem} ${progressVal === 100 ? styles.stepItemCompleted : ''}`}>
            <span className={`${styles.stepBullet} ${progressVal === 100 ? styles.stepBulletCompleted : ''}`} />
            <span>{t("automatedForm.reviewAndConfirm", "3. Review, Resolve & Submit")}</span>
          </div>
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorMsg && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#991b1b',
          borderRadius: '10px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.86rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg('')}
            style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          PHASE 1 VIEW: CHATBOT & DOCUMENT UPLOADS
          ══════════════════════════════════════════════════════════════ */}
      {activePhase === 'phase1_chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Reviewing Officer Feedback Banner */}
          {(sessionState?.clerk_notes || sessionState?.rejection_reason || (sessionState?.rejected_docs && sessionState.rejected_docs.length > 0)) && (
            <div className={styles.officerFeedbackBanner}>
              <div className={styles.feedbackHeader}>
                <AlertCircle size={22} className={styles.feedbackIcon} />
                <div className={styles.feedbackHeaderText}>
                  <span>Reviewing Officer Action / Feedback Notice</span>
                  <span className={styles.feedbackStatusBadge}>
                    {sessionState?.rejection_reason ? 'Application Rejected' : 'Correction Needed'}
                  </span>
                </div>
              </div>
              <div className={styles.feedbackBody}>
                {(sessionState?.clerk_notes || sessionState?.rejection_reason) && (
                  <p className={styles.feedbackComment}>
                    "{sessionState.clerk_notes || sessionState.rejection_reason}"
                  </p>
                )}
                <p className={styles.feedbackInstruction}>
                  Please review the officer notes above, update your particulars using the interactive chat, and re-upload any highlighted rejected documents in the right panel.
                </p>
              </div>
            </div>
          )}
          
          <div className={styles.phase1Grid}>
            
            {/* Left Column: Chat Workspace */}
            <div className={styles.chatCard}>
              {/* Chat Header */}
              <div className={styles.chatHeader}>
                <div className={styles.chatBotInfo}>
                  <div className={styles.botAvatar}>
                    <Bot size={22} />
                  </div>
                  <div>
                    <h4 className={styles.botName}>RevenueGov AI Assistant</h4>
                    <p className={styles.botStatus}>
                      <span className={styles.botOnlineDot} />
                      Applying for {certName}
                    </p>
                  </div>
                </div>

                <div className={styles.chatHeaderActions}>
                  {/* Voice Output Toggle Button */}
                  <button
                    type="button"
                    id="chatbot-voice-toggle-btn"
                    className={`${styles.voiceToggleBtn} ${voiceResponseEnabled ? styles.voiceToggleBtnActive : ''}`}
                    onClick={toggleVoiceResponse}
                    title={voiceResponseEnabled ? 'Voice Response is Enabled (Click to Mute)' : 'Voice Response is Disabled (Click to Turn On)'}
                  >
                    {voiceResponseEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    <span>Voice: {voiceResponseEnabled ? 'ON' : 'OFF'}</span>
                    {isSpeaking && (
                      <span className={styles.voiceWaveIndicator}>
                        <span className={styles.voiceWaveBar} />
                        <span className={styles.voiceWaveBar} />
                        <span className={styles.voiceWaveBar} />
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Chat Message List */}
              <div ref={chatContainerRef} className={styles.chatMessagesContainer}>
                {sessionState?.messages?.map((msg, idx) => {
                  const isAssistant = msg.role === 'assistant'
                  return (
                    <div
                      key={idx}
                      className={`${styles.messageRow} ${isAssistant ? styles.messageRowAssistant : styles.messageRowUser}`}
                    >
                      <div className={`${styles.messageAvatar} ${isAssistant ? styles.messageAvatarAssistant : styles.messageAvatarUser}`}>
                        {isAssistant ? <Bot size={16} /> : <User size={16} />}
                      </div>

                      <div className={`${styles.bubble} ${isAssistant ? styles.bubbleAssistant : styles.bubbleUser}`}>
                        <div className={isAssistant ? styles.bubbleTextWrap : ''}>
                          <div style={{ whiteSpace: 'pre-line' }}>{msg.content}</div>
                          {isAssistant && (
                            <button
                              type="button"
                              className={styles.msgSpeakBtn}
                              onClick={() => speakText(msg.content)}
                              title="Listen to this message"
                            >
                              <Volume2 size={14} />
                            </button>
                          )}
                        </div>

                        {/* Quick Response Suggestion Chips for specific fields */}
                        {isAssistant && idx === sessionState.messages.length - 1 && sessionState.pending_field === 'sex' && (
                          <div className={styles.chipsRow}>
                            {['Male', 'Female', 'Others'].map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                className={styles.quickChip}
                                onClick={() => handleSendMessage(opt)}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}

                        {isAssistant && idx === sessionState.messages.length - 1 && sessionState.pending_field === 'marital_status' && (
                          <div className={styles.chipsRow}>
                            {['Yes (Married)', 'No (Unmarried)'].map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                className={styles.quickChip}
                                onClick={() => handleSendMessage(opt.startsWith('Yes') ? 'Yes' : 'No')}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}

                        {isAssistant && idx === sessionState.messages.length - 1 && sessionState.pending_field === 'purpose' && (
                          <div className={styles.chipsRow}>
                            {['Higher Education Scholarship', 'Fee Concession', 'Government Welfare Scheme'].map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                className={styles.quickChip}
                                onClick={() => handleSendMessage(opt)}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Assistant Typing Indicator */}
                {isSendingChat && (
                  <div className={`${styles.messageRow} ${styles.messageRowAssistant}`}>
                    <div className={`${styles.messageAvatar} ${styles.messageAvatarAssistant}`}>
                      <Bot size={16} />
                    </div>
                    <div className={styles.typingIndicator}>
                      <span className={styles.typingDot} />
                      <span className={styles.typingDot} />
                      <span className={styles.typingDot} />
                    </div>
                  </div>
                )}

                <div ref={chatMessagesEndRef} />
              </div>

              {/* Active Rectifying Mode Indicator */}
              {sessionState?.rectifying_field && (
                <div style={{
                  background: '#eff6ff',
                  borderTop: '1px solid #bfdbfe',
                  borderBottom: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                  padding: '7px 16px',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontWeight: 500,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Edit2 size={13} style={{ color: '#2563eb' }} />
                    <span>Editing Particular: <strong>{sessionState.rectifying_field.replace(/_/g, ' ').toUpperCase()}</strong></span>
                  </div>
                  <button
                    type="button"
                    style={{
                      background: '#ffffff',
                      border: '1px solid #93c5fd',
                      color: '#1e40af',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                    onClick={() => handleSendMessage('Cancel')}
                    disabled={isSendingChat}
                    title="Keep existing value and resume application"
                  >
                    Keep Existing Value
                  </button>
                </div>
              )}

              {/* Casual conversation helper chips & Backtrack */}
              <div style={{ display: 'flex', gap: '8px', padding: '8px 16px', background: '#f8fafc', borderTop: sessionState?.rectifying_field ? 'none' : '1px solid #e2e8f0', overflowX: 'auto', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                  <Sparkles size={12} style={{ color: '#3b82f6' }} /> {t("automatedForm.quickResponses", "Quick Actions")}:
                </span>
                <button
                  type="button"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '9999px',
                    padding: '3px 10px',
                    fontSize: '0.74rem',
                    color: '#334155',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 600,
                  }}
                  onClick={() => handleSendMessage('Go back')}
                  disabled={isSendingChat}
                  title="Go back to the previous question slot"
                >
                  <RotateCcw size={11} style={{ color: '#0284c7' }} />
                  <span>{t("common.back", "Go back")}</span>
                </button>
                <button
                  type="button"
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '9999px', padding: '3px 10px', fontSize: '0.74rem', color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onClick={() => handleSendMessage(`What is this certificate used for?`)}
                  disabled={isSendingChat}
                >
                  What is this for?
                </button>
                <button
                  type="button"
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '9999px', padding: '3px 10px', fontSize: '0.74rem', color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onClick={() => handleSendMessage('What documents will I need to upload?')}
                  disabled={isSendingChat}
                >
                  What documents are needed?
                </button>
                {sessionState?.pending_field === 'father_name' && (
                  <button
                    type="button"
                    style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '9999px', padding: '3px 10px', fontSize: '0.74rem', color: '#334155', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    onClick={() => handleSendMessage("Why do you need my father's name?")}
                    disabled={isSendingChat}
                  >
                    Why father's name?
                  </button>
                )}
              </div>

              {/* Active Listening Notice Banner */}
              {isListening && (
                <div className={styles.listeningNotice}>
                  <div className={styles.listeningLeft}>
                    <span className={styles.listeningPulseDot} />
                    <span className={styles.listeningText}>
                      Listening... Speak clearly in {speechLang === 'hi-IN' ? 'Hindi' : speechLang === 'mr-IN' ? 'Marathi' : 'English'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.listeningStopBtn}
                    onClick={toggleListening}
                  >
                    Done Speaking
                  </button>
                </div>
              )}

              {/* Chat Input Field */}
              <div className={styles.chatInputArea}>
                <button
                  type="button"
                  id="chatbot-mic-btn"
                  className={`${styles.chatMicBtn} ${isListening ? styles.chatMicBtnListening : ''}`}
                  onClick={toggleListening}
                  disabled={isSendingChat}
                  title={isListening ? 'Stop listening' : 'Speak your response (Voice to Text)'}
                >
                  {isListening ? (
                    <MicOff size={18} />
                  ) : (
                    <Mic size={18} />
                  )}
                </button>

                <div className={styles.speechLangGroup} title="Speech Recognition Language">
                  <button
                    type="button"
                    className={`${styles.speechLangBtn} ${speechLang === 'en-IN' ? styles.speechLangBtnActive : ''}`}
                    onClick={() => setSpeechLang('en-IN')}
                    title="English"
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    className={`${styles.speechLangBtn} ${speechLang === 'hi-IN' ? styles.speechLangBtnActive : ''}`}
                    onClick={() => setSpeechLang('hi-IN')}
                    title="हिन्दी (Hindi)"
                  >
                    हिं
                  </button>
                  <button
                    type="button"
                    className={`${styles.speechLangBtn} ${speechLang === 'mr-IN' ? styles.speechLangBtnActive : ''}`}
                    onClick={() => setSpeechLang('mr-IN')}
                    title="मराठी (Marathi)"
                  >
                    मरा
                  </button>
                </div>

                <input
                  type="text"
                  className={styles.chatInput}
                  placeholder={
                    isListening
                      ? 'Listening... Speak your answer now...'
                      : sessionState?.pending_field
                      ? `Type or speak your ${sessionState.pending_field.replace('_', ' ')}...`
                      : 'Type or speak to the assistant...'
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  disabled={isSendingChat}
                />

                <button
                  type="button"
                  className={styles.chatSendBtn}
                  onClick={() => handleSendMessage()}
                  disabled={isSendingChat || !inputText.trim()}
                  title={t("automatedForm.send", "Send answer")}
                >
                  <Send size={18} />
                </button>
              </div>
            </div>

            {/* Right Column: Particulars Extracted & Document Upload Slots */}
            <div className={styles.phase1RightPanel}>
              
              {/* Card 1: Live Extracted Particulars */}
              <div className={styles.summaryCard}>
                <h4 className={styles.summaryTitle}>
                  <FileText size={18} style={{ color: '#2563eb' }} />
                  Extracted Particulars ({Object.keys(sessionState?.chat_data || {}).length}/10)
                </h4>

                {Object.keys(sessionState?.chat_data || {}).length === 0 ? (
                  <div className={styles.summaryEmpty}>
                    No particulars recorded yet. Respond to the assistant to begin populating the form.
                  </div>
                ) : (
                  <div className={styles.summaryList}>
                    {Object.entries(sessionState.chat_data).map(([key, val]) => (
                      <div key={key} className={styles.summaryItem} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                          <span className={styles.summaryLabel}>
                            {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                          <span className={styles.summaryVal} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(val)}</span>
                        </div>
                        <button
                          type="button"
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            color: '#2563eb',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                          onClick={() => handleSendMessage(`Change my ${key.replace(/_/g, ' ')}`)}
                          disabled={isSendingChat}
                          title={`Update ${key.replace(/_/g, ' ')} via chat`}
                        >
                          <Edit2 size={11} />
                          <span>Edit</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card 2: Enclosed Supporting Documents Upload */}
              <div className={styles.docSlotsCard}>
                <h4 className={styles.summaryTitle}>
                  <Upload size={18} style={{ color: '#2563eb' }} />
                  Supporting Documents (OCR Isolated)
                </h4>
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0' }}>
                  Upload required documents. Tesseract OCR will extract data separately to compare against your particulars.
                </p>

                <div className={styles.docSlotsList}>
                  {DOCUMENT_DEFINITIONS.map((docDef) => {
                    const uploaded = sessionState?.uploaded_documents?.[docDef.key]
                    const ocrInfo = sessionState?.ocr_data?.[docDef.key]
                    const isUploading = uploadingDocKey === docDef.key
                    const isRejected =
                      uploaded?.verification_status === 'REJECTED' ||
                      (sessionState?.rejected_docs && sessionState.rejected_docs.includes(docDef.key))

                    return (
                      <div
                        key={docDef.key}
                        className={`${styles.docSlot} ${uploaded ? styles.docSlotUploaded : ''} ${isRejected ? styles.docSlotRejected : ''}`}
                      >
                        <div className={styles.docSlotHeader}>
                          <span className={styles.docSlotName}>{docDef.name}</span>
                          {isRejected ? (
                            <span className={styles.rejectedSlotBadge}>
                              <AlertCircle size={12} />
                              Re-upload Required
                            </span>
                          ) : uploaded ? (
                            <span className={styles.uploadedFileBadge}>
                              <CheckCircle2 size={14} />
                              Uploaded
                            </span>
                          ) : null}
                        </div>

                        <p className={styles.docSlotDesc}>{docDef.desc}</p>

                        {isRejected && (
                          <div className={styles.rejectedSlotReason}>
                            <strong>⚠️ Rejected by Reviewing Officer:</strong>{' '}
                            {uploaded?.rejection_notes || 'Please re-upload a clear, valid official document.'}
                          </div>
                        )}

                        {uploaded && (
                          <div style={{
                            fontSize: '0.78rem',
                            color: isRejected ? '#be123c' : '#15803d',
                            fontWeight: 600,
                            background: isRejected ? '#ffe4e6' : '#f0fdf4',
                            border: `1px solid ${isRejected ? '#fca5a5' : '#bbf7d0'}`,
                            borderRadius: '6px',
                            padding: '4px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            <span>📎 {uploaded.filename}</span>
                          </div>
                        )}

                        <div className={styles.docUploadActionRow}>
                          <label
                            className={styles.uploadTriggerBtn}
                            style={isRejected ? { background: '#e11d48', borderColor: '#be123c', color: '#ffffff' } : undefined}
                          >
                            {isUploading ? (
                              <>
                                <Loader2 size={14} className={styles.spin} />
                                <span>Running OCR...</span>
                              </>
                            ) : isRejected ? (
                              <>
                                <Upload size={14} />
                                <span>Re-upload Document</span>
                              </>
                            ) : uploaded ? (
                              <>
                                <RefreshCw size={13} />
                                <span>Replace File</span>
                              </>
                            ) : (
                              <>
                                <Upload size={14} />
                                <span>Upload Document</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept={docDef.accept}
                              className={styles.fileInputHidden}
                              disabled={isUploading}
                              onChange={(e) => {
                                const f = e.target.files?.[0]
                                if (f) handleDocumentUpload(docDef.key, f)
                              }}
                            />
                          </label>

                          {uploaded && (
                            <button
                              type="button"
                              className={styles.deleteDocBtn}
                              onClick={() => handleDeleteDocument(docDef.key, uploaded.id)}
                              title="Delete uploaded document"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>

                        {/* OCR preview snippet */}
                        {ocrInfo && (
                          <div
                            className={styles.ocrSnippetBadge}
                            style={
                              ocrInfo.provider === 'bypassed'
                                ? { background: '#f0fdf4', borderColor: '#bbf7d0', color: '#166534' }
                                : {}
                            }
                          >
                            <FileCheck size={13} />
                            <span>
                              {ocrInfo.provider === 'bypassed' ? (
                                'Verified (Direct Visual Verification for Photo/Signature)'
                              ) : (
                                <>
                                  OCR Confidence: <strong>{Math.round(ocrInfo.confidence * 100)}%</strong> ({ocrInfo.provider})
                                </>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

            </div>

          </div>

          {/* Bottom Bar: Action to Switch to Phase 2 */}
          <div className={styles.phase1BottomBar}>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: hasRejectedDocs ? '#be123c' : '#0f172a' }}>
                {hasRejectedDocs ? 'Action Required: Re-upload Rejected Document(s)' : 'Ready to review your filled application form?'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.82rem', color: hasRejectedDocs ? '#e11d48' : '#64748b' }}>
                {hasRejectedDocs
                  ? 'The reviewing officer rejected one or more documents. Please re-upload the highlighted document(s) above to unlock application review.'
                  : 'You can switch between chat and the formal populated application form at any time.'}
              </p>
            </div>

            <button
              type="button"
              className={styles.viewFormBtn}
              onClick={() => {
                if (hasRejectedDocs) {
                  toast.error('Please re-upload your rejected document(s) first before reviewing form.')
                  return
                }
                setActivePhase('phase2_review')
              }}
              disabled={!canViewForm && !hasRejectedDocs}
              style={hasRejectedDocs ? { opacity: 0.65, cursor: 'not-allowed', background: '#94a3b8' } : undefined}
              title={hasRejectedDocs ? 'Please re-upload rejected document(s) first' : 'View Application Form'}
            >
              <span>{t("automatedForm.reviewAndConfirm", "View Application Form")}</span>
              <ArrowRight size={18} />
            </button>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          PHASE 2 VIEW: REVIEW, VALIDATION & OCR COMPARISON
          ══════════════════════════════════════════════════════════════ */}
      {activePhase === 'phase2_review' && (
        <div className={styles.phase2Grid}>

          {/* Left Column: Populated Government Application Form */}
          <div className={styles.formCard}>
            
            <div className={styles.officialHeader}>
              <p className={styles.govTitle}>Government of Maharashtra • Revenue Department</p>
              <h2 className={styles.certTitle}>Application Form for {certName}</h2>

              <div className={styles.formMetaRow}>
                <span className={styles.formMetaItem}>
                  <Hash size={13} />
                  Certificate ID: <strong>{draftApp?.certificate_id || draftApp?.application_number}</strong>
                </span>
                <span className={styles.formMetaItem}>
                  <Lock size={13} />
                  Tracking Ref: <strong>{draftApp?.tracking_id}</strong>
                </span>
                <span className={styles.formMetaItem} style={{ color: '#16a34a', background: '#dcfce7' }}>
                  Mode: AI Assisted
                </span>
              </div>
            </div>

            <div className={styles.formIntro}>
              "I do hereby apply for issue of {certName}. My particulars are as under —"
            </div>

            {/* 10 Particulars Fields matching docs-resources/application form format.txt */}
            <div className={styles.fieldsSection}>
              
              {/* 1. Name */}
              <div className={styles.fieldRow}>
                <div className={styles.fieldLabelWrap}>
                  <label className={styles.fieldLabel}>1. Name (Full Legal Name)</label>
                  {sessionState?.comparison_scores?.field_scores?.applicant_name && (
                    <span style={{ fontSize: '0.75rem', color: sessionState.comparison_scores.field_scores.applicant_name.match ? '#16a34a' : '#ea580c', fontWeight: 600 }}>
                      Match: {sessionState.comparison_scores.field_scores.applicant_name.score}%
                    </span>
                  )}
                </div>
                <div className={styles.fieldInputWrap}>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    value={editableFields.name || ''}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    onBlur={() => handleFieldBlur('name')}
                    placeholder="Enter full name"
                  />
                </div>
              </div>

              {/* 2. Father's Name */}
              <div className={styles.fieldRow}>
                <div className={styles.fieldLabelWrap}>
                  <label className={styles.fieldLabel}>2. Father's Name</label>
                  {sessionState?.comparison_scores?.field_scores?.father_name && (
                    <span style={{ fontSize: '0.75rem', color: sessionState.comparison_scores.field_scores.father_name.match ? '#16a34a' : '#ea580c', fontWeight: 600 }}>
                      Match: {sessionState.comparison_scores.field_scores.father_name.score}%
                    </span>
                  )}
                </div>
                <div className={styles.fieldInputWrap}>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    value={editableFields.father_name || ''}
                    onChange={(e) => handleFieldChange('father_name', e.target.value)}
                    onBlur={() => handleFieldBlur('father_name')}
                    placeholder="Enter father's name"
                  />
                </div>
              </div>

              {/* 3. Mother's Name */}
              <div className={styles.fieldRow}>
                <div className={styles.fieldLabelWrap}>
                  <label className={styles.fieldLabel}>3. Mother's Name</label>
                  {sessionState?.comparison_scores?.field_scores?.mother_name && (
                    <span style={{ fontSize: '0.75rem', color: sessionState.comparison_scores.field_scores.mother_name.match ? '#16a34a' : '#ea580c', fontWeight: 600 }}>
                      Match: {sessionState.comparison_scores.field_scores.mother_name.score}%
                    </span>
                  )}
                </div>
                <div className={styles.fieldInputWrap}>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    value={editableFields.mother_name || ''}
                    onChange={(e) => handleFieldChange('mother_name', e.target.value)}
                    onBlur={() => handleFieldBlur('mother_name')}
                    placeholder="Enter mother's name"
                  />
                </div>
              </div>

              {/* 4. Date of Birth */}
              <div className={styles.fieldRow}>
                <div className={styles.fieldLabelWrap}>
                  <label className={styles.fieldLabel}>4. Date of Birth (DD-MM-YYYY)</label>
                  {sessionState?.comparison_scores?.field_scores?.dob && (
                    <span style={{ fontSize: '0.75rem', color: sessionState.comparison_scores.field_scores.dob.match ? '#16a34a' : '#ea580c', fontWeight: 600 }}>
                      Match: {sessionState.comparison_scores.field_scores.dob.score}%
                    </span>
                  )}
                </div>
                <div className={styles.fieldInputWrap}>
                  <input
                    type="text"
                    className={styles.fieldInput}
                    value={editableFields.dob || ''}
                    onChange={(e) => handleFieldChange('dob', e.target.value)}
                    onBlur={() => handleFieldBlur('dob')}
                    placeholder="DD-MM-YYYY"
                  />
                </div>
              </div>

              {/* 5. Sex (Male / Female / Others) */}
              <div className={styles.fieldRow}>
                <div className={styles.fieldLabelWrap}>
                  <label className={styles.fieldLabel}>5. Sex (Male / Female / Others)</label>
                  {sessionState?.comparison_scores?.field_scores?.gender && (
                    <span style={{ fontSize: '0.75rem', color: sessionState.comparison_scores.field_scores.gender.match ? '#16a34a' : '#ea580c', fontWeight: 600 }}>
                      Match: {sessionState.comparison_scores.field_scores.gender.score}%
                    </span>
                  )}
                </div>
                <div className={styles.fieldInputWrap}>
                  <select
                    className={styles.fieldInput}
                    value={editableFields.sex || 'Male'}
                    onChange={(e) => {
                      handleFieldChange('sex', e.target.value)
                      handleFieldBlur('sex')
                    }}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
              </div>

              {/* 6. Marital Status (Yes / No) */}
              <div className={styles.fieldRow}>
                <div className={styles.fieldLabelWrap}>
                  <label className={styles.fieldLabel}>6. Marital Status (Yes / No)</label>
                </div>
                <div className={styles.fieldInputWrap}>
                  <select
                    className={styles.fieldInput}
                    value={editableFields.marital_status || 'No'}
                    onChange={(e) => {
                      handleFieldChange('marital_status', e.target.value)
                      handleFieldBlur('marital_status')
                    }}
                  >
                    <option value="No">No (Unmarried)</option>
                    <option value="Yes">Yes (Married)</option>
                  </select>
                </div>
              </div>

              {/* 7. If Yes Husband's Name */}
              {editableFields.marital_status === 'Yes' && (
                <div className={styles.fieldRow}>
                  <div className={styles.fieldLabelWrap}>
                    <label className={styles.fieldLabel}>7. If Yes, Husband's Name</label>
                  </div>
                  <div className={styles.fieldInputWrap}>
                    <input
                      type="text"
                      className={styles.fieldInput}
                      value={editableFields.husband_name || ''}
                      onChange={(e) => handleFieldChange('husband_name', e.target.value)}
                      onBlur={() => handleFieldBlur('husband_name')}
                      placeholder="Enter husband's full name"
                    />
                  </div>
                </div>
              )}

              {/* 8. Present Residential Address */}
              <div className={styles.fieldRow}>
                <div className={styles.fieldLabelWrap}>
                  <label className={styles.fieldLabel}>8. Present Residential Address</label>
                  {sessionState?.comparison_scores?.field_scores?.address && (
                    <span style={{ fontSize: '0.75rem', color: sessionState.comparison_scores.field_scores.address.match ? '#16a34a' : '#ea580c', fontWeight: 600 }}>
                      Overlap: {sessionState.comparison_scores.field_scores.address.score}%
                    </span>
                  )}
                </div>
                <div className={styles.fieldInputWrap}>
                  <textarea
                    rows={2}
                    className={styles.fieldInput}
                    value={editableFields.address || ''}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                    onBlur={() => handleFieldBlur('address')}
                    placeholder="Enter complete residential address"
                  />
                </div>
              </div>

              {/* 9. Years of Residence (Domicile Certificate only) */}
              {serviceId === 'domicile_certificate' && (
                <div className={styles.fieldRow}>
                  <div className={styles.fieldLabelWrap}>
                    <label className={styles.fieldLabel}>9. Years of Residence (Only for Domicile Certificate)</label>
                  </div>
                  <div className={styles.fieldInputWrap}>
                    <input
                      type="number"
                      className={styles.fieldInput}
                      value={editableFields.years_of_residence || ''}
                      onChange={(e) => handleFieldChange('years_of_residence', e.target.value)}
                      onBlur={() => handleFieldBlur('years_of_residence')}
                      placeholder="e.g. 15"
                    />
                  </div>
                </div>
              )}

              {/* 10. Purpose of the Certificate (Income Certificate only) */}
              {serviceId === 'income_certificate' && (
                <div className={styles.fieldRow}>
                  <div className={styles.fieldLabelWrap}>
                    <label className={styles.fieldLabel}>10. Purpose of the Certificate (Only for Income Certificate)</label>
                  </div>
                  <div className={styles.fieldInputWrap}>
                    <input
                      type="text"
                      className={styles.fieldInput}
                      value={editableFields.purpose || ''}
                      onChange={(e) => handleFieldChange('purpose', e.target.value)}
                      onBlur={() => handleFieldBlur('purpose')}
                      placeholder="e.g. Higher Education Scholarship"
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Statutory Declaration Checkbox */}
            <div className={styles.declarationCard}>
              <label className={styles.declarationLabel}>
                <input
                  type="checkbox"
                  className={styles.declarationCheckbox}
                  checked={declarationAccepted}
                  onChange={(e) => setDeclarationAccepted(e.target.checked)}
                />
                <span>
                  <strong>Declaration:</strong> The above particulars are correct as per the best of my knowledge. In case of any false information, I shall be held responsible and appropriate action may be taken against me.
                </span>
              </label>
            </div>

            {/* Actions: Back to Chat and Submit */}
            <div className={styles.formActionsRow}>
              <button
                type="button"
                className={styles.backToChatBtn}
                onClick={() => setActivePhase('phase1_chat')}
              >
                <Bot size={16} />
                <span>Back to Assistant</span>
              </button>

              <button
                type="button"
                className={styles.submitBtn}
                onClick={handleSubmitApplication}
                disabled={isSubmitting || !declarationAccepted || hasRejectedDocs}
                title={hasRejectedDocs ? 'Please re-upload rejected document(s) in AI chat before submitting' : 'Submit application'}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className={styles.spin} />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Submit Application</span>
                  </>
                )}
              </button>
            </div>

            {hasRejectedDocs && (
              <div style={{
                background: '#ffe4e6',
                border: '1px solid #fca5a5',
                color: '#be123c',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.84rem',
                fontWeight: 600,
                marginTop: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <AlertCircle size={16} />
                <span>One or more supporting documents were rejected by the reviewing officer. Please click "Back to Assistant" and re-upload before submitting.</span>
              </div>
            )}

          </div>

          {/* Right Column: Document OCR Comparison & Resolution Panel */}
          <div className={styles.ocrPanel}>
            
            {/* Overall Match Overview Card */}
            <div className={styles.matchOverviewCard}>
              <div className={styles.matchHeader}>
                <h4 className={styles.matchTitle}>
                  <ShieldCheck size={20} style={{ color: '#2563eb' }} />
                  OCR Comparison & Validation
                </h4>

                {sessionState?.comparison_scores?.has_comparisons &&
                sessionState.comparison_scores.overall_score !== null &&
                sessionState.comparison_scores.overall_score !== undefined ? (
                  <span
                    className={`${styles.matchScoreBadge} ${
                      sessionState.comparison_scores.overall_score >= 85
                        ? styles.scoreGreen
                        : sessionState.comparison_scores.overall_score >= 60
                        ? styles.scoreAmber
                        : styles.scoreRed
                    }`}
                  >
                    {sessionState.comparison_scores.overall_score}% Match
                  </span>
                ) : (
                  <span
                    className={styles.matchScoreBadge}
                    style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1' }}
                  >
                    Pending Verification
                  </span>
                )}
              </div>

              <p className={styles.matchDisclaimer}>
                Our deterministic OCR engine compares your conversational inputs against the text extracted from your uploaded statutory documents.
              </p>
            </div>

            {/* Field Comparison Cards */}
            <div className={styles.comparisonList}>
              {sessionState?.comparison_scores?.field_scores &&
              Object.keys(sessionState.comparison_scores.field_scores).length > 0 ? (
                Object.entries(sessionState.comparison_scores.field_scores).map(([fieldKey, item]) => {
                  const isMatch = item.match
                  const fieldTitle = FIELD_TITLE_MAP[fieldKey] || fieldKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

                  return (
                    <div
                      key={fieldKey}
                      className={`${styles.compCard} ${!isMatch ? styles.compCardMismatch : ''}`}
                    >
                      <div className={styles.compCardHeader}>
                        <span className={styles.compFieldName}>{fieldTitle}</span>
                        <span className={`${styles.compStatusBadge} ${isMatch ? styles.badgeMatch : styles.badgeMismatch}`}>
                          {isMatch ? <Check size={13} /> : <AlertCircle size={13} />}
                          {isMatch ? 'Matched' : 'Discrepancy Detected'} ({item.score}%)
                        </span>
                      </div>

                      <div className={styles.compValuesGrid}>
                        <div className={styles.valBox}>
                          <div className={styles.valBoxTitle}>Form / Chat Input</div>
                          <div className={styles.valBoxText}>{item.app_value || '—'}</div>
                        </div>

                        <div className={styles.valBox}>
                          <div className={styles.valBoxTitle}>Document OCR Extracted</div>
                          <div className={styles.valBoxText}>{item.ocr_value || '—'}</div>
                        </div>
                      </div>

                      {/* Discrepancy Resolution Buttons */}
                      {!isMatch && (
                        <div className={styles.compActionsRow}>
                          <button
                            type="button"
                            className={styles.actionBtnKeepChat}
                            onClick={() => handleResolveField(fieldKey, 'CHAT', item.app_value)}
                            title="Keep your conversational input"
                          >
                            Keep Form Value
                          </button>

                          <button
                            type="button"
                            className={styles.actionBtnUseOcr}
                            onClick={() => handleResolveField(fieldKey, 'OCR', item.ocr_value)}
                            title="Replace form value with document OCR value"
                          >
                            Use Document OCR Value
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className={styles.summaryCard} style={{ textAlign: 'center', color: '#64748b' }}>
                  <FileCheck size={28} style={{ color: '#94a3b8', margin: '0 auto 8px auto' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>
                    Upload supporting documents to compare your declared particulars against OCR-extracted data.
                  </p>
                </div>
              )}
            </div>

            {/* Uploaded Documents Quick List */}
            <div className={styles.summaryCard}>
              <h4 className={styles.summaryTitle}>
                <Upload size={18} style={{ color: '#2563eb' }} />
                Uploaded Documents ({Object.keys(sessionState?.uploaded_documents || {}).length})
              </h4>

              <div className={styles.summaryList}>
                {DOCUMENT_DEFINITIONS.map((def) => {
                  const doc = sessionState?.uploaded_documents?.[def.key]
                  const ocr = sessionState?.ocr_data?.[def.key]

                  return (
                    <div key={def.key} className={styles.summaryItem}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{def.name}</div>
                        <div style={{ fontSize: '0.74rem', color: doc ? '#16a34a' : '#94a3b8', fontWeight: doc ? 600 : 400 }}>
                          {doc ? `✓ ${doc.filename}` : 'Not uploaded yet'}
                        </div>
                      </div>

                      {ocr && (
                        <span style={{ fontSize: '0.76rem', color: ocr.provider === 'bypassed' ? '#16a34a' : '#1d4ed8', fontWeight: 700 }}>
                          {ocr.provider === 'bypassed' ? 'Verified (Visual Proof)' : `${Math.round(ocr.confidence * 100)}% OCR`}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SCREEN-BLOCKING OCR / UPLOAD PROCESSING OVERLAY MODAL
          ══════════════════════════════════════════════════════════════ */}
      {ocrModal.isOpen && (
        <div className={styles.ocrModalBackdrop} role="dialog" aria-modal="true">
          <div className={styles.ocrModalCard}>
            
            {/* Header */}
            <div className={styles.ocrModalHeader}>
              <div className={styles.ocrModalTopBadge}>
                {ocrModal.isBypassed ? (
                  <>
                    <ShieldCheck size={13} />
                    <span>Direct Biometric Attachment</span>
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
                      { step: 4, title: 'Cross-Field Evidence Matching', sub: 'Validating against your declared form inputs' },
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
