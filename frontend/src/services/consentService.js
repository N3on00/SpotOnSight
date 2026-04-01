import { webStorage } from './webStorage'

const CONSENT_STORAGE_KEY = 'sos_consent'

const CONSENT_DEFAULTS = {
  locationConsent: false,
  locationConsentTimestamp: null,
  cookieConsent: false,
  cookieConsentTimestamp: null,
}

export function loadConsentState() {
  try {
    const raw = webStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return { ...CONSENT_DEFAULTS }
    const parsed = JSON.parse(raw)
    return {
      locationConsent: Boolean(parsed.locationConsent),
      locationConsentTimestamp: parsed.locationConsentTimestamp || null,
      cookieConsent: Boolean(parsed.cookieConsent),
      cookieConsentTimestamp: parsed.cookieConsentTimestamp || null,
    }
  } catch {
    return { ...CONSENT_DEFAULTS }
  }
}

function saveConsentState(state) {
  try {
    webStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

export function setLocationConsent(granted) {
  const state = loadConsentState()
  state.locationConsent = granted
  state.locationConsentTimestamp = granted ? Date.now() : null
  saveConsentState(state)
  return state
}

export function setCookieConsent(granted) {
  const state = loadConsentState()
  state.cookieConsent = granted
  state.cookieConsentTimestamp = granted ? Date.now() : null
  saveConsentState(state)
  return state
}

export function hasLocationConsent() {
  return loadConsentState().locationConsent
}

export function hasCookieConsent() {
  return loadConsentState().cookieConsent
}

export function getConsentState() {
  return loadConsentState()
}

export function clearAllConsent() {
  webStorage.removeItem(CONSENT_STORAGE_KEY)
}