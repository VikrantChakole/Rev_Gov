import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import useChatStore from '../../store/chatStore'
import { loginCitizen, registerCitizen } from '../../api/auth'
import { INDIAN_STATES } from '../../utils/constants'
import styles from './AuthPage.module.css'

export default function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setCitizenAuth, isCitizenAuthenticated } = useAuthStore()

  const [tab, setTab]             = useState(searchParams.get('tab') === 'register' ? 'register' : 'login')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]   = useState('')
  const [name, setName]           = useState('')
  const [userState, setUserState] = useState('Maharashtra')
  const [nationality]             = useState('Indian')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  // Redirect if already authenticated
  useEffect(() => {
    if (isCitizenAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isCitizenAuthenticated, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      useChatStore.getState().reset()
      if (tab === 'login') {
        const res = await loginCitizen({ identifier, password })
        setCitizenAuth(res.access_token, {
          citizen_id:  res.citizen_id,
          name:        res.name,
          email:       res.email,
          phone:       res.phone,
          state:       res.state || 'Maharashtra',
          nationality: res.nationality || 'Indian',
          role:        'CITIZEN',
        })
      } else {
        const res = await registerCitizen({
          identifier: identifier.trim(),
          password,
          name: name.trim() || undefined,
          state: userState.trim() || 'Maharashtra',
          nationality: nationality.trim() || 'Indian',
        })
        setCitizenAuth(res.access_token, {
          citizen_id:  res.citizen_id,
          name:        res.name,
          email:       res.email,
          phone:       res.phone,
          state:       res.state || userState.trim() || 'Maharashtra',
          nationality: res.nationality || nationality.trim() || 'Indian',
          role:        'CITIZEN',
        })
      }
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.cardHeader}>
          <div className={styles.logoIcon}>
            <span className="material-symbols-outlined">account_balance</span>
          </div>
          <div>
            <h1 className={styles.title}>RevenueGov</h1>
            <p className={styles.subtitle}>Government Services, Simplified</p>
          </div>
        </div>

        {/* Role Selector — Service Officers and Admin links */}
        <div className={styles.portalNote}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--rg-text-body)' }}>info</span>
          <span>
            For government staff, use the{' '}
            <Link to="/officer/login" className={styles.adminLink}>Service Officers</Link>
            {' '}or{' '}
            <Link to="/admin/login" className={styles.adminLink}>Admin Portal</Link>.
          </span>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tabBtn} ${tab === 'login' ? styles.tabActive : ''}`}
            onClick={() => { setTab('login'); setError('') }}
          >
            Sign In
          </button>
          <button
            className={`${styles.tabBtn} ${tab === 'register' ? styles.tabActive : ''}`}
            onClick={() => { setTab('register'); setError('') }}
          >
            Register
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className={styles.errorBanner}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.form}>
          {tab === 'register' && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>Full Name</label>
                <input
                  type="text"
                  className={`${styles.input} ${error && /name/i.test(error) ? styles.inputError : ''}`}
                  placeholder="Enter your full name"
                  value={name}
                  onChange={e => { setName(e.target.value); if (error) setError('') }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className={styles.field}>
                  <label className={styles.label}>State</label>
                  <select
                    className={styles.select}
                    value={userState}
                    onChange={e => setUserState(e.target.value)}
                    required
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Nationality</label>
                  <div className={styles.fixedInputWrap}>
                    <input
                      type="text"
                      className={`${styles.input} ${styles.inputFixed}`}
                      value="Indian"
                      readOnly
                      disabled
                      title="Nationality is fixed as Indian"
                    />
                    <span className={styles.fixedBadge}>Fixed</span>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className={styles.field}>
            <label className={styles.label}>Email or Mobile Number</label>
            <input
              type="text"
              className={`${styles.input} ${error && /(mobile|phone|email)/i.test(error) ? styles.inputError : ''}`}
              placeholder="citizen@example.com or +91XXXXXXXXXX"
              value={identifier}
              onChange={e => { setIdentifier(e.target.value); if (error) setError('') }}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              className={`${styles.input} ${error && /password/i.test(error) ? styles.inputError : ''}`}
              placeholder="Enter password"
              value={password}
              onChange={e => { setPassword(e.target.value); if (error) setError('') }}
              required
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading
              ? 'Processing...'
              : tab === 'login'
              ? 'Sign In to Citizen Dashboard'
              : 'Create Permanent Citizen Account'}
          </button>
        </form>

        {/* Footer note */}
        <p className={styles.footerNote}>
          Your permanent Citizen ID works across Web, WhatsApp, and IVR helpline.
        </p>
      </div>
    </div>
  )
}
