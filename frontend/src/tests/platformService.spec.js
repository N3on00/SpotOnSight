import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../platform/capacitorBridge', () => ({
  addAppStateChangeListener: vi.fn(async () => null),
  addKeyboardVisibilityListeners: vi.fn(async () => []),
  getPlatformName: vi.fn(() => 'web'),
  isNativePlatform: vi.fn(() => false),
  preferenceGet: vi.fn(async () => ''),
  preferenceRemove: vi.fn(async () => true),
  preferenceSet: vi.fn(async () => true),
  removeListener: vi.fn(async () => undefined),
  setStatusBarTheme: vi.fn(async () => true),
}))

import * as bridge from '../platform/capacitorBridge'
import { PlatformService } from '../services/platformService'

function createState() {
  return {
    session: {
      token: '',
      user: null,
    },
    map: {
      filterSubscriptions: [],
    },
    ui: {
      theme: 'light',
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  bridge.getPlatformName.mockReturnValue('web')
  bridge.isNativePlatform.mockReturnValue(false)
  bridge.preferenceGet.mockResolvedValue('')
})

describe('PlatformService', () => {
  it('hydrates native session/theme/subscriptions from preferences', async () => {
    bridge.isNativePlatform.mockReturnValue(true)
    bridge.getPlatformName.mockReturnValue('android')

    bridge.preferenceGet.mockImplementation(async (key) => {
      if (key === 'sos_web_session_v1') {
        return JSON.stringify({
          token: 'native-token',
          user: {
            id: 'user-7',
            username: 'native-user',
            email: 'native@example.test',
          },
        })
      }
      if (key === 'sos_web_theme_v1') {
        return 'dark'
      }
      if (key === 'sos_map_filter_subscriptions_v2:user-7') {
        return JSON.stringify([
          {
            id: 'sub-1',
            ownerUserId: 'user-7',
            label: 'Nearby favorites',
            createdAt: '2026-01-01T00:00:00.000Z',
            filters: {
              text: 'lake',
              tagsText: '',
              ownerText: '',
              visibility: 'all',
              onlyFavorites: true,
              radiusKm: 10,
            },
            center: null,
            snapshot: {},
          },
        ])
      }
      return ''
    })

    const state = createState()
    const service = new PlatformService(state)

    await service.hydrateState()

    expect(state.session.token).toBe('native-token')
    expect(state.session.user?.id).toBe('user-7')
    expect(state.ui.theme).toBe('dark')
    expect(state.map.filterSubscriptions).toHaveLength(1)
  })

  it('skips native preference writes on web platform', async () => {
    const state = createState()
    state.session.token = 'web-token'
    state.session.user = { id: 'user-1' }

    const service = new PlatformService(state)
    await service.persistSession()

    expect(bridge.preferenceSet).not.toHaveBeenCalled()
    expect(bridge.preferenceRemove).not.toHaveBeenCalled()
  })

  it('removes stored native session when auth state is empty', async () => {
    bridge.isNativePlatform.mockReturnValue(true)

    const service = new PlatformService(createState())
    await service.persistSession()

    expect(bridge.preferenceRemove).toHaveBeenCalledWith('sos_web_session_v1')
  })

  it('wires native app lifecycle to runtime start/stop', async () => {
    bridge.isNativePlatform.mockReturnValue(true)
    let appStateListener = null
    bridge.addAppStateChangeListener.mockImplementation(async (listener) => {
      appStateListener = listener
      return { remove: vi.fn(async () => undefined) }
    })

    const runtime = {
      start: vi.fn(),
      stop: vi.fn(),
      tick: vi.fn(async () => undefined),
    }

    const service = new PlatformService(createState())
    await service.initializeRuntimeLifecycle(runtime)

    expect(typeof appStateListener).toBe('function')

    appStateListener({ isActive: true })
    expect(runtime.start).toHaveBeenCalledOnce()
    expect(runtime.tick).toHaveBeenCalledWith(expect.objectContaining({ source: 'native-resume' }))

    appStateListener({ isActive: false })
    expect(runtime.stop).toHaveBeenCalledOnce()
  })
})
