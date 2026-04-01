import {
  addFavorite,
  applySession,
  clearProfileState,
  clearSession,
  removeFavorite,
  resetDashboardSocial,
  setAdminReports,
  setAdminUsers,
  setDashboardSocial,
  setFavorites,
  setProfileState,
  setSpots,
  setSupportTickets,
  upsertAdminReport,
  upsertAdminUser,
} from '../state/appMutations'

function serviceLastError(ctx, serviceId) {
  const service = ctx.service(serviceId)
  return typeof service?.lastError === 'function' ? service.lastError() : ''
}

function bindServiceAction(ctx, serviceId, spec) {
  return async (...args) => {
    const service = ctx.service(serviceId)
    const result = await service[spec.method](...args)
    if (typeof spec.after === 'function') {
      return spec.after(ctx, result, args)
    }
    return result
  }
}

function createServiceActionSet(ctx, serviceId, specMap) {
  const actions = {}
  for (const [actionName, spec] of Object.entries(specMap)) {
    actions[actionName] = bindServiceAction(ctx, serviceId, spec)
  }
  actions.lastError = () => serviceLastError(ctx, serviceId)
  return actions
}

const AUTH_ACTION_SPECS = Object.freeze({
  login: Object.freeze({
    method: 'login',
    after(ctx, session) {
      if (!session) return false
      applySession(ctx.state, session)
      return true
    },
  }),
  register: Object.freeze({
    method: 'register',
    after(ctx, session) {
      if (!session) return false
      applySession(ctx.state, session)
      return true
    },
  }),
  logout: Object.freeze({
    method: 'logout',
    after(ctx) {
      clearSession(ctx.state)
    },
  }),
})

const USERS_ACTION_SPECS = Object.freeze({
  refreshProfile: Object.freeze({
    method: 'me',
    after(ctx, user) {
      if (!user) return false
      applySession(ctx.state, { token: ctx.state.session.token, user })
      return true
    },
  }),
  updateProfile: Object.freeze({
    method: 'updateMe',
    after(ctx, user) {
      if (!user) return false
      applySession(ctx.state, { token: ctx.state.session.token, user })
      return true
    },
  }),
  searchUsers: Object.freeze({ method: 'searchByUsername' }),
  friendDirectory: Object.freeze({ method: 'friendDirectory' }),
  searchFriends: Object.freeze({ method: 'searchFriends' }),
  profile: Object.freeze({ method: 'profile' }),
})

const SPOTS_ACTION_SPECS = Object.freeze({
  reload: Object.freeze({
    method: 'list',
    after(ctx, spots) {
      setSpots(ctx.state, spots)
      return spots
    },
  }),
  deleteSpot: Object.freeze({ method: 'delete' }),
  byUser: Object.freeze({ method: 'byUser' }),
  favoritesOfUser: Object.freeze({ method: 'favoritesOfUser' }),
})

const SOCIAL_ACTION_SPECS = Object.freeze({
  reloadFavorites: Object.freeze({
    method: 'loadFavorites',
    after(ctx, favorites) {
      setFavorites(ctx.state, favorites)
      return favorites
    },
  }),
  share: Object.freeze({ method: 'shareSpot' }),
  follow: Object.freeze({ method: 'followUser' }),
  unfollow: Object.freeze({ method: 'unfollowUser' }),
  removeFollower: Object.freeze({ method: 'removeFollower' }),
  incomingRequests: Object.freeze({ method: 'incomingFollowRequests' }),
  approveRequest: Object.freeze({ method: 'approveFollowRequest' }),
  rejectRequest: Object.freeze({ method: 'rejectFollowRequest' }),
  block: Object.freeze({ method: 'blockUser' }),
  unblock: Object.freeze({ method: 'unblockUser' }),
  blockedUsers: Object.freeze({ method: 'blockedUsers' }),
  followersOf: Object.freeze({ method: 'followersOf' }),
  followingOf: Object.freeze({ method: 'followingOf' }),
  reportContent: Object.freeze({ method: 'reportContent' }),
  moderationNotifications: Object.freeze({ method: 'moderationNotifications' }),
})

const SUPPORT_ACTION_SPECS = Object.freeze({
  submitTicket: Object.freeze({ method: 'createTicket' }),
  submitDebugTicket: Object.freeze({ method: 'createDebugTicket' }),
  listAdminTickets: Object.freeze({
    method: 'listAdminTickets',
    after(ctx, tickets) {
      setSupportTickets(ctx.state, tickets)
      return tickets
    },
  }),
})

