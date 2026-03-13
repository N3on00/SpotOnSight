export class ComponentBehavior {
  constructor(context = {}) {
    this.updateContext(context)
  }

  updateContext(context = {}) {
    this.context = context && typeof context === 'object' ? context : {}
    this.app = this.context.app || null
    this.router = this.context.router || null
    this.route = this.context.route || null
    this.screen = this.context.screen || ''
    this.spec = this.context.spec || null
    return this
  }

  notify(payload) {
    if (!this.app || typeof this.app.service !== 'function') return
    this.app.service('notify').push(payload)
  }

  handleError({
    title = 'Action failed',
    message = 'Please try again.',
    details = '',
    error = null,
    errorHandlerId = '',
    scope = 'component',
  } = {}) {
    if (typeof this.context.handleComponentError !== 'function') {
      this.notify({
        level: 'error',
        title,
        message,
        details: String(details || error?.message || error || ''),
      })
      return false
    }

    return this.context.handleComponentError({
      errorHandlerId,
      title,
      message,
      details,
      error,
      scope,
    })
  }

  runUiAction(actionId, payload = {}) {
    if (typeof this.context.runUiAction === 'function') {
      return this.context.runUiAction(actionId, payload)
    }
    if (this.app?.ui?.runAction) {
      return this.app.ui.runAction(actionId, payload)
    }
    return Promise.resolve(null)
  }

  navigate(to) {
    if (typeof this.context.navigate === 'function') {
      return this.context.navigate(to)
    }
    if (this.router?.push) {
      return this.router.push(to)
    }
    return Promise.resolve(false)
  }
}
