import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Sparkles, AlertTriangle, CreditCard, ShieldCheck, Monitor, X, ChevronUp } from 'lucide-react';
import styles from './HackathonPitchBar.module.css';

export default function HackathonPitchBar() {
  const isEnabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('presentation') === 'true';
  if (!isEnabled) return null;

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleQuickSeed = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/v1/demo/quick-seed', {
        citizen_name: 'Rajesh Kumar Sharma',
        phone: '+919876543210',
        email: 'rajesh.sharma@example.com',
        annual_income: 48000,
        district: 'Ernakulam',
        language: 'ml',
      });
      toast.success(`Application ${res.data.application_number} seeded!`);
      navigate('/citizen-dashboard');
    } catch (err) {
      toast.error('Quick seed failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerMismatch = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/v1/demo/trigger-mismatch?application_number=REV-DEMO-2026-0001');
      toast.error(`Discrepancy Injected: Declared Name != OCR Extracted Name`);
      navigate('/officer-dashboard');
    } catch (err) {
      toast.error('Mismatch trigger failed. Run Quick Seed first.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePaymentFailure = async () => {
    toast.error('Simulated Gateway Timeout: Payment Status is PENDING.');
    navigate('/citizen-dashboard');
  };

  return (
    <div className={styles.pitchBarContainer}>
      {!isOpen ? (
        <button className={styles.triggerBtn} onClick={() => setIsOpen(true)}>
          <Sparkles size={16} />
          <span>⚡ Live Presentation Control Bar</span>
          <ChevronUp size={16} />
        </button>
      ) : (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <Sparkles size={16} />
              <span>Jury Demo Quick Triggers</span>
            </div>
            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className={styles.btnGrid}>
            <button className={styles.actionBtn} onClick={handleQuickSeed} disabled={loading}>
              <Sparkles size={16} color="#60a5fa" />
              <div>
                <div>⚡ Auto-Fill Income Certificate</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Malayalam context (Rajesh Sharma)</div>
              </div>
            </button>

            <button className={styles.actionBtn} onClick={handleTriggerMismatch} disabled={loading}>
              <AlertTriangle size={16} color="#f59e0b" />
              <div>
                <div>⚠️ Trigger OCR Discrepancy</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Form vs Document name mismatch</div>
              </div>
            </button>

            <button className={styles.actionBtn} onClick={handleSimulatePaymentFailure}>
              <CreditCard size={16} color="#ef4444" />
              <div>
                <div>💳 Simulate Payment Callback Fail</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Timeout & idempotent retry test</div>
              </div>
            </button>

            <button className={styles.actionBtn} onClick={() => navigate('/data-guard')}>
              <ShieldCheck size={16} color="#10b981" />
              <div>
                <div>🔒 Inspect PII Data Guard</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>DPDP Act 2023 redaction firewall</div>
              </div>
            </button>

            <button className={styles.actionBtn} onClick={() => navigate('/demo')}>
              <Monitor size={16} color="#a855f7" />
              <div>
                <div>🌐 Omnichannel Command Center</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>Web + WhatsApp + IVR 3-column sync</div>
              </div>
            </button>

            <button className={styles.actionBtn} onClick={() => navigate('/multilingual-eval')}>
              <span className={styles.demoTag}>ML</span>
              <div>
                <div>🎙️ Malayalam Speech Evaluation</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>WER & Native Speaker ratings</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
