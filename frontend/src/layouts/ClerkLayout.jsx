import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  FileText,
  ScrollText,
  AlertTriangle,
  LogOut,
  MapPin,
  Building2,
  Menu,
} from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import useUIStore from '../store/uiStore'
import { logout } from '../api/auth'
import LanguageSwitcher from '../components/LanguageSwitcher/LanguageSwitcher'
import styles from './ClerkLayout.module.css'

export default function ClerkLayout() {
  const { t } = useTranslation()
  const { user, clearAuth } = useAuthStore()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const navigate = useNavigate()

  const clerkNavItems = [
    { to: '/clerk/dashboard',    icon: LayoutDashboard, label: t('clerk.navDashboard', 'Dashboard') },
    { to: '/clerk/applications', icon: FileText,        label: t('clerk.navApplications', 'Applications') },
    { to: '/clerk/audit',        icon: ScrollText,      label: t('clerk.navAuditLogs', 'Audit Logs') },
    { to: '/clerk/escalations',  icon: AlertTriangle,   label: t('clerk.navEscalations', 'Escalations') },
  ]

  useEffect(() => {
    document.body.className = 'admin-theme'
    return () => { document.body.className = '' }
  }, [])

  useEffect(() => {
    const handler = () => {
      clearAuth()
      toast.error('Session expired. Please login again.')
      navigate('/officer/login')
    }
    window.addEventListener('auth:expired', handler)
    return () => window.removeEventListener('auth:expired', handler)
  }, [clearAuth, navigate])

  const handleLogout = async () => {
    try { await logout() } catch (_) {}
    clearAuth()
    toast.success('Logged out successfully')
    navigate('/officer/login')
  }

  const assignedState = user?.state || 'Maharashtra'
  const displayName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user?.username || 'Desk Clerk')

  return (
    <div className={styles.shell}>
      {/* ── SIDEBAR ── */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : styles.collapsed}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.emblemBadge}>
            <Building2 size={24} color="#ffffff" />
          </div>
          {sidebarOpen && (
            <div className={styles.brandGroup}>
              <span className={styles.brandTitle}>RevenueGov</span>
              <span className={styles.brandSub}>{t('clerk.deskClerkPortal', 'Desk Clerk Portal')}</span>
            </div>
          )}
        </div>

        {/* Clerk Jurisdiction Banner */}
        {sidebarOpen && (
          <div className={styles.jurisdictionPill}>
            <MapPin size={13} color="#15803d" />
            <span className={styles.jurisdictionText}>{t('clerk.jurisdictionState', { state: assignedState, defaultValue: `${assignedState} Jurisdiction` })}</span>
          </div>
        )}

        <nav className={styles.nav}>
          {clerkNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <Icon size={18} className={styles.navIcon} />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button className={styles.navItem} onClick={handleLogout}>
            <LogOut size={18} className={styles.navIcon} />
            {sidebarOpen && <span>{t('clerk.signOut', 'Sign Out')}</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              className={styles.menuBtn}
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>
            <span className={styles.topbarHeading}>{t('clerk.frontDeskHeading', 'Department of Revenue — Citizen Front-Desk Operations')}</span>
          </div>

          <div className={styles.topbarRight}>
            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* State jurisdiction indicator */}
            <div className={styles.stateIndicator}>
              <MapPin size={14} color="#15803d" />
              <span>{t('clerk.stateIndicator', { state: assignedState, defaultValue: `${assignedState} State` })}</span>
            </div>

            <div className={styles.userBadge}>
              <span className={styles.userRole}>{t('clerk.deskClerkRole', 'DESK CLERK')}</span>
              <span className={styles.userName}>{displayName}</span>
            </div>
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
