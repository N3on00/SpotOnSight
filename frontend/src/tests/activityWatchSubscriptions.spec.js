import { describe, expect, it, vi } from 'vitest'

import { createFilterSubscription } from '../models/spotSubscriptions'
import { ActivityWatchService } from '../services/activityWatchService'

class TestActivityWatchService extends ActivityWatchService {}

describe('ActivityWatchService filter subscription notifications', () => {
  it('notifies only for owned subscriptions with changed snapshots', async () => {
    const owned = createFilterSubscription({
      ownerUserId: 'me-1',
      label: 'Owned subscription',
      snapshot: {
        'spot-1': 'old-signature',
      },
    })

    const foreign = createFilterSubscription({
      ownerUserId: 'other-user',
      label: 'Foreign subscription',
      snapshot: {
        'spot-2': 'old-signature',
      },
    })

    const notifyPush = vi.fn()

    const state = {
      session: {
        token: 'token',
        user: {
          id: 'me-1',
        },
      },
      social: {
        followers: [],
        followersCount: 0,
        incomingRequests: [],
      },
      map: {
        filterSubscriptions: [owned, foreign],
      },
      spots: [],
      favorites: [],
    }

    const socialController = {
      followersOf: vi.fn(async () => []),
      incomingRequests: vi.fn(async () => []),
    }
    const spotsController = {
      reload: vi.fn(async () => {
        state.spots = [
          {
            id: 'spot-1',
            owner_id: 'owner-1',
            title: 'New title',
            description: 'Changed',
            tags: ['nature'],
            lat: 47.3,
            lon: 8.5,
            visibility: 'public',
            images: [],
            invite_user_ids: [],
            created_at: '2026-02-17T00:00:00Z',
          },
        ]
      }),
    }

    const app = {
      state,
      ui: {
        isAuthenticated: () => true,
      },
      controller: (id) => {
        if (id === 'social') return socialController
        if (id === 'spots') return spotsController
        throw new Error(`Unknown controller: ${id}`)
      },
      service: (id) => {
        if (id === 'notify') {
          return {
            push: notifyPush,
          }
        }
        throw new Error(`Unknown service: ${id}`)
      },
    }

    const watchService = new TestActivityWatchService(app)
    watchService._seeded = true

    await watchService.tick({ notify: true })

    expect(spotsController.reload).toHaveBeenCalledOnce()

    const titles = notifyPush.mock.calls.map(([payload]) => String(payload?.title || ''))
    expect(titles).toContain('Subscription update')

    const saved = Array.isArray(state.map.filterSubscriptions)
      ? state.map.filterSubscriptions
      : []
    expect(saved).toHaveLength(1)
    expect(saved[0].ownerUserId).toBe('me-1')
  })

  it('notifies when subscription starts with empty snapshot and new spot appears', async () => {
    const owned = createFilterSubscription({
      ownerUserId: 'me-1',
      label: 'Empty baseline',
      snapshot: {},
    })

    const notifyPush = vi.fn()
    const state = {
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
        filterSubscriptions: [owned],
      },
      spots: [],
      favorites: [],
    }

    const app = {
      state,
      ui: {
        isAuthenticated: () => true,
      },
      controller: (id) => {
        if (id === 'social') {
          return {
            followersOf: vi.fn(async () => []),
            incomingRequests: vi.fn(async () => []),
          }
        }
        if (id === 'spots') {
          return {
            reload: vi.fn(async () => {
              state.spots = [
                {
                  id: 'spot-new',
                  owner_id: 'owner-1',
                  title: 'New matching spot',
                  description: 'Just created',
                  tags: [],
                  lat: 47.1,
                  lon: 8.4,
                  visibility: 'public',
                  images: [],
                  invite_user_ids: [],
                  created_at: '2026-02-17T00:00:00Z',
                },
              ]
            }),
          }
        }
        throw new Error(`Unknown controller: ${id}`)
      },
      service: (id) => {
        if (id === 'notify') {
          return { push: notifyPush }
        }
        throw new Error(`Unknown service: ${id}`)
      },
    }

    const watchService = new TestActivityWatchService(app)
    watchService._seeded = true

    await watchService.tick({ notify: true })

    const messages = notifyPush.mock.calls.map(([payload]) => String(payload?.message || ''))
    expect(messages.some((text) => text.includes('1 new'))).toBe(true)
  })

  it('still checks subscriptions when social polling fails', async () => {
    const owned = createFilterSubscription({
      ownerUserId: 'me-1',
      label: 'Resilient check',
      snapshot: { 'spot-old': 'old' },
    })

    const notifyPush = vi.fn()
    const state = {
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
        filterSubscriptions: [owned],
      },
      spots: [],
      favorites: [],
    }

    const app = {
      state,
      ui: {
        isAuthenticated: () => true,
      },
      controller: (id) => {
        if (id === 'social') {
          return {
            followersOf: vi.fn(async () => {
              throw new Error('social offline')
            }),
            incomingRequests: vi.fn(async () => {
              throw new Error('social offline')
            }),
          }
        }
        if (id === 'spots') {
          return {
            reload: vi.fn(async () => {
              state.spots = [
                {
                  id: 'spot-fresh',
                  owner_id: 'owner-1',
                  title: 'Fresh spot',
                  description: 'Visible now',
                  tags: [],
                  lat: 47.2,
                  lon: 8.45,
                  visibility: 'public',
                  images: [],
                  invite_user_ids: [],
                  created_at: '2026-02-17T00:00:00Z',
                },
              ]
            }),
          }
        }
        throw new Error(`Unknown controller: ${id}`)
      },
      service: (id) => {
        if (id === 'notify') {
          return { push: notifyPush }
        }
        throw new Error(`Unknown service: ${id}`)
      },
    }

    const watchService = new TestActivityWatchService(app)
    watchService._seeded = true

    await watchService.tick({ notify: true })

    const titles = notifyPush.mock.calls.map(([payload]) => String(payload?.title || ''))
    expect(titles).toContain('Subscription update')
  })

  it('notifies immediately after relogin when new matching spots exist', async () => {
    const owned = createFilterSubscription({
      ownerUserId: 'me-1',
      label: 'Relogin watcher',
      snapshot: {
        'spot-old': 'previous-signature',
      },
    })

    const notifyPush = vi.fn()
    const state = {
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
        filterSubscriptions: [owned],
      },
      spots: [],
      favorites: [],
    }

    const app = {
      state,
      ui: {
        isAuthenticated: () => true,
      },
      controller: (id) => {
        if (id === 'social') {
          return {
            followersOf: vi.fn(async () => []),
            incomingRequests: vi.fn(async () => []),
          }
        }
        if (id === 'spots') {
          return {
            reload: vi.fn(async () => {
              state.spots = [
                {
                  id: 'spot-new-after-login',
                  owner_id: 'owner-2',
                  title: 'Post-login spot',
                  description: 'Created while user was offline',
                  tags: [],
                  lat: 47.25,
                  lon: 8.55,
                  visibility: 'public',
                  images: [],
                  invite_user_ids: [],
                  created_at: '2026-02-17T00:00:00Z',
                },
              ]
            }),
          }
        }
        throw new Error(`Unknown controller: ${id}`)
      },
      service: (id) => {
        if (id === 'notify') {
          return { push: notifyPush }
        }
        throw new Error(`Unknown service: ${id}`)
      },
    }

    const watchService = new TestActivityWatchService(app)
    watchService._seeded = false

    await watchService.tick({ notify: true })

    const titles = notifyPush.mock.calls.map(([payload]) => String(payload?.title || ''))
    expect(titles).toContain('Subscription update')
  })

  it('treats ownerless legacy subscriptions as owned by current user', async () => {
    const legacyOwned = {
      ...createFilterSubscription({
        ownerUserId: 'me-1',
        label: 'Legacy ownerless sub',
        snapshot: {},
      }),
      ownerUserId: '',
    }

    const notifyPush = vi.fn()
    const state = {
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
        filterSubscriptions: [legacyOwned],
      },
      spots: [],
      favorites: [],
    }

    const app = {
      state,
      ui: {
        isAuthenticated: () => true,
      },
      controller: (id) => {
        if (id === 'social') {
          return {
            followersOf: vi.fn(async () => []),
            incomingRequests: vi.fn(async () => []),
          }
        }
        if (id === 'spots') {
          return {
            reload: vi.fn(async () => {
              state.spots = [
                {
                  id: 'legacy-spot-1',
                  owner_id: 'owner-1',
                  title: 'Legacy spot',
                  description: 'Matched from ownerless subscription',
                  tags: [],
                  lat: 47.0,
                  lon: 8.0,
                  visibility: 'public',
                  images: [],
                  invite_user_ids: [],
                  created_at: '2026-02-17T00:00:00Z',
                },
              ]
            }),
          }
        }
        throw new Error(`Unknown controller: ${id}`)
      },
      service: (id) => {
        if (id === 'notify') {
          return { push: notifyPush }
        }
        throw new Error(`Unknown service: ${id}`)
      },
    }

    const watchService = new TestActivityWatchService(app)
    watchService._seeded = true

    await watchService.tick({ notify: true })

    expect(state.map.filterSubscriptions).toHaveLength(1)
    expect(state.map.filterSubscriptions[0].ownerUserId).toBe('me-1')
  })
})
