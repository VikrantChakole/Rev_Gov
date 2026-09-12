import React from 'react';
import { Download, Printer, ShieldCheck, X } from 'lucide-react';
import styles from './DigitalCertificateModal.module.css';

export default function DigitalCertificateModal({
  isOpen,
  onClose,
  certificateData = {
    certificateNumber: 'CERT-REV-2026-9041',
    applicantName: 'Rajesh Kumar Sharma',
    annualIncome: '48,000',
    incomeSource: 'Agriculture & Local Retail',
    district: 'Ernakulam',
    issueDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    issuingAuthority: 'Tahsildar / District Collectorate',
  }
}) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const verificationUrl = `${window.location.origin}/verify/${certificateData.certificateNumber}`;

  return (
    <div className={styles.overlay}>
      <div style={{ width: '100%', maxWidth: '720px' }}>
        <div className={styles.certPaper}>
          <div className={styles.watermark}>STATE REVENUE DEPT</div>

          <div className={styles.header}>
            <div className={styles.emblem}>🏛️</div>
            <div className={styles.govTitle}>GOVERNMENT OF KERALA</div>
            <div className={styles.deptTitle}>REVENUE DEPARTMENT</div>
            <div className={styles.certHeading}>INCOME CERTIFICATE</div>
            <div className={styles.certNumber}>No: {certificateData.certificateNumber}</div>
          </div>

          <div className={styles.bodyText}>
            This is to certify that Sri/Smt. <span className={styles.highlight}>{certificateData.applicantName}</span>,
            residing in <span className={styles.highlight}>{certificateData.district} District</span>,
            has an annual family income of <span className={styles.highlight}>₹{certificateData.annualIncome} (Forty-Eight Thousand Rupees Only)</span> from all sources
            including <span className={styles.highlight}>{certificateData.incomeSource}</span>.
            <br /><br />
            This certificate is officially issued for the purpose of Higher Education & Fee Concession.
          </div>

          <div className={styles.footerGrid}>
            <div className={styles.qrContainer}>
              <div className={styles.qrBox}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=85x85&data=${encodeURIComponent(verificationUrl)}`}
                  alt="QR Code Verification"
                  style={{ width: '85px', height: '85px' }}
                />
              </div>
              <span className={styles.qrSubtext}>Scan to Verify Authenticity</span>
            </div>

            <div className={styles.signBlock}>
              <div style={{ color: '#10b981', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={14} /> Digitally Signed (SHA-256)
              </div>
              <div className={styles.signTitle}>{certificateData.issuingAuthority}</div>
              <div className={styles.signSub}>Date of Issue: {certificateData.issueDate}</div>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.closeBtn} onClick={onClose}>
            Close
          </button>
          <button className={styles.printBtn} onClick={handlePrint}>
            <Printer size={16} inline style={{ marginRight: '6px' }} /> Print / Save PDF
          </button>
        </div>
      </div>
    </div>
  );
}
