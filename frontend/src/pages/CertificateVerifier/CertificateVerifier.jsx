import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, ShieldCheck, Download, Home, Lock, Award } from 'lucide-react'
import client from '../../api/client'
import styles from './CertificateVerifier.module.css'

export default function CertificateVerifier() {
  const { t } = useTranslation()
  const { certNumber } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchVerification() {
      try {
        setLoading(true)
        const res = await client.get(`/certificates/verify/${certNumber}`)
        setData(res.data || res)
      } catch (err) {
        setError(err.response?.data?.detail?.message || err.message || t('certificate.couldNotVerify', 'The certificate number scanned could not be verified in the authoritative government registry.'))
      } finally {
        setLoading(false)
      }
    }
    if (certNumber) {
      fetchVerification()
    }
  }, [certNumber, t])

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.card} style={{ textAlign: 'center' }}>
          <div className={styles.loadingSpinner} />
          <h3 className={styles.title}>
            {t('certificate.verifyingAuthenticity', 'Verifying Certificate Authenticity...')}
          </h3>
          <p className={styles.subtitle}>
            {t('certificate.checkingRegistry', 'Checking government registry cryptographic signatures')}
          </p>
        </div>
      </div>
    )
  }

  const isValid = data && data.valid

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.govEmblem}>🏛️</div>
          <h1 className={styles.title}>
            {t('certificate.govRevenueDept', 'Government Revenue Department')}
          </h1>
          <p className={styles.subtitle}>
            {t('certificate.officialPortal', 'Official Certificate Verification Portal')}
          </p>
          
          <div className={`${styles.badge} ${isValid ? styles.validBadge : styles.invalidBadge}`}>
            {isValid ? (
              <>
                <CheckCircle2 size={18} />
                <span>{t('certificate.officiallyVerified', 'OFFICIALLY VERIFIED & AUTHENTIC')}</span>
              </>
            ) : (
              <>
                <XCircle size={18} />
                <span>{t('certificate.unverifiedInvalid', 'UNVERIFIED / INVALID CERTIFICATE')}</span>
              </>
            )}
          </div>
        </div>

        {isValid ? (
          <>
            <div className={styles.detailsGrid}>
              <div className={styles.fieldItem}>
                <span className={styles.fieldLabel}>{t('certificate.certificateNumber', 'Certificate Number')}</span>
                <span className={styles.fieldVal}>{data.certificate_number}</span>
              </div>

              <div className={styles.fieldItem}>
                <span className={styles.fieldLabel}>{t('certificate.serviceType', 'Service Type')}</span>
                <span className={styles.fieldVal}>{data.service_name}</span>
              </div>

              <div className={styles.fieldItem}>
                <span className={styles.fieldLabel}>{t('certificate.trackingIdentifier', 'Tracking Identifier')}</span>
                <span className={styles.fieldVal}>{data.tracking_id || data.application_number}</span>
              </div>

              <div className={styles.fieldItem}>
                <span className={styles.fieldLabel}>{t('certificate.citizenReference', 'Citizen Reference')}</span>
                <span className={styles.fieldVal}>{data.citizen_ref}</span>
              </div>

              <div className={styles.fieldItem}>
                <span className={styles.fieldLabel}>{t('certificate.issuingAuthority', 'Issuing Authority')}</span>
                <span className={styles.fieldVal}>{data.issuing_authority}</span>
              </div>

              <div className={styles.fieldItem}>
                <span className={styles.fieldLabel}>{t('certificate.issueDate', 'Issue Date')}</span>
                <span className={styles.fieldVal}>
                  {data.issue_date ? new Date(data.issue_date).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>

            <div className={styles.hashBox}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem', color: '#94a3b8', fontWeight: 600 }}>
                <Lock size={14} /> {t('certificate.digitalStampDigest', 'Digital SHA-256 Stamp Digest:')}
              </div>
              <div>{data.full_hash || data.digital_stamp_hash}</div>
            </div>

            <div className={styles.actions}>
              {data.download_url && (
                <a
                  href={`${client.defaults.baseURL.replace('/api/v1', '')}${data.download_url}`}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.downloadBtn}
                >
                  <Download size={18} /> {t('certificate.downloadVerified', 'Download Verified Certificate')}
                </a>
              )}
              <Link to="/" className={styles.homeBtn}>
                <Home size={18} /> {t('certificate.portalHome', 'Portal Home')}
              </Link>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <p style={{ color: '#f87171', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
              {error || t('certificate.couldNotVerify', 'The certificate number scanned could not be verified in the authoritative government registry.')}
            </p>
            <Link to="/" className={styles.homeBtn}>
              <Home size={18} /> {t('certificate.returnPortalHome', 'Return to Portal Home')}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
