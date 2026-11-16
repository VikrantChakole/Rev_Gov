import { useState } from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../store/authStore'
import LanguageSwitcher from '../components/LanguageSwitcher/LanguageSwitcher'
import styles from './PublicLayout.module.css'

export default function PublicLayout() {
  const { t } = useTranslation()
  const navigate  = useNavigate()
  const { isCitizenAuthenticated, citizenUser } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className={styles.page}>
      {/* ═══ TOP NAVIGATION BAR ═══ */}
      <header className={styles.topbar}>
        <Link to="/" className={styles.brand}>
          <div className={styles.brandIcon}>
            <span className="material-symbols-outlined">account_balance</span>
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>RevenueGov</span>
            <span className={styles.brandTagline}>{t('header.brandTagline', 'Government Services')}</span>
          </div>
        </Link>

        {/* Desktop right section */}
        <div className={styles.navRight}>
          {/* Dynamic Language switcher */}
          <LanguageSwitcher />

          {/* Auth buttons */}
          {isCitizenAuthenticated ? (
            <button
              className={styles.dashboardBtn}
              onClick={() => navigate('/dashboard')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>dashboard</span>
              {t('navigation.myDashboard', 'My Dashboard')}
            </button>
          ) : (
            <>
              <button
                className={styles.loginBtn}
                onClick={() => navigate('/login')}
              >
                {t('authentication.signIn', 'Sign In')}
              </button>
              <button
                className={styles.registerBtn}
                onClick={() => navigate('/login?tab=register')}
              >
                {t('authentication.register', 'Register')}
              </button>
              <Link to="/officer/login" className={styles.officerNavBtn}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>badge</span>
                {t('navigation.officerPortal', 'Service Officers')}
              </Link>
              <Link to="/admin/login" className={styles.adminNavBtn}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>admin_panel_settings</span>
                {t('navigation.adminPortal', 'Admin')}
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className={styles.menuBtn}
          onClick={() => setMenuOpen(v => !v)}
          aria-label={t('accessibility.openMenu', 'Open menu')}
        >
          <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
        </button>
      </header>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <>
          <div className={styles.mobileOverlay} onClick={() => setMenuOpen(false)} />
          <div className={styles.mobileMenu}>
            <div className={styles.mobileLangRow}>
              <LanguageSwitcher onLanguageChange={() => setMenuOpen(false)} />
            </div>
            {isCitizenAuthenticated ? (
              <button
                className={`${styles.registerBtn} ${styles.mobileFullBtn}`}
                onClick={() => { navigate('/dashboard'); setMenuOpen(false) }}
              >
                {t('navigation.myDashboard', 'My Dashboard')}
              </button>
            ) : (
              <>
                <button
                  className={`${styles.loginBtn} ${styles.mobileFullBtn}`}
                  onClick={() => { navigate('/login'); setMenuOpen(false) }}
                >
                  {t('authentication.signInCitizen', 'Sign In (Citizen)')}
                </button>
                <button
                  className={`${styles.registerBtn} ${styles.mobileFullBtn}`}
                  onClick={() => { navigate('/login?tab=register'); setMenuOpen(false) }}
                >
                  {t('authentication.register', 'Register')}
                </button>
                <button
                  className={`${styles.officerNavBtn} ${styles.mobileFullBtn}`}
                  onClick={() => { navigate('/officer/login'); setMenuOpen(false) }}
                >
                  {t('authentication.officerLogin', 'Service Officers Login')}
                </button>
                <button
                  className={`${styles.adminNavBtn} ${styles.mobileFullBtn}`}
                  onClick={() => { navigate('/admin/login'); setMenuOpen(false) }}
                >
                  {t('navigation.adminPortal', 'Admin Portal')}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Page content */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
