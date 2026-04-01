import { ProfileScreenErrorHandler } from '../core/errorHandlerRegistry'
import { UI_ACTIONS, UI_COMPONENT_IDS, UI_SCREENS } from '../core/uiElements'
import { routeToMap, routeToProfile, routeToSettings } from '../router/routeSpec'
import ProfileHero from '../components/profile/ProfileHero.vue'
import ProfileSummary from '../components/profile/ProfileSummary.vue'
import { beginLoadingState, endLoadingState } from '../state/appMutations'
import { createModerationActions, createSpotCommentActions, createSpotFavoriteAction, notify } from './uiShared'

class ProfilePageErrorHandler extends ProfileScreenErrorHandler {}

const registeredRegistries = new WeakSet()

const PROFILE_SCREEN_DEFINITION = {
  screen: UI_SCREENS.PROFILE,
  errorHandlers: [
    {
      id: 'screen.profile.page',
      handlerClass: ProfilePageErrorHandler,
      useForRoute: true,
    },
  ],
  actions: [
    {
      id: UI_ACTIONS.PROFILE_REFRESH,
      handler: async ({ app, payload }) => {
        const targetId = payload && typeof payload === 'object' ? payload.userId : ''
        await app.action('profile').loadProfileState(targetId)
      },
    },
  ],
  headers: [
    {
      id: UI_COMPONENT_IDS.PROFILE_HERO,
      order: 10,
      component: ProfileHero,
    },
  ],
  main: [
    {
      id: UI_COMPONENT_IDS.PROFILE_SUMMARY,
      order: 10,
      component: ProfileSummary,
      buildProps: ({ app, router }) => {
        const moderation = createModerationActions(app)
        return {
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
            beginLoadingState(app.state, 'socialFollow')
            try {
              const status = await app.action('social').follow(targetId)
              if (!status) {
                notify(app, {
                  level: 'error',
                  title: 'Follow failed',
                  message: 'Could not follow this profile.',
                  details: app.action('social').lastError(),
                })
                return false
              }
              notify(app, {
                level: 'success',
                title: status === 'pending' ? 'Request sent' : 'Followed',
                message: status === 'pending' ? 'Waiting for user approval.' : 'You are now following this profile.',
              })
              await app.action('profile').loadProfileState(targetId)
              return true
            } finally {
              endLoadingState(app.state, 'socialFollow')
            }
          },
          onUnfollowProfile: async () => {
            const targetId = String(app.state.profile.viewedUserId || '').trim()
            if (!targetId) return false
            beginLoadingState(app.state, 'socialUnfollow')
            try {
              const ok = await app.action('social').unfollow(targetId)
              if (!ok) {
                notify(app, {
                  level: 'error',
                  title: 'Unfollow failed',
                  message: 'Could not unfollow this profile.',
                  details: app.action('social').lastError(),
                })
                return false
              }
              notify(app, {
                level: 'info',
                title: 'Unfollowed',
                message: 'You no longer follow this profile.',
              })
              await app.action('profile').loadProfileState(targetId)
              return true
            } finally {
              endLoadingState(app.state, 'socialUnfollow')
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
          onLoadUserProfile: async (userId) => app.action('users').profile(userId),
          currentUserId: app.state.session.user?.id || '',
          ...createSpotCommentActions(app),
          onOpenProfile: (userId) => {
            router.push(routeToProfile(userId))
          },
          onEditProfile: () => {
            router.push(routeToSettings())
          },
          onNotify: (payload) => notify(app, payload),
        }
      },
    },
  ],
  lifecycle: {
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
  },
}

export function registerProfileUi(registry) {
  if (registeredRegistries.has(registry)) return
  registeredRegistries.add(registry)
  registry.registerScreenDefinition(PROFILE_SCREEN_DEFINITION)
}
