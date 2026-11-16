import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { BadgeCheck, Eye, EyeOff, Info } from 'lucide-react'
import { login } from '../../api/auth'
import useAuthStore from '../../store/authStore'
import styles from './ServiceOfficerLogin.module.css'

export default function ServiceOfficerLogin() {
  const [selectedRole, setSelectedRole] = useState('DESK_CLERK') // 'DESK_CLERK' | 'DISTRICT_OFFICER'
  const [username, setUsername]         = useState('')
  const [password, setPassword]         = useState('')
  const [showPwd, setShowPwd]           = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')

  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await login(username, password)
      const userRole = data.role?.toUpperCase()

      // Validate role permissions based on selected radio button
      const allowedForClerk = ['DESK_CLERK', 'OPERATOR', 'OFFICER', 'ADMIN']
      const allowedForOfficer = ['DISTRICT_OFFICER', 'OFFICER', 'REVIEWER', 'APPROVER', 'ADMIN']

      if (selectedRole === 'DESK_CLERK' && !allowedForClerk.includes(userRole)) {
        setError(`This account has role "${data.role}". Please select District Officer or use the Admin portal.`)
        setLoading(false)
        return
      }

      if (selectedRole === 'DISTRICT_OFFICER' && !allowedForOfficer.includes(userRole)) {
        setError(`This account has role "${data.role}". Please select Desk Clerk or use the Admin portal.`)
        setLoading(false)
        return
      }

      setAuth(data.access_token, {
        username: data.username,
        role: data.role,
        first_name: data.first_name,
        last_name: data.last_name,
        state: data.state || 'Maharashtra',
        nationality: data.nationality || 'Indian',
      })
      const displayName = data.first_name ? `${data.first_name} ${data.last_name || ''}`.trim() : data.username
      toast.success(`Welcome, ${displayName}`)

      // Route to appropriate workstation
      if (userRole === 'DISTRICT_OFFICER' || (selectedRole === 'DISTRICT_OFFICER' && userRole !== 'DESK_CLERK')) {
        navigate('/district/dashboard')
      } else if (userRole === 'DESK_CLERK' || selectedRole === 'DESK_CLERK') {
        navigate('/clerk/dashboard')
      } else if (userRole === 'OFFICER') {
        navigate('/officer-dashboard')
      } else {
        navigate('/admin/dashboard')
      }
    } catch (err) {
      setError(err.message || 'Invalid username or password. Please check your credentials.')
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
            <BadgeCheck size={28} />
          </div>
          <div>
            <h1 className={styles.title}>Service Officers</h1>
            <p className={styles.subtitle}>Revenue Services Platform — Officer & Staff Portal</p>
          </div>
        </div>

        {/* Portal Note */}
        <div className={styles.portalNote}>
          <Info size={18} style={{ flexShrink: 0 }} />
          <span>
            Citizen looking to apply? Go to{' '}
            <Link to="/login" className={styles.portalLink}>Citizen Portal</Link>
            {' '}or{' '}
            <Link to="/admin/login" className={styles.portalLink}>Admin Portal</Link>.
          </span>
        </div>

        {/* Error Banner */}
        {error && (
          <div className={styles.errorBanner}>
            <span style={{ fontWeight: 700 }}>Notice:</span> {error}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Role Selection Radio Buttons */}
          <div className={styles.roleSelectorGroup}>
            <label className={styles.roleSelectorLabel}>Select Service Role</label>
            <div className={styles.radioRow}>
              <label
                className={`${styles.radioCard} ${selectedRole === 'DESK_CLERK' ? styles.radioCardActive : ''}`}
                onClick={() => setSelectedRole('DESK_CLERK')}
              >
                <input
                  type="radio"
                  name="serviceRole"
                  value="DESK_CLERK"
                  checked={selectedRole === 'DESK_CLERK'}
                  onChange={() => setSelectedRole('DESK_CLERK')}
                  className={styles.radioInput}
                />
                <div className={styles.radioContent}>
                  <span className={styles.radioTitle}>Desk Clerk</span>
                  <span className={styles.radioSub}>Counter & Ingestion</span>
                </div>
              </label>

              <label
                className={`${styles.radioCard} ${selectedRole === 'DISTRICT_OFFICER' ? styles.radioCardActive : ''}`}
                onClick={() => setSelectedRole('DISTRICT_OFFICER')}
              >
                <input
                  type="radio"
                  name="serviceRole"
                  value="DISTRICT_OFFICER"
                  checked={selectedRole === 'DISTRICT_OFFICER'}
                  onChange={() => setSelectedRole('DISTRICT_OFFICER')}
                  className={styles.radioInput}
                />
                <div className={styles.radioContent}>
                  <span className={styles.radioTitle}>District Officer</span>
                  <span className={styles.radioSub}>Review & Approval</span>
                </div>
              </label>
            </div>
          </div>

          {/* Username Field */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="officer-username">Username</label>
            <input
              id="officer-username"
              className={styles.input}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={selectedRole === 'DESK_CLERK' ? 'e.g. deskclerk or operator' : 'e.g. districtofficer or officer'}
              autoComplete="username"
              required
            />
          </div>

          {/* Password Field */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="officer-password">Password</label>
            <div className={styles.passwordWrap}>
              <input
                id="officer-password"
                className={styles.input}
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button className={styles.submitBtn} type="submit" disabled={loading}>
            {loading
              ? 'Authenticating…'
              : `Sign In as ${selectedRole === 'DESK_CLERK' ? 'Desk Clerk' : 'District Officer'}`}
          </button>
        </form>

        <div className={styles.divider} />

        <div className={styles.footerLinksRow}>
          <Link to="/admin/login" className={styles.switchLink}>
            Admin login →
          </Link>
          <Link to="/" className={styles.homeLink}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
