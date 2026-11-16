import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Users,
  Search,
  RefreshCw,
  Copy,
  Check,
  Shield,
  UserCheck,
  Building2,
  MapPin,
  Flag,
  Phone,
  UserPlus,
  X,
  Lock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getAdminUsers, createAdminUser } from '../../api/auth'
import styles from './AdminUsers.module.css'

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
]

export default function AdminUsers() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [copiedId, setCopiedId] = useState(null)

  // Onboarding modal state
  const [showOnboardModal, setShowOnboardModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formData, setFormData] = useState({
    role: 'DESK_CLERK',
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    state: 'Maharashtra',
    nationality: 'Indian',
  })

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-users-list', roleFilter, search],
    queryFn: () => getAdminUsers({ role: roleFilter, search: search.trim() || undefined }),
    refetchInterval: 15000,
  })

  const users = data?.users || []
  const totalUsers = data?.total || users.length

  // Calculate metrics
  const citizenCount = users.filter((u) => u.role === 'CITIZEN').length
  const officerCount = users.filter((u) => ['OFFICER', 'DESK_CLERK', 'DISTRICT_OFFICER', 'OPERATOR'].includes(u.role)).length
  const adminCount = users.filter((u) => u.role === 'ADMIN').length

  const handleCopy = (id) => {
    if (typeof window !== 'undefined' && window.navigator?.clipboard) {
      window.navigator.clipboard.writeText(id)
    }
    setCopiedId(id)
    toast.success('User ID copied to clipboard')
    if (typeof window !== 'undefined') {
      window.setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const handleOpenOnboard = () => {
    setFormData({
      role: 'DESK_CLERK',
      username: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: '',
      state: 'Maharashtra',
      nationality: 'Indian',
    })
    setFormError('')
    setShowOnboardModal(true)
  }

  const handleCloseOnboard = () => {
    if (!submitting) {
      setShowOnboardModal(false)
      setFormError('')
    }
  }

  const handleSubmitOnboard = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!formData.username.trim()) {
      setFormError('Username is required.')
      return
    }
    if (!formData.password || formData.password.length < 6) {
      setFormError('Password must be at least 6 characters.')
      return
    }
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setFormError('First and Last names are required.')
      return
    }

    setSubmitting(true)
    try {
      await createAdminUser({
        role: formData.role,
        username: formData.username.trim(),
        password: formData.password,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        phone: formData.phone.trim() || undefined,
        state: formData.state.trim() || 'Maharashtra',
        nationality: 'Indian',
      })
      toast.success(`${formData.role === 'DESK_CLERK' ? 'Desk Clerk' : 'District Officer'} onboarded successfully!`)
      setShowOnboardModal(false)
      refetch()
    } catch (err) {
      setFormError(err.message || 'Failed to onboard user. Please check the details and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const getRoleBadgeClass = (role) => {
    switch (role?.toUpperCase()) {
      case 'ADMIN':
        return styles.roleBadgeAdmin
      case 'DISTRICT_OFFICER':
      case 'OFFICER':
        return styles.roleBadgeOfficer
      case 'DESK_CLERK':
      case 'OPERATOR':
        return styles.roleBadgeClerk
      default:
        return styles.roleBadgeCitizen
    }
  }

  const formatRoleLabel = (role) => {
    switch (role) {
      case 'DESK_CLERK':
        return 'Desk Clerk'
      case 'DISTRICT_OFFICER':
        return 'District Officer'
      case 'OFFICER':
        return 'Revenue Officer'
      case 'ADMIN':
        return 'Administrator'
      case 'CITIZEN':
        return 'Citizen'
      case 'OPERATOR':
        return 'Assisted Operator'
      default:
        return role
    }
  }

  return (
    <div className={styles.container}>
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Users Management Directory</h1>
          <p className={styles.subtitle}>
            Comprehensive overview of registered citizens, desk clerks, district officers, and system staff.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            className={styles.onboardBtn}
            onClick={handleOpenOnboard}
          >
            <UserPlus size={16} />
            <span>Onboard Service Officer</span>
          </button>
          <button
            className={styles.refreshBtn}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={16} className={isFetching ? styles.spin : ''} />
            <span>Sync Realtime</span>
          </button>
        </div>
      </div>

      {/* ── Summary Metrics ── */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>Total Users</span>
            <div className={styles.metricIconWrap} style={{ background: '#e0f2fe', color: '#00355f' }}>
              <Users size={18} />
            </div>
          </div>
          <div className={styles.metricCount} style={{ color: '#00355f' }}>{totalUsers}</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>Citizens</span>
            <div className={styles.metricIconWrap} style={{ background: '#f8fafc', color: '#475569' }}>
              <UserCheck size={18} />
            </div>
          </div>
          <div className={styles.metricCount} style={{ color: '#475569' }}>{citizenCount}</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>Service Officers</span>
            <div className={styles.metricIconWrap} style={{ background: '#eff6ff', color: '#1d4ed8' }}>
              <Building2 size={18} />
            </div>
          </div>
          <div className={styles.metricCount} style={{ color: '#1d4ed8' }}>{officerCount}</div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricTitle}>Administrators</span>
            <div className={styles.metricIconWrap} style={{ background: '#fef2f2', color: '#b91c1c' }}>
              <Shield size={18} />
            </div>
          </div>
          <div className={styles.metricCount} style={{ color: '#b91c1c' }}>{adminCount}</div>
        </div>
      </div>

      {/* ── Search & Filter Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by name, username, mobile, state..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Role:</label>
          <select
            className={styles.roleSelect}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="ALL">All Roles</option>
            <option value="CITIZEN">Citizens</option>
            <option value="DESK_CLERK">Desk Clerks</option>
            <option value="DISTRICT_OFFICER">District Officers</option>
            <option value="OFFICER">Officers</option>
            <option value="ADMIN">Administrators</option>
          </select>
        </div>
      </div>

      {/* ── Users Table ── */}
      <div className={styles.tableWrapper}>
        {isLoading ? (
          <div className={styles.loadingBox}>
            <RefreshCw size={24} className={styles.spin} color="#00355f" />
            <p>Loading application users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className={styles.emptyBox}>
            <Users size={36} color="#94a3b8" />
            <p>No users matching the selected filters found.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User ID</th>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Mobile Number</th>
                <th>State</th>
                <th>Nationality</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <span className={styles.idCell} title={user.id}>
                      {user.id.slice(0, 8)}…
                      <button
                        className={styles.copyBtn}
                        onClick={() => handleCopy(user.id)}
                        title="Copy User ID"
                      >
                        {copiedId === user.id ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                      </button>
                    </span>
                  </td>

                  <td>
                    <div className={styles.nameCell}>
                      <span className={styles.nameText}>{user.first_name || '—'}</span>
                      <span className={styles.usernameText}>@{user.username}</span>
                    </div>
                  </td>

                  <td>
                    <span className={styles.nameText}>{user.last_name || '—'}</span>
                  </td>

                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#334155' }}>
                      <Phone size={13} color="#64748b" />
                      {user.mobile_number || '—'}
                    </span>
                  </td>

                  <td>
                    <span className={styles.stateBadge}>
                      <MapPin size={12} />
                      {user.state || 'Maharashtra'}
                    </span>
                  </td>

                  <td>
                    <span className={styles.nationalityBadge}>
                      <Flag size={12} />
                      {user.nationality || 'Indian'}
                    </span>
                  </td>

                  <td>
                    <span className={`${styles.badge} ${getRoleBadgeClass(user.role)}`}>
                      {formatRoleLabel(user.role)}
                    </span>
                  </td>

                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.8rem', color: '#16a34a', fontWeight: 500 }}>
                      <span className={styles.activeDot} />
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Onboarding Registration Modal ── */}
      {showOnboardModal && (
        <div className={styles.modalOverlay} onClick={handleCloseOnboard}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleWrap}>
                <div className={styles.modalIcon}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 className={styles.modalTitle}>Onboard Service Officer</h2>
                  <p className={styles.modalSubtitle}>
                    Register a new Desk Clerk or District Officer assigned to a state jurisdiction.
                  </p>
                </div>
              </div>
              <button
                className={styles.modalCloseBtn}
                onClick={handleCloseOnboard}
                disabled={submitting}
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitOnboard}>
              <div className={styles.modalBody}>
                {formError && (
                  <div className={styles.errorBanner}>
                    <Shield size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Role Selector Cards */}
                <div>
                  <label className={styles.sectionHeading}>Select Officer Role</label>
                  <div className={styles.roleSelectorGrid}>
                    <div
                      className={`${styles.roleOptionCard} ${formData.role === 'DESK_CLERK' ? styles.roleOptionCardActive : ''}`}
                      onClick={() => setFormData({ ...formData, role: 'DESK_CLERK' })}
                    >
                      <div className={styles.roleCardHeader}>
                        <span className={styles.roleCardTitle}>Desk Clerk</span>
                        <span className={formData.role === 'DESK_CLERK' ? styles.roleBadgeClerk : ''} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                          {formData.role === 'DESK_CLERK' ? '✓ Selected' : ''}
                        </span>
                      </div>
                      <span className={styles.roleCardDesc}>
                        Assists citizens, verifies documents, and handles front-desk submissions.
                      </span>
                    </div>

                    <div
                      className={`${styles.roleOptionCard} ${formData.role === 'DISTRICT_OFFICER' ? styles.roleOptionCardActive : ''}`}
                      onClick={() => setFormData({ ...formData, role: 'DISTRICT_OFFICER' })}
                    >
                      <div className={styles.roleCardHeader}>
                        <span className={styles.roleCardTitle}>District Officer</span>
                        <span className={formData.role === 'DISTRICT_OFFICER' ? styles.roleBadgeOfficer : ''} style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                          {formData.role === 'DISTRICT_OFFICER' ? '✓ Selected' : ''}
                        </span>
                      </div>
                      <span className={styles.roleCardDesc}>
                        Oversees district applications, field escalations, and approval decisions.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Personal Information */}
                <div>
                  <label className={styles.sectionHeading}>Personal Information</label>
                  <div className={styles.formRow}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>First Name *</label>
                      <input
                        type="text"
                        required
                        className={styles.fieldInput}
                        placeholder="e.g. Ramesh"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Last Name *</label>
                      <input
                        type="text"
                        required
                        className={styles.fieldInput}
                        placeholder="e.g. Patil"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Account Credentials */}
                <div>
                  <label className={styles.sectionHeading}>Account Credentials</label>
                  <div className={styles.formRow}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Username *</label>
                      <input
                        type="text"
                        required
                        className={styles.fieldInput}
                        placeholder="e.g. clerk_ramesh"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Password *</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        className={styles.fieldInput}
                        placeholder="Min 6 characters"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Contact & Jurisdiction */}
                <div>
                  <label className={styles.sectionHeading}>Jurisdiction & Demographics</label>
                  <div className={styles.fieldGroup} style={{ marginBottom: 12 }}>
                    <label className={styles.fieldLabel}>Mobile Number</label>
                    <input
                      type="tel"
                      className={styles.fieldInput}
                      placeholder="+91 9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Assigned State *</label>
                      <select
                        className={styles.fieldSelect}
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      >
                        {INDIAN_STATES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Nationality</label>
                      <div className={styles.fixedNationalityWrap}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Flag size={14} color="#1d4ed8" />
                          <span>Indian</span>
                        </span>
                        <span className={styles.nationalityBadgeFixed}>
                          <Lock size={10} /> Fixed
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={handleCloseOnboard}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className={styles.spin} />
                      <span>Onboarding...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      <span>Complete Onboarding</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

