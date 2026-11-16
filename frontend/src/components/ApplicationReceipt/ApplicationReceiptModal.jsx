import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Printer,
  X,
  CheckCircle2,
  FileText,
  ShieldCheck,
  User,
  Calendar,
  MapPin,
  Clock,
  Sparkles,
  Award,
} from 'lucide-react'
import styles from './ApplicationReceiptModal.module.css'

export default function ApplicationReceiptModal({
  isOpen,
  onClose,
  data = {},
}) {
  const { t, i18n } = useTranslation()
  if (!isOpen) return null

  const {
    certificateId = 'APP-PENDING',
    citizenId = 'CIT-CITIZEN',
    trackingId = 'TRK-PENDING',
    applicationNumber = certificateId,
    serviceName = 'Statutory Certificate',
    submittedAt = new Date().toISOString(),
    status = 'SUBMITTED',
    formType = 'Manual Web Form',
    particulars = {},
    enclosedDocs = {},
    docSubtypes = {},
  } = data

  const handlePrint = () => {
    const receiptElement = document.getElementById('printable-receipt')
    if (!receiptElement) {
      window.print()
      return
    }

    // Collect all active stylesheets and style tags from current document
    const styleElements = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((el) => el.outerHTML)
      .join('\n')

    // Create an isolated hidden iframe for clean, uninterrupted printing
    const iframe = document.createElement('iframe')
    iframe.id = 'receipt-print-iframe'
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    iframe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(iframe)

    const frameDoc = iframe.contentWindow.document
    frameDoc.open()
    frameDoc.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Application_Receipt_${certificateId || trackingId}</title>
          ${styleElements}
          <style>
            @page {
              size: A4 portrait;
              margin: 5mm 8mm;
            }
            *, *::before, *::after {
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
              overflow: hidden !important;
            }
            #printable-receipt {
              display: block !important;
              visibility: visible !important;
              position: static !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            #printable-receipt * {
              visibility: visible !important;
            }

            /* Single-Page Fitting Compact Sizing */
            #printable-receipt [class*="receiptHeader"] {
              padding-bottom: 5px !important;
              margin-bottom: 6px !important;
              border-bottom: 1.5px solid #0f172a !important;
            }
            #printable-receipt [class*="govtInsigniaWrap"] {
              margin-bottom: 2px !important;
            }
            #printable-receipt [class*="emblemSymbol"] {
              font-size: 0.85rem !important;
              margin-bottom: 1px !important;
            }
            #printable-receipt [class*="govtState"] {
              font-size: 0.94rem !important;
              margin: 0 0 1px 0 !important;
            }
            #printable-receipt [class*="govtDept"] {
              font-size: 0.78rem !important;
              margin: 0 0 2px 0 !important;
            }
            #printable-receipt [class*="portalSub"] {
              font-size: 0.6rem !important;
            }
            #printable-receipt [class*="receiptDocTitleBox"] {
              padding: 3px 6px !important;
              margin-top: 3px !important;
            }
            #printable-receipt [class*="receiptDocTitle"] {
              font-size: 0.85rem !important;
              margin: 0 0 1px 0 !important;
            }
            #printable-receipt [class*="receiptActRef"] {
              font-size: 0.6rem !important;
            }

            #printable-receipt [class*="identifiersBanner"] {
              padding: 4px 8px !important;
              margin-bottom: 5px !important;
              gap: 8px !important;
              border-width: 1px !important;
            }
            #printable-receipt [class*="idCellLabel"] {
              font-size: 0.55rem !important;
            }
            #printable-receipt [class*="idCellValue"] {
              font-size: 0.76rem !important;
            }
            #printable-receipt [class*="idCellValueTracking"] {
              font-size: 0.82rem !important;
            }
            #printable-receipt [class*="statusBadge"] {
              font-size: 0.6rem !important;
              padding: 1px 4px !important;
            }

            #printable-receipt [class*="metaStrip"] {
              padding: 3px 8px !important;
              margin-bottom: 5px !important;
              font-size: 0.66rem !important;
            }

            #printable-receipt [class*="sectionBlock"] {
              margin-bottom: 5px !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            #printable-receipt [class*="sectionHeader"] {
              padding: 2.5px 8px !important;
            }
            #printable-receipt [class*="sectionNum"] {
              width: 14px !important;
              height: 14px !important;
              font-size: 0.6rem !important;
            }
            #printable-receipt [class*="sectionTitle"] {
              font-size: 0.68rem !important;
            }

            #printable-receipt [class*="particularsTable"] {
              font-size: 0.68rem !important;
            }
            #printable-receipt [class*="particularsTable"] td {
              padding: 2.5px 6px !important;
              line-height: 1.25 !important;
            }
            #printable-receipt [class*="tdLabel"] {
              font-size: 0.65rem !important;
              width: 22% !important;
            }
            #printable-receipt [class*="tdVal"] {
              font-size: 0.68rem !important;
              width: 28% !important;
            }

            #printable-receipt [class*="docsTable"] {
              font-size: 0.66rem !important;
            }
            #printable-receipt [class*="docsTable"] th {
              padding: 2.5px 6px !important;
              font-size: 0.62rem !important;
            }
            #printable-receipt [class*="docsTable"] td {
              padding: 2px 6px !important;
              font-size: 0.64rem !important;
              line-height: 1.2 !important;
            }
            #printable-receipt [class*="docStatusBadge"] {
              font-size: 0.58rem !important;
              padding: 1px 4px !important;
            }

            #printable-receipt [class*="declarationStampBox"] {
              padding: 4px 8px !important;
              margin-bottom: 5px !important;
              gap: 10px !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            #printable-receipt [class*="declarationTitle"] {
              font-size: 0.66rem !important;
              margin-bottom: 1px !important;
            }
            #printable-receipt [class*="declarationStatement"] {
              font-size: 0.6rem !important;
              line-height: 1.25 !important;
              margin-bottom: 2px !important;
            }
            #printable-receipt [class*="declarationMeta"] {
              font-size: 0.58rem !important;
            }
            #printable-receipt [class*="digitalStamp"] {
              width: 76px !important;
              height: 76px !important;
              padding: 2px !important;
              border-width: 1.5px !important;
              flex-shrink: 0 !important;
            }
            #printable-receipt [class*="stampGovt"] {
              font-size: 0.4rem !important;
            }
            #printable-receipt [class*="stampEmblem"] {
              font-size: 0.44rem !important;
              margin: 0 !important;
            }
            #printable-receipt [class*="stampStatus"] {
              font-size: 0.42rem !important;
              padding: 0 3px !important;
              margin: 1px 0 !important;
            }
            #printable-receipt [class*="stampDate"] {
              font-size: 0.42rem !important;
            }
            #printable-receipt [class*="stampId"] {
              font-size: 0.38rem !important;
            }

            #printable-receipt [class*="receiptFooter"] {
              padding-top: 4px !important;
              gap: 2px !important;
              border-top: 1px solid #0f172a !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            #printable-receipt [class*="footerNotice"] {
              font-size: 0.58rem !important;
              line-height: 1.25 !important;
            }
            #printable-receipt [class*="footerMetaRow"] {
              font-size: 0.54rem !important;
            }
          </style>
        </head>
        <body>
          <div id="printable-receipt" class="${receiptElement.className}">
            ${receiptElement.innerHTML}
          </div>
        </body>
      </html>
    `)
    frameDoc.close()

    // Wait briefly for iframe DOM and styles to evaluate before triggering print dialog
    setTimeout(() => {
      try {
        iframe.contentWindow.focus()
        iframe.contentWindow.print()
      } catch (err) {
        console.error('Iframe print error, falling back to window.print():', err)
        window.print()
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe)
          }
        }, 1500)
      }
    }, 350)
  }


  // Helper translation functions
  const getSlotLabel = (slot) => {
    switch (slot) {
      case 'Identity Proof': return t('receipt.slotIdentityProof', 'Identity Proof')
      case 'Residential Proof': return t('receipt.slotResidentialProof', 'Residential Proof')
      case 'Proof of Age': return t('receipt.slotAgeProof', 'Proof of Age')
      case 'Signature': return t('receipt.slotSignature', 'Signature')
      case 'Photograph': return t('receipt.slotPhotograph', 'Photograph')
      default: return slot
    }
  }

  const getTypeLabel = (type) => {
    if (!type) return '—'
    if (typeof type !== 'string') return type
    if (type.includes('Identity Card')) return t('receipt.typeGovtId', 'Government Identity Card')
    if (type.includes('Residence') || type.includes('Utility')) return t('receipt.typeUtilityProof', 'Utility / Residence Proof')
    if (type.includes('Birth') || type.includes('Leaving')) return t('receipt.typeBirthProof', 'Birth / School Leaving Certificate')
    if (type.includes('Signature')) return t('receipt.typeApplicantSign', 'Applicant Signature on White Paper')
    if (type.includes('Passport')) return t('receipt.typePassportPhoto', 'Colour Passport Size Photograph')
    return type
  }

  const getStatusLabel = (st) => {
    if (!st || st === 'Not Provided') return t('receipt.statusNotProvided', 'Not Provided')
    if (typeof st === 'string' && st.includes('Biometric')) return t('receipt.statusBiometricKept', 'Biometric Fidelity Kept')
    return t('receipt.statusAttachedAuth', 'Attached & Authenticated')
  }

  // Format date helper
  const formattedDate = new Date(submittedAt).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'medium',
  })

  // Normalize particulars fields
  const applicantName = particulars.name || particulars.applicant_name || '—'
  const fatherName = particulars.father_name || '—'
  const motherName = particulars.mother_name || '—'
  const dob = particulars.dob || particulars.date_of_birth || '—'
  const gender = particulars.sex || particulars.gender || '—'
  const maritalStatus = particulars.marital_status || 'No'
  const husbandName = particulars.husband_name || (maritalStatus === 'Yes' ? '—' : 'Not Applicable')
  const address = particulars.address || '—'
  const yearsOfResidence = particulars.years_of_residence || ''
  const purpose = particulars.purpose || particulars.purpose_of_certificate || ''
  const annualIncome = particulars.annual_income || ''
  const caste = particulars.caste || particulars.caste_subcaste || ''

  // Documents list
  const docList = [
    {
      slot: 'Identity Proof',
      type: docSubtypes.identity_proof || enclosedDocs.identity_proof?.subtype || 'Government Identity Card',
      file: enclosedDocs.identity_proof?.filename || enclosedDocs.identity_proof?.name || (enclosedDocs.identity_proof ? 'Attached' : 'Not Provided'),
      status: enclosedDocs.identity_proof ? 'Attached & Authenticated' : 'Not Provided',
    },
    {
      slot: 'Residential Proof',
      type: docSubtypes.residential_proof || enclosedDocs.residential_proof?.subtype || 'Utility / Residence Proof',
      file: enclosedDocs.residential_proof?.filename || enclosedDocs.residential_proof?.name || (enclosedDocs.residential_proof ? 'Attached' : 'Not Provided'),
      status: enclosedDocs.residential_proof ? 'Attached & Authenticated' : 'Not Provided',
    },
    {
      slot: 'Proof of Age',
      type: docSubtypes.age_proof || enclosedDocs.age_proof?.subtype || 'Birth / School Leaving Certificate',
      file: enclosedDocs.age_proof?.filename || enclosedDocs.age_proof?.name || (enclosedDocs.age_proof ? 'Attached' : 'Not Provided'),
      status: enclosedDocs.age_proof ? 'Attached & Authenticated' : 'Not Provided',
    },
    {
      slot: 'Signature',
      type: 'Applicant Signature on White Paper',
      file: enclosedDocs.signature?.filename || enclosedDocs.signature?.name || (enclosedDocs.signature ? 'Attached' : 'Not Provided'),
      status: enclosedDocs.signature ? 'Biometric Fidelity Kept' : 'Not Provided',
    },
    {
      slot: 'Photograph',
      type: 'Colour Passport Size Photograph',
      file: enclosedDocs.passport_image?.filename || enclosedDocs.passport_image?.name || (enclosedDocs.passport_image ? 'Attached' : 'Not Provided'),
      status: enclosedDocs.passport_image ? 'Biometric Fidelity Kept' : 'Not Provided',
    },
  ]

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalCard}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Toolbar (hidden during printing) */}
        <div className={`${styles.modalToolbar} ${styles.noPrint}`}>
          <div className={styles.toolbarTitleWrap}>
            <FileText size={18} className={styles.toolbarIcon} />
            <h3 className={styles.toolbarTitle}>{t("receipt.officialApplicationReceipt", "Official Application Receipt")}</h3>
          </div>

          <div className={styles.toolbarActions}>
            <button
              type="button"
              className={styles.btnPrintPrimary}
              onClick={handlePrint}
              title={t("receipt.printReceiptTooltip", "Print receipt or save as PDF")}
            >
              <Printer size={16} />
              <span>{t("receipt.printReceiptPdf", "Print Receipt / Save PDF")}</span>
            </button>

            <button
              type="button"
              className={styles.btnClose}
              onClick={onClose}
              title={t("common.close", "Close")}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Official Receipt Sheet (Target for window.print) */}
        <div id="printable-receipt" className={styles.receiptSheet}>
          
          {/* Government Insignia Header */}
          <div className={styles.receiptHeader}>
            <div className={styles.govtInsigniaWrap}>
              <div className={styles.emblemSymbol}>सत्यमेव जयते</div>
              <h2 className={styles.govtState}>{t("receipt.govtState", "GOVERNMENT OF MAHARASHTRA")}</h2>
              <h3 className={styles.govtDept}>{t("receipt.govtDept", "REVENUE & CITIZEN SERVICES DEPARTMENT")}</h3>
              <p className={styles.portalSub}>{t("receipt.portalSub", "PUBLIC CITIZEN SERVICES PORTAL • STATUTORY E-GOVERNANCE RECEIPT")}</p>
            </div>

            <div className={styles.receiptDocTitleBox}>
              <h1 className={styles.receiptDocTitle}>{t("receipt.acknowledgmentTitle", "APPLICATION SUBMISSION ACKNOWLEDGMENT")}</h1>
              <span className={styles.receiptActRef}>
                {t("receipt.statutoryActRef", "Issued under Section 4 of Maharashtra Right to Public Services Act & Information Technology Act, 2000")}
              </span>
            </div>
          </div>

          {/* Primary Statutory Identifiers Banner (Certificate ID, Citizen ID, Tracking ID) */}
          <div className={styles.identifiersBanner}>
            <div className={styles.idCell}>
              <span className={styles.idCellLabel}>{t("receipt.certIdAppNo", "CERTIFICATE ID / APP NO")}</span>
              <strong className={styles.idCellValue}>{certificateId || applicationNumber}</strong>
            </div>

            <div className={styles.idCell}>
              <span className={styles.idCellLabel}>{t("receipt.citizenId", "CITIZEN ID")}</span>
              <strong className={styles.idCellValue}>{citizenId}</strong>
            </div>

            <div className={styles.idCell}>
              <span className={styles.idCellLabel}>{t("receipt.trackingId", "TRACKING ID")}</span>
              <strong className={styles.idCellValueTracking}>{trackingId}</strong>
            </div>

            <div className={styles.idCell}>
              <span className={styles.idCellLabel}>{t("receipt.status", "STATUS")}</span>
              <span className={styles.statusBadge}>{status}</span>
            </div>
          </div>

          {/* Metadata Meta Strip */}
          <div className={styles.metaStrip}>
            <div className={styles.metaStripItem}>
              <span className={styles.metaStripLabel}>{t("receipt.targetService", "Target Service:")}</span>
              <strong className={styles.metaStripValue}>{serviceName}</strong>
            </div>

            <div className={styles.metaStripItem}>
              <span className={styles.metaStripLabel}>{t("receipt.filingMode", "Filing Mode:")}</span>
              <strong className={styles.metaStripValue}>{formType}</strong>
            </div>

            <div className={styles.metaStripItem}>
              <span className={styles.metaStripLabel}>{t("receipt.submissionDateTime", "Submission Date & Time:")}</span>
              <span className={styles.metaStripValue}>{formattedDate}</span>
            </div>
          </div>

          {/* Section 1: Applicant Submitted Particulars */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNum}>1</span>
              <h4 className={styles.sectionTitle}>{t("receipt.applicantParticulars", "APPLICANT PARTICULARS (SUBMITTED FORM DATA)")}</h4>
            </div>

            <table className={styles.particularsTable}>
              <tbody>
                <tr>
                  <td className={styles.tdLabel}>{t("receipt.applicantFullName", "1. Applicant Full Name")}</td>
                  <td className={styles.tdVal}><strong>{applicantName}</strong></td>
                  <td className={styles.tdLabel}>{t("receipt.fatherName", "2. Father's Name")}</td>
                  <td className={styles.tdVal}>{fatherName}</td>
                </tr>
                <tr>
                  <td className={styles.tdLabel}>{t("receipt.motherName", "3. Mother's Name")}</td>
                  <td className={styles.tdVal}>{motherName}</td>
                  <td className={styles.tdLabel}>{t("receipt.dob", "4. Date of Birth")}</td>
                  <td className={styles.tdVal}>{dob}</td>
                </tr>
                <tr>
                  <td className={styles.tdLabel}>{t("receipt.gender", "5. Sex / Gender")}</td>
                  <td className={styles.tdVal}>{gender}</td>
                  <td className={styles.tdLabel}>{t("receipt.maritalStatus", "6. Marital Status")}</td>
                  <td className={styles.tdVal}>{maritalStatus}</td>
                </tr>
                {maritalStatus === 'Yes' && (
                  <tr>
                    <td className={styles.tdLabel}>{t("receipt.husbandName", "7. Husband's Name")}</td>
                    <td className={styles.tdVal} colSpan={3}>{husbandName}</td>
                  </tr>
                )}
                <tr>
                  <td className={styles.tdLabel}>{t("receipt.presentAddress", "8. Present Residential Address")}</td>
                  <td className={styles.tdVal} colSpan={3}>{address}</td>
                </tr>
                {(yearsOfResidence || purpose || annualIncome || caste) && (
                  <tr>
                    {yearsOfResidence ? (
                      <>
                        <td className={styles.tdLabel}>{t("receipt.yearsOfResidence", "9. Years of Residence")}</td>
                        <td className={styles.tdVal}>{yearsOfResidence} {t("receipt.years", "years")}</td>
                      </>
                    ) : null}
                    {purpose ? (
                      <>
                        <td className={styles.tdLabel}>{t("receipt.purposeOfCertificate", "10. Purpose of Certificate")}</td>
                        <td className={styles.tdVal} colSpan={yearsOfResidence ? 1 : 3}>{purpose}</td>
                      </>
                    ) : null}
                    {annualIncome ? (
                      <>
                        <td className={styles.tdLabel}>{t("receipt.annualIncomeDeclared", "Annual Income (Declared)")}</td>
                        <td className={styles.tdVal}>₹{annualIncome}</td>
                      </>
                    ) : null}
                    {caste ? (
                      <>
                        <td className={styles.tdLabel}>{t("receipt.casteSubcaste", "Caste / Subcaste")}</td>
                        <td className={styles.tdVal}>{caste}</td>
                      </>
                    ) : null}
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Section 2: Enclosed Documents */}
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNum}>2</span>
              <h4 className={styles.sectionTitle}>{t("receipt.enclosedDocuments", "ENCLOSED STATUTORY DOCUMENTS")}</h4>
            </div>

            <table className={styles.docsTable}>
              <thead>
                <tr>
                  <th>{t("receipt.enclosureSlot", "Enclosure Slot")}</th>
                  <th>{t("receipt.docTypeSelected", "Document Type Selected")}</th>
                  <th>{t("receipt.attachedFile", "Attached File")}</th>
                  <th>{t("receipt.authenticationStatus", "Authentication Status")}</th>
                </tr>
              </thead>
              <tbody>
                {docList.map((d, idx) => (
                  <tr key={idx}>
                    <td className={styles.tdDocSlot}>{getSlotLabel(d.slot)}</td>
                    <td className={styles.tdDocType}>{getTypeLabel(d.type)}</td>
                    <td className={styles.tdDocFile}>{d.file}</td>
                    <td className={styles.tdDocStatus}>
                      {d.status !== 'Not Provided' ? (
                        <span className={styles.docStatusBadge}>✓ {getStatusLabel(d.status)}</span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>— {t("receipt.statusNotProvided", "Not Provided")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 3: Statutory Declaration & Official Stamp */}
          <div className={styles.declarationStampBox}>
            <div className={styles.declarationTextWrap}>
              <h5 className={styles.declarationTitle}>{t("receipt.citizenDeclarationConfirmed", "Statutory Citizen Declaration Confirmed:")}</h5>
              <p className={styles.declarationStatement}>
                {t("receipt.citizenDeclarationText", "\"The above particulars are correct as per the best of my knowledge. In case of any false information, I shall be held responsible and appropriate action may be taken against me.\"")}
              </p>
              <div className={styles.declarationMeta}>
                <span>{t("receipt.declarationConsent", "Authenticated via Citizen Session • Consent Recorded: YES")}</span>
              </div>
            </div>

            {/* Simulated Official Digital Stamp */}
            <div className={styles.digitalStamp}>
              <div className={styles.stampInner}>
                <div className={styles.stampGovt}>{t("receipt.stampGovt", "GOVT. OF MAHARASHTRA")}</div>
                <div className={styles.stampEmblem}>सत्यमेव जयते</div>
                <div className={styles.stampStatus}>{t("receipt.stampStatus", "E-SUBMITTED")}</div>
                <div className={styles.stampDate}>{new Date(submittedAt).toLocaleDateString('en-IN')}</div>
                <div className={styles.stampId}>{trackingId}</div>
              </div>
            </div>
          </div>

          {/* Footer Notice & Instructions */}
          <div className={styles.receiptFooter}>
            <div className={styles.footerNotice}>
              <strong>{t("receipt.applicantNotice", "Notice for Applicant:")}</strong> {t("receipt.applicantNoticeDesc", "Please preserve this statutory acknowledgment slip for your records. Quote your Tracking ID or Certificate ID for all status inquiries. Your application is now queued for Desk Clerk document review.")}
            </div>

            <div className={styles.footerMetaRow}>
              <span>{t("receipt.computerGeneratedNotice", "Computer Generated Slip under IT Act 2000 • No physical signature required.")}</span>
              <span>{t("receipt.generatedOnPortal", "RevenueGov Portal • Generated:")} {formattedDate}</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
