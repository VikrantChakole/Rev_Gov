import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import hi from './locales/hi.json'
import mr from './locales/mr.json'
import bn from './locales/bn.json'
import te from './locales/te.json'
import ta from './locales/ta.json'
import gu from './locales/gu.json'
import kn from './locales/kn.json'
import ml from './locales/ml.json'
import pa from './locales/pa.json'

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'mr', 'bn', 'te', 'ta', 'gu', 'kn', 'ml', 'pa']

export const LANGUAGE_NAMES = {
  en: 'English',
  hi: 'हिन्दी',
  mr: 'मराठी',
  bn: 'বাংলা',
  te: 'తెలుగు',
  ta: 'தமிழ்',
  gu: 'ગુજરાતી',
  kn: 'ಕನ್ನಡ',
  ml: 'മലയാളം',
  pa: 'ਪੰਜਾਬੀ',
}

// BCP 47 locale codes for Web Speech STT and TTS
export const LANGUAGE_LOCALES = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
  bn: 'bn-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  pa: 'pa-IN',
}

// State to official/regional third language mapping
export const STATE_LANGUAGE_MAP = {
  Maharashtra: 'mr',
  'Andhra Pradesh': 'te',
  Telangana: 'te',
  'West Bengal': 'bn',
  Gujarat: 'gu',
  Karnataka: 'kn',
  'Tamil Nadu': 'ta',
  Kerala: 'ml',
  Punjab: 'pa',
  // Hindi speaking states:
  'Uttar Pradesh': 'hi',
  'Madhya Pradesh': 'hi',
  Bihar: 'hi',
  Rajasthan: 'hi',
  Haryana: 'hi',
  'Himachal Pradesh': 'hi',
  Jharkhand: 'hi',
  Chhattisgarh: 'hi',
  Uttarakhand: 'hi',
  Delhi: 'hi',
  Chandigarh: 'hi',
}

export function getStateLanguage(stateName) {
  if (!stateName) return null
  const normalized = String(stateName).trim().toLowerCase()
  for (const [state, lang] of Object.entries(STATE_LANGUAGE_MAP)) {
    if (state.toLowerCase() === normalized) {
      if (lang === 'en' || lang === 'hi') return null
      return lang
    }
  }
  return null
}

export function getLanguagesForState(stateName) {
  const base = ['en', 'hi']
  const thirdLang = getStateLanguage(stateName)
  if (thirdLang && !base.includes(thirdLang) && SUPPORTED_LANGUAGES.includes(thirdLang)) {
    return [...base, thirdLang]
  }
  return base
}

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  mr: { translation: mr },
  bn: { translation: bn },
  te: { translation: te },
  ta: { translation: ta },
  gu: { translation: gu },
  kn: { translation: kn },
  ml: { translation: ml },
  pa: { translation: pa },
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'revgov_lang',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
  })

/**
 * Universal translation function supporting:
 * 1. t('common.submit') -> uses active i18n language
 * 2. t('common.welcome', { name: 'Ramesh' }) -> with interpolation
 * 3. Legacy: t('hi', 'common.submit') -> backward compatibility with older code
 */
export function t(arg1, arg2, arg3) {
  if (typeof arg1 === 'string' && SUPPORTED_LANGUAGES.includes(arg1) && typeof arg2 === 'string') {
    return i18n.t(arg2, { lng: arg1, ...(arg3 || {}) })
  }
  return i18n.t(arg1, arg2)
}

export default i18n
