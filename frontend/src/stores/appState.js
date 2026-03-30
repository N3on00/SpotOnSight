import { reactive } from 'vue'
import { normalizeUser } from '../models/userMapper'
import { normalizeFilterSubscription } from '../models/spotSubscriptions'

const SESSION_KEY = 'sos_web_session_v1'
const THEME_KEY = 'sos_web_theme_v1'
const LEGACY_FILTER_SUBSCRIPTIONS_KEY = 'sos_map_filter_subscriptions_v1'
const FILTER_SUBSCRIPTIONS_KEY_PREFIX = 'sos_map_filter_subscriptions_v2'

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) {
      return { token: '', user: null }
    }
    const parsed = JSON.parse(raw)
    return {
      token: typeof parsed.token === 'string' ? parsed.token : '',
      user: parsed.user && typeof parsed.user === 'object' ? normalizeUser(parsed.user) : null,
    }
  } catch {
    return { token: '', user: null }
  }
}

function loadTheme() {
  try {
    const raw = String(localStorage.getItem(THEME_KEY) || '').trim().toLowerCase()
    if (raw === 'dark') return 'dark'
    return 'light'
  } catch {
    return 'light'
  }
}

function normalizeFilterSubscriptionsForUser(parsed, userId) {
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

function filterSubscriptionsStorageKey(userId) {
  return `${FILTER_SUBSCRIPTIONS_KEY_PREFIX}:${String(userId || '').trim()}`
}

function loadFilterSubscriptionsForUser(userId) {
  const ownerUserId = String(userId || '').trim()
  if (!ownerUserId) return []

  try {
    const storageKey = filterSubscriptionsStorageKey(ownerUserId)
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const parsed = JSON.parse(raw)
      return normalizeFilterSubscriptionsForUser(parsed, ownerUserId)
    }

    const legacyRaw = localStorage.getItem(LEGACY_FILTER_SUBSCRIPTIONS_KEY)
    if (!legacyRaw) return []

    const legacyParsed = JSON.parse(legacyRaw)
    const migrated = normalizeFilterSubscriptionsForUser(legacyParsed, ownerUserId)
    localStorage.setItem(storageKey, JSON.stringify(migrated))
    localStorage.removeItem(LEGACY_FILTER_SUBSCRIPTIONS_KEY)
    return migrated
  } catch {
    return []
  }
}

export function createAppState() {
  const session = loadSession()
  const theme = loadTheme()
  const filterSubscriptions = loadFilterSubscriptionsForUser(session.user?.id)
  return reactive({
    config: {
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
      supportEmail: import.meta.env.VITE_SUPPORT_EMAIL || 'support@spotonsight.app',
    },
    session,
    spots: [],
    favorites: [],
    notifications: [],
    notificationLog: [],
    loading: {
      authLogin: false,
      authRegister: false,
      adminLoad: false,
      adminAction: false,
      homeRefresh: false,
      socialReload: false,
      socialFollow: false,
      socialUnfollow: false,
      socialSearch: false,
      socialMeetups: false,
      socialMeetupMutate: false,
      mapReload: false,
      mapSave: false,
      mapDelete: false,
      mapFavorite: false,
      mapShare: false,
      settingsLoad: false,
      settingsSave: false,
      profileLoad: false,
      supportSubmit: false,
    },
    loadingCounts: {},
    social: {
      followersCount: 0,
      followingCount: 0,
      followers: [],
      following: [],
      searchResults: [],
      incomingRequests: [],
      blockedUsers: [],
      meetups: [],
      meetupInvites: [],
      moderationNotifications: [],
    },
    admin: {
      reports: [],
      users: [],
      supportTickets: [],
    },
    map: {
      center: [47.3769, 8.5417],
      zoom: 12,
      draftLat: null,
      draftLon: null,
      filterSubscriptions,
      nearRadiusKm: 25,
      meetupCreationSpot: null,
    },
    profile: {
      current: null,
      createdSpots: [],
      favoriteSpots: [],
      viewedUserId: '',
    },
    ui: {
      theme,
      activeScreen: '',
      backendRequestCount: 0,
    },
  })
}

export function persistSession(state) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      token: state.session.token,
      user: state.session.user,
    }),
  )
}

export function persistTheme(state) {
  localStorage.setItem(THEME_KEY, String(state?.ui?.theme || 'light'))
}

export function persistFilterSubscriptions(state) {
  const ownerUserId = String(state?.session?.user?.id || '').trim()
  if (!ownerUserId) return

  const subs = Array.isArray(state?.map?.filterSubscriptions)
    ? state.map.filterSubscriptions
    : []

  const normalized = normalizeFilterSubscriptionsForUser(subs, ownerUserId)
  localStorage.setItem(
    filterSubscriptionsStorageKey(ownerUserId),
    JSON.stringify(normalized),
  )
}

export function syncUserFilterSubscriptions(state) {
  const ownerUserId = String(state?.session?.user?.id || '').trim()
  state.map.filterSubscriptions = loadFilterSubscriptionsForUser(ownerUserId)
}