const ADMIN_ACTION_SPECS = Object.freeze({
  loadReports: Object.freeze({
    method: 'loadReports',
    after(ctx, reports) {
      setAdminReports(ctx.state, reports)
      return reports
    },
  }),
  reviewReport: Object.freeze({
    method: 'reviewReport',
    after(ctx, report) {
      if (report) upsertAdminReport(ctx.state, report)
      return report
    },
  }),
  loadUsers: Object.freeze({
    method: 'loadUsers',
    after(ctx, users) {
      setAdminUsers(ctx.state, users)
      return users
    },
  }),
  updateUserStatus: Object.freeze({
    method: 'updateUserStatus',
    after(ctx, user) {
      if (user) upsertAdminUser(ctx.state, user)
      return user
    },
  }),
})

const COMMENTS_ACTION_SPECS = Object.freeze({
  listBySpot: Object.freeze({ method: 'getComments' }),
  create: Object.freeze({ method: 'createComment' }),
  update: Object.freeze({ method: 'updateComment' }),
  delete: Object.freeze({ method: 'deleteComment' }),
})

const MEETUPS_ACTION_SPECS = Object.freeze({
  list: Object.freeze({ method: 'list' }),
  create: Object.freeze({ method: 'create' }),
  update: Object.freeze({ method: 'update' }),
  remove: Object.freeze({ method: 'remove' }),
  listInvites: Object.freeze({ method: 'listInvites' }),
  respond: Object.freeze({ method: 'respond' }),
  listComments: Object.freeze({ method: 'listComments' }),
  createComment: Object.freeze({ method: 'createComment' }),
  updateComment: Object.freeze({ method: 'updateComment' }),
  deleteComment: Object.freeze({ method: 'deleteComment' }),
})

export function createAuthActions(ctx) {
  const actions = createServiceActionSet(ctx, 'authService', AUTH_ACTION_SPECS)
  actions.isAuthenticated = () => Boolean(ctx.state.session.token)
  return actions
}

export function createUsersActions(ctx) {
  return createServiceActionSet(ctx, 'usersService', USERS_ACTION_SPECS)
}

export function createSpotsActions(ctx) {
  const actions = createServiceActionSet(ctx, 'spotsService', SPOTS_ACTION_SPECS)
  actions.saveSpot = async (spot) => {
    const service = ctx.service('spotsService')
    if (spot?.id) {
      return service.update(spot.id, spot)
    }
    const id = await service.create(spot)
    return Boolean(id)
  }
  return actions
}

export function createSocialActions(ctx) {
  const actions = createServiceActionSet(ctx, 'socialService', SOCIAL_ACTION_SPECS)
  actions.toggleFavorite = async (spotId, currentlyFavorite) => {
    const service = ctx.service('socialService')
    const ok = currentlyFavorite
      ? await service.unfavoriteSpot(spotId)
      : await service.favoriteSpot(spotId)
    if (!ok) return false
    if (currentlyFavorite) {
      removeFavorite(ctx.state, spotId)
    } else {
      addFavorite(ctx.state, spotId)
    }
    return true
  }
  return actions
}

export function createSupportActions(ctx) {
  return createServiceActionSet(ctx, 'supportService', SUPPORT_ACTION_SPECS)
}

export function createAdminActions(ctx) {
  return createServiceActionSet(ctx, 'adminService', ADMIN_ACTION_SPECS)
}

export function createCommentsActions(ctx) {
  return createServiceActionSet(ctx, 'comments', COMMENTS_ACTION_SPECS)
}

export function createMeetupsActions(ctx) {
  return createServiceActionSet(ctx, 'meetups', MEETUPS_ACTION_SPECS)
}

export function createDashboardActions(ctx) {
  return {
    async reloadCoreData() {
      await ctx.action('spots').reload()
      await ctx.action('social').reloadFavorites()
    },
    async reloadDashboardData() {
      await this.reloadCoreData()
      const uid = ctx.state.session.user?.id
      if (!uid) {
        resetDashboardSocial(ctx.state)
        return
      }
      const [followers, following, incomingRequests, blockedUsers] = await Promise.all([
        ctx.action('social').followersOf(uid),
        ctx.action('social').followingOf(uid),
        ctx.action('social').incomingRequests(),
        ctx.action('social').blockedUsers(),
      ])
      setDashboardSocial(ctx.state, { followers, following, incomingRequests, blockedUsers })
    },
  }
}

export function createProfileActions(ctx) {
  return {
    async loadProfileState(targetId) {
      const userId = String(targetId || ctx.state.session.user?.id || '').trim()
      if (!userId) {
        clearProfileState(ctx.state)
        return
      }
      const meId = String(ctx.state.session.user?.id || '').trim()
      const [profile, createdSpots, favoriteSpots, following] = await Promise.all([
        ctx.action('users').profile(userId),
        ctx.action('spots').byUser(userId),
        ctx.action('spots').favoritesOfUser(userId),
        meId ? ctx.action('social').followingOf(meId) : Promise.resolve([]),
      ])
      setProfileState(ctx.state, { profile, createdSpots, favoriteSpots, viewedUserId: userId, following })
    },
  }
}
