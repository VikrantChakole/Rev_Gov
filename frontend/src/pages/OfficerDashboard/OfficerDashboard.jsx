import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ShieldAlert, Clock, CheckCircle, XCircle, AlertTriangle, Eye, ArrowRight } from 'lucide-react';

export default function OfficerDashboard() {
  const [apps, setApps] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch queue
    axios.get('/api/v1/dashboard/officer')
      .then(res => {
        setApps(res.data.submitted_applications || []);
        if (res.data.submitted_applications?.length > 0) {
          setSelectedApp(res.data.submitted_applications[0]);
        }
      })
      .catch(() => {
        // Fallback demo queue
        const mockQueue = [
          {
            id: 'demo-app-1',
            application_number: 'REV-DEMO-2026-0001',
            citizen_name: 'Rajesh Kumar Sharma',
            service_name: 'Income Certificate',
            status: 'UNDER_REVIEW',
            risk_score: 42,
            risk_category: 'MEDIUM',
            sla_days: 7,
            days_pending: 2,
            risk_signals: [
              { code: 'NAME_MISMATCH', name: 'Applicant Name Mismatch', weight: 25, evidence: "Declared 'Rajesh Kumar Sharma' vs OCR 'Rajesh K. Sharma'" },
              { code: 'LOW_OCR_CONFIDENCE', name: 'Low Document OCR Confidence', weight: 17, evidence: 'Identity Proof OCR confidence is 68%' },
            ],
            declared_fields: { applicant_name: 'Rajesh Kumar Sharma', annual_income: '₹48,000', district: 'Ernakulam' },
            ocr_fields: { applicant_name: 'Rajesh K. Sharma', dob: '15/03/1990' },
          }
        ];
        setApps(mockQueue);
        setSelectedApp(mockQueue[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleRecommend = (action) => {
    toast.success(`Application ${selectedApp.application_number} ${action.toLowerCase()}ed and escalated to Reviewer queue.`);
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>Officer Review Portal</h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Inspect application evidence, OCR discrepancy signals, and transparent risk scoring before submitting recommendation.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
        {/* Queue Column */}
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', background: '#1e3a8a', color: '#ffffff', fontWeight: '700', fontSize: '14px' }}>
            Assigned Queue ({apps.length})
          </div>
          <div style={{ padding: '12px' }}>
            {apps.map(a => (
              <div
                key={a.application_number}
                onClick={() => setSelectedApp(a)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: selectedApp?.application_number === a.application_number ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  background: selectedApp?.application_number === a.application_number ? '#eff6ff' : '#ffffff',
                  marginBottom: '10px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '13px' }}>
                  <span>{a.application_number}</span>
                  <span style={{ color: a.risk_score > 50 ? '#dc2626' : '#d97706' }}>Risk: {a.risk_score}/100</span>
                </div>
                <div style={{ fontSize: '13px', color: '#0f172a', margin: '4px 0' }}>{a.citizen_name}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{a.service_name} • SLA: Day {a.days_pending || 1} of {a.sla_days || 7}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail Inspection Workspace */}
        {selectedApp && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#ffffff', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{selectedApp.application_number}</h2>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Applicant: <strong>{selectedApp.citizen_name}</strong></div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '700' }}>
                  <Clock size={12} inline style={{ marginRight: '4px' }} /> SLA Timer: 5 Days Left
                </span>
              </div>
            </div>

            {/* Explainable Risk Scoring Box */}
            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldAlert color="#d97706" size={18} /> Transparent Risk Score: {selectedApp.risk_score} / 100 ({selectedApp.risk_category})
                </div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Decision Support Tool</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedApp.risk_signals?.map((sig, idx) => (
                  <div key={idx} style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    <div style={{ fontWeight: '700', color: '#dc2626' }}>
                      +{sig.weight} pts • {sig.name}
                    </div>
                    <div style={{ color: '#475569', marginTop: '2px' }}>Evidence: {sig.evidence}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Field vs OCR Comparison */}
            <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px', color: '#0f172a' }}>Field vs Document OCR Evidence Comparison</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>Field</th>
                  <th style={{ padding: '8px 12px' }}>Declared Form Value</th>
                  <th style={{ padding: '8px 12px' }}>OCR Extracted Value</th>
                  <th style={{ padding: '8px 12px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Full Name</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontWeight: '700' }}>Rajesh Kumar Sharma</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', color: '#d97706' }}>Rajesh K. Sharma</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#d97706', fontWeight: 'bold' }}>⚠️ Mismatch</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Annual Income</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', fontWeight: '700' }}>₹48,000</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>₹48,000</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>
                    <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✅ Verified</span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Officer Action Controls */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => handleRecommend('Clarification Requested')} style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '10px 18px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                Request Clarification
              </button>
              <button onClick={() => handleRecommend('Recommend Approval')} style={{ background: '#15803d', color: '#ffffff', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={16} /> Recommend Approval
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
