const RUNTIME_BINDINGS = Object.freeze([
  Object.freeze({
    id: 'activity.watch',
    serviceId: 'activityWatch',
    startMethod: 'start',
    stopMethod: 'stop',
    tickMethod: 'tick',
    requiresAuth: true,
  }),
])

export function getRuntimeBindings() {
  return [...RUNTIME_BINDINGS]
}

export function registerRuntime() {
  return getRuntimeBindings()
}
