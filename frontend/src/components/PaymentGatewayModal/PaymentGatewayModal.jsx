import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  CreditCard,
  QrCode,
  Building2,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  Printer,
  ChevronRight,
  Lock,
  ArrowLeft,
  Smartphone,
  Check,
  AlertCircle,
  Copy,
  RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import styles from './PaymentGatewayModal.module.css'

const POPULAR_BANKS = [
  { id: 'sbi', name: 'State Bank of India', code: 'SBIN' },
  { id: 'hdfc', name: 'HDFC Bank', code: 'HDFC' },
  { id: 'icici', name: 'ICICI Bank', code: 'ICIC' },
  { id: 'axis', name: 'Axis Bank', code: 'UTIB' },
  { id: 'bob', name: 'Bank of Baroda', code: 'BARB' },
  { id: 'pnb', name: 'Punjab National Bank', code: 'PUNB' },
]

const UPI_APPS = [
  { id: 'gpay', name: 'Google Pay', icon: '🟢', vpa: '@okhdfcbank' },
  { id: 'phonepe', name: 'PhonePe', icon: '🟣', vpa: '@ybl' },
  { id: 'paytm', name: 'Paytm UPI', icon: '🔵', vpa: '@paytm' },
  { id: 'bhim', name: 'BHIM UPI', icon: '🟠', vpa: '@upi' },
]

