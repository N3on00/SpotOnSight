import { createUiRegistryBuilder } from '../core/uiRegistryBuilder'

function duplicateEntryError(kind, id, actorId) {
  return new Error(`Duplicate ${kind} '${id}' registered by actor '${actorId}'`)
}

export function createActorRegistry(actors) {
  const actorList = Array.isArray(actors) ? [...actors] : []
  const serviceFactories = {}
  const actionFactories = {}
  const runtimeBindings = []
  const registerUiHooks = []
  const uiRegistry = createUiRegistryBuilder()

  const serviceOwners = new Map()
  const actionOwners = new Map()
  const runtimeBindingOwners = new Map()

  const registry = {
    actors: actorList,
    serviceFactories,
    actionFactories,
    runtimeBindings,
    uiRegistry,
    registerScreenDefinition: uiRegistry.registerScreenDefinition,
    getAction: uiRegistry.getAction,
    getComponents: uiRegistry.getComponents,
    getScreenLifecycle: uiRegistry.getScreenLifecycle,
    registerUi() {
      for (const hook of registerUiHooks) {
        hook(registry)
      }
    },
  }

  for (const actor of actorList) {
    const actorId = String(actor?.id || '').trim()
    if (!actorId) {
      throw new Error('Actor id is required')
    }

    const actorServices = actor?.services && typeof actor.services === 'object' ? actor.services : {}
    for (const [serviceId, factory] of Object.entries(actorServices)) {
      if (serviceOwners.has(serviceId)) {
        throw duplicateEntryError('service', serviceId, actorId)
      }
      serviceOwners.set(serviceId, actorId)
      serviceFactories[serviceId] = (ctx) => factory(ctx, registry)
    }

    const actorActions = actor?.actions && typeof actor.actions === 'object' ? actor.actions : {}
    for (const [actionId, factory] of Object.entries(actorActions)) {
      if (actionOwners.has(actionId)) {
        throw duplicateEntryError('action', actionId, actorId)
      }
      actionOwners.set(actionId, actorId)
      actionFactories[actionId] = (ctx) => factory(ctx, registry)
    }

    const actorRuntimeBindings = Array.isArray(actor?.runtimeBindings) ? actor.runtimeBindings : []
    for (const binding of actorRuntimeBindings) {
      const bindingId = String(binding?.id || '').trim()
      if (!bindingId) {
        throw new Error(`Runtime binding id is required for actor '${actorId}'`)
      }
      if (runtimeBindingOwners.has(bindingId)) {
        throw duplicateEntryError('runtime binding', bindingId, actorId)
      }
      runtimeBindingOwners.set(bindingId, actorId)
      runtimeBindings.push(Object.freeze({ ...binding }))
    }

    if (typeof actor?.registerUi === 'function') {
      registerUiHooks.push(actor.registerUi)
    }
  }

  return Object.freeze(registry)
}
