import React, { useState, useEffect } from 'react'
import {
  PhoneCall,
  Save,
  RefreshCw,
  ExternalLink,
  Volume2,
  Mic,
  Radio,
  Clock,
  Settings,
  Layers,
  CheckCircle2,
  Loader2,
  Headphones,
  Sliders,
  PhoneForwarded,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { configApi } from '../../api/config'
import styles from './IVRConfigPage.module.css'

const TTS_ENGINES = [
  { id: 'gtts', name: 'Google Text-to-Speech (gTTS 13 Indian Languages)' },
  { id: 'edge_tts', name: 'Edge-TTS Neural Synthesizer' },
  { id: 'mock', name: 'Mock / Simulated Speech Synth' },
]

const STT_ENGINES = [
  { id: 'google', name: 'Google Speech Recognition Cloud' },
  { id: 'whisper', name: 'OpenAI Whisper Neural Model' },
  { id: 'mock', name: 'Mock Voice Recognizer' },
]

const FALLBACK_OPTIONS = [
  { id: 'TRANSFER_TO_CLERK', label: 'Transfer Call to Human Desk Clerk Queue' },
  { id: 'VOICEMAIL', label: 'Record Voicemail for Citizen Callback' },
  { id: 'REPEAT_MENU', label: 'Repeat Main Menu Options' },
]

export default function IVRConfigPage() {
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Language for greetings & audio preview
  const [activeLang, setActiveLang] = useState('en')

  // Audio preview state
  const [synthesizingTTS, setSynthesizingTTS] = useState(false)
  const [previewAudioUrl, setPreviewAudioUrl] = useState(null)

  const fetchConfig = async () => {
    try {
      setLoading(true)
      const res = await configApi.getIVRConfig()
      if (res?.data?.success) {
        setConfig(res.data.config)
      }
    } catch (err) {
      console.error('Failed to load IVR config:', err)
      toast.error('Failed to load IVR configuration.')
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
      const res = await configApi.updateIVRConfig(config)
      if (res?.data?.success) {
        toast.success('IVR configuration updated and synchronized!')
      }
    } catch (err) {
      console.error('Failed to save IVR config:', err)
      toast.error('Failed to save IVR configuration.')
    } finally {
      setSaving(false)
    }
  }

  const handleGreetingChange = (text) => {
    if (!config) return
    setConfig((prev) => ({
      ...prev,
      greetings: {
        ...(prev.greetings || {}),
        [activeLang]: text,
      },
    }))
  }

  const handleDTMFToggle = (key, checked) => {
    if (!config?.dtmf_menu) return
    setConfig((prev) => {
      const updated = JSON.parse(JSON.stringify(prev))
      if (updated.dtmf_menu[key]) {
        updated.dtmf_menu[key].enabled = checked
      }
      return updated
    })
  }

  const handleDTMFLabelChange = (key, label) => {
    if (!config?.dtmf_menu) return
    setConfig((prev) => {
      const updated = JSON.parse(JSON.stringify(prev))
      if (updated.dtmf_menu[key]) {
        updated.dtmf_menu[key].label = label
      }
      return updated
    })
  }

  const handleSynthesizePreview = async () => {
    const currentGreeting = config?.greetings?.[activeLang] || ''
    if (!currentGreeting.trim()) {
      toast.error('Greeting script is empty.')
      return
    }
    try {
      setSynthesizingTTS(true)
      const res = await configApi.testIVRTTS({
        text: currentGreeting.trim(),
        language: activeLang,
        tts_engine: config?.tts_engine || 'gtts',
      })
      if (res?.data?.success && res.data.audio_url) {
        setPreviewAudioUrl(res.data.audio_url)
        toast.success('TTS audio synthesized successfully!')
      } else {
        toast.error('Failed to synthesize TTS audio.')
      }
    } catch (err) {
      console.error('TTS preview error:', err)
      toast.error('Error generating audio preview.')
    } finally {
      setSynthesizingTTS(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 12 }}>
          <Loader2 className="spin" size={28} color="#7c3aed" />
          <span style={{ fontSize: '0.95rem', color: '#64748b' }}>Loading IVR telephony settings...</span>
        </div>
      </div>
    )
  }

  const currentGreeting = config?.greetings?.[activeLang] || ''

  return (
    <div className={styles.container}>
      {/* ── Page Header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.titleGroup}>
          <h1 className={styles.pageTitle}>
            <PhoneCall className={styles.titleIcon} size={28} />
            Interactive Voice Response (IVR) Configuration
          </h1>
          <p className={styles.pageSubtitle}>
            Configure citizen inbound helpline routing, DTMF keypad menu rules, multilingual voice prompts, and speech synthesis engines.
          </p>
        </div>

        <div className={styles.headerActions}>
          <a
            href="/ivr"
            target="_blank"
            rel="noreferrer"
            className={styles.secondaryBtn}
            title="Open citizen phone simulator"
          >
            <ExternalLink size={15} />
            Open IVR Simulator
          </a>
          <button className={styles.secondaryBtn} onClick={fetchConfig} title="Reload settings">
            <RefreshCw size={15} />
            Refresh
          </button>
          <button className={styles.saveBtn} onClick={handleSaveConfig} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* ── Status Banner ── */}
      <div className={styles.statusBanner}>
        <div className={styles.statusItems}>
          <div className={styles.statusItem}>
            <span className={styles.statusDot} />
            <span>Toll-Free Helpline:</span>
            <span className={styles.statusValue}>{config?.helpline_number || '1800-120-8040'}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusDot} />
            <span>Operating Schedule:</span>
            <span className={styles.statusValue}>{config?.operating_hours || '24x7'}</span>
          </div>
          <div className={styles.statusItem}>
            <span className={styles.statusDot} />
            <span>Speech Engine:</span>
            <span className={styles.statusValue}>gTTS (13 Indian Languages)</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Headphones size={18} color="#a21caf" />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#701a75' }}>
            Telephony Gateway Active
          </span>
        </div>
      </div>

      {/* ── 2-Column Grid ── */}
      <div className={styles.layoutGrid}>
        {/* Left Column: Helpline Inbound Gateway & Speech Engines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Card 1: Inbound Helpline Routing */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>
                  <Radio size={18} color="#7c3aed" />
                  Inbound Helpline Gateway & Inbound Rules
                </h2>
                <p className={styles.cardDesc}>
                  Configure national toll-free DID routing and citizen call handling policies.
                </p>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Toll-Free Helpline Number</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={config?.helpline_number || ''}
                  onChange={(e) => setConfig({ ...config, helpline_number: e.target.value })}
                  placeholder="e.g. 1800-120-8040"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Direct DID Alternative Number</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={config?.alternative_number || ''}
                  onChange={(e) => setConfig({ ...config, alternative_number: e.target.value })}
                  placeholder="e.g. 022-2202-9999"
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Operating Schedule</label>
                <select
                  className={styles.formSelect}
                  value={config?.operating_hours || '24x7'}
                  onChange={(e) => setConfig({ ...config, operating_hours: e.target.value })}
                >
                  <option value="24x7">24x7 Automated Voice Bot</option>
                  <option value="09:00-18:00">Working Hours (09:00 - 18:00 IST)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Default Greeting Language</label>
                <select
                  className={styles.formSelect}
                  value={config?.default_language || 'en'}
                  onChange={(e) => setConfig({ ...config, default_language: e.target.value })}
                >
                  <option value="en">English (India)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                  <option value="mr">मराठी (Marathi)</option>
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Silence Timeout (Seconds)</label>
                <input
                  type="number"
                  min="3"
                  max="15"
                  className={styles.formInput}
                  value={config?.max_silence_timeout_sec || 5}
                  onChange={(e) => setConfig({ ...config, max_silence_timeout_sec: Number(e.target.value) })}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Unrecognized Input Fallback</label>
                <select
                  className={styles.formSelect}
                  value={config?.fallback_action || 'TRANSFER_TO_CLERK'}
                  onChange={(e) => setConfig({ ...config, fallback_action: e.target.value })}
                >
                  {FALLBACK_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Voice Synthesis & Speech Engines */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>
                  <Sliders size={18} color="#7c3aed" />
                  Voice Synthesis (TTS) & AI Speech Engine
                </h2>
                <p className={styles.cardDesc}>
                  Select speech synthesis and automatic voice recognition acoustic models.
                </p>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Text-To-Speech (TTS) Engine</label>
                <select
                  className={styles.formSelect}
                  value={config?.tts_engine || 'gtts'}
                  onChange={(e) => setConfig({ ...config, tts_engine: e.target.value })}
                >
                  {TTS_ENGINES.map((eng) => (
                    <option key={eng.id} value={eng.id}>
                      {eng.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Speech-To-Text (STT) Engine</label>
                <select
                  className={styles.formSelect}
                  value={config?.stt_engine || 'google'}
                  onChange={(e) => setConfig({ ...config, stt_engine: e.target.value })}
                >
                  {STT_ENGINES.map((eng) => (
                    <option key={eng.id} value={eng.id}>
                      {eng.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Voice Profile Gender</label>
                <select
                  className={styles.formSelect}
                  value={config?.voice_gender || 'female'}
                  onChange={(e) => setConfig({ ...config, voice_gender: e.target.value })}
                >
                  <option value="female">Female Neural (Professional & Polite)</option>
                  <option value="male">Male Neural (Formal)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Speech Rate Speed</label>
                <select
                  className={styles.formSelect}
                  value={String(config?.speech_rate || 1.0)}
                  onChange={(e) => setConfig({ ...config, speech_rate: parseFloat(e.target.value) })}
                >
                  <option value="0.85">0.85x (Slow & Clear)</option>
                  <option value="1.0">1.0x (Normal Pace)</option>
                  <option value="1.15">1.15x (Brisk)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: DTMF Menu Navigation & Multilingual Voice Prompts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Card 3: DTMF Keypad Menu Tree */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>
                  <Layers size={18} color="#7c3aed" />
                  DTMF Keypad Menu Tree
                </h2>
                <p className={styles.cardDesc}>
                  Configure automated touch-tone telephone key actions and options.
                </p>
              </div>
            </div>

            <div className={styles.dtmfList}>
              {config?.dtmf_menu &&
                Object.entries(config.dtmf_menu).map(([key, item]) => (
                  <div key={key} className={styles.dtmfItem}>
                    <div className={styles.dtmfKeyBadge}>{key}</div>
                    <div className={styles.dtmfInfo}>
                      <input
                        type="text"
                        className={styles.formInput}
                        style={{ padding: '4px 8px', fontSize: '0.84rem' }}
                        value={item.label}
                        onChange={(e) => handleDTMFLabelChange(key, e.target.value)}
                      />
                      <span className={styles.dtmfAction}>Action: {item.action}</span>
                    </div>
                    <label className={styles.switch}>
                      <input
                        type="checkbox"
                        checked={item.enabled !== false}
                        onChange={(e) => handleDTMFToggle(key, e.target.checked)}
                      />
                      <span className={styles.slider} />
                    </label>
                  </div>
                ))}
            </div>
          </div>

          {/* Card 4: Multilingual Voice Greetings & Audio Preview */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2 className={styles.cardTitle}>
                  <Volume2 size={18} color="#7c3aed" />
                  Multilingual Greetings & Voice Audio Preview
                </h2>
                <p className={styles.cardDesc}>
                  Customize welcome greeting scripts and listen to the synthesized speech.
                </p>
              </div>
            </div>

            {/* Language Selector */}
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

            {/* Greeting Editor */}
            <div className={styles.formGroup}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className={styles.formLabel}>
                  Greeting Voice Script ({activeLang.toUpperCase()})
                </label>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  {currentGreeting.length} characters
                </span>
              </div>
              <textarea
                rows={4}
                className={styles.formTextarea}
                value={currentGreeting}
                onChange={(e) => handleGreetingChange(e.target.value)}
                placeholder="Enter welcome voice script..."
              />
            </div>

            {/* Listen Audio Preview Box */}
            <div className={styles.audioPlayerBox}>
              <button
                type="button"
                className={styles.listenBtn}
                onClick={handleSynthesizePreview}
                disabled={synthesizingTTS}
              >
                {synthesizingTTS ? <Loader2 size={16} className="spin" /> : <Volume2 size={16} />}
                {synthesizingTTS ? 'Synthesizing Speech Audio...' : 'Generate & Listen Voice Prompt'}
              </button>

              {previewAudioUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>
                    Synthesized Audio Playback:
                  </span>
                  <audio controls autoPlay src={previewAudioUrl} key={previewAudioUrl}>
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
