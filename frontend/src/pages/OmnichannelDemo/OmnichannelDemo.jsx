import React, { useState, useEffect } from 'react';
import { Monitor, MessageSquare, PhoneCall, RefreshCw } from 'lucide-react';
import styles from './OmnichannelDemo.module.css';

export default function OmnichannelDemo() {
  const [activeApp, setActiveApp] = useState('REV-DEMO-2026-0001');
  const [messages, setMessages] = useState([
    { id: 1, channel: 'WEB', sender: 'assistant', text: 'നമസ്കാരം! റവന്യൂ വകുപ്പ് സഹായകരിലേക്ക് സ്വാഗതം. (Welcome to Revenue Department Services)' },
    { id: 2, channel: 'WEB', sender: 'user', text: 'എനിക്ക് വരുമാന സർട്ടിഫിക്കറ്റ് വേണം (I need an Income Certificate)' },
    { id: 3, channel: 'WHATSAPP', sender: 'assistant', text: 'താങ്കളുടെ പേര് നൽകുക (Please provide your full name)' },
    { id: 4, channel: 'WHATSAPP', sender: 'user', text: 'Rajesh Kumar Sharma' },
    { id: 5, channel: 'IVR', sender: 'assistant', text: 'റവന്യൂ ഹെൽപ്പ് ലൈൻ: താങ്കളുടെ വാർഷിക വരുമാനം എത്രയാണ്? (IVR Prompt: What is your annual income?)' },
    { id: 6, channel: 'IVR', sender: 'user', text: 'DTMF Keypad Pressed: 48000' },
  ]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Omnichannel Command Center</h1>
          <p className={styles.subtitle}>
            Single Unified Citizen Record synced across Web, WhatsApp, and IVR channels in real time.
          </p>
        </div>
        <div className={styles.syncBadge}>
          <RefreshCw size={16} className="spin" />
          <span>Real-time SSE Context Vault Active ({activeApp})</span>
        </div>
      </div>

      <div className={styles.splitGrid}>
        {/* Column 1: Citizen Web Chat */}
        <div className={styles.column}>
          <div className={`${styles.colHeader} ${styles.webCol}`}>
            <Monitor size={18} />
            <span>Channel 1: Citizen Web Portal</span>
          </div>
          <div className={styles.colContent}>
            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  margin: '8px 0',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: msg.sender === 'user' ? '#dbeafe' : '#f1f5f9',
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  fontSize: '13px',
                }}
              >
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: '2px' }}>
                  {msg.sender === 'user' ? 'Citizen (Web)' : 'AI Revenue Assistant'}
                </div>
                {msg.text}
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: WhatsApp Simulator */}
        <div className={styles.column}>
          <div className={`${styles.colHeader} ${styles.waCol}`}>
            <MessageSquare size={18} />
            <span>Channel 2: WhatsApp Business Mode</span>
          </div>
          <div className={styles.colContent} style={{ background: '#e5ddd5' }}>
            {messages.filter(m => m.channel === 'WHATSAPP' || m.sender === 'assistant').map(msg => (
              <div
                key={msg.id}
                style={{
                  margin: '8px 0',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: msg.sender === 'user' ? '#dcf8c6' : '#ffffff',
                  fontSize: '13px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                <div style={{ fontSize: '10px', color: '#128c7e', fontWeight: 'bold', marginBottom: '2px' }}>
                  {msg.sender === 'user' ? '+91 98765 43210' : 'Revenue Department WhatsApp'}
                </div>
                {msg.text}
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: IVR Call Simulator */}
        <div className={styles.column}>
          <div className={`${styles.colHeader} ${styles.ivrCol}`}>
            <PhoneCall size={18} />
            <span>Channel 3: IVR Phone Helpline</span>
          </div>
          <div className={styles.colContent} style={{ background: '#0f172a', color: '#f8fafc' }}>
            <div style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px' }}>
              <div>📞 Active Call: 1800-REV-GOV</div>
              <div>State: DTMF Status Collection</div>
              <div>Caller: +91 98765 43210</div>
            </div>

            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  margin: '8px 0',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: msg.sender === 'user' ? '#334155' : '#1e293b',
                  fontSize: '12px',
                  borderLeft: '4px solid #38bdf8',
                }}
              >
                <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold' }}>
                  {msg.sender === 'user' ? 'Caller Speech / Keypad' : 'IVR Voice Engine (TTS)'}
                </div>
                {msg.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
