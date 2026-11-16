import React, { useState, useEffect, useRef } from 'react'
import {
  ScanLine,
  Cpu,
  Eye,
  FileText,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Upload,
  Loader2,
  FileCheck,
  Server,
  Zap,
  Check,
  ExternalLink,
  Code,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ocrApi } from '../../api/ocr'
import styles from './OCRConfigPage.module.css'

const PROVIDER_OPTIONS = [
  {
    id: 'auto',
    name: 'Auto (Smart Fallback)',
    badge: 'Recommended',
    desc: 'Tries Tesseract if installed; automatically uses Gemini 3.6 Flash Vision AI for accurate real-time document OCR.',
  },
  {
    id: 'vision_ai',
    name: 'Vision AI (Multimodal)',
    badge: 'High Accuracy',
    desc: 'Uses Gemini 3.6 Flash & OpenRouter Vision to directly read and extract text from uploaded images and scanned PDFs.',
  },
  {
    id: 'tesseract',
    name: 'Tesseract OCR (Local)',
    badge: 'Offline Engine',
    desc: 'Strictly executes the local system Tesseract binary at the configured filesystem path.',
  },
  {
    id: 'mock',
    name: 'Mock (Development)',
    badge: 'Offline Test',
    desc: 'Generates deterministic synthetic text for automated testing without calling external services.',
  },
]

