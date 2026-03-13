import { getRuntimeServices } from '../core/runtimeRegistry'
import { BaseService } from './baseService'

const DEFAULT_TICK_INTERVAL_MS = 45000

function hasMethod(target, methodName) {
  return Boolean(target && typeof target[methodName] === 'function')
}

export class RuntimeService extends BaseService {
  constructor(ctx, { tickIntervalMs = DEFAULT_TICK_INTERVAL_MS } = {}) {
    super({ serviceName: 'runtime' })
    this.ctx = ctx
    this._started = false
    this._tickIntervalMs = Math.max(10000, Number(tickIntervalMs) || DEFAULT_TICK_INTERVAL_MS)
    this._intervalId = null
  }

  _bindings() {
    return getRuntimeServices()
  }

  _serviceOf(binding) {
    return this.ctx.service(binding.serviceId)
  }

  _isAllowed(binding) {
    if (!binding.requiresAuth) return true
    return Boolean(this.ctx.ui?.isAuthenticated())
  }

  start() {
    if (this._started) return
    this._started = true
    this._startTicker()

    for (const binding of this._bindings()) {
      if (!this._isAllowed(binding)) continue
      const service = this._serviceOf(binding)
      if (hasMethod(service, binding.startMethod)) {
        service[binding.startMethod]()
      }
    }
  }

  stop() {
    if (!this._started) return
    this._started = false
    this._stopTicker()

    for (const binding of this._bindings()) {
      const service = this._serviceOf(binding)
      if (hasMethod(service, binding.stopMethod)) {
        service[binding.stopMethod]()
      }
    }
  }

  async tick(options = {}) {
    if (!this._started) return

    for (const binding of this._bindings()) {
      if (!this._isAllowed(binding)) continue
      const service = this._serviceOf(binding)
      if (!hasMethod(service, binding.tickMethod)) continue
      await service[binding.tickMethod](options)
    }
  }

  _startTicker() {
    if (this._intervalId) return

    this._intervalId = setInterval(() => {
      void this.tick({ notify: true, source: 'runtime-interval' })
    }, this._tickIntervalMs)
  }

  _stopTicker() {
    if (!this._intervalId) return
    clearInterval(this._intervalId)
    this._intervalId = null
  }
}
