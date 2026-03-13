import { resolveScreenErrorHandler } from './errorHandlerRegistry'
import { ComponentBehavior } from './componentBehavior'
import { asText } from '../utils/sanitizers'

const DECORATOR_REGISTRY = new Map()
const DECORATOR_INSTANCE_CACHE = new WeakMap()

function normalizeDecoratorIds(value) {
  if (!Array.isArray(value)) return []
  const out = []
  const seen = new Set()
  for (const item of value) {
    const id = asText(item)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

function toObject(value) {
  return value && typeof value === 'object' ? value : {}
}

export class ComponentDecorator {
  constructor(app) {
    this.app = app
  }

  extendContext(_input = {}) {
    return {}
  }

  decorateProps(_input = {}) {
    return null
  }
}

export class ComponentNavigationDecorator extends ComponentDecorator {
  extendContext({ router }) {
    return {
      navigate: (to) => {
        if (!router || typeof router.push !== 'function') return Promise.resolve(false)
        return router.push(to)
      },
      replaceRoute: (to) => {
        if (!router || typeof router.replace !== 'function') return Promise.resolve(false)
        return router.replace(to)
      },
    }
  }
}

export class ComponentActionDecorator extends ComponentDecorator {
  extendContext({ app }) {
    return {
      runUiAction: (actionId, payload = {}) => {
        return app.ui.runAction(actionId, payload)
      },
    }
  }
}

function validateBehaviorClass(behaviorClass, id = '') {
  if (typeof behaviorClass !== 'function') {
    throw new Error(`Behavior class for '${id}' must be a class/function`)
  }

  const prototype = behaviorClass.prototype
  if (!(prototype instanceof ComponentBehavior) && prototype !== ComponentBehavior.prototype) {
    throw new Error(`Behavior class for '${id}' must extend ComponentBehavior`)
  }
}

export class ComponentBehaviorDecorator extends ComponentDecorator {
  constructor(app) {
    super(app)
    this._instances = new Map()
  }

  _cacheKey({ screen, spec, route }) {
    const routeKey = spec?.behaviorScope === 'route'
      ? String(route?.fullPath || '')
      : ''
    return `${String(screen || '')}:${String(spec?.id || '')}:${routeKey}`
  }

  _resolveBehaviorClass(spec) {
    const behaviorClass = spec?.behaviorClass
    if (!behaviorClass) return null
    validateBehaviorClass(behaviorClass, spec?.id || '')
    return behaviorClass
  }

  decorateProps(input = {}) {
    const spec = input.spec
    const behaviorClass = this._resolveBehaviorClass(spec)
    if (!behaviorClass) return null

    const key = this._cacheKey(input)
    const propName = asText(spec?.behaviorPropName) || 'behavior'
    let behavior = this._instances.get(key)

    if (!behavior) {
      behavior = new behaviorClass(input)
      this._instances.set(key, behavior)
    } else if (typeof behavior.updateContext === 'function') {
      behavior.updateContext(input)
    }

    return {
      ...input.props,
      [propName]: behavior,
    }
  }
}

export class ComponentErrorDecorator extends ComponentDecorator {
  _errorHandlerId(input = {}) {
    const explicit = asText(input.errorHandlerId)
    if (explicit) return explicit

    const routeScope = asText(input.scope) === 'route'
    if (routeScope) {
      return asText(input.routeErrorHandlerId) || asText(input.screenErrorHandlerId) || 'screen.default'
    }

    return asText(input.screenErrorHandlerId) || 'screen.default'
  }

  extendContext({ app, route, screen, screenLifecycle }) {
    return {
      handleComponentError: ({
        errorHandlerId = '',
        title = '',
        message = '',
        details = '',
        error = null,
        scope = 'component',
      } = {}) => {
        const handler = resolveScreenErrorHandler(
          this._errorHandlerId({
            errorHandlerId,
            scope,
            screenErrorHandlerId: screenLifecycle?.errorHandlerId,
            routeErrorHandlerId: screenLifecycle?.routeErrorHandlerId,
          }),
          app,
        )

        return handler.handle({
          title,
          message,
          details,
          error,
          scope,
          route,
          screen,
        })
      },
    }
  }
}

function validateDecoratorClass(decoratorClass, id) {
  if (typeof decoratorClass !== 'function') {
    throw new Error(`Decorator '${id}' must be a class/function`)
  }

  const prototype = decoratorClass.prototype
  if (!(prototype instanceof ComponentDecorator) && prototype !== ComponentDecorator.prototype) {
    throw new Error(`Decorator '${id}' must extend ComponentDecorator`)
  }
}

function decoratorCacheForApp(app) {
  if (!DECORATOR_INSTANCE_CACHE.has(app)) {
    DECORATOR_INSTANCE_CACHE.set(app, new Map())
  }
  return DECORATOR_INSTANCE_CACHE.get(app)
}

export function registerComponentDecorator({ id, decoratorClass }) {
  const key = asText(id)
  if (!key) {
    throw new Error('registerComponentDecorator() requires id')
  }

  validateDecoratorClass(decoratorClass, key)
  DECORATOR_REGISTRY.set(key, decoratorClass)
}

export function resolveComponentDecorator(id, app) {
  const key = asText(id)
  if (!key) {
    throw new Error('resolveComponentDecorator() requires id')
  }

  const DecoratorClass = DECORATOR_REGISTRY.get(key)
  if (!DecoratorClass) {
    throw new Error(`Unknown component decorator: ${key}`)
  }

  const cache = decoratorCacheForApp(app)
  if (cache.has(key)) {
    return cache.get(key)
  }

  const instance = new DecoratorClass(app)
  cache.set(key, instance)
  return instance
}

export function getRegisteredComponentDecorators() {
  return [...DECORATOR_REGISTRY.keys()]
}

export function wrapComponentSpecWithDecorators({
  screen,
  slot,
  spec,
  defaultDecoratorIds = [],
  screenLifecycle = null,
}) {
  const rawSpec = toObject(spec)
  const baseBuildProps = typeof rawSpec.buildProps === 'function'
    ? rawSpec.buildProps
    : () => ({})

  const explicitDecorators = rawSpec.decorators === false
    ? []
    : normalizeDecoratorIds(rawSpec.decorators)

  const decoratorIds = normalizeDecoratorIds([
    ...normalizeDecoratorIds(defaultDecoratorIds),
    ...explicitDecorators,
  ])

  if (!decoratorIds.length) {
    return {
      ...rawSpec,
      buildProps: baseBuildProps,
    }
  }

  return {
    ...rawSpec,
    buildProps: (ctxInput = {}) => {
      const ctx = toObject(ctxInput)
      const app = ctx.app
      const decoratorInstances = decoratorIds.map((id) => resolveComponentDecorator(id, app))

      const extensions = {}
      for (const decorator of decoratorInstances) {
        const extended = decorator.extendContext({
          ...ctx,
          screen,
          slot,
          spec: rawSpec,
          screenLifecycle,
        })
        if (extended && typeof extended === 'object') {
          Object.assign(extensions, extended)
        }
      }

      const mergedCtx = {
        ...ctx,
        ...extensions,
        screen,
        slot,
        spec: rawSpec,
        screenLifecycle,
      }

      let props = toObject(baseBuildProps(mergedCtx))

      for (const decorator of decoratorInstances) {
        const decorated = decorator.decorateProps({
          ...mergedCtx,
          screen,
          slot,
          spec: rawSpec,
          screenLifecycle,
          props,
        })

        if (decorated && typeof decorated === 'object') {
          props = decorated
        }
      }

      return props
    },
  }
}
