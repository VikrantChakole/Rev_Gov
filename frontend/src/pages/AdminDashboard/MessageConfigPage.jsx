import React, { useState, useEffect, useRef } from 'react'
import {
  MessageSquare,
  Send,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Check,
  ShieldCheck,
  Zap,
  Globe,
  Loader2,
  Sparkles,
  Phone,
  Layers,
  Copy,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { configApi } from '../../api/config'
import styles from './MessageConfigPage.module.css'

const SMS_PROVIDERS = [
  { id: 'cdac_gov', name: 'CDAC Gov SMS (National NIC Gateway)' },
  { id: 'twilio', name: 'Twilio SMS Gateway' },
  { id: 'gupshup', name: 'Gupshup Enterprise Messaging' },
  { id: 'mock', name: 'Sandbox / Mock Engine' },
]

const WHATSAPP_PROVIDERS = [
  { id: 'meta_cloud', name: 'Meta WhatsApp Cloud API (Official)' },
  { id: 'twilio_whatsapp', name: 'Twilio WhatsApp Business' },
  { id: 'gupshup', name: 'Gupshup WhatsApp API' },
  { id: 'mock', name: 'Sandbox / Mock Engine' },
]

const TRIGGER_EVENTS = [
  { id: 'SUBMITTED', label: 'Submitted', badge: 'Queue' },
  { id: 'UNDER_REVIEW', label: 'Under Review', badge: 'Scrutiny' },
  { id: 'CORRECTION_NEEDED', label: 'Action Required', badge: 'Clarification' },
  { id: 'APPROVED', label: 'Approved', badge: 'Officer' },
  { id: 'PAYMENT_REQUIRED', label: 'Payment Needed', badge: 'Fees' },
  { id: 'CERTIFICATE_READY', label: 'Certificate Ready', badge: 'Complete' },
  { id: 'ESCALATED', label: 'Escalated', badge: 'Desk Clerk' },
  { id: 'REJECTED', label: 'Rejected', badge: 'Notice' },
]

export default function MessageConfigPage() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Active trigger & language editor
  const [activeTrigger, setActiveTrigger] = useState('SUBMITTED')
  const [activeLang, setActiveLang] = useState('en')

  // Preview channel
  const [previewMode, setPreviewMode] = useState('whatsapp') // 'whatsapp' | 'sms'

  // Test sandbox state
  const [testPhone, setTestPhone] = useState('9876543210')
  const [testChannel, setTestChannel] = useState('whatsapp')
  const [testingDispatch, setTestingDispatch] = useState(false)
  const [testReceipt, setTestReceipt] = useState(null)

  const textareaRef = useRef(null)

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const res = await configApi.getMessageConfig()
      if (res?.data?.success) {
        setConfig(res.data.config)
      }
    } catch (err) {
      console.error('Failed to load message config:', err)
      toast.error('Failed to load message gateway configuration.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  const handleSaveConfig = async () => {
    if (!config) return
    try {
      setSaving(true)
      const res = await configApi.updateMessageConfig(config)
      if (res?.data?.success) {
        toast.success('Configuration saved and synchronized successfully!')
      }
    } catch (err) {
      console.error('Failed to save config:', err)
      toast.error('Failed to save configuration.')
    } finally {
      setSaving(false)
    }
  }

  const handleTriggerTemplateChange = (text) => {
    if (!config) return
    setConfig((prev) => {
      const updated = JSON.parse(JSON.stringify(prev))
      if (!updated.triggers[activeTrigger]) {
        updated.triggers[activeTrigger] = { templates: {} }
      }
      if (!updated.triggers[activeTrigger].templates) {
        updated.triggers[activeTrigger].templates = {}
      }
      updated.triggers[activeTrigger].templates[activeLang] = text
      return updated
    })
  }

  const handleTriggerToggle = (checked) => {
    if (!config) return
    setConfig((prev) => {
      const updated = JSON.parse(JSON.stringify(prev))
      if (updated.triggers[activeTrigger]) {
        updated.triggers[activeTrigger].enabled = checked
      }
      return updated
    })
  }

  const handleInsertPlaceholder = (placeholderKey) => {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    const currentText =
      config?.triggers?.[activeTrigger]?.templates?.[activeLang] || ''
    const updatedText =
      currentText.substring(0, start) +
      placeholderKey +
      currentText.substring(end)
    handleTriggerTemplateChange(updatedText)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(
        start + placeholderKey.length,
        start + placeholderKey.length
      )
    }, 50)
  }

  const handleTestDispatch = async () => {
    if (!testPhone.trim()) {
      toast.error('Please enter a recipient phone number.')
      return
    }
    try {
      setTestingDispatch(true)
      const res = await configApi.testMessageDispatch({
        recipient_phone: testPhone.trim(),
        channel: testChannel,
        trigger_event: activeTrigger,
        language: activeLang,
      })
      if (res?.data?.success) {
        setTestReceipt(res.data)
        toast.success(`Test alert dispatched via ${testChannel.toUpperCase()}!`)
      }
    } catch (err) {
      console.error('Failed to send test alert:', err)
      toast.error('Error sending test notification.')
    } finally {
      setTestingDispatch(false)
    }
  }

  // Generate live sample interpolation for smartphone preview
  const currentTemplate =
    config?.triggers?.[activeTrigger]?.templates?.[activeLang] || ''
  const previewRendered = currentTemplate
    .replace(/{citizen_name}/g, 'Ramesh Patil')
    .replace(/{tracking_id}/g, 'MH-REV-2026-88392')
    .replace(/{service_name}/g, 'Income Certificate')
    .replace(/{status}/g, activeTrigger.replace('_', ' '))
    .replace(/{portal_url}/g, 'https://revgov.maharashtra.gov.in/track')
    .replace(/{amount}/g, '55')
    .replace(/{reason}/g, 'Verification needed for address proof')
    .replace(/{escalation_id}/g, 'ESC-99214A')

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
          <Loader2 className="spin" size={28} color="#2563eb" />
          <span style={{ fontSize: '0.95rem', color: '#64748b' }}>Loading notification gateway configurations...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* ── Page Header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.titleGroup}>
          <h1 className={styles.pageTitle}>
            <MessageSquare className={styles.titleIcon} size={28} />
            Message & WhatsApp Gateway Configuration
          </h1>
          <p className={styles.pageSubtitle}>
            Configure automated SMS and WhatsApp citizen status alerts, gateway providers, and multilingual notification templates.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.refreshBtn} onClick={fetchConfig} title="Reload settings">
            <RefreshCw size={15} />
            Refresh
          </button>
          <button className={styles.saveBtn} onClick={handleSaveConfig} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ── Live Status Bar ── */}
      <div className={styles.statusBanner}>
        <div className={styles.statusItems}>
          <div className={styles.statusItem}>
            <span className={styles.statusDot} />
            <span>SMS Gateway:</span>
            <span className={styles.statusValue}>
              {SMS_PROVIDERS.find((p) => p.id === config?.sms_provider)?.name || config?.sms_provider}
            </span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusDot} />
            <span>WhatsApp Gateway:</span>
            <span className={styles.statusValue}>
              {WHATSAPP_PROVIDERS.find((p) => p.id === config?.whatsapp_provider)?.name || config?.whatsapp_provider}
            </span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusDot} />
            <span>Sender ID:</span>
            <span className={styles.statusValue}>{config?.sender_id || 'REVGOV'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Encrypted Channels</span>
          <ShieldCheck size={16} color="#10b981" />
        </div>
      </div>

      {/* ── 2-Column Responsive Layout ── */}
      <div className={styles.layoutGrid}>
        {/* Left Column: Gateways + Triggers + Template Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Card 1: Channel Providers & Gateway Credentials */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>
                  <Zap size={18} color="#2563eb" />
                  Communication Gateways & Channels
                </h2>
                <p className={styles.cardDesc}>
                  Select active message routing providers and configure official government sender credentials.
                </p>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>SMS Gateway Provider</label>
                <select
                  className={styles.formSelect}
                  value={config?.sms_provider || 'cdac_gov'}
                  onChange={(e) => setConfig({ ...config, sms_provider: e.target.value })}
                >
                  {SMS_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>WhatsApp Business Provider</label>
                <select
                  className={styles.formSelect}
                  value={config?.whatsapp_provider || 'meta_cloud'}
                  onChange={(e) => setConfig({ ...config, whatsapp_provider: e.target.value })}
                >
                  {WHATSAPP_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Official Sender ID (SMS Header)</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={config?.sender_id || ''}
                  onChange={(e) => setConfig({ ...config, sender_id: e.target.value })}
                  placeholder="e.g. REVGOV"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>WhatsApp Phone Number ID</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={config?.whatsapp_phone_number_id || ''}
                  onChange={(e) => setConfig({ ...config, whatsapp_phone_number_id: e.target.value })}
                  placeholder="e.g. 109847291048201"
                />
              </div>
            </div>

            {/* Master Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleLabel}>Enable Automated SMS Alerts</span>
                  <span className={styles.toggleDesc}>Dispatches real-time text message alerts to the citizen's mobile number.</span>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={Boolean(config?.enable_sms)}
                    onChange={(e) => setConfig({ ...config, enable_sms: e.target.checked })}
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleLabel}>Enable Automated WhatsApp Alerts</span>
                  <span className={styles.toggleDesc}>Delivers rich status updates and document links straight to WhatsApp.</span>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={Boolean(config?.enable_whatsapp)}
                    onChange={(e) => setConfig({ ...config, enable_whatsapp: e.target.checked })}
                  />
                  <span className={styles.slider} />
                </label>
              </div>

              <div className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleLabel}>Fallback to SMS on WhatsApp Failure</span>
                  <span className={styles.toggleDesc}>Automatically dispatches standard SMS if citizen WhatsApp delivery fails.</span>
                </div>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={Boolean(config?.fallback_to_sms)}
                    onChange={(e) => setConfig({ ...config, fallback_to_sms: e.target.checked })}
                  />
                  <span className={styles.slider} />
                </label>
              </div>
            </div>
          </div>

          {/* Card 2: Status Event Triggers & Multilingual Template Editor */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>
                  <Layers size={18} color="#2563eb" />
                  Status Update Triggers & Multilingual Templates
                </h2>
                <p className={styles.cardDesc}>
                  Select a workflow status event to customize alert copy across English, Hindi, and Marathi.
                </p>
              </div>
            </div>

            {/* Event Selector Horizontal Pills */}
            <div className={styles.triggerList}>
              {TRIGGER_EVENTS.map((trig) => {
                const isEnabled = config?.triggers?.[trig.id]?.enabled !== false
                return (
                  <button
                    key={trig.id}
                    className={`${styles.triggerPill} ${activeTrigger === trig.id ? styles.active : ''}`}
                    onClick={() => setActiveTrigger(trig.id)}
                  >
                    <span>{trig.label}</span>
                    <span style={{ fontSize: '0.68rem', opacity: 0.7 }}>({trig.badge})</span>
                    {!isEnabled && <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>●</span>}
                  </button>
                )
              })}
            </div>

            {/* Active Trigger Controls & Language Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#334155' }}>
                  Trigger Status:
                </span>
                <label className={styles.switch}>
                  <input
                    type="checkbox"
                    checked={config?.triggers?.[activeTrigger]?.enabled !== false}
                    onChange={(e) => handleTriggerToggle(e.target.checked)}
                  />
                  <span className={styles.slider} />
                </label>
                <span style={{ fontSize: '0.8rem', color: config?.triggers?.[activeTrigger]?.enabled !== false ? '#15803d' : '#94a3b8', fontWeight: 600 }}>
                  {config?.triggers?.[activeTrigger]?.enabled !== false ? 'Active' : 'Muted'}
                </span>
              </div>

              {/* Language Tabs */}
              <div className={styles.langTabs}>
                <button
                  className={`${styles.langTab} ${activeLang === 'en' ? styles.active : ''}`}
                  onClick={() => setActiveLang('en')}
                >
                  English (EN)
                </button>
                <button
                  className={`${styles.langTab} ${activeLang === 'hi' ? styles.active : ''}`}
                  onClick={() => setActiveLang('hi')}
                >
                  हिन्दी (HI)
                </button>
                <button
                  className={`${styles.langTab} ${activeLang === 'mr' ? styles.active : ''}`}
                  onClick={() => setActiveLang('mr')}
                >
                  मराठी (MR)
                </button>
              </div>
            </div>

            {/* Variable Placeholders Section */}
            <div className={styles.placeholdersSection}>
              <span className={styles.chipsLabel}>
                Insert Dynamic Data Placeholders (Click to insert):
              </span>
              <div className={styles.chipsList}>
                {config?.placeholders?.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={styles.chip}
                    onClick={() => handleInsertPlaceholder(p.key)}
                    title={`${p.description} (e.g. ${p.sample})`}
                  >
                    + {p.key}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Textarea */}
            <div className={styles.formGroup}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className={styles.formLabel}>
                  Notification Message Body ({activeLang.toUpperCase()})
                </label>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  {currentTemplate.length} characters
                </span>
              </div>
              <textarea
                ref={textareaRef}
                rows={5}
                className={styles.formTextarea}
                value={currentTemplate}
                onChange={(e) => handleTriggerTemplateChange(e.target.value)}
                placeholder="Enter status update notification message template..."
              />
            </div>
          </div>
        </div>

        {/* Right Column: Live Smartphone Preview & Test Sandbox */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Smartphone Simulator Preview */}
          <div className={styles.phoneContainer}>
            <div className={styles.phoneTopBar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Smartphone size={14} />
                <span>Live Smartphone Preview</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  style={{
                    background: previewMode === 'whatsapp' ? '#059669' : '#334155',
                    border: 'none',
                    color: '#fff',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                  }}
                  onClick={() => setPreviewMode('whatsapp')}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  style={{
                    background: previewMode === 'sms' ? '#2563eb' : '#334155',
                    border: 'none',
                    color: '#fff',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                  }}
                  onClick={() => setPreviewMode('sms')}
                >
                  SMS
                </button>
              </div>
            </div>

            <div className={`${styles.phoneScreen} ${previewMode === 'sms' ? styles.smsMode : ''}`}>
              {previewMode === 'whatsapp' ? (
                <>
                  <div className={styles.whatsappHeader}>
                    <div className={styles.govEmblemSmall}>🏛️</div>
                    <div className={styles.whatsappHeaderInfo}>
                      <span className={styles.whatsappHeaderTitle}>
                        Revenue Department MH
                        <CheckCircle2 size={13} color="#10b981" fill="#10b981" />
                      </span>
                      <span className={styles.whatsappHeaderSub}>Official Government Service</span>
                    </div>
                  </div>

                  <div className={styles.chatBubbleWhatsApp}>
                    {previewRendered || 'Message body is empty'}
                    <div className={styles.bubbleMeta}>
                      <span>10:42 AM</span>
                      <span style={{ color: '#53bdeb', fontWeight: 'bold' }}>✓✓</span>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#64748b' }}>
                    SMS • REVGOV • Today 10:42 AM
                  </div>
                  <div className={styles.chatBubbleSMS}>
                    {previewRendered || 'Message body is empty'}
                    <div className={styles.bubbleMeta}>
                      <span>Delivered</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sandbox Test Dispatch */}
          <div className={styles.sandboxCard}>
            <div className={styles.sandboxTitle}>
              <Send size={16} color="#10b981" />
              Dispatch Test Notification Sandbox
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
              Simulate an instant alert dispatch for event <strong>{activeTrigger}</strong> in <strong>{activeLang.toUpperCase()}</strong>.
            </p>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Target Phone</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="9876543210"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Channel</label>
                <select
                  className={styles.formSelect}
                  value={testChannel}
                  onChange={(e) => setTestChannel(e.target.value)}
                >
                  <option value="whatsapp">WhatsApp Alert</option>
                  <option value="sms">SMS Text Alert</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              className={styles.testDispatchBtn}
              onClick={handleTestDispatch}
              disabled={testingDispatch}
            >
              {testingDispatch ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
              {testingDispatch ? 'Simulating Dispatch...' : 'Dispatch Test Alert'}
            </button>

            {/* Test Receipt Box */}
            {testReceipt && (
              <div className={styles.receiptBox}>
                <div className={styles.receiptRow}>
                  <span style={{ fontWeight: 700 }}>Dispatch Receipt</span>
                  <span className={styles.receiptBadge}>
                    <Check size={11} style={{ display: 'inline', marginRight: 2 }} />
                    {testReceipt.status}
                  </span>
                </div>
                <div className={styles.receiptRow}>
                  <span>Dispatch ID:</span>
                  <span style={{ fontFamily: 'monospace' }}>{testReceipt.dispatch_id}</span>
                </div>
                <div className={styles.receiptRow}>
                  <span>Gateway Latency:</span>
                  <span>{testReceipt.latency_ms} ms</span>
                </div>
                <div className={styles.receiptRow}>
                  <span>Recipient:</span>
                  <span>+91 {testReceipt.recipient}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
