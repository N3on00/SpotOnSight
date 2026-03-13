import { createScreenModule } from '../core/screenRegistry'
import { UI_ACTIONS, UI_COMPONENT_IDS, UI_SCREENS } from '../core/uiElements'
import MapHeader from '../components/map/MapHeader.vue'
import { MapWorkspaceBehavior } from '../components/map/MapWorkspaceBehavior'
import MapWorkspace from '../components/map/MapWorkspace.vue'
import { notify } from './uiShared'

async function reloadMapData(app) {
  await app.controller('spots').reload()
  await app.controller('social').reloadFavorites()
}

function parseFocusRequest(route) {
  return MapWorkspaceBehavior.parseFocusRequest(route)
}

const mapScreen = createScreenModule(UI_SCREENS.MAP)

mapScreen.action(UI_ACTIONS.MAP_RELOAD, async ({ app }) => {
  await reloadMapData(app)
})

mapScreen.header({
  id: UI_COMPONENT_IDS.MAP_HEADER,
  order: 10,
  component: MapHeader,
  buildProps: ({ app }) => ({
    onReload: async () => {
      await reloadMapData(app)
      notify(app, { level: 'success', title: 'Map refreshed', message: 'Spots loaded from backend.' })
    },
    reloadBusy: app.state.loading.mapReload,
  }),
})

mapScreen.main({
  id: UI_COMPONENT_IDS.MAP_WORKSPACE,
  order: 10,
  component: MapWorkspace,
  behaviorClass: MapWorkspaceBehavior,
  buildProps: ({ app, route }) => ({
    state: app.state,
    focusRequest: parseFocusRequest(route),
  }),
})

mapScreen.lifecycle({
  onEnter: async ({ app }) => {
    await app.ui.runAction(UI_ACTIONS.MAP_RELOAD)
  },
  errorTitle: 'Map load failed',
  errorMessage: 'Could not initialize map page.',
})
