import { toUserErrorMessage } from './apiErrors'

export class BaseService {
  constructor({ serviceName = 'service' } = {}) {
    this.serviceName = serviceName
    this._lastError = ''
  }

  lastError() {
    return this._lastError
  }

  clearError() {
    this._lastError = ''
  }

  captureError(error, fallbackMessage = '') {
    const fallback = fallbackMessage || `Unknown ${this.serviceName} error`
    this._lastError = toUserErrorMessage(error, fallback)
  }
}

export class ApiStateService extends BaseService {
  constructor(api, state, options = {}) {
    super(options)
    this.api = api
    this.state = state
  }

  token() {
    return this.state?.session?.token || ''
  }
}
