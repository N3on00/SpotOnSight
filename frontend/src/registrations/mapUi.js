import { UI_ACTIONS, UI_COMPONENT_IDS, UI_SCREENS } from '../core/uiElements'
import MapHeader from '../components/map/MapHeader.vue'
import { MapWorkspaceBehavior } from '../components/map/MapWorkspaceBehavior'
import MapWorkspace from '../components/map/MapWorkspace.vue'
import { notify } from './uiShared'

async function reloadMapData(app) {
  await app.action('spots').reload()
  await app.action('social').reloadFavorites()
}

function parseFocusRequest(route) {
  return MapWorkspaceBehavior.parseFocusRequest(route)
}

const registeredRegistries = new WeakSet()

const MAP_SCREEN_DEFINITION = {
  screen: UI_SCREENS.MAP,
  actions: [
    {
      id: UI_ACTIONS.MAP_RELOAD,
      handler: async ({ app }) => {
        await reloadMapData(app)
      },
    },
  ],
  headers: [
    {
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
    },
  ],
  main: [
    {
      id: UI_COMPONENT_IDS.MAP_WORKSPACE,
      order: 10,
      component: MapWorkspace,
      behaviorClass: MapWorkspaceBehavior,
      buildProps: ({ app, route }) => ({
        state: app.state,
        focusRequest: parseFocusRequest(route),
      }),
    },
  ],
  lifecycle: {
    onEnter: async ({ app }) => {
      await app.ui.runAction(UI_ACTIONS.MAP_RELOAD)
    },
    errorTitle: 'Map load failed',
    errorMessage: 'Could not initialize map page.',
  },
}

export function registerMapUi(registry) {
  if (registeredRegistries.has(registry)) return
  registeredRegistries.add(registry)
  registry.registerScreenDefinition(MAP_SCREEN_DEFINITION)
}
