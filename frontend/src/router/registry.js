import RegisteredScreenView from '../views/RegisteredScreenView.vue'
import { ROUTE_BINDINGS } from './routeSpec'

function toRouteRecord(binding) {
  if (!binding?.screen) {
    throw new Error(`Unknown route screen for binding '${binding?.name || ''}'`)
  }

  return {
    path: binding.path,
    name: binding.name,
    component: RegisteredScreenView,
    props: {
      screen: binding.screen,
    },
    meta: binding.meta,
  }
}

export function getRoutes() {
  return ROUTE_BINDINGS.map((binding) => toRouteRecord(binding))
}