export default function OCRConfigPage() {
  const [config, setConfig] = useState(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)

  // Form settings state
  const [selectedProvider, setSelectedProvider] = useState('auto')
  const [tesseractPathInput, setTesseractPathInput] = useState('')

  // Sandbox Test Window state
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedDocType, setSelectedDocType] = useState('AUTO')
  const [isDragging, setIsDragging] = useState(false)
  const [runningTest, setRunningTest] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [activeResultTab, setActiveResultTab] = useState('fields') // 'fields' | 'raw' | 'breakdown'

  const fileInputRef = useRef(null)

  // Fetch current OCR status and config
  const fetchConfig = async () => {
    try {
      setLoadingConfig(true)
      const res = await ocrApi.getConfig()
      if (res?.success && res.config) {
        setConfig(res.config)
        setSelectedProvider(res.config.active_provider || 'auto')
        setTesseractPathInput(res.config.executable !== 'Not detected' ? res.config.executable : 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe')
      }
    } catch (err) {
      console.error('Failed to load OCR config:', err)
      toast.error(err.message || 'Failed to fetch OCR configuration')
    } finally {
      setLoadingConfig(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [])

  // Save OCR Settings
  const handleSaveConfig = async () => {
    setSavingConfig(true)
    try {
      const res = await ocrApi.updateConfig({
        provider: selectedProvider,
        tesseract_cmd: tesseractPathInput.trim(),
      })
      if (res?.success && res.config) {
        setConfig(res.config)
        toast.success(res.message || 'OCR configuration updated successfully!')
      }
    } catch (err) {
      console.error('Update OCR config error:', err)
      toast.error(err.message || 'Failed to update OCR configuration')
    } finally {
      setSavingConfig(false)
    }
  }

  // Handle Drag and Drop
  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      setSelectedFile(file)
      setTestResult(null)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setTestResult(null)
    }
  }

  // Run Test OCR Extraction
  const handleRunTest = async () => {
    if (!selectedFile) {
      toast.error('Please upload an image or PDF document to test.')
      return
    }

    setRunningTest(true)
    setTestResult(null)

    const formData = new FormData()
    formData.append('file', selectedFile)
    if (selectedDocType && selectedDocType !== 'AUTO') {
      formData.append('doc_type', selectedDocType)
    }

    try {
      const res = await ocrApi.testExtraction(formData)
      if (res?.success && res.diagnostics) {
        setTestResult(res.diagnostics)
        toast.success(res.diagnostics.message || 'OCR Test completed!')
      }
    } catch (err) {
      console.error('OCR test error:', err)
      toast.error(err.message || 'OCR extraction test failed')
    } finally {
      setRunningTest(false)
    }
  }

  if (loadingConfig) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <Loader2 size={36} className={styles.spin} style={{ color: '#2563eb', margin: '0 auto 16px auto' }} />
          <h3 style={{ fontSize: '1.2rem', color: '#0f172a', margin: '0 0 6px 0' }}>
            Loading OCR Engine Configuration...
          </h3>
          <p style={{ color: '#64748b', fontSize: '0.88rem' }}>
            Checking status of Tesseract OCR, Vision AI, and PDF parsers
          </p>
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
            <ScanLine size={26} style={{ color: '#2563eb' }} />
            OCR Engine Configuration & Test Sandbox
          </h1>
          <p className={styles.pageSubtitle}>
            Configure extraction engines, monitor local Tesseract and Vision AI health, and validate document text recognition in real time.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={fetchConfig}
            title="Refresh engine status"
          >
            <RefreshCw size={15} />
            <span>Refresh Status</span>
          </button>
        </div>
      </div>

      {/* ── 1. OCR Service Architecture Cards ── */}
      <div className={styles.serviceGrid}>
        
        {/* Card 1: Tesseract OCR (Local) */}
        <div className={styles.serviceCard}>
          <div className={styles.serviceCardHeader}>
            <div className={styles.serviceIconWrap} style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Cpu size={22} />
            </div>
            <span
              className={`${styles.statusBadge} ${
                config?.tesseract?.available ? styles.statusOnline : styles.statusDegraded
              }`}
            >
              {config?.tesseract?.available ? (
                <>
                  <CheckCircle2 size={13} />
                  Installed & Connected
                </>
              ) : (
                <>
                  <AlertCircle size={13} />
                  Not Detected in Path
                </>
              )}
            </span>
          </div>

          <div>
            <h3 className={styles.serviceTitle}>Tesseract OCR (Local Engine)</h3>
            <p className={styles.serviceDesc}>
              High-performance local optical character recognition binary. Operates 100% offline with zero external network overhead.
            </p>
          </div>

          <div className={styles.serviceDetailsList}>
            <div className={detailRowClass(styles)}>
              <span className={styles.detailKey}>Executable:</span>
              <span className={styles.detailVal}>{config?.tesseract?.executable}</span>
            </div>
            <div className={detailRowClass(styles)}>
              <span className={styles.detailKey}>Version:</span>
              <span className={styles.detailVal}>{config?.tesseract?.version}</span>
            </div>
            <div className={detailRowClass(styles)}>
              <span className={styles.detailKey}>Languages:</span>
              <span className={styles.detailVal}>{config?.tesseract?.languages?.join(', ') || 'eng'}</span>
            </div>
          </div>

          {!config?.tesseract?.available && (
            <a
              href="https://github.com/UB-Mannheim/tesseract/wiki"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '0.78rem', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}
            >
              <span>Download Tesseract Windows Installer</span>
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Card 2: Vision AI Engine */}
        <div className={styles.serviceCard}>
          <div className={styles.serviceCardHeader}>
            <div className={styles.serviceIconWrap} style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
              <Sparkles size={22} />
            </div>
            <span
              className={`${styles.statusBadge} ${
                config?.vision_ai?.available ? styles.statusOnline : styles.statusOffline
              }`}
            >
              {config?.vision_ai?.available ? (
                <>
                  <CheckCircle2 size={13} />
                  Active & Operational
                </>
              ) : (
                <>
                  <AlertCircle size={13} />
                  API Keys Missing
                </>
              )}
            </span>
          </div>

          <div>
            <h3 className={styles.serviceTitle}>Vision AI Engine (Multimodal)</h3>
            <p className={styles.serviceDesc}>
              State-of-the-art vision extraction using Google Gemini 3.6 Flash and OpenRouter Vision for noisy phone photos and complex Indian documents.
            </p>
          </div>

          <div className={styles.serviceDetailsList}>
            <div className={detailRowClass(styles)}>
              <span className={styles.detailKey}>Primary Model:</span>
              <span className={styles.detailVal}>{config?.vision_ai?.gemini_model}</span>
            </div>
            <div className={detailRowClass(styles)}>
              <span className={styles.detailKey}>Gemini Status:</span>
              <span className={styles.detailVal} style={{ color: config?.vision_ai?.gemini_active ? '#16a34a' : '#ea580c' }}>
                {config?.vision_ai?.gemini_active ? 'Connected' : 'Unavailable'}
              </span>
            </div>
            <div className={detailRowClass(styles)}>
              <span className={styles.detailKey}>OpenRouter Fallback:</span>
              <span className={styles.detailVal} style={{ color: config?.vision_ai?.openrouter_active ? '#16a34a' : '#ea580c' }}>
                {config?.vision_ai?.openrouter_active ? 'Connected' : 'Unavailable'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: PyMuPDF PDF Stream Parser */}
        <div className={styles.serviceCard}>
          <div className={styles.serviceCardHeader}>
            <div className={styles.serviceIconWrap} style={{ background: '#f0fdf4', color: '#16a34a' }}>
              <FileCheck size={22} />
            </div>
            <span className={`${styles.statusBadge} ${styles.statusOnline}`}>
              <CheckCircle2 size={13} />
              Engine Ready
            </span>
          </div>

          <div>
            <h3 className={styles.serviceTitle}>PyMuPDF Stream Parser</h3>
            <p className={styles.serviceDesc}>
              Extracts high-fidelity vector text streams and metadata directly from digital PDF applications without rendering raster images.
            </p>
          </div>

          <div className={styles.serviceDetailsList}>
            <div className={detailRowClass(styles)}>
              <span className={styles.detailKey}>Engine:</span>
              <span className={styles.detailVal}>{config?.pdf_engine?.engine || 'PyMuPDF'}</span>
            </div>
            <div className={detailRowClass(styles)}>
              <span className={styles.detailKey}>DPI Resolution:</span>
              <span className={styles.detailVal}>200 DPI Rasterizer</span>
            </div>
            <div className={detailRowClass(styles)}>
              <span className={styles.detailKey}>Role:</span>
              <span className={styles.detailVal}>Direct PDF Stream Extractor</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── 2. Configuration Settings Card ── */}
      <div className={styles.configCard}>
        <h2 className={styles.sectionTitle}>
          <Server size={18} style={{ color: '#2563eb' }} />
          Active Provider & Executable Settings
        </h2>

        {/* Provider Radio Cards */}
        <div className={styles.formRow}>
          <label className={styles.label}>Select Primary OCR Provider:</label>
          <div className={styles.providerOptionsGrid}>
            {PROVIDER_OPTIONS.map((opt) => {
              const isSelected = selectedProvider === opt.id
              return (
                <div
                  key={opt.id}
                  className={`${styles.providerCard} ${isSelected ? styles.providerCardActive : ''}`}
                  onClick={() => setSelectedProvider(opt.id)}
                >
                  <div className={styles.providerCardTitle}>
                    <span>{opt.name}</span>
                    {isSelected && <Check size={16} style={{ color: '#2563eb' }} />}
                  </div>
                  <p className={styles.providerCardDesc}>{opt.desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Tesseract Path Input */}
        <div className={styles.formRow}>
          <label className={styles.label}>Local Tesseract Executable Binary Path:</label>
          <div className={styles.inputGroup}>
            <input
              type="text"
              className={styles.textInput}
              value={tesseractPathInput}
              onChange={(e) => setTesseractPathInput(e.target.value)}
              placeholder="e.g. C:\Program Files\Tesseract-OCR\tesseract.exe"
            />
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSaveConfig}
              disabled={savingConfig}
            >
              {savingConfig ? (
                <>
                  <Loader2 size={16} className={styles.spin} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Save & Test Path</span>
                </>
              )}
            </button>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Current effective provider: <strong style={{ color: '#0f172a' }}>{config?.effective_provider}</strong>
          </span>
        </div>
      </div>

      {/* ── 3. Interactive OCR Test Sandbox Window ── */}
      <div className={styles.sandboxCard}>
        <h2 className={styles.sectionTitle}>
          <Zap size={18} style={{ color: '#10b981' }} />
          Live Document OCR Test Sandbox
        </h2>
        <p className={styles.sandboxIntro}>
          Upload any identity document (Aadhaar, PAN, Voter ID, Income Certificate, Electricity Bill, or scanned PDF) to test the active OCR extraction pipeline and inspect detected text, confidence scores, and structured fields.
        </p>

        {/* Drag & Drop Upload Zone */}
        <div
          className={`${styles.uploadZone} ${isDragging ? styles.uploadZoneActive : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".png,.jpg,.jpeg,.pdf"
            onChange={handleFileChange}
          />

          <Upload size={32} className={styles.uploadIcon} />
          <p className={styles.uploadPrompt}>
            Drag & drop a test document image or PDF here, or <span style={{ color: '#2563eb', textDecoration: 'underline' }}>browse</span>
          </p>
          <p className={styles.uploadHint}>Supports PNG, JPG, JPEG, and PDF documents (Max 15MB)</p>

          {selectedFile && (
            <div className={styles.selectedFileInfo} onClick={(e) => e.stopPropagation()}>
              <FileText size={15} />
              <span>{selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
            </div>
          )}
        </div>

        {/* Controls Row */}
        <div className={styles.sandboxControlsRow}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
              Target Document Type:
            </label>
            <select
              className={styles.selectInput}
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
            >
              <option value="AUTO">Auto-Detect Document</option>
              <option value="AADHAAR_CARD">Aadhaar Card</option>
              <option value="PAN_CARD">PAN Card</option>
              <option value="VOTER_ID">Voter ID</option>
              <option value="INCOME_PROOF">Income Certificate / Salary Slip</option>
              <option value="CASTE_CERTIFICATE">Caste Certificate</option>
              <option value="DOMICILE_CERTIFICATE">Domicile Certificate</option>
            </select>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <button
              type="button"
              className={styles.testRunBtn}
              onClick={handleRunTest}
              disabled={runningTest || !selectedFile}
            >
              {runningTest ? (
                <>
                  <Loader2 size={16} className={styles.spin} />
                  <span>Processing Extraction...</span>
                </>
              ) : (
                <>
                  <Zap size={16} />
                  <span>Run Test OCR Extraction</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Test Results Output ── */}
        {testResult && (
          <div className={styles.resultsSection}>
            
            {/* Overview Banner */}
            <div className={styles.resultsOverviewBanner}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.98rem', color: '#0f172a', fontWeight: 700 }}>
                  Extraction Results
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                  {testResult.message}
                </p>
              </div>

              <div className={styles.overviewPills}>
                <span className={styles.overviewPill}>
                  <span>Provider:</span>
                  <strong style={{ color: '#2563eb' }}>{testResult.provider_used}</strong>
                </span>
                <span className={styles.overviewPill}>
                  <span>Confidence:</span>
                  <strong style={{ color: '#16a34a' }}>{testResult.confidence}%</strong>
                </span>
                <span className={styles.overviewPill}>
                  <span>Latency:</span>
                  <strong>{testResult.execution_time_ms} ms</strong>
                </span>
                <span className={styles.overviewPill}>
                  <span>Type:</span>
                  <strong>{testResult.doc_type_detected}</strong>
                </span>
              </div>
            </div>

            {/* Results Tab Buttons */}
            <div className={styles.tabsRow}>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeResultTab === 'fields' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveResultTab('fields')}
              >
                Structured Extracted Fields ({Object.keys(testResult.extracted_fields || {}).length})
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeResultTab === 'raw' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveResultTab('raw')}
              >
                Raw OCR Text
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeResultTab === 'breakdown' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveResultTab('breakdown')}
              >
                Confidence Breakdown
              </button>
            </div>

            {/* Tab 1: Structured Extracted Fields Table */}
            {activeResultTab === 'fields' && (
              <div className={styles.fieldsTableWrap}>
                {Object.keys(testResult.extracted_fields || {}).length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                    No structured fields could be parsed from the raw text. Check the Raw Text tab.
                  </div>
                ) : (
                  <table className={styles.fieldsTable}>
                    <thead>
                      <tr>
                        <th>Field Name</th>
                        <th>Extracted Value</th>
                        <th>Field Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(testResult.extracted_fields).map(([k, val]) => (
                        <tr key={k}>
                          <td style={{ fontWeight: 700, color: '#334155' }}>
                            {k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{String(val)}</td>
                          <td style={{ color: '#64748b', fontSize: '0.78rem', fontFamily: 'monospace' }}>{k}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Tab 2: Raw Extracted Text */}
            {activeResultTab === 'raw' && (
              <pre className={styles.rawTextBox}>
                {testResult.raw_text || '[No text extracted]'}
              </pre>
            )}

            {/* Tab 3: Confidence Breakdown */}
            {activeResultTab === 'breakdown' && (
              <div className={styles.fieldsTableWrap}>
                <table className={styles.fieldsTable}>
                  <thead>
                    <tr>
                      <th>Target Field</th>
                      <th>Confidence Score</th>
                      <th>Validation Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(testResult.confidence_breakdown || {}).map(([k, sc]) => (
                      <tr key={k}>
                        <td style={{ fontWeight: 700 }}>{k}</td>
                        <td>
                          <span style={{ color: sc >= 85 ? '#16a34a' : '#ea580c', fontWeight: 800 }}>
                            {sc}%
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.76rem', background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px' }}>
                            {sc >= 85 ? 'High Confidence' : 'Review Advised'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        )}

      </div>

    </div>
  )
}

function detailRowClass(styles) {
  return styles.detailRow
}
