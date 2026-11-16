import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import useChatStore from '../../store/chatStore'
import useAuthStore from '../../store/authStore'
import {
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  getStateLanguage,
  getLanguagesForState,
} from '../../i18n'
import { INDIAN_STATES, STORAGE_KEYS } from '../../utils/constants'
import styles from './LanguageSwitcher.module.css'

export default function LanguageSwitcher({
  showStateSelector = true,
  compact = false,
  className = '',
  onLanguageChange,
}) {
  const { i18n } = useTranslation()
  const { language, setLanguage } = useChatStore()
  const { citizenUser, updateCitizenUser } = useAuthStore()

  // Active language from i18next (with fallback to chatStore or 'en')
  const currentLang = i18n.language || language || 'en'

  // Resolve current state
  const [userState, setUserState] = useState(() => {
    return citizenUser?.state || localStorage.getItem(STORAGE_KEYS.USER_STATE) || 'Maharashtra'
  })

  const [stateDropdownOpen, setStateDropdownOpen] = useState(false)
  const [allLangsOpen, setAllLangsOpen] = useState(false)

  const stateDropdownRef = useRef(null)
  const allLangsRef = useRef(null)

  // Synchronize chatStore and i18next if out of sync
  useEffect(() => {
    if (i18n.language && i18n.language !== language) {
      setLanguage(i18n.language)
    }
  }, [i18n.language])

  // Sync state if citizenUser state updates
  useEffect(() => {
    if (citizenUser?.state && citizenUser.state !== userState) {
      setUserState(citizenUser.state)
      localStorage.setItem(STORAGE_KEYS.USER_STATE, citizenUser.state)
    }
  }, [citizenUser?.state])

  // Listen to custom cross-component state change events
  useEffect(() => {
    const handleStateEvent = (e) => {
      if (e.detail?.state) {
        setUserState(e.detail.state)
      }
    }
    window.addEventListener('rsp_user_state_changed', handleStateEvent)
    return () => window.removeEventListener('rsp_user_state_changed', handleStateEvent)
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(e.target)) {
        setStateDropdownOpen(false)
      }
      if (allLangsRef.current && !allLangsRef.current.contains(e.target)) {
        setAllLangsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // State-specific 3rd language
  const thirdLang = getStateLanguage(userState)

  const handleSelectLanguage = (lang) => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) return
    i18n.changeLanguage(lang)
    setLanguage(lang)
    localStorage.setItem('revgov_lang', lang)
    if (onLanguageChange) onLanguageChange(lang)
    setAllLangsOpen(false)
  }

  const handleStateChange = (newState) => {
    setUserState(newState)
    localStorage.setItem(STORAGE_KEYS.USER_STATE, newState)
    if (updateCitizenUser) {
      updateCitizenUser({ state: newState })
    }
    window.dispatchEvent(new CustomEvent('rsp_user_state_changed', { detail: { state: newState } }))
    setStateDropdownOpen(false)

    // Automatically adapt regional 3rd language if appropriate
    const newLangs = getLanguagesForState(newState)
    if (!newLangs.includes(currentLang)) {
      const newThird = getStateLanguage(newState)
      const targetLang = newThird || 'en'
      handleSelectLanguage(targetLang)
    }
  }

  return (
    <div className={`${styles.switcherContainer} ${compact ? styles.compact : ''} ${className}`}>
      {/* ── 1. State Selector Dropdown ── */}
      {showStateSelector && (
        <div className={styles.stateSelectorWrap} ref={stateDropdownRef}>
          <button
            type="button"
            className={styles.statePill}
            onClick={() => setStateDropdownOpen((v) => !v)}
            title={`Assigned State: ${userState}. Click to change.`}
            aria-expanded={stateDropdownOpen}
            aria-haspopup="listbox"
          >
            <span className={styles.pinIcon}>📍</span>
            <span className={styles.stateName}>{userState}</span>
            <span className={styles.dropdownArrow}>{stateDropdownOpen ? '▲' : '▼'}</span>
          </button>

          {stateDropdownOpen && (
            <div className={styles.stateDropdownMenu} role="listbox">
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownTitle}>Select Citizen State</span>
                <span className={styles.dropdownSubtitle}>
                  Adapts regional language automatically
                </span>
              </div>
              <div className={styles.dropdownList}>
                {INDIAN_STATES.map((stateName) => {
                  const stateLang = getStateLanguage(stateName)
                  const isSelected = stateName.toLowerCase() === userState.toLowerCase()
                  return (
                    <button
                      key={stateName}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`${styles.dropdownOption} ${isSelected ? styles.optionSelected : ''}`}
                      onClick={() => handleStateChange(stateName)}
                    >
                      <span className={styles.optionStateName}>{stateName}</span>
                      {stateLang ? (
                        <span className={styles.optionLangBadge}>
                          {LANGUAGE_NAMES[stateLang]}
                        </span>
                      ) : (
                        <span className={styles.optionHindiBadge}>हिन्दी / Eng</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 2. Quick Language Buttons Group ── */}
      <div className={styles.langButtonGroup} role="group" aria-label="Quick Select Language">
        {/* Fixed: English */}
        <button
          type="button"
          className={`${styles.langBtn} ${currentLang === 'en' ? styles.langActive : ''}`}
          onClick={() => handleSelectLanguage('en')}
          title="Switch to English"
        >
          {LANGUAGE_NAMES['en']}
        </button>

        {/* Fixed: Hindi */}
        <button
          type="button"
          className={`${styles.langBtn} ${currentLang === 'hi' ? styles.langActive : ''}`}
          onClick={() => handleSelectLanguage('hi')}
          title="हिन्दी में बदलें (Hindi)"
        >
          {LANGUAGE_NAMES['hi']}
        </button>

        {/* Dynamic: State-Specific Language (if not en/hi) */}
        {thirdLang && thirdLang !== 'en' && thirdLang !== 'hi' && (
          <button
            type="button"
            className={`${styles.langBtn} ${styles.thirdLangBtn} ${
              currentLang === thirdLang ? styles.langActive : ''
            }`}
            onClick={() => handleSelectLanguage(thirdLang)}
            title={`Switch to ${LANGUAGE_NAMES[thirdLang]} (${userState})`}
          >
            <span className={styles.thirdLangText}>{LANGUAGE_NAMES[thirdLang]}</span>
            <span className={styles.stateTag}>{userState.slice(0, 2).toUpperCase()}</span>
          </button>
        )}
      </div>

      {/* ── 3. All 10 Languages Selector Dropdown ── */}
      <div className={styles.allLangsWrap} ref={allLangsRef}>
        <button
          type="button"
          className={`${styles.allLangsBtn} ${!['en', 'hi', thirdLang].includes(currentLang) ? styles.allLangsBtnActive : ''}`}
          onClick={() => setAllLangsOpen((v) => !v)}
          title="Select from all 10 official languages"
          aria-expanded={allLangsOpen}
          aria-haspopup="listbox"
        >
          <span className={styles.globeIcon}>🌐</span>
          <span className={styles.currentLangLabel}>
            {LANGUAGE_NAMES[currentLang] || 'Language'}
          </span>
          <span className={styles.dropdownArrow}>{allLangsOpen ? '▲' : '▼'}</span>
        </button>

        {allLangsOpen && (
          <div className={styles.allLangsMenu} role="listbox">
            <div className={styles.dropdownHeader}>
              <span className={styles.dropdownTitle}>Official Indian Languages (10)</span>
              <span className={styles.dropdownSubtitle}>
                Select your preferred native language
              </span>
            </div>
            <div className={styles.allLangsGrid}>
              {SUPPORTED_LANGUAGES.map((code) => {
                const isSelected = currentLang === code
                return (
                  <button
                    key={code}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`${styles.langOption} ${isSelected ? styles.langOptionSelected : ''}`}
                    onClick={() => handleSelectLanguage(code)}
                  >
                    <span className={styles.langNativeName}>{LANGUAGE_NAMES[code]}</span>
                    <span className={styles.langCodeBadge}>{code.toUpperCase()}</span>
                    {isSelected && <span className={styles.selectedCheck}>✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
