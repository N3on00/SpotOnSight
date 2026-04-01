import { persistSession } from '../stores/appState'

export function setSessionState(state, session) {
  state.session.token = String(session?.token || '')
  state.session.user = session?.user && typeof session.user === 'object' ? session.user : null
}

export function applySession(state, session) {
  setSessionState(state, session)
  persistSession(state)
}

export function clearSession(state) {
  state.session.token = ''
  state.session.user = null
  state.favorites = []
  state.notifications = []
  state.notificationLog = []
  persistSession(state)
}

export function setSpots(state, spots) {
  state.spots = Array.isArray(spots) ? spots : []
}

export function setFavorites(state, favoriteIds) {
  state.favorites = Array.isArray(favoriteIds) ? favoriteIds : []
}

export function addFavorite(state, spotId) {
  const id = String(spotId || '').trim()
  if (!id) return
  if (!Array.isArray(state.favorites)) {
    state.favorites = []
  }
  if (!state.favorites.includes(id)) {
    state.favorites.push(id)
  }
}

export function removeFavorite(state, spotId) {
  const id = String(spotId || '').trim()
  state.favorites = Array.isArray(state.favorites)
    ? state.favorites.filter((entry) => String(entry || '') !== id)
    : []
}

export function setAdminReports(state, reports) {
  state.admin.reports = Array.isArray(reports) ? reports : []
}

export function upsertAdminReport(state, report) {
  if (!report?.id) return
  state.admin.reports = Array.isArray(state.admin.reports)
    ? state.admin.reports.map((item) => item.id === report.id ? report : item)
    : [report]
}

export function setAdminUsers(state, users) {
  state.admin.users = Array.isArray(users) ? users : []
}

export function upsertAdminUser(state, user) {
  if (!user?.id) return
  state.admin.users = Array.isArray(state.admin.users)
    ? state.admin.users.map((item) => item.id === user.id ? user : item)
    : [user]
}

export function setSupportTickets(state, tickets) {
  state.admin.supportTickets = Array.isArray(tickets) ? tickets : []
}

export function setDashboardSocial(state, { followers = [], following = [], incomingRequests = [], blockedUsers = [] } = {}) {
  state.social.followers = Array.isArray(followers) ? followers : []
  state.social.following = Array.isArray(following) ? following : []
  state.social.incomingRequests = Array.isArray(incomingRequests) ? incomingRequests : []
  state.social.blockedUsers = Array.isArray(blockedUsers) ? blockedUsers : []
  state.social.followersCount = state.social.followers.length
  state.social.followingCount = state.social.following.length
}

export function resetDashboardSocial(state) {
  setDashboardSocial(state, {})
}

export function setActivitySocial(state, { followers = [], incomingRequests = [], moderationNotifications = [] } = {}) {
  state.social.followers = Array.isArray(followers) ? followers : []
  state.social.followersCount = state.social.followers.length
  state.social.incomingRequests = Array.isArray(incomingRequests) ? incomingRequests : []
  state.social.moderationNotifications = Array.isArray(moderationNotifications) ? moderationNotifications : []
}

export function setFilterSubscriptions(state, subscriptions) {
  state.map.filterSubscriptions = Array.isArray(subscriptions) ? subscriptions : []
}

export function setTheme(state, theme) {
  state.ui.theme = String(theme || 'light') === 'dark' ? 'dark' : 'light'
}

export function pushNotification(state, entry) {
  if (!Array.isArray(state.notificationLog)) {
    state.notificationLog = []
  }
  state.notificationLog.push(entry)
  if (state.notificationLog.length > 200) {
    state.notificationLog = state.notificationLog.slice(-200)
  }
  if (!Array.isArray(state.notifications)) {
    state.notifications = []
  }
  state.notifications.push(entry)
}

export function removeNotification(state, id) {
  state.notifications = Array.isArray(state.notifications)
    ? state.notifications.filter((entry) => entry.id !== id)
    : []
}

export function clearNotificationLog(state) {
  state.notificationLog = []
}

export function setProfileState(state, { profile = null, createdSpots = [], favoriteSpots = [], viewedUserId = '', following = [] } = {}) {
  state.profile.current = profile
  state.profile.createdSpots = Array.isArray(createdSpots) ? createdSpots : []
  state.profile.favoriteSpots = Array.isArray(favoriteSpots) ? favoriteSpots : []
  state.profile.viewedUserId = String(viewedUserId || '').trim()
  state.social.following = Array.isArray(following) ? following : []
}

export function clearProfileState(state) {
  setProfileState(state, {})
}

export function setSocialMeetupState(state, { meetups = [], meetupInvites = [], searchResults = null } = {}) {
  if (searchResults !== null) {
    state.social.searchResults = Array.isArray(searchResults) ? searchResults : []
  }
  state.social.meetups = Array.isArray(meetups) ? meetups : []
  state.social.meetupInvites = Array.isArray(meetupInvites) ? meetupInvites : []
}

export function clearMeetupCreationSpot(state) {
  state.map.meetupCreationSpot = null
}

export function setMeetupCreationSpot(state, spot) {
  state.map.meetupCreationSpot = spot && typeof spot === 'object' ? spot : null
}

export function setSocialSearchResults(state, searchResults) {
  state.social.searchResults = Array.isArray(searchResults) ? searchResults : []
}

export function ensureLoadingKey(state, key) {
  if (!key) return
  if (!(key in state.loading)) {
    state.loading[key] = false
  }
  if (!state.loadingCounts) {
    state.loadingCounts = {}
  }
  if (!(key in state.loadingCounts)) {
    state.loadingCounts[key] = 0
  }
}

export function beginLoadingState(state, key) {
  if (!key) return
  ensureLoadingKey(state, key)
  state.loadingCounts[key] += 1
  state.loading[key] = true
}

export function endLoadingState(state, key) {
  if (!key) return
  ensureLoadingKey(state, key)
  state.loadingCounts[key] = Math.max(0, (state.loadingCounts[key] || 0) - 1)
  state.loading[key] = state.loadingCounts[key] > 0
}
