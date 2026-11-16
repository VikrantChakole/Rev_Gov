import React from 'react';
import { useTranslation } from 'react-i18next';
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
    district: 'Pune',
    issueDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    issuingAuthority: 'Tahsildar / District Collectorate',
  }
}) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const verificationUrl = `${window.location.origin}/verify-certificate/${certificateData.certificateNumber}`;

  return (
    <div className={styles.overlay}>
      <div style={{ width: '100%', maxWidth: '720px' }}>
        <div className={styles.certPaper}>
          <div className={styles.watermark}>
            {t('certificate.watermark', 'STATE REVENUE DEPT')}
          </div>

          <div className={styles.header}>
            <div className={styles.emblem}>🏛️</div>
            <div className={styles.govTitle}>
              {t('certificate.govTitle', 'GOVERNMENT OF MAHARASHTRA')}
            </div>
            <div className={styles.deptTitle}>
              {t('certificate.deptTitle', 'REVENUE DEPARTMENT')}
            </div>
            <div className={styles.certHeading}>
              {t('certificate.certHeading', 'INCOME CERTIFICATE')}
            </div>
            <div className={styles.certNumber}>
              {t('certificate.certNumberPrefix', 'No:')} {certificateData.certificateNumber}
            </div>
          </div>

          <div className={styles.bodyText}>
            {t('certificate.certifyThat', 'This is to certify that Sri/Smt.')}{' '}
            <span className={styles.highlight}>{certificateData.applicantName}</span>,{' '}
            {t('certificate.residingIn', 'residing in')}{' '}
            <span className={styles.highlight}>{certificateData.district} {t('certificate.districtSuffix', 'District')}</span>,{' '}
            {t('certificate.hasAnnualIncome', 'has an annual family income of')}{' '}
            <span className={styles.highlight}>₹{certificateData.annualIncome}</span>{' '}
            {t('certificate.fromAllSources', 'from all sources including')}{' '}
            <span className={styles.highlight}>{certificateData.incomeSource}</span>.
            <br /><br />
            {t('certificate.officialPurpose', 'This certificate is officially issued for the purpose of Higher Education & Fee Concession.')}
          </div>

          <div className={styles.footerGrid}>
            <div className={styles.qrContainer}>
              <div className={styles.qrBox}>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=85x85&data=${encodeURIComponent(verificationUrl)}`}
                  alt={t('certificate.scanToVerify', 'Scan to Verify Authenticity')}
                  style={{ width: '85px', height: '85px' }}
                />
              </div>
              <span className={styles.qrSubtext}>
                {t('certificate.scanToVerify', 'Scan to Verify Authenticity')}
              </span>
            </div>

            <div className={styles.signBlock}>
              <div style={{ color: '#10b981', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldCheck size={14} /> {t('certificate.digitallySigned', 'Digitally Signed (SHA-256)')}
              </div>
              <div className={styles.signTitle}>{certificateData.issuingAuthority}</div>
              <div className={styles.signSub}>
                {t('certificate.dateOfIssue', 'Date of Issue:')} {certificateData.issueDate}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.closeBtn} onClick={onClose}>
            {t('common.close', 'Close')}
          </button>
          <button className={styles.printBtn} onClick={handlePrint}>
            <Printer size={16} inline style={{ marginRight: '6px' }} /> {t('common.printSavePdf', 'Print / Save PDF')}
          </button>
        </div>
      </div>
    </div>
  );
}
