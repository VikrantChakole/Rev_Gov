import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../store/authStore'
import { getCitizenProfile, updateCitizenProfile } from '../../api/auth'
import { INDIAN_STATES } from '../../utils/constants'
import styles from './ProfilePage.module.css'

function initials(name, id) {
  if (name) return name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  if (id)   return id.replace('CIT-', '').slice(0, 2)
  return 'C'
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const { citizenUser, updateCitizenUser } = useAuthStore()
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(false)
  const [name, setName]         = useState('')
  const [phone, setPhone]       = useState('')
  const [email, setEmail]       = useState('')
  const [address, setAddress]   = useState('')
  const [userState, setUserState] = useState(citizenUser?.state || 'Maharashtra')
  const [nationality, setNationality] = useState(citizenUser?.nationality || 'Indian')
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' })

  const fetchProfile = async () => {
    setLoading(true)
    try {
      const data = await getCitizenProfile()
      setProfile(data)
      setName(data.name || '')
      setPhone(data.phone || '')
      setEmail(data.email || '')
      setAddress(data.address || '')
      setUserState(data.state || citizenUser?.state || 'Maharashtra')
      setNationality(data.nationality || citizenUser?.nationality || 'Indian')
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || t('profile.loadError', 'Failed to load profile.') })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    setStatusMsg({ type: '', text: '' })
    try {
      const updated = await updateCitizenProfile({
        name,
        phone,
        email,
        address,
        state: userState,
        nationality,
      })
      setProfile(updated)
      updateCitizenUser({
        name: updated.name,
        phone: updated.phone,
        email: updated.email,
        address: updated.address,
        state: updated.state,
        nationality: updated.nationality,
      })
      setEditing(false)
      setStatusMsg({ type: 'success', text: t('profile.updateSuccess', 'Profile updated successfully.') })
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message || t('profile.updateError', 'Failed to update profile.') })
    }
  }

  const cid = profile?.citizen_id || citizenUser?.citizen_id || ''

  return (
    <div className={styles.page}>

      {/* Page header */}
      <header className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>{t('profile.citizenAccount', 'Citizen Account')}</h2>
        <p className={styles.pageSubtitle}>{t('profile.managePreferences', 'Manage your profile and preferences.')}</p>
      </header>

      <div className={styles.content}>
        {/* ── Profile card ── */}
        <div className={styles.profileCard}>

          {/* Avatar + identity */}
          <div className={styles.avatarRow}>
            <div className={styles.avatarLg}>
              {loading ? '…' : initials(profile?.name, cid)}
            </div>
            <div>
              <h3 className={styles.profileName}>{profile?.name || t('profile.citizenAccount', 'Citizen Account')}</h3>
              <div className={styles.citizenIdBadge}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>verified_user</span>
                {cid}
              </div>
            </div>
          </div>

          {/* Status message */}
          {statusMsg.text && (
            <div className={`${styles.statusMsg} ${statusMsg.type === 'success' ? styles.statusSuccess : styles.statusError}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {statusMsg.type === 'success' ? 'check_circle' : 'error'}
              </span>
              {statusMsg.text}
            </div>
          )}

          {loading ? (
            <div className={styles.loadingRow}>
              <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--rg-outline-variant)' }}>progress_activity</span>
            </div>
          ) : !editing ? (
            <>
              {/* Info bento grid */}
              <div className={styles.bentoGrid}>
                {[
                  { icon: 'badge',        label: t('profile.citizenId', 'Citizen ID'),        value: cid },
                  { icon: 'language',     label: t('profile.preferredLanguage', 'Preferred Language'), value: (profile?.preferred_language || 'en').toUpperCase() },
                  { icon: 'call',         label: t('profile.phoneNumber', 'Phone Number'),       value: profile?.phone || t('profile.notProvided', 'Not provided') },
                  { icon: 'email',        label: t('profile.emailAddress', 'Email Address'),      value: profile?.email || t('profile.notProvided', 'Not provided') },
                  { icon: 'location_on',  label: t('profile.state', 'State'),              value: profile?.state || userState || 'Maharashtra' },
                  { icon: 'flag',         label: t('profile.nationality', 'Nationality'),        value: (profile?.nationality || nationality || 'Indian') === 'Indian' ? t('dashboard.indian', 'Indian') : (profile?.nationality || nationality) },
                  { icon: 'home',         label: t('profile.address', 'Address'),            value: profile?.address || t('profile.notProvided', 'Not provided'), full: true },
                ].map(({ icon, label, value, full }) => (
                  <div key={label} className={`${styles.bentoCell} ${full ? styles.bentoCellFull : ''}`}>
                    <div className={styles.bentoCellHeader}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--rg-primary)' }}>{icon}</span>
                      <span className={styles.bentoCellLabel}>{label}</span>
                    </div>
                    <span className={styles.bentoCellValue}>{value}</span>
                  </div>
                ))}
              </div>

              <div className={styles.actions}>
                <button className={styles.editBtn} onClick={() => setEditing(true)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  {t('profile.editProfile', 'Edit Profile')}
                </button>
                <Link to="/applications" className={styles.appsBtn}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>assignment</span>
                  {t('profile.myApplications', 'My Applications')}
                </Link>
              </div>
            </>
          ) : (
            <form onSubmit={handleSave} className={styles.editForm}>
              <div className={styles.formField}>
                <label className={styles.formLabel}>{t('profile.fullName', 'Full Name')}</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t('profile.fullNamePlaceholder', 'Your full name')}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>{t('profile.phoneNumber', 'Phone Number')}</label>
                <input
                  type="tel"
                  className={styles.formInput}
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder={t('profile.phonePlaceholder', '+91 XXXXXXXXXX')}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>{t('profile.emailAddress', 'Email Address')}</label>
                <input
                  type="email"
                  className={styles.formInput}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('profile.emailPlaceholder', 'citizen@example.com')}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>{t('profile.state', 'State')}</label>
                <select
                  className={styles.formInput}
                  value={userState}
                  onChange={e => setUserState(e.target.value)}
                >
                  {INDIAN_STATES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>{t('profile.nationality', 'Nationality')}</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={t('dashboard.indian', 'Indian')}
                  readOnly
                  disabled
                  style={{ background: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                />
              </div>

              <div className={styles.formField}>
                <label className={styles.formLabel}>{t('profile.address', 'Address')}</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder={t('profile.addressPlaceholder', 'Residential address')}
                />
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setEditing(false)}>{t('common.cancel', 'Cancel')}</button>
                <button type="submit" className={styles.editBtn}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                  {t('profile.saveChanges', 'Save Changes')}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Channel identities card */}
        {profile?.identities && profile.identities.length > 0 && (
          <div className={styles.identitiesCard}>
            <h3 className={styles.sectionTitle}>{t('profile.connectedChannels', 'Connected Channels')}</h3>
            <ul className={styles.identityList}>
              {profile.identities.map((ident, i) => (
                <li key={i} className={styles.identityItem}>
                  <div className={styles.identityIcon}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      {ident.channel === 'WHATSAPP' ? 'chat' : ident.channel === 'IVR' ? 'call' : 'public'}
                    </span>
                  </div>
                  <div>
                    <div className={styles.identityChannel}>{ident.channel}</div>
                    <div className={styles.identityType}>{ident.identifier_type}</div>
                  </div>
                  <span className="material-symbols-outlined" style={{ marginLeft: 'auto', fontSize: 16, color: ident.verified ? 'var(--rg-success)' : 'var(--rg-warning)' }}>
                    {ident.verified ? 'verified' : 'schedule'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
