import { useState, useEffect, useRef } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../store/authStore'
import useChatStore from '../store/chatStore'
import { RightPanelProvider, useRightPanel } from './RightPanelContext'
import NewApplicationModal from '../components/NewApplicationModal/NewApplicationModal'
import { applicationsApi } from '../api/applications'
import LanguageSwitcher from '../components/LanguageSwitcher/LanguageSwitcher'
import styles from './CitizenDashboardLayout.module.css'

const CITIZEN_NAV = [
  { to: '/dashboard',    icon: 'dashboard',     key: 'dashboard',   label: 'Dashboard'    },
  { to: '/assistant',    icon: 'smart_toy',     key: 'assistant',   label: 'Assistant'    },
  { to: '/form-filling', icon: 'edit_document', key: 'formFilling', label: 'Form Filling' },
  { to: '/documents',    icon: 'folder_open',   key: 'documents',   label: 'Documents'    },
  { to: '/profile',      icon: 'person',        key: 'profile',     label: 'Profile'      },
]

const MOBILE_NAV = [
  { to: '/dashboard',    icon: 'dashboard',     key: 'dashboard',   label: 'Dashboard'  },
  { to: '/assistant',    icon: 'smart_toy',     key: 'assistant',   label: 'Assistant'  },
  { to: '/form-filling', icon: 'edit_document', key: 'formFilling', label: 'Form Fill'  },
  { to: '/documents',    icon: 'folder_open',   key: 'documents',   label: 'Docs'       },
  { to: '/profile',      icon: 'person',        key: 'profile',     label: 'Profile'    },
]

