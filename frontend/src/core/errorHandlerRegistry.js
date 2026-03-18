import { asText } from '../utils/sanitizers'
import { NOTIFICATION_CATEGORIES } from '../services/notificationService'

const HANDLER_REGISTRY = new Map()
const INSTANCE_CACHE = new WeakMap()

function detailsFromError(error) {
  return asText(error?.message || error)
}

export class ScreenErrorHandler {
  constructor(app) {
    this.app = app
  }

  shouldIgnore({ route }) {
    const needsAuth = Boolean(route?.meta?.requiresAuth)
    return Boolean(needsAuth && !this.app.ui?.isAuthenticated())
  }

  resolveLevel({ level }) {
    return asText(level) || 'error'
  }

  resolveTitle({ title }) {
    return asText(title) || 'Screen load failed'
  }

  resolveMessage({ message }) {
    return asText(message) || 'Could not initialize this page.'
  }

  resolveDetails({ details, error }) {
    const explicit = asText(details)
    if (explicit) return explicit
    return detailsFromError(error)
  }

  handle(input = {}) {
    if (this.shouldIgnore(input)) {
      return false
    }

    this.app.service('notify').push({
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      level: this.resolveLevel(input),
      title: this.resolveTitle(input),
      message: this.resolveMessage(input),
      details: this.resolveDetails(input),
    })
    return true
  }
}

export class AuthScreenErrorHandler extends ScreenErrorHandler {
  resolveTitle({ title }) {
    return asText(title) || 'Authentication failed'
  }

  resolveMessage({ message }) {
    return asText(message) || 'Please verify your credentials and backend availability.'
  }
}

export class ProfileScreenErrorHandler extends ScreenErrorHandler {
  resolveTitle({ title, scope }) {
    const explicit = asText(title)
    if (explicit) return explicit
    if (scope === 'route') return 'Profile refresh failed'
    return 'Profile load failed'
  }

  resolveMessage({ message, scope }) {
    const explicit = asText(message)
    if (explicit) return explicit
    if (scope === 'route') return 'Could not refresh this profile.'
    return 'Could not initialize profile page.'
  }
}

function validateHandlerClass(handlerClass, id) {
  if (typeof handlerClass !== 'function') {
    throw new Error(`Handler '${id}' must be a class/function`)
  }

  const prototype = handlerClass.prototype
  if (!(prototype instanceof ScreenErrorHandler) && prototype !== ScreenErrorHandler.prototype) {
    throw new Error(`Handler '${id}' must extend ScreenErrorHandler`)
  }
}

export function registerScreenErrorHandler({ id, handlerClass }) {
  const key = asText(id)
  if (!key) {
    throw new Error('registerScreenErrorHandler() requires id')
  }

  validateHandlerClass(handlerClass, key)
  HANDLER_REGISTRY.set(key, handlerClass)
}

function handlerCacheForApp(app) {
  if (!INSTANCE_CACHE.has(app)) {
    INSTANCE_CACHE.set(app, new Map())
  }
  return INSTANCE_CACHE.get(app)
}

export function resolveScreenErrorHandler(handlerId, app) {
  const fallbackId = 'screen.default'
  const requested = asText(handlerId)
  const resolvedId = HANDLER_REGISTRY.has(requested) ? requested : fallbackId

  const cache = handlerCacheForApp(app)
  if (cache.has(resolvedId)) {
    return cache.get(resolvedId)
  }

  const HandlerClass = HANDLER_REGISTRY.get(resolvedId) || ScreenErrorHandler
  const instance = new HandlerClass(app)
  cache.set(resolvedId, instance)
  return instance
}

export function getRegisteredScreenErrorHandlers() {
  return [...HANDLER_REGISTRY.keys()]
}
