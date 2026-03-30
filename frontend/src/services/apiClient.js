import { createApiError } from './apiErrors'

function runtimeOrigin() {
  const origin = String(globalThis?.location?.origin || '').trim()
  return origin || 'http://localhost'
}

function hasAbsoluteScheme(value) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(String(value || '').trim())
}

function normalizeBaseUrl(baseUrl) {
  const raw = String(baseUrl || '').trim()
  if (!raw) {
    return {
      origin: runtimeOrigin(),
      basePath: '',
    }
  }

  const parsed = hasAbsoluteScheme(raw)
    ? new URL(raw)
    : new URL(raw, runtimeOrigin())

  return {
    origin: parsed.origin,
    basePath: parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, ''),
  }
}

function buildRequestUrl(baseUrl, path) {
  const rawPath = String(path || '').trim()
  if (hasAbsoluteScheme(rawPath)) {
    return rawPath
  }

  const { origin, basePath } = normalizeBaseUrl(baseUrl)
  const [pathnameAndSearch = '/', hashPart = ''] = rawPath.split('#', 2)
  const [pathnamePart = '/', searchPart = ''] = pathnameAndSearch.split('?', 2)
  const normalizedPath = `/${String(pathnamePart || '/').replace(/^\/+/, '')}`
  const url = new URL(origin)

  url.pathname = `${basePath}${normalizedPath}` || '/'
  url.search = searchPart ? `?${searchPart}` : ''
  url.hash = hashPart ? `#${hashPart}` : ''

  return url.toString()
}

export class ApiClient {
  constructor(baseUrl, { onUnauthorized, onRequestStart, onRequestEnd } = {}) {
    this.baseUrl = baseUrl
    this.onUnauthorized = typeof onUnauthorized === 'function' ? onUnauthorized : null
    this.onRequestStart = typeof onRequestStart === 'function' ? onRequestStart : null
    this.onRequestEnd = typeof onRequestEnd === 'function' ? onRequestEnd : null
  }

  async request(method, path, { body, token, form = false } = {}) {
    const headers = {}
    let payload
    const hasAuthToken = Boolean(String(token || '').trim())

    if (body !== undefined) {
      if (form) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
        payload = new URLSearchParams(body).toString()
      } else {
        headers['Content-Type'] = 'application/json'
        payload = JSON.stringify(body)
      }
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const tryPaths = [path]
    if (path.endsWith('/')) {
      tryPaths.push(path.slice(0, -1))
    } else {
      tryPaths.push(`${path}/`)
    }

    let lastError = null
    this.onRequestStart?.({ method, path })
    try {
      for (const p of tryPaths) {
        const url = buildRequestUrl(this.baseUrl, p)
        try {
          const res = await fetch(url, { method, headers, body: payload })
          const text = await res.text()
          let data = {}
          if (text) {
            try {
              data = JSON.parse(text)
            } catch {
              data = { raw: text }
            }
          }

          if (!res.ok) {
            if (res.status === 401 && hasAuthToken && this.onUnauthorized) {
              try {
                this.onUnauthorized({ status: res.status, method, path: p, data })
              } catch {
                // Ignore unauthorized callback failures.
              }
            }

            throw createApiError({
              status: res.status,
              method,
              path: p,
              data,
              url,
              requestBody: body,
            })
          }

          return data
        } catch (e) {
          lastError = e
          if (e?.status !== 404) {
            break
          }
        }
      }

      throw lastError || new Error('Unknown API error')
    } finally {
      this.onRequestEnd?.({ method, path })
    }
  }

  get(path, opts = {}) {
    return this.request('GET', path, opts)
  }

  post(path, body, opts = {}) {
    return this.request('POST', path, { ...opts, body })
  }

  postForm(path, body, opts = {}) {
    return this.request('POST', path, { ...opts, body, form: true })
  }

  put(path, body, opts = {}) {
    return this.request('PUT', path, { ...opts, body })
  }

  patch(path, body, opts = {}) {
    return this.request('PATCH', path, { ...opts, body })
  }

  delete(path, opts = {}) {
    return this.request('DELETE', path, opts)
  }
}
