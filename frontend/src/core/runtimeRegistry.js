import { asText } from '../utils/sanitizers'

const runtimeRegistry = new Map()

export function registerRuntimeService({
  id,
  serviceId,
  startMethod = 'start',
  stopMethod = 'stop',
  tickMethod = 'tick',
  requiresAuth = true,
}) {
  const key = asText(id)
  const resolvedServiceId = asText(serviceId)

  if (!key) {
    throw new Error('registerRuntimeService() requires id')
  }
  if (!resolvedServiceId) {
    throw new Error(`registerRuntimeService('${key}') requires serviceId`)
  }

  runtimeRegistry.set(key, Object.freeze({
    id: key,
    serviceId: resolvedServiceId,
    startMethod: asText(startMethod) || 'start',
    stopMethod: asText(stopMethod) || 'stop',
    tickMethod: asText(tickMethod) || 'tick',
    requiresAuth: Boolean(requiresAuth),
  }))
}

export function getRuntimeServices() {
  return [...runtimeRegistry.values()]
}
