export function resetAuthenticatedState(state) {
  state.session.token = ''
  state.session.user = null
  state.spots = []
  state.favorites = []
  state.notifications = []
  state.notificationLog = []

  for (const key of Object.keys(state.loading || {})) {
    state.loading[key] = false
  }
  state.loadingCounts = {}

  state.social.followersCount = 0
  state.social.followingCount = 0
  state.social.followers = []
  state.social.following = []
  state.social.searchResults = []
  state.social.incomingRequests = []
  state.social.blockedUsers = []
  state.social.meetups = []
  state.social.meetupInvites = []

  state.profile.current = null
  state.profile.createdSpots = []
  state.profile.favoriteSpots = []
  state.profile.viewedUserId = ''

  if (state.ui && typeof state.ui === 'object') {
    state.ui.backendRequestCount = 0
  }
}
