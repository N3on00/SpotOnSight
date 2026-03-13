import { describe, expect, it, vi } from 'vitest'

import { registerRuntime } from '../bootstrap/runtimeRegistrations'
import { RuntimeService } from '../services/runtimeService'
import { ActivityWatchService } from '../services/activityWatchService'

class TestRuntimeService extends RuntimeService {}
class TestActivityWatchService extends ActivityWatchService {}

function createState() {
  return {
    session: {
      token: 'token',
      user: { id: 'me-1' },
    },
    social: {
      followers: [],
      followersCount: 0,
      incomingRequests: [],
    },
    map: {
      filterSubscriptions: [],
    },
    spots: [],
    favorites: [],
  }
}

function createContext({ authenticated = true } = {}) {
  registerRuntime()

  const state = createState()
  const notify = { push: vi.fn() }
  const social = {
    followersOf: vi.fn(async () => []),
    incomingRequests: vi.fn(async () => []),
  }
  const spots = {
    reload: vi.fn(async () => {
      state.spots = []
    }),
  }

  const ctx = {
    state,
    ui: {
      isAuthenticated: () => authenticated,
    },
    service: null,
    controller: (id) => {
      if (id === 'social') return social
      if (id === 'spots') return spots
      throw new Error(`Unknown controller: ${id}`)
    },
  }

  const activityWatch = new TestActivityWatchService(ctx)

  const services = {
    activityWatch,
    notify,
  }

  ctx.service = (id) => {
    const service = services[id]
    if (!service) {
      throw new Error(`Unknown service: ${id}`)
    }
    return service
  }

  return { ctx, activityWatch }
}

describe('RuntimeService orchestration', () => {
  it('starts, ticks, and stops all registered runtime services', async () => {
    const { ctx, activityWatch } = createContext({ authenticated: true })
    const runtime = new TestRuntimeService(ctx)

    const startSpy = vi.spyOn(activityWatch, 'start')
    const tickSpy = vi.spyOn(activityWatch, 'tick')
    const stopSpy = vi.spyOn(activityWatch, 'stop')

    runtime.start()
    await runtime.tick({ notify: true })
    runtime.stop()

    expect(startSpy).toHaveBeenCalledOnce()
    expect(tickSpy).toHaveBeenCalledWith({ notify: true })
    expect(stopSpy).toHaveBeenCalledOnce()
  })

  it('skips tick when authentication is missing', async () => {
    const { ctx, activityWatch } = createContext({ authenticated: false })
    const runtime = new TestRuntimeService(ctx)

    const tickSpy = vi.spyOn(activityWatch, 'tick')

    runtime.start()
    await runtime.tick({ notify: true })
    runtime.stop()

    expect(tickSpy).not.toHaveBeenCalled()
  })

  it('ticks on runtime interval while started', async () => {
    vi.useFakeTimers()

    try {
      const { ctx, activityWatch } = createContext({ authenticated: true })
      const runtime = new TestRuntimeService(ctx, { tickIntervalMs: 10000 })
      const tickSpy = vi.spyOn(activityWatch, 'tick')

      runtime.start()
      await vi.advanceTimersByTimeAsync(10050)
      runtime.stop()

      expect(tickSpy).toHaveBeenCalledWith(expect.objectContaining({ source: 'runtime-interval' }))
    } finally {
      vi.useRealTimers()
    }
  })
})