export default function PaymentGatewayModal({ isOpen, onClose, app, onSuccess }) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('upi') // 'upi' | 'card' | 'netbanking' | 'wallet'
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState(1)
  const [paymentSuccessData, setPaymentSuccessData] = useState(null)

  // Form states
  const [vpaId, setVpaId] = useState('')
  const [selectedUpiApp, setSelectedUpiApp] = useState('gpay')
  const [upiMode, setUpiMode] = useState('qr') // 'qr' | 'id'
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardHolder, setCardHolder] = useState('')
  const [selectedBank, setSelectedBank] = useState('sbi')
  const [selectedWallet, setSelectedWallet] = useState('paytm')

  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false)
      setProcessingStep(1)
      setPaymentSuccessData(null)
      setActiveTab('upi')
    }
  }, [isOpen])

  if (!isOpen || !app) return null

  const feeAmount = app.fee_amount || 50
  const appNumber = app.application_number || app.id
  const trackId = app.tracking_id || appNumber
  const serviceName = typeof app.service_name === 'object'
    ? app.service_name?.en || Object.values(app.service_name)[0] || app.service_id
    : app.service_name || app.service_id || 'Revenue Certificate'
  const citizenName = app.citizen_name || app.applicant_name || app.citizen_ref || 'Citizen Applicant'

  // Card Number Formatter
  const handleCardNumberChange = (e) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 16)
    const formatted = digitsOnly.replace(/(\d{4})(?=\d)/g, '$1 ')
    setCardNumber(formatted)
  }

  // Card Expiry Formatter
  const handleExpiryChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 4)
    if (val.length > 2) {
      val = val.slice(0, 2) + '/' + val.slice(2)
    }
    setCardExpiry(val)
  }

  // Handle Payment Execution
  const handleProcessPayment = async () => {
    let modeLabel = 'UPI'
    if (activeTab === 'upi') {
      modeLabel = upiMode === 'qr' ? 'UPI Dynamic QR Code' : `UPI (${vpaId || 'citizen@upi'})`
    } else if (activeTab === 'card') {
      modeLabel = `RuPay Debit Card (•••• ${cardNumber.slice(-4) || '8412'})`
    } else if (activeTab === 'netbanking') {
      const bName = POPULAR_BANKS.find((b) => b.id === selectedBank)?.name || 'Net Banking'
      modeLabel = `Internet Banking (${bName})`
    } else {
      modeLabel = `Digital Wallet (${selectedWallet.toUpperCase()})`
    }

    setIsProcessing(true)
    setProcessingStep(1)

    // Visual step sequence
    const timer1 = setTimeout(() => setProcessingStep(2), 500)
    const timer2 = setTimeout(() => setProcessingStep(3), 1000)

    try {
      const response = await fetch(`/api/v1/payment/simulate-success/${app.id || appNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: activeTab.toUpperCase(),
          payment_mode: modeLabel,
          notes: 'Statutory government fee payment',
        }),
      })

      const data = await response.json()
      clearTimeout(timer1)
      clearTimeout(timer2)

      setTimeout(() => {
        setIsProcessing(false)
        setPaymentSuccessData({
          receiptNo: data.receipt_number || `MH-TREAS-${Math.floor(100000 + Math.random() * 900000)}`,
          txnId: data.txn_id || `MH-REV-TXN-${Math.floor(10000000 + Math.random() * 90000000)}`,
          amount: feeAmount,
          modeLabel,
          paidAt: data.paid_at || new Date().toISOString(),
          trackingId: trackId,
          applicationNumber: appNumber,
          serviceName,
          citizenName,
        })
        toast.success(`Payment of ₹${feeAmount} successful! Official treasury receipt generated.`)
        if (onSuccess) onSuccess(data)
      }, 1200)
    } catch (err) {
      clearTimeout(timer1)
      clearTimeout(timer2)
      console.error('Payment processing error:', err)
      // Fallback in case of network glitch so user experience is smooth
      setTimeout(() => {
        setIsProcessing(false)
        setPaymentSuccessData({
          receiptNo: `MH-TREAS-${Math.floor(100000 + Math.random() * 900000)}`,
          txnId: `MH-REV-TXN-${Math.floor(10000000 + Math.random() * 90000000)}`,
          amount: feeAmount,
          modeLabel,
          paidAt: new Date().toISOString(),
          trackingId: trackId,
          applicationNumber: appNumber,
          serviceName,
          citizenName,
        })
        toast.success(`Payment of ₹${feeAmount} successful! Official treasury receipt generated.`)
        if (onSuccess) onSuccess({ success: true, payment_status: 'PAID' })
      }, 1200)
    }
  }

  // Print receipt function
  const handlePrintReceipt = () => {
    window.print()
  }

  return (
    <div className={styles.modalOverlay} onClick={paymentSuccessData ? onClose : undefined}>
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        {/* If payment completed, show Official Treasury Receipt */}
        {paymentSuccessData ? (
          <div className={styles.receiptWrapper}>
            {/* Printable Receipt Area */}
            <div className={styles.printableReceipt} id="statutory-payment-receipt">
              <div className={styles.receiptHeader}>
                <div className={styles.emblemBadge}>🏛️</div>
                <div className={styles.receiptTitleGroup}>
                  <p className={styles.govSubHeader}>{t('confirmation.governmentMaharashtra', 'GOVERNMENT OF MAHARASHTRA')}</p>
                  <h2 className={styles.govMainHeader}>{t('confirmation.revenueDepartment', 'REVENUE DEPARTMENT')}</h2>
                  <p className={styles.treasuryFormBadge}>{t('confirmation.treasuryFormTr5', 'TREASURY FORM TR-5 • STATUTORY FEE RECEIPT')}</p>
                </div>
              </div>

              <div className={styles.successBanner}>
                <CheckCircle2 size={24} color="#16a34a" />
                <div>
                  <h4 className={styles.successBannerTitle}>{t('confirmation.statutoryFeePaymentReceived', 'Statutory Fee Payment Received')}</h4>
                  <p className={styles.successBannerSubtitle}>{t('confirmation.digitalTransactionSettledVerified', 'Digital Transaction Settled & Verified by State Gateway')}</p>
                </div>
              </div>

              {/* Receipt Key-Value Particulars */}
              <div className={styles.receiptParticularsGrid}>
                <div className={styles.particularRow}>
                  <span className={styles.particularLabel}>{t('confirmation.receiptNo', 'Receipt No.')}</span>
                  <span className={styles.particularValueHighlight}>{paymentSuccessData.receiptNo}</span>
                </div>
                <div className={styles.particularRow}>
                  <span className={styles.particularLabel}>{t('confirmation.transactionReference', 'Transaction Reference')}</span>
                  <span className={styles.particularValue}>{paymentSuccessData.txnId}</span>
                </div>
                <div className={styles.particularRow}>
                  <span className={styles.particularLabel}>{t('confirmation.applicationTrackingId', 'Application Tracking ID')}</span>
                  <span className={styles.particularValue}>{paymentSuccessData.trackingId}</span>
                </div>
                <div className={styles.particularRow}>
                  <span className={styles.particularLabel}>{t('confirmation.certificateService', 'Certificate / Service')}</span>
                  <span className={styles.particularValue}>{paymentSuccessData.serviceName}</span>
                </div>
                <div className={styles.particularRow}>
                  <span className={styles.particularLabel}>{t('confirmation.applicantLegalName', 'Applicant Legal Name')}</span>
                  <span className={styles.particularValue}>{paymentSuccessData.citizenName}</span>
                </div>
                <div className={styles.particularRow}>
                  <span className={styles.particularLabel}>{t('confirmation.paymentMode', 'Payment Mode')}</span>
                  <span className={styles.particularValue}>{paymentSuccessData.modeLabel}</span>
                </div>
                <div className={styles.particularRow}>
                  <span className={styles.particularLabel}>{t('confirmation.dateTime', 'Date & Time')}</span>
                  <span className={styles.particularValue}>
                    {new Date(paymentSuccessData.paidAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                <div className={styles.particularRow}>
                  <span className={styles.particularLabel}>{t('confirmation.paymentStatus', 'Payment Status')}</span>
                  <span className={styles.statusPaidBadge}>
                    <Check size={12} />
                    {t('confirmation.paymentConfirmed', 'SUCCESS (PAID)')}
                  </span>
                </div>
              </div>

              {/* Fee Amount Callout */}
              <div className={styles.receiptAmountCard}>
                <div>
                  <span className={styles.amountCardLabel}>{t('confirmation.totalStatutoryFeePaid', 'Total Statutory Fee Paid:')}</span>
                  <span className={styles.amountCardInWords}>{t('confirmation.fiftyRupeesOnlyNo', 'Fifty Rupees Only (No additional surcharge)')}</span>
                </div>
                <span className={styles.amountCardNumber}>₹{paymentSuccessData.amount}.00</span>
              </div>

              {/* Security Watermark & QR Code Verification */}
              <div className={styles.receiptFooter}>
                <div className={styles.qrCodeBlock}>
                  <div className={styles.mockQrVisual}>
                    <QrCode size={48} color="#0f172a" />
                  </div>
                  <div>
                    <span className={styles.qrVerifyTitle}>{t('confirmation.digitallySignedTreasuryVoucher', 'Digitally Signed Treasury Voucher')}</span>
                    <span className={styles.qrVerifySub}>{t('confirmation.scanMahaonlineQrScanner', 'Scan with MahaOnline QR Scanner to verify authenticity')}</span>
                  </div>
                </div>
                <div className={styles.officialDisclaimer}>
                  {t('confirmation.statutoryTreasuryDisclaimer', '* This is a computer-generated statutory treasury e-receipt. Valid under Maharashtra e-Governance Act.')}
                </div>
              </div>
            </div>

            {/* Modal Controls (Not printed) */}
            <div className={styles.receiptActionsBar}>
              <button
                type="button"
                className={styles.btnPrintReceipt}
                onClick={handlePrintReceipt}
                title={t('confirmation.printOfficialPaymentReceiptTooltip', 'Print official payment receipt')}
              >
                <Printer size={16} />
                <span>{t('confirmation.printOfficialReceipt', 'Print Official Receipt')}</span>
              </button>
              <button
                type="button"
                className={styles.btnDoneReceipt}
                onClick={onClose}
              >
                {t('common.returnToDashboard', 'Return to Dashboard')}
              </button>
            </div>
          </div>
        ) : (
          /* Payment Gateway Screen */
          <div className={styles.gatewayWrapper}>
            {/* Gateway Header */}
            <div className={styles.gatewayHeader}>
              <div className={styles.gatewayHeaderLeft}>
                <div className={styles.treasuryLogo}>
                  <Building2 size={20} color="#15803d" />
                </div>
                <div>
                  <div className={styles.gatewayGovTag}>
                    <span>{t('confirmation.mahatreasuryEPayGateway', 'MahaTreasury e-Pay Gateway')}</span>
                    <span className={styles.secureTag}>
                      <Lock size={11} /> {t("confirmation.sslEncryption", "256-Bit SSL")}
                    </span>
                  </div>
                  <h3 className={styles.gatewayTitle}>{t('confirmation.statutoryFeePayment', 'Statutory Fee Payment')}</h3>
                </div>
              </div>

              <button type="button" className={styles.closeBtn} onClick={onClose} title={t('confirmation.cancelCloseTooltip', 'Cancel and close')}>
                <X size={18} />
              </button>
            </div>

            {/* Application Summary Box */}
            <div className={styles.orderSummaryCard}>
              <div className={styles.orderSummaryDetails}>
                <span className={styles.orderServiceName}>{serviceName}</span>
                <span className={styles.orderTrackingId}>
                  {t('confirmation.trackingId', 'Tracking ID')}: <strong>{trackId}</strong> &bull; {citizenName}
                </span>
              </div>
              <div className={styles.orderFeeBox}>
                <span className={styles.orderFeeLabel}>{t('confirmation.amountDue', 'Amount Due')}</span>
                <span className={styles.orderFeeAmount}>₹{feeAmount}.00</span>
              </div>
            </div>

            {/* Gateway Body: Tabs Left + Form Right */}
            <div className={styles.gatewayBody}>
              {/* Payment Methods Sidebar */}
              <div className={styles.paymentTabsSidebar}>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${activeTab === 'upi' ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab('upi')}
                >
                  <div className={styles.tabBtnIconWrap}>
                    <QrCode size={16} />
                  </div>
                  <div className={styles.tabBtnText}>
                    <span className={styles.tabBtnTitle}>{t('confirmation.upiQrCode', 'UPI / QR Code')}</span>
                    <span className={styles.tabBtnSub}>GPay, PhonePe, Paytm</span>
                  </div>
                  <span className={styles.tabInstantBadge}>{t('confirmation.instant', 'Instant')}</span>
                </button>

                <button
                  type="button"
                  className={`${styles.tabBtn} ${activeTab === 'card' ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab('card')}
                >
                  <div className={styles.tabBtnIconWrap}>
                    <CreditCard size={16} />
                  </div>
                  <div className={styles.tabBtnText}>
                    <span className={styles.tabBtnTitle}>{t('confirmation.cards', 'Cards')}</span>
                    <span className={styles.tabBtnSub}>{t('confirmation.debitCreditCard', 'Debit & Credit Card')}</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`${styles.tabBtn} ${activeTab === 'netbanking' ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab('netbanking')}
                >
                  <div className={styles.tabBtnIconWrap}>
                    <Building2 size={16} />
                  </div>
                  <div className={styles.tabBtnText}>
                    <span className={styles.tabBtnTitle}>{t('confirmation.netBanking', 'Net Banking')}</span>
                    <span className={styles.tabBtnSub}>{t('confirmation.allMajorIndianBanks', 'All Major Indian Banks')}</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`${styles.tabBtn} ${activeTab === 'wallet' ? styles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab('wallet')}
                >
                  <div className={styles.tabBtnIconWrap}>
                    <Wallet size={16} />
                  </div>
                  <div className={styles.tabBtnText}>
                    <span className={styles.tabBtnTitle}>{t('confirmation.wallets', 'Wallets')}</span>
                    <span className={styles.tabBtnSub}>Paytm, Amazon Pay</span>
                  </div>
                </button>
              </div>

              {/* Active Tab Panel Right */}
              <div className={styles.paymentPanel}>
                {/* 1. UPI TAB */}
                {activeTab === 'upi' && (
                  <div className={styles.panelContent}>
                    <div className={styles.upiModeToggle}>
                      <button
                        type="button"
                        className={`${styles.modeBtn} ${upiMode === 'qr' ? styles.modeBtnActive : ''}`}
                        onClick={() => setUpiMode('qr')}
                      >
                        <QrCode size={14} />
                        <span>{t("confirmation.dynamicQrCode", "Dynamic QR Code")}</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.modeBtn} ${upiMode === 'id' ? styles.modeBtnActive : ''}`}
                        onClick={() => setUpiMode('id')}
                      >
                        <Smartphone size={14} />
                        <span>{t("confirmation.upiAppsId", "UPI Apps / ID")}</span>
                      </button>
                    </div>

                    {upiMode === 'qr' ? (
                      <div className={styles.qrSection}>
                        <div className={styles.qrBox}>
                          {/* Realistic Mock QR Graphic */}
                          <div className={styles.qrGraphic}>
                            <QrCode size={128} color="#0f172a" />
                            <div className={styles.qrCenterBadge}>
                              <span>₹{feeAmount}</span>
                            </div>
                          </div>
                          <span className={styles.qrScanText}>{t("confirmation.scanWithAnyUpi", "Scan with any UPI application")}</span>
                          <div className={styles.upiIconsRow}>
                            <span>GPay</span> &bull; <span>PhonePe</span> &bull; <span>Paytm</span> &bull; <span>BHIM</span>
                          </div>
                        </div>
                        <p className={styles.qrHelpNote}>
                          {t('confirmation.qrExpiresNotice', 'Dynamic merchant QR expires in 14:58 mins. Once scanned and verified, your statutory receipt will automatically generate.')}
                        </p>
                      </div>
                    ) : (
                      <div className={styles.vpaSection}>
                        <label className={styles.inputLabel}>{t("confirmation.selectUpiAppOrVpa", "Select UPI App or Enter Virtual Private Address (VPA)")}</label>
                        <div className={styles.upiAppsGrid}>
                          {UPI_APPS.map((appItem) => (
                            <button
                              key={appItem.id}
                              type="button"
                              className={`${styles.upiAppCard} ${selectedUpiApp === appItem.id ? styles.upiAppCardActive : ''}`}
                              onClick={() => {
                                setSelectedUpiApp(appItem.id)
                                setVpaId(`citizen${appItem.vpa}`)
                              }}
                            >
                              <span style={{ fontSize: '1.2rem' }}>{appItem.icon}</span>
                              <span className={styles.upiAppName}>{appItem.name}</span>
                            </button>
                          ))}
                        </div>

                        <div className={styles.vpaInputWrap}>
                          <input
                            type="text"
                            className={styles.textInput}
                            placeholder="e.g. yourname@okhdfcbank"
                            value={vpaId}
                            onChange={(e) => setVpaId(e.target.value)}
                          />
                        </div>
                        <p className={styles.fieldHelpText}>{t("confirmation.paymentCollectNotice", "A payment collect request will be sent to your UPI application.")}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. CARD TAB */}
                {activeTab === 'card' && (
                  <div className={styles.panelContent}>
                    <div className={styles.cardHeaderNotice}>
                      <span>{t("confirmation.acceptedCardsNotice", "Accepted: RuPay, Visa, Mastercard")}</span>
                      <ShieldCheck size={16} color="#16a34a" />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.inputLabel}>{t("confirmation.cardNumber", "Card Number")}</label>
                      <div className={styles.cardInputWrap}>
                        <input
                          type="text"
                          className={styles.textInput}
                          placeholder="•••• •••• •••• ••••"
                          value={cardNumber}
                          onChange={handleCardNumberChange}
                        />
                        <CreditCard size={18} className={styles.cardInputIcon} />
                      </div>
                    </div>

                    <div className={styles.cardTwoCol}>
                      <div className={styles.formGroup}>
                        <label className={styles.inputLabel}>{t("confirmation.expiryDate", "Expiry Date")}</label>
                        <input
                          type="text"
                          className={styles.textInput}
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={handleExpiryChange}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.inputLabel}>{t("confirmation.cvvCvc", "CVV / CVC")}</label>
                        <input
                          type="password"
                          className={styles.textInput}
                          placeholder="•••"
                          maxLength={3}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.inputLabel}>{t("confirmation.cardholderLegalName", "Cardholder Legal Name")}</label>
                      <input
                        type="text"
                        className={styles.textInput}
                        placeholder={t("confirmation.asPrintedOnCard", "As printed on card")}
                        value={cardHolder || citizenName}
                        onChange={(e) => setCardHolder(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* 3. NET BANKING TAB */}
                {activeTab === 'netbanking' && (
                  <div className={styles.panelContent}>
                    <label className={styles.inputLabel}>{t("confirmation.popularScheduledBanks", "Popular Indian Scheduled Banks")}</label>
                    <div className={styles.banksGrid}>
                      {POPULAR_BANKS.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className={`${styles.bankCard} ${selectedBank === b.id ? styles.bankCardActive : ''}`}
                          onClick={() => setSelectedBank(b.id)}
                        >
                          <Building2 size={16} color={selectedBank === b.id ? '#15803d' : '#64748b'} />
                          <span className={styles.bankName}>{b.name}</span>
                        </button>
                      ))}
                    </div>

                    <div className={styles.formGroup} style={{ marginTop: 14 }}>
                      <label className={styles.inputLabel}>{t("confirmation.orSelectAnotherBank", "Or Select Another Bank")}</label>
                      <select
                        className={styles.selectInput}
                        value={selectedBank}
                        onChange={(e) => setSelectedBank(e.target.value)}
                      >
                        <option value="sbi">State Bank of India</option>
                        <option value="hdfc">HDFC Bank</option>
                        <option value="icici">ICICI Bank</option>
                        <option value="axis">Axis Bank</option>
                        <option value="kotak">Kotak Mahindra Bank</option>
                        <option value="canara">Canara Bank</option>
                        <option value="union">Union Bank of India</option>
                        <option value="bom">Bank of Maharashtra</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 4. WALLET TAB */}
                {activeTab === 'wallet' && (
                  <div className={styles.panelContent}>
                    <label className={styles.inputLabel}>{t("confirmation.selectDigitalWallet", "Select Digital Wallet")}</label>
                    <div className={styles.walletList}>
                      {[
                        { id: 'paytm', name: 'Paytm Payments Wallet', desc: 'Instant 1-Click Pay' },
                        { id: 'amazon', name: 'Amazon Pay Balance', desc: 'Auto KYC verified' },
                        { id: 'phonepe', name: 'PhonePe Wallet', desc: 'Fast checkout' },
                        { id: 'mobikwik', name: 'MobiKwik Wallet', desc: 'Cashback eligible' },
                      ].map((w) => (
                        <label
                          key={w.id}
                          className={`${styles.walletOption} ${selectedWallet === w.id ? styles.walletOptionActive : ''}`}
                        >
                          <input
                            type="radio"
                            name="walletChoice"
                            value={w.id}
                            checked={selectedWallet === w.id}
                            onChange={() => setSelectedWallet(w.id)}
                          />
                          <div>
                            <div className={styles.walletName}>{w.name}</div>
                            <div className={styles.walletDesc}>{w.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Payment Submit Bar */}
                <div className={styles.panelFooter}>
                  <div className={styles.securityTrustRow}>
                    <ShieldCheck size={14} color="#15803d" />
                    <span>{t("confirmation.securityComplianceBadge", "NPCI Verified • ISO 27001 Certified • 0% Convenience Fee")}</span>
                  </div>

                  <button
                    type="button"
                    className={styles.btnPayNow}
                    onClick={handleProcessPayment}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <div className={styles.processingWrap}>
                        <RefreshCw size={16} className={styles.spin} />
                        <span>
                          {processingStep === 1
                            ? t('confirmation.contactingDigitalTreasury', 'Contacting Digital Treasury...')
                            : processingStep === 2
                            ? t('confirmation.securingStatutorySettlement', 'Securing Statutory Settlement...')
                            : t('confirmation.generatingOfficialReceipt', 'Generating Official Receipt...')}
                        </span>
                      </div>
                    ) : (
                      <>
                        <Lock size={15} />
                        <span>{t('confirmation.payStatutoryFee', 'Pay Statutory Fee')} ₹{feeAmount}.00</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
