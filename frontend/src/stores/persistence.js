import { normalizeFilterSubscription } from '../models/spotSubscriptions'
import { normalizeUser } from '../models/userMapper'

export const SESSION_KEY = 'sos_web_session_v1'
export const THEME_KEY = 'sos_web_theme_v1'
export const LEGACY_FILTER_SUBSCRIPTIONS_KEY = 'sos_map_filter_subscriptions_v1'
export const FILTER_SUBSCRIPTIONS_KEY_PREFIX = 'sos_map_filter_subscriptions_v2'

function parseJson(value, fallback) {
  try {
    return JSON.parse(String(value || ''))
  } catch {
    return fallback
  }
}

export function normalizeStoredSession(rawValue) {
  const parsed = parseJson(rawValue, null)
  if (!parsed || typeof parsed !== 'object') {
    return { token: '', user: null }
  }

  return {
    token: typeof parsed.token === 'string' ? parsed.token : '',
    user: parsed.user && typeof parsed.user === 'object' ? normalizeUser(parsed.user) : null,
  }
}

export function normalizeStoredTheme(rawValue) {
  return String(rawValue || '').trim().toLowerCase() === 'dark' ? 'dark' : 'light'
}

export function normalizeFilterSubscriptionsForUser(parsed, userId) {
  if (!Array.isArray(parsed)) return []

  const ownerUserId = String(userId || '').trim()
  if (!ownerUserId) return []

  return parsed
    .map((entry) => normalizeFilterSubscription(entry))
    .filter(Boolean)
    .map((entry) => {
      const owner = String(entry.ownerUserId || '').trim()
      if (owner && owner !== ownerUserId) {
        return null
      }
      return {
        ...entry,
        ownerUserId,
      }
    })
    .filter(Boolean)
}

export function filterSubscriptionsStorageKey(userId) {
  return `${FILTER_SUBSCRIPTIONS_KEY_PREFIX}:${String(userId || '').trim()}`
}

export function loadSessionFromStorage(storage) {
  return normalizeStoredSession(storage.getItem(SESSION_KEY))
}

export function loadThemeFromStorage(storage) {
  return normalizeStoredTheme(storage.getItem(THEME_KEY))
}

export function loadFilterSubscriptionsForUser(storage, userId, { allowLegacy = false } = {}) {
  const ownerUserId = String(userId || '').trim()
  if (!ownerUserId) return []

  const storageKey = filterSubscriptionsStorageKey(ownerUserId)
  const raw = storage.getItem(storageKey)
  if (raw) {
    return normalizeFilterSubscriptionsForUser(parseJson(raw, []), ownerUserId)
  }

  if (!allowLegacy) {
    return []
  }

  const legacyRaw = storage.getItem(LEGACY_FILTER_SUBSCRIPTIONS_KEY)
  if (!legacyRaw) return []

  const migrated = normalizeFilterSubscriptionsForUser(parseJson(legacyRaw, []), ownerUserId)
  storage.setItem(storageKey, JSON.stringify(migrated))
  storage.removeItem(LEGACY_FILTER_SUBSCRIPTIONS_KEY)
  return migrated
}

export async function loadFilterSubscriptionsForUserAsync(storage, userId, { allowLegacy = false } = {}) {
  const ownerUserId = String(userId || '').trim()
  if (!ownerUserId) return []

  const storageKey = filterSubscriptionsStorageKey(ownerUserId)
  const raw = await storage.getItem(storageKey)
  if (raw) {
    return normalizeFilterSubscriptionsForUser(parseJson(raw, []), ownerUserId)
  }

  if (!allowLegacy) {
    return []
  }

  const legacyRaw = await storage.getItem(LEGACY_FILTER_SUBSCRIPTIONS_KEY)
  if (!legacyRaw) return []

  const migrated = normalizeFilterSubscriptionsForUser(parseJson(legacyRaw, []), ownerUserId)
  await storage.setItem(storageKey, JSON.stringify(migrated))
  await storage.removeItem(LEGACY_FILTER_SUBSCRIPTIONS_KEY)
  return migrated
}

export function persistSessionToStorage(storage, state) {
  storage.setItem(
    SESSION_KEY,
    JSON.stringify({
      token: state.session.token,
      user: state.session.user,
    }),
  )
}

export function persistThemeToStorage(storage, theme) {
  storage.setItem(THEME_KEY, normalizeStoredTheme(theme))
}

export function persistFilterSubscriptionsToStorage(storage, ownerUserId, subscriptions) {
  const normalizedOwnerUserId = String(ownerUserId || '').trim()
  if (!normalizedOwnerUserId) return

  const normalized = normalizeFilterSubscriptionsForUser(subscriptions, normalizedOwnerUserId)
  storage.setItem(
    filterSubscriptionsStorageKey(normalizedOwnerUserId),
    JSON.stringify(normalized),
  )
}

export async function persistFilterSubscriptionsToStorageAsync(storage, ownerUserId, subscriptions) {
  const normalizedOwnerUserId = String(ownerUserId || '').trim()
  if (!normalizedOwnerUserId) return

  const normalized = normalizeFilterSubscriptionsForUser(subscriptions, normalizedOwnerUserId)
  await storage.setItem(
    filterSubscriptionsStorageKey(normalizedOwnerUserId),
    JSON.stringify(normalized),
  )
}
