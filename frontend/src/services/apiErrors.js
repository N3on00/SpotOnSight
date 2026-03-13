import { API_ENDPOINTS, getApiEndpointBinding } from '../api/registry'

const AUTH_REGISTER_PATH = getApiEndpointBinding(API_ENDPOINTS.AUTH_REGISTER).path

function toText(value) {
  if (value == null) return ''
  return String(value).trim()
}

function detailItemToText(item) {
  if (item == null) return ''
  if (typeof item === 'string') return item.trim()

  if (typeof item === 'object') {
    const msg = toText(item.msg || item.message || item.error)
    const loc = Array.isArray(item.loc)
      ? item.loc
          .map((part) => toText(part))
          .filter(Boolean)
          .join('.')
      : ''

    if (loc && msg) {
      return `${loc}: ${msg}`
    }
    return msg
  }

  return toText(item)
}

function detailToText(detail) {
  if (Array.isArray(detail)) {
    return detail
      .map((item) => detailItemToText(item))
      .filter(Boolean)
      .join('; ')
  }
  return detailItemToText(detail)
}

function payloadToMessage(data) {
  if (data == null) return ''

  if (typeof data === 'string') {
    return data.trim()
  }

  if (typeof data !== 'object') {
    return ''
  }

  const detail = detailToText(data.detail)
  if (detail) return detail

  const message = toText(data.message || data.error || data.raw)
  if (message) return message

  return ''
}

function statusFallback(status) {
  if (status === 400) return 'Invalid request.'
  if (status === 401) return 'Authentication failed.'
  if (status === 403) return 'Access denied.'
  if (status === 404) return 'Requested resource was not found.'
  if (status === 409) return 'A conflicting record already exists.'
  if (status === 422) return 'Submitted data is invalid.'
  if (status >= 500 && status <= 599) return 'Server error. Please try again later.'
  return ''
}

function statusFallbackByPath(status, path = '') {
  const normalizedPath = toText(path)
  if (status === 409 && normalizedPath.includes(AUTH_REGISTER_PATH)) {
    return 'Username or email already exists.'
  }
  return statusFallback(status)
}

function parseHttpErrorText(value) {
  const text = toText(value)
  if (!text) {
    return { status: 0, path: '' }
  }

  const match = text.match(/^HTTP\s+(\d{3})\s+[A-Z]+\s+([^\s].*)$/i)
  if (!match) {
    return { status: 0, path: '' }
  }

  return {
    status: Number(match[1]) || 0,
    path: toText(match[2]),
  }
}

function sanitizeErrorMessage(value) {
  const message = toText(value)
  if (!message) return ''
  if (/^HTTP\s+\d{3}\b/.test(message)) {
    return ''
  }
  return message
}

export class ApiError extends Error {
  constructor({ status = 0, method = 'GET', path = '', data = null } = {}) {
    const normalizedMethod = String(method || 'GET').toUpperCase()
    const normalizedPath = String(path || '')
    super(`HTTP ${status} ${normalizedMethod} ${normalizedPath}`.trim())

    this.name = 'ApiError'
    this.status = Number(status) || 0
    this.method = normalizedMethod
    this.path = normalizedPath
    this.data = data
  }

  userMessage(fallback = 'Request failed.') {
    const fromPayload = payloadToMessage(this.data)
    if (fromPayload) return fromPayload

    const fromStatus = statusFallbackByPath(this.status, this.path)
    if (fromStatus) return fromStatus

    const fromError = sanitizeErrorMessage(this.message)
    if (fromError) return fromError

    return toText(fallback) || 'Request failed.'
  }
}

export class ConflictApiError extends ApiError {
  constructor(input = {}) {
    super(input)
    this.name = 'ConflictApiError'
  }
}

export class ValidationApiError extends ApiError {
  constructor(input = {}) {
    super(input)
    this.name = 'ValidationApiError'
  }
}

export function createApiError({ status = 0, method = 'GET', path = '', data = null } = {}) {
  const payload = { status, method, path, data }
  if (status === 409) {
    return new ConflictApiError(payload)
  }
  if (status === 422) {
    return new ValidationApiError(payload)
  }
  return new ApiError(payload)
}

export function toUserErrorMessage(error, fallback = 'Request failed.') {
  if (!error) {
    return toText(fallback) || 'Request failed.'
  }

  if (error instanceof ApiError) {
    return error.userMessage(fallback)
  }

  const fromPayload = payloadToMessage(error.data)
  if (fromPayload) return fromPayload

  const fromStatus = statusFallbackByPath(Number(error.status) || 0, error.path)
  if (fromStatus) return fromStatus

  const parsed = parseHttpErrorText(error.message || error)
  const fromHttpText = statusFallbackByPath(parsed.status, parsed.path)
  if (fromHttpText) return fromHttpText

  const fromError = sanitizeErrorMessage(error.message || error)
  if (fromError) return fromError

  return toText(fallback) || 'Request failed.'
}
