import { reactive } from 'vue'
import { webStorage } from '../services/webStorage'
import {
  loadFilterSubscriptionsForUser,
  loadSessionFromStorage,
  loadThemeFromStorage,
  persistFilterSubscriptionsToStorage,
  persistSessionToStorage,
  persistThemeToStorage,
} from './persistence'

export function createAppState() {
  const session = loadSessionFromStorage(webStorage)
  const theme = loadThemeFromStorage(webStorage)
  const filterSubscriptions = loadFilterSubscriptionsForUser(webStorage, session.user?.id, { allowLegacy: true })
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
  persistSessionToStorage(webStorage, state)
}

export function persistTheme(state) {
  persistThemeToStorage(webStorage, state?.ui?.theme)
}

export function persistFilterSubscriptions(state) {
  const ownerUserId = String(state?.session?.user?.id || '').trim()
  if (!ownerUserId) return

  const subs = Array.isArray(state?.map?.filterSubscriptions)
    ? state.map.filterSubscriptions
    : []

  persistFilterSubscriptionsToStorage(webStorage, ownerUserId, subs)
}

export function syncUserFilterSubscriptions(state) {
  const ownerUserId = String(state?.session?.user?.id || '').trim()
  state.map.filterSubscriptions = loadFilterSubscriptionsForUser(webStorage, ownerUserId, { allowLegacy: true })
}
