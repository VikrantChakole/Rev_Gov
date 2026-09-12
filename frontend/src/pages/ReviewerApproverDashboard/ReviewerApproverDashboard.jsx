import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Award, CheckCircle, FileCheck, Shield, Key } from 'lucide-react';
import DigitalCertificateModal from '../../components/DigitalCertificateModal/DigitalCertificateModal';

export default function ReviewerApproverDashboard() {
  const [role, setRole] = useState('APPROVER'); // REVIEWER | APPROVER
  const [showCertModal, setShowCertModal] = useState(false);
  const [app, setApp] = useState({
    application_number: 'REV-DEMO-2026-0001',
    citizen_name: 'Rajesh Kumar Sharma',
    service_name: 'Income Certificate',
    status: 'OFFICER_RECOMMENDED',
    officer_name: 'Officer Anjali Nair',
    officer_recommendation: 'Recommend Approval after verifying regional name transliteration.',
    risk_score: 42,
  });

  const handleFinalApproval = () => {
    toast.success(`Application ${app.application_number} APPROVED by District Collector. Digital Signature generated.`);
    setShowCertModal(true);
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
            Multi-Level Approval Portal (Separation of Duties)
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            Enforces strict separation of processing officer, independent reviewer, and final issuing approver.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
          <button
            onClick={() => setRole('REVIEWER')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: '700',
              fontSize: '12px',
              background: role === 'REVIEWER' ? '#1e3a8a' : 'transparent',
              color: role === 'REVIEWER' ? '#ffffff' : '#64748b',
              cursor: 'pointer',
            }}
          >
            Reviewer Persona
          </button>
          <button
            onClick={() => setRole('APPROVER')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: '700',
              fontSize: '12px',
              background: role === 'APPROVER' ? '#1e3a8a' : 'transparent',
              color: role === 'APPROVER' ? '#ffffff' : '#64748b',
              cursor: 'pointer',
            }}
          >
            Approver Persona (District Collector)
          </button>
        </div>
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff', padding: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{app.application_number}</h2>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
              Service: <strong>{app.service_name}</strong> | Applicant: <strong>{app.citizen_name}</strong>
            </div>
          </div>
          <span style={{ background: '#dcfce7', color: '#15803d', padding: '6px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: '700' }}>
            Officer Status: {app.status}
          </span>
        </div>

        <div style={{ background: '#eff6ff', borderLeft: '4px solid #2563eb', padding: '14px', borderRadius: '4px', marginBottom: '24px' }}>
          <div style={{ fontWeight: '700', fontSize: '13px', color: '#1e40af' }}>Processing Officer Notes ({app.officer_name}):</div>
          <div style={{ fontSize: '13px', color: '#1e3a8a', marginTop: '2px' }}>"{app.officer_recommendation}"</div>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
          <div style={{ fontWeight: '700', fontSize: '13px', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={16} color="#10b981" /> Separation of Duties Checklist:
          </div>
          <ul style={{ fontSize: '12px', color: '#475569', marginTop: '8px', paddingLeft: '20px' }}>
            <li>Processing Officer != Approver (Enforced)</li>
            <li>Applicant != Officer (Enforced)</li>
            <li>Audit Event Trail Logged: EVT-99042</li>
          </ul>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={handleFinalApproval}
            style={{
              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
              color: '#ffffff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
            }}
          >
            <Key size={18} /> Authorize Digital Signing & Issue Certificate
          </button>
        </div>
      </div>

      <DigitalCertificateModal
        isOpen={showCertModal}
        onClose={() => setShowCertModal(false)}
        certificateData={{
          certificateNumber: 'CERT-REV-2026-9041',
          applicantName: app.citizen_name,
          annualIncome: '48,000',
          incomeSource: 'Agriculture & Local Retail',
          district: 'Ernakulam',
          issueDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
          issuingAuthority: 'District Collectorate, Revenue Department',
        }}
      />
    </div>
  );
}
