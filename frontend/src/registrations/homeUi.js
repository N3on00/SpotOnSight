import { createScreenModule } from '../core/screenRegistry'
import { UI_ACTIONS, UI_COMPONENT_IDS, UI_SCREENS } from '../core/uiElements'
import { routeToMap, routeToProfile } from '../router/routeSpec'
import HomeHero from '../components/home/HomeHero.vue'
import HomeMapWidget from '../components/home/HomeMapWidget.vue'
import HomeDiscover from '../components/home/HomeDiscover.vue'
import {
  createSpotCommentActions,
  createSpotFavoriteAction,
  controllerLastError,
  mergeUniqueDetails,
  notify,
  reloadDashboardData,
  runTask,
} from './uiShared'

function _homeSyncErrorDetails(app) {
  return mergeUniqueDetails(
    controllerLastError(app, 'spots'),
    controllerLastError(app, 'social'),
  )
}

async function _reloadHomeDashboardStrict(app) {
  await reloadDashboardData(app)
  const details = _homeSyncErrorDetails(app)
  if (details) {
    throw new Error(details)
  }
}

function _openMap(router, { lat = null, lon = null, spotId = '' } = {}) {
  router.push(routeToMap({ lat, lon, spotId }))
}

function _goToSpot(app, router, spot) {
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

  _openMap(router, { lat, lon, spotId })
}

const homeScreen = createScreenModule(UI_SCREENS.HOME)

homeScreen.action(UI_ACTIONS.HOME_REFRESH, async ({ app }) => {
  await _reloadHomeDashboardStrict(app)
})

homeScreen.header({
  id: UI_COMPONENT_IDS.HOME_HERO,
  order: 10,
  component: HomeHero,
  buildProps: ({ app }) => ({
    username: app.state.session.user?.display_name || app.state.session.user?.username || '',
  }),
})

homeScreen.main({
  id: UI_COMPONENT_IDS.HOME_MAP_WIDGET,
  order: 8,
  component: HomeMapWidget,
  buildProps: ({ app, router }) => ({
    spots: app.state.spots,
    onOpenMap: (focus = null) => {
      const src = focus && typeof focus === 'object' ? focus : {}
      const lat = Number(src.lat)
      const lon = Number(src.lon)
      _openMap(router, {
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
      })
    },
    onOpenSpot: (spot) => _goToSpot(app, router, spot),
  }),
})

homeScreen.main({
  id: UI_COMPONENT_IDS.HOME_DISCOVER,
  order: 10,
  component: HomeDiscover,
  buildProps: ({ app, router }) => ({
    spots: app.state.spots,
    favorites: app.state.favorites,
    refreshBusy: app.state.loading.homeRefresh,
    onOpenProfile: (userId) => {
      const nextId = typeof userId === 'string' && userId.trim()
        ? userId.trim()
        : String(app.state.session.user?.id || '')
      router.push(routeToProfile(nextId))
    },
    onRefresh: async () => {
      await runTask(app, {
        loadingKey: 'homeRefresh',
        task: () => _reloadHomeDashboardStrict(app),
        errorTitle: 'Sync failed',
        errorMessage: 'Could not sync spots and social data.',
        errorDetails: (error) => String(error?.message || error || ''),
        successTitle: 'Synced',
        successMessage: 'Spots and social data updated.',
      })
    },
    onGoToSpot: (spot) => _goToSpot(app, router, spot),
    onToggleFavorite: createSpotFavoriteAction(app),
    onLoadUserProfile: async (userId) => {
      return app.controller('users').profile(userId)
    },
    currentUserId: app.state.session.user?.id || '',
    ...createSpotCommentActions(app),
    onNotify: (payload) => notify(app, payload),
  }),
})

homeScreen.lifecycle({
  onEnter: async ({ app }) => {
    await app.ui.runAction(UI_ACTIONS.HOME_REFRESH)
  },
  errorTitle: 'Dashboard load failed',
  errorMessage: 'Could not initialize home screen.',
})
