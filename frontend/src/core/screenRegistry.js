import { registerAction, registerComponent } from './registry'
import { wrapComponentSpecWithDecorators } from './componentDecoratorRegistry'
import { registerScreenErrorHandler } from './errorHandlerRegistry'
import { UI_SLOTS } from './uiElements'
import { asText } from '../utils/sanitizers'

const screenRegistry = new Map()

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

export function registerScreenLifecycle({
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

export function getScreenLifecycle(screen) {
  const key = asText(screen)
  if (!key) return null
  const value = screenRegistry.get(key)
  if (!value) return null
  return { ...value }
}

export function createScreenModule(screen) {
  const screenId = asText(screen)
  const screenConfig = ensureScreen(screenId)

  function registerErrorHandler({
    id,
    handlerClass,
    routeId,
    routeHandlerClass,
    useForRoute = false,
  } = {}) {
    const handlerId = asText(id)
    if (!handlerId) {
      throw new Error(`Screen '${screenId}' errorHandler() requires id`)
    }

    registerScreenErrorHandler({
      id: handlerId,
      handlerClass,
    })

    const lifecyclePatch = {
      screen: screenId,
      errorHandlerId: handlerId,
    }

    if (routeHandlerClass) {
      const nextRouteId = asText(routeId) || `${handlerId}.route`
      registerScreenErrorHandler({
        id: nextRouteId,
        handlerClass: routeHandlerClass,
      })
      lifecyclePatch.routeErrorHandlerId = nextRouteId
    } else {
      const explicitRouteId = asText(routeId)
      if (explicitRouteId) {
        lifecyclePatch.routeErrorHandlerId = explicitRouteId
      } else if (useForRoute) {
        lifecyclePatch.routeErrorHandlerId = handlerId
      }
    }

    registerScreenLifecycle(lifecyclePatch)
    return api
  }

  function registerAt(slot, spec) {
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
    return api
  }

  const api = {
    action(actionId, handler) {
      registerAction(actionId, handler)
      return api
    },
    widget(spec) {
      const slot = asText(spec?.slot) || UI_SLOTS.MAIN
      return registerAt(slot, spec)
    },
    header(spec) {
      return registerAt(UI_SLOTS.HEADER, spec)
    },
    main(spec) {
      return registerAt(UI_SLOTS.MAIN, spec)
    },
    footer(spec) {
      return registerAt(UI_SLOTS.FOOTER, spec)
    },
    lifecycle(options) {
      registerScreenLifecycle({
        screen: screenId,
        ...(options && typeof options === 'object' ? options : {}),
      })
      return api
    },
    errorHandler(options) {
      return registerErrorHandler(options)
    },
  }

  return api
}

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
