import { createApiError } from './apiErrors'

export class ApiClient {
  constructor(baseUrl, { onUnauthorized } = {}) {
    this.baseUrl = baseUrl
    this.onUnauthorized = typeof onUnauthorized === 'function' ? onUnauthorized : null
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
    for (const p of tryPaths) {
      const url = new URL(p, this.baseUrl).toString()
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
