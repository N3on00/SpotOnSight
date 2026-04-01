import { wrapComponentSpecWithDecorators } from './componentDecoratorRegistry'
import { registerScreenErrorHandler } from './errorHandlerRegistry'
import { UI_SLOTS } from './uiElements'
import { asText } from '../utils/sanitizers'

function normalizeStringList(value) {
  if (!Array.isArray(value)) return []
  const out = []
  const seen = new Set()

  for (const entry of value) {
    const item = asText(entry)
    if (!item || seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }

  return out
}

export function createUiRegistryBuilder() {
  const componentRegistry = new Map()
  const actionRegistry = new Map()
  const screenRegistry = new Map()

  function slotKey(screen, slot) {
    return `${screen}:${slot}`
  }

  function ensureScreen(screen) {
    const key = asText(screen)
    if (!key) {
      throw new Error('Screen id is required')
    }
    if (!screenRegistry.has(key)) {
      screenRegistry.set(key, {
        screen: key,
        componentDecorators: ['component.error', 'component.navigation', 'component.action', 'component.behavior'],
        buildScreenCtx: null,
        onEnter: null,
        onRouteChange: null,
        errorHandlerId: 'screen.default',
        errorTitle: 'Screen load failed',
        errorMessage: 'Could not initialize this page.',
        routeErrorHandlerId: 'screen.default',
        routeErrorTitle: 'Screen update failed',
        routeErrorMessage: 'Could not update this page.',
      })
    }
    return screenRegistry.get(key)
  }

  function registerComponent({ screen, slot, id, order = 100, component, buildProps }) {
    const key = slotKey(screen, slot)
    const list = (componentRegistry.get(key) || []).filter((x) => x.id !== id)
    list.push({ id, order, component, buildProps })
    componentRegistry.set(key, list)
  }

  function getComponents(screen, slot) {
    const key = slotKey(screen, slot)
    const list = componentRegistry.get(key) || []
    return [...list].sort((a, b) => (a.order - b.order) || a.id.localeCompare(b.id))
  }

  function registerAction(actionId, handler) {
    actionRegistry.set(actionId, handler)
  }

  function getAction(actionId) {
    return actionRegistry.get(actionId)
  }

  function registerScreenLifecycle({
    screen,
    buildScreenCtx,
    onEnter,
    onRouteChange,
    componentDecorators,
    errorHandlerId,
    errorTitle,
    errorMessage,
    routeErrorHandlerId,
    routeErrorTitle,
    routeErrorMessage,
  }) {
    const target = ensureScreen(screen)

    if (typeof buildScreenCtx === 'function') target.buildScreenCtx = buildScreenCtx
    if (typeof onEnter === 'function') target.onEnter = onEnter
    if (typeof onRouteChange === 'function') target.onRouteChange = onRouteChange

    if (componentDecorators === false) {
      target.componentDecorators = []
    } else {
      const nextDecorators = normalizeStringList(componentDecorators)
      if (nextDecorators.length) {
        target.componentDecorators = nextDecorators
      }
    }

    const nextErrorHandlerId = asText(errorHandlerId)
    if (nextErrorHandlerId) target.errorHandlerId = nextErrorHandlerId

    const nextRouteErrorHandlerId = asText(routeErrorHandlerId)
    if (nextRouteErrorHandlerId) target.routeErrorHandlerId = nextRouteErrorHandlerId

    const nextErrorTitle = asText(errorTitle)
    if (nextErrorTitle) target.errorTitle = nextErrorTitle

    const nextErrorMessage = asText(errorMessage)
    if (nextErrorMessage) target.errorMessage = nextErrorMessage

    const nextRouteErrorTitle = asText(routeErrorTitle)
    if (nextRouteErrorTitle) target.routeErrorTitle = nextRouteErrorTitle

    const nextRouteErrorMessage = asText(routeErrorMessage)
    if (nextRouteErrorMessage) target.routeErrorMessage = nextRouteErrorMessage
  }

  function getScreenLifecycle(screen) {
    const key = asText(screen)
    if (!key) return null
    const value = screenRegistry.get(key)
    if (!value) return null
    return { ...value }
  }

  function registerScreenDefinition(definition) {
    const screenId = asText(definition?.screen)
    if (!screenId) {
      throw new Error('Screen definition requires screen id')
    }
    const screenConfig = ensureScreen(screenId)

    for (const entry of Array.isArray(definition?.errorHandlers) ? definition.errorHandlers : []) {
      const handlerId = asText(entry?.id)
      if (!handlerId) {
        throw new Error(`Screen '${screenId}' errorHandler() requires id`)
      }

      registerScreenErrorHandler({
        id: handlerId,
        handlerClass: entry.handlerClass,
      })

      const lifecyclePatch = {
        screen: screenId,
        errorHandlerId: handlerId,
      }

      if (entry.routeHandlerClass) {
        const nextRouteId = asText(entry.routeId) || `${handlerId}.route`
        registerScreenErrorHandler({
          id: nextRouteId,
          handlerClass: entry.routeHandlerClass,
        })
        lifecyclePatch.routeErrorHandlerId = nextRouteId
      } else {
        const explicitRouteId = asText(entry.routeId)
        if (explicitRouteId) {
          lifecyclePatch.routeErrorHandlerId = explicitRouteId
        } else if (entry.useForRoute) {
          lifecyclePatch.routeErrorHandlerId = handlerId
        }
      }

      registerScreenLifecycle(lifecyclePatch)
    }

    for (const entry of Array.isArray(definition?.actions) ? definition.actions : []) {
      registerAction(entry.id, entry.handler)
    }

    const registrations = [
      ...(Array.isArray(definition?.widgets) ? definition.widgets.map((entry) => ({ slot: asText(entry?.slot) || UI_SLOTS.MAIN, spec: entry })) : []),
      ...(Array.isArray(definition?.headers) ? definition.headers.map((entry) => ({ slot: UI_SLOTS.HEADER, spec: entry })) : []),
      ...(Array.isArray(definition?.main) ? definition.main.map((entry) => ({ slot: UI_SLOTS.MAIN, spec: entry })) : []),
      ...(Array.isArray(definition?.footers) ? definition.footers.map((entry) => ({ slot: UI_SLOTS.FOOTER, spec: entry })) : []),
    ]

    for (const { slot, spec } of registrations) {
      const decoratedSpec = wrapComponentSpecWithDecorators({
        screen: screenId,
        slot,
        spec,
        defaultDecoratorIds: screenConfig.componentDecorators,
        screenLifecycle: screenConfig,
      })

      registerComponent({
        screen: screenId,
        slot,
        ...decoratedSpec,
      })
    }

    if (definition?.lifecycle && typeof definition.lifecycle === 'object') {
      registerScreenLifecycle({
        screen: screenId,
        ...definition.lifecycle,
      })
    }
  }

  return Object.freeze({
    registerScreenDefinition,
    getAction,
    getComponents,
    getScreenLifecycle,
  })
}
