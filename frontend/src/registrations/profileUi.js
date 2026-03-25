import { createScreenModule } from '../core/screenRegistry'
import { ProfileScreenErrorHandler } from '../core/errorHandlerRegistry'
import { UI_ACTIONS, UI_COMPONENT_IDS, UI_SCREENS } from '../core/uiElements'
import { routeToMap, routeToProfile, routeToSettings } from '../router/routeSpec'
import ProfileHero from '../components/profile/ProfileHero.vue'
import ProfileSummary from '../components/profile/ProfileSummary.vue'
import { createModerationActions, createSpotCommentActions, createSpotFavoriteAction, notify } from './uiShared'

class ProfilePageErrorHandler extends ProfileScreenErrorHandler {}

async function loadProfileState(app, targetId) {
  const userId = String(targetId || app.state.session.user?.id || '').trim()
  if (!userId) {
    app.state.profile.current = null
    app.state.profile.createdSpots = []
    app.state.profile.favoriteSpots = []
    app.state.profile.viewedUserId = ''
    return
  }

  const meId = String(app.state.session.user?.id || '').trim()

  const [profile, createdSpots, favoriteSpots, following] = await Promise.all([
    app.controller('users').profile(userId),
    app.controller('spots').byUser(userId),
    app.controller('spots').favoritesOfUser(userId),
    meId ? app.controller('social').followingOf(meId) : Promise.resolve([]),
  ])

  app.state.profile.current = profile
  app.state.profile.createdSpots = Array.isArray(createdSpots) ? createdSpots : []
  app.state.profile.favoriteSpots = Array.isArray(favoriteSpots) ? favoriteSpots : []
  app.state.profile.viewedUserId = userId
  app.state.social.following = Array.isArray(following) ? following : []
}

const profileScreen = createScreenModule(UI_SCREENS.PROFILE)

profileScreen.errorHandler({
  id: 'screen.profile.page',
  handlerClass: ProfilePageErrorHandler,
  useForRoute: true,
})

profileScreen.action(UI_ACTIONS.PROFILE_REFRESH, async ({ app, payload }) => {
  const targetId = payload && typeof payload === 'object' ? payload.userId : ''
  await loadProfileState(app, targetId)
})

profileScreen.header({
  id: UI_COMPONENT_IDS.PROFILE_HERO,
  order: 10,
  component: ProfileHero,
})

profileScreen.main({
  id: UI_COMPONENT_IDS.PROFILE_SUMMARY,
  order: 10,
  component: ProfileSummary,
  buildProps: ({ app, router }) => {
    const moderation = createModerationActions(app)
     return ({
     profile: app.state.profile.current,
    createdSpots: app.state.profile.createdSpots,
    favoriteSpots: app.state.profile.favoriteSpots,
     favorites: app.state.favorites,
     viewerIsAdmin: Boolean(app.state.session.user?.is_admin),
     isOwnProfile: String(app.state.profile.viewedUserId || '') === String(app.state.session.user?.id || ''),
    isFollowingProfile: (app.state.social.following || [])
      .map((user) => String(user?.id || '').trim())
      .includes(String(app.state.profile.viewedUserId || '').trim()),
    followBusy: app.state.loading.socialFollow || app.state.loading.socialUnfollow,
    onFollowProfile: async () => {
      const targetId = String(app.state.profile.viewedUserId || '').trim()
      if (!targetId) return false

      app.state.loading.socialFollow = true
      try {
        const status = await app.controller('social').follow(targetId)
        if (!status) {
          notify(app, {
            level: 'error',
            title: 'Follow failed',
            message: 'Could not follow this profile.',
            details: app.controller('social').lastError(),
          })
          return false
        }

        notify(app, {
          level: 'success',
          title: status === 'pending' ? 'Request sent' : 'Followed',
          message: status === 'pending' ? 'Waiting for user approval.' : 'You are now following this profile.',
        })

        await loadProfileState(app, targetId)
        return true
      } finally {
        app.state.loading.socialFollow = false
      }
    },
    onUnfollowProfile: async () => {
      const targetId = String(app.state.profile.viewedUserId || '').trim()
      if (!targetId) return false

      app.state.loading.socialUnfollow = true
      try {
        const ok = await app.controller('social').unfollow(targetId)
        if (!ok) {
          notify(app, {
            level: 'error',
            title: 'Unfollow failed',
            message: 'Could not unfollow this profile.',
            details: app.controller('social').lastError(),
          })
          return false
        }

        notify(app, {
          level: 'info',
          title: 'Unfollowed',
          message: 'You no longer follow this profile.',
        })

        await loadProfileState(app, targetId)
        return true
      } finally {
        app.state.loading.socialUnfollow = false
      }
    },
    onGoToSpot: (spot) => {
      const lat = Number(spot?.lat)
      const lon = Number(spot?.lon)
      const spotId = String(spot?.id || '').trim()
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        notify(app, {
          level: 'warning',
          title: 'Spot location missing',
          message: 'This spot has no usable coordinates.',
        })
        return
      }

      router.push(routeToMap({ lat, lon, spotId }))
    },
    onToggleFavorite: createSpotFavoriteAction(app),
    onReportSpot: moderation.onReportSpot,
    onReportComment: moderation.onReportComment,
    onReportProfile: moderation.onReportUser,
    onLoadUserProfile: async (userId) => {
      return app.controller('users').profile(userId)
    },
    currentUserId: app.state.session.user?.id || '',
    ...createSpotCommentActions(app),
    onOpenProfile: (userId) => {
      router.push(routeToProfile(userId))
    },
    onEditProfile: () => {
      router.push(routeToSettings())
    },
    onNotify: (payload) => notify(app, payload),
    })
  },
})

profileScreen.lifecycle({
  onEnter: async ({ app, route }) => {
    await app.ui.runAction(UI_ACTIONS.PROFILE_REFRESH, {
      userId: String(route.params?.userId || ''),
    })
  },
  onRouteChange: async ({ app, route, previousRoute }) => {
    const nextId = String(route.params?.userId || '')
    const prevId = String(previousRoute?.params?.userId || '')
    if (nextId === prevId) return

    await app.ui.runAction(UI_ACTIONS.PROFILE_REFRESH, { userId: nextId })
  },
  errorTitle: 'Profile load failed',
  errorMessage: 'Could not initialize profile page.',
  routeErrorTitle: 'Profile refresh failed',
  routeErrorMessage: 'Could not refresh this profile.',
})
