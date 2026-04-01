import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthService } from '../services/authService'
import { ApiClient } from '../services/apiClient'
import { API_ENDPOINTS } from '../api/registry'
import { createAppState, persistSession } from '../stores/appState'
import { SpotsService } from '../services/spotsService'

class TestAuthService extends AuthService {}
class TestSpotsService extends SpotsService {}
class TestApiClient extends ApiClient {}

function createMemoryStorage() {
  const store = new Map()
  return {
    getItem: (key) => (store.has(String(key)) ? store.get(String(key)) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value))
    },
    removeItem: (key) => {
      store.delete(String(key))
    },
    clear: () => {
      store.clear()
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Auth failure and unauthorized handling', () => {
  it('returns false on invalid login credentials', async () => {
    const api = {
      request: vi.fn(async () => {
        throw {
          status: 401,
          data: {
            detail: 'Incorrect username/email or password',
          },
        }
      }),
    }

    const state = {
      session: {
        token: '',
        user: null,
      },
    }

    const service = new TestAuthService(api, state)
    const session = await service.login('alice', 'wrong')

    expect(session).toBe(false)
    expect(api.request).toHaveBeenCalledWith(API_ENDPOINTS.AUTH_LOGIN, {
      body: {
        username_or_email: 'alice',
        password: 'wrong',
      },
    })
    expect(service.lastError()).toContain('Incorrect username/email or password')
  })

  it('invokes unauthorized callback for authenticated requests', async () => {
    const onUnauthorized = vi.fn()
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ detail: 'Expired token' }),
    }))

    vi.stubGlobal('fetch', fetchMock)

    const apiClient = new TestApiClient('http://127.0.0.1:8000', {
      onUnauthorized,
    })

    await expect(
      apiClient.get('/social/me', { token: 'expired-token' }),
    ).rejects.toMatchObject({ status: 401 })

    expect(onUnauthorized).toHaveBeenCalledOnce()
    expect(onUnauthorized).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        method: 'GET',
      }),
    )
  })

  it('supports a relative API base path for proxied production requests', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: 'ok' }),
    }))

    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('location', { origin: 'https://app.example.com' })

    const apiClient = new TestApiClient('/api')
    await apiClient.get('/health')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://app.example.com/api/health',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('tracks backend request lifecycle callbacks around API calls', async () => {
    const onRequestStart = vi.fn()
    const onRequestEnd = vi.fn()
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: 'ok' }),
    }))

    vi.stubGlobal('fetch', fetchMock)

    const apiClient = new TestApiClient('http://127.0.0.1:8000', {
      onRequestStart,
      onRequestEnd,
    })

    await apiClient.post('/spots', { title: 'Test spot' })

    expect(onRequestStart).toHaveBeenCalledOnce()
    expect(onRequestStart).toHaveBeenCalledWith({ method: 'POST', path: '/spots' })
    expect(onRequestEnd).toHaveBeenCalledOnce()
    expect(onRequestEnd).toHaveBeenCalledWith({ method: 'POST', path: '/spots' })
  })
})

describe('Session persistence and offline resilience', () => {
  it('restores persisted session from localStorage', () => {
    const localStorage = createMemoryStorage()
    vi.stubGlobal('localStorage', localStorage)

    const state = {
      session: {
        token: 'persisted-token',
        user: {
          id: 'user-1',
          username: 'alice',
          email: 'alice@example.com',
          display_name: 'Alice',
        },
      },
    }

    persistSession(state)

    const appState = createAppState()
    expect(appState.session.token).toBe('persisted-token')
    expect(appState.session.user?.id).toBe('user-1')
  })

  it('keeps UI data stable when spot loading fails', async () => {
    const api = {
      request: vi.fn(async () => {
        throw new Error('Backend offline')
      }),
    }
    const state = {
      session: {
        token: 'token',
      },
      spots: [{ id: 'existing-spot' }],
    }

    const service = new TestSpotsService(api, state)
    const spots = await service.list()

    expect(spots).toEqual([])
    expect(state.spots).toEqual([{ id: 'existing-spot' }])
    expect(String(service.lastError() || '').trim().length).toBeGreaterThan(0)
  })
})
