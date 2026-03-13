import { registerRuntimeService } from '../core/runtimeRegistry'

let registered = false

export function registerRuntime() {
  if (registered) return
  registered = true

  registerRuntimeService({
    id: 'activity.watch',
    serviceId: 'activityWatch',
    startMethod: 'start',
    stopMethod: 'stop',
    tickMethod: 'tick',
    requiresAuth: true,
  })
}