function initials(name) {
  if (!name) return 'C'
  return name.trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

/* Inner shell that reads the right panel context */
function DashboardShell() {
  const { t } = useTranslation()
  const location  = useLocation()
  const navigate  = useNavigate()
  const { isCitizenAuthenticated, citizenUser, clearCitizenAuth } = useAuthStore()
  const { panelContent, panelTitle } = useRightPanel()

  const [sidebarOpen,   setSidebarOpen]   = useState(false)
  const [rightOpen,     setRightOpen]     = useState(false)
  const [collapsed,     setCollapsed]     = useState(false)  // icon-only mode
  const [isNewAppModalOpen, setIsNewAppModalOpen] = useState(false)

  // Apply theme class
  useEffect(() => {
    document.body.className = 'citizen-theme'
    return () => { document.body.className = '' }
  }, [])

  // Close drawers on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false)
    setRightOpen(false)
  }, [location.pathname])

  const isActive = (to) => {
    if (to === '/form-filling') {
      return (
        location.pathname === '/form-filling' ||
        location.pathname.startsWith('/applications/manual-form') ||
        location.pathname.startsWith('/applications/automated-form')
      )
    }
    return to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
  }

  const handleLogout = () => {
    clearCitizenAuth()
    useChatStore.getState().reset()
    navigate('/')
  }

  const handleNavClick = async (e, to) => {
    if (to === '/form-filling') {
      e.preventDefault()
      try {
        const res = await applicationsApi.getActiveDraft()
        if (res?.has_draft && res.draft?.id) {
          navigate(`/applications/manual-form/${res.draft.id}?service=${res.draft.service_id || 'caste_certificate'}`)
          return
        }
      } catch (err) {
        console.warn('Draft check error on nav click:', err)
      }
      navigate('/form-filling')
    }
  }

  const isFullWidthPage = 
    location.pathname === '/dashboard' || 
    location.pathname === '/form-filling' || 
    location.pathname.startsWith('/applications/manual-form') ||
    location.pathname.startsWith('/applications/automated-form')

  return (
    <div className={`${styles.shell} ${collapsed ? styles.collapsed : ''} ${isFullWidthPage ? styles.fullWidthMain : ''}`}>

      {/* ══════ LEFT SIDEBAR ══════ */}
      {sidebarOpen && (
        <div className={styles.mobileOverlay} onClick={() => setSidebarOpen(false)} />
      )}

      <nav className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        {/* Logo row */}
        <div className={styles.sidebarLogo}>
          <div className={styles.sidebarLogoIcon}>
            <span className="material-symbols-outlined">account_balance</span>
          </div>
          {!collapsed && (
            <div className={styles.sidebarBrandWrap}>
              <div className={styles.sidebarBrandName}>RevenueGov</div>
              <div className={styles.sidebarBrandTag}>{t('header.brandTagline', 'Government Services')}</div>
            </div>
          )}
          {/* Collapse toggle — desktop only */}
          <button
            className={styles.collapseBtn}
            onClick={() => setCollapsed(v => !v)}
            title={collapsed ? t('accessibility.expandSidebar', 'Expand sidebar') : t('accessibility.collapseSidebar', 'Collapse sidebar')}
          >
            <span className="material-symbols-outlined">
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        </div>

        {/* New Application CTA */}
        <button
          type="button"
          onClick={() => setIsNewAppModalOpen(true)}
          className={`${styles.newAppBtn} ${collapsed ? styles.newAppBtnCollapsed : ''}`}
          title={t('application.newApplication', 'New Application')}
        >
          <span className="material-symbols-outlined">add</span>
          {!collapsed && <span>{t('application.newApplication', 'New Application')}</span>}
        </button>

        {/* Nav links */}
        <ul className={styles.navList}>
          {CITIZEN_NAV.map(({ to, icon, key, label }) => (
            <li key={to}>
              <Link
                to={to}
                onClick={(e) => handleNavClick(e, to)}
                className={`${styles.navItem} ${isActive(to) ? styles.navActive : ''}`}
                title={t(`navigation.${key}`, label)}
              >
                <span
                  className="material-symbols-outlined"
                  style={isActive(to) ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {icon}
                </span>
                {!collapsed && <span className={styles.navLabel}>{t(`navigation.${key}`, label)}</span>}
              </Link>
            </li>
          ))}
        </ul>

        {/* Bottom profile */}
        {isCitizenAuthenticated && (
          <div className={styles.sidebarProfile}>
            {!collapsed ? (
              <>
                <div className={styles.profileRow} onClick={() => navigate('/profile')}>
                  <div className={styles.profileAvatar}>
                    {initials(citizenUser?.name || citizenUser?.citizen_id)}
                  </div>
                  <div className={styles.profileInfo}>
                    <div className={styles.profileName}>
                      {citizenUser?.name || t('profile.citizenAccount', 'Citizen Account')}
                    </div>
                    <div className={styles.profileId}>{citizenUser?.citizen_id}</div>
                  </div>
                  <span className={`material-symbols-outlined ${styles.profileChevron}`}>
                    chevron_right
                  </span>
                </div>
                <button className={styles.logoutBtn} onClick={handleLogout}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>logout</span>
                  {t('authentication.signOut', 'Sign Out')}
                </button>
              </>
            ) : (
              <button
                className={styles.profileAvatarSmall}
                onClick={() => navigate('/profile')}
                title={citizenUser?.name || 'Profile'}
              >
                {initials(citizenUser?.name || citizenUser?.citizen_id)}
              </button>
            )}
          </div>
        )}
      </nav>

      {/* ══════ MAIN CONTENT ══════ */}
      <div className={styles.contentWrap}>

        {/* Desktop top header bar */}
        <header className={styles.desktopTopBar}>
          <div className={styles.desktopTopBarLeft}>
            <span className={styles.portalBadge}>
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>verified_user</span>
              {t('header.citizenServicesBadge', 'RevenueGov Citizen Services')}
            </span>
          </div>
          <div className={styles.desktopTopBarRight}>
            <LanguageSwitcher />
          </div>
        </header>

        {/* Mobile top bar */}
        <header className={styles.mobileTopBar}>
          <button
            className={styles.mobileMenuBtn}
            onClick={() => setSidebarOpen(v => !v)}
            aria-label={t('accessibility.openMenu', 'Open menu')}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <Link to="/" className={styles.mobileBrand}>RevenueGov</Link>
          <div className={styles.mobileTopActions}>
            <LanguageSwitcher compact={true} showStateSelector={false} />
            {panelContent && (
              <button
                className={styles.mobileContextBtn}
                onClick={() => setRightOpen(v => !v)}
                aria-label={t('accessibility.toggleContext', 'Toggle context')}
              >
                <span className="material-symbols-outlined">info</span>
              </button>
            )}
            {isCitizenAuthenticated && (
              <div
                className={styles.mobileAvatar}
                onClick={() => navigate('/profile')}
              >
                {initials(citizenUser?.name || citizenUser?.citizen_id)}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className={styles.main}>
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className={styles.mobileBottomNav}>
          {MOBILE_NAV.map(({ to, icon, key, label }) => (
            <Link
              key={to}
              to={to}
              onClick={(e) => handleNavClick(e, to)}
              className={`${styles.mobileNavTab} ${isActive(to) ? styles.mobileNavActive : ''}`}
            >
              <span
                className="material-symbols-outlined"
                style={isActive(to) ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {icon}
              </span>
              <span className={styles.mobileNavLabel}>{t(`navigation.${key}`, label)}</span>
            </Link>
          ))}
        </nav>
      </div>

      {/* ══════ RIGHT PANEL (desktop / tablet drawer) ══════ */}
      {!isFullWidthPage && panelContent && (
        <>
          {/* Desktop right panel */}
          <aside className={styles.rightPanel}>
            {panelTitle && (
              <div className={styles.rightPanelHeader}>
                <span className={styles.rightPanelTitle}>{panelTitle}</span>
              </div>
            )}
            <div className={styles.rightPanelBody}>
              {panelContent}
            </div>
          </aside>

          {/* Context toggle button — visible on small laptop only */}
          <button
            className={styles.contextToggleBtn}
            onClick={() => setRightOpen(v => !v)}
            title="Show context panel"
          >
            <span className="material-symbols-outlined">
              {rightOpen ? 'close' : 'chevron_left'}
            </span>
          </button>

          {/* Tablet/mobile right drawer */}
          {rightOpen && (
            <>
              <div className={styles.mobileOverlay} onClick={() => setRightOpen(false)} />
              <div className={styles.rightDrawer}>
                <div className={styles.bottomSheetHandle} />
                {panelTitle && (
                  <div className={styles.rightPanelHeader}>
                    <span className={styles.rightPanelTitle}>{panelTitle}</span>
                    <button onClick={() => setRightOpen(false)} className={styles.closeBtn}>
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                )}
                {panelContent}
              </div>
            </>
          )}
        </>
      )}
      {/* New Application Modal */}
      <NewApplicationModal
        isOpen={isNewAppModalOpen}
        onClose={() => setIsNewAppModalOpen(false)}
      />
    </div>
  )
}

export default function CitizenDashboardLayout() {
  return (
    <RightPanelProvider>
      <DashboardShell />
    </RightPanelProvider>
  )
}
