import { describe, expect, it, vi } from 'vitest'

import { UI_ACTIONS } from '../core/uiElements'
import { MapWorkspaceBehavior } from '../components/map/MapWorkspaceBehavior'

class TestMapWorkspaceBehavior extends MapWorkspaceBehavior {}

function createBehaviorHarness() {
  const notifyPush = vi.fn()
  const runUiAction = vi.fn(async () => true)
  const navigate = vi.fn(async () => true)

  const spotsController = {
    saveSpot: vi.fn(async () => true),
    deleteSpot: vi.fn(async () => true),
    lastError: vi.fn(() => ''),
  }

  const socialController = {
    toggleFavorite: vi.fn(async () => true),
    share: vi.fn(async () => true),
    lastError: vi.fn(() => ''),
  }

  const usersController = {
    profile: vi.fn(async () => ({ id: 'u-1' })),
    searchUsers: vi.fn(async () => []),
    friendDirectory: vi.fn(async () => []),
  }

  const app = {
    controller: (id) => {
      if (id === 'spots') return spotsController
      if (id === 'social') return socialController
      if (id === 'users') return usersController
      throw new Error(`Unknown controller: ${id}`)
    },
    service: (id) => {
      if (id === 'notify') return { push: notifyPush }
      if (id === 'locationSearch') {
        return {
          searchPlaces: vi.fn(async () => []),
        }
      }
      throw new Error(`Unknown service: ${id}`)
    },
    ui: {
      runAction: runUiAction,
    },
  }

  const behavior = new TestMapWorkspaceBehavior({
    app,
    runUiAction,
    navigate,
    route: { fullPath: '/map' },
    screen: 'map',
  })

  return {
    behavior,
    runUiAction,
    navigate,
    notifyPush,
    spotsController,
    socialController,
  }
}

describe('MapWorkspaceBehavior', () => {
  it('parses focus request from route query', () => {
    const focus = TestMapWorkspaceBehavior.parseFocusRequest({
      query: {
        lat: '47.12',
        lon: '8.55',
        spotId: 'spot-1',
      },
    })

    expect(focus).toEqual({
      lat: 47.12,
      lon: 8.55,
      spotId: 'spot-1',
    })
  })

  it('saves spot, reloads via action, and notifies success', async () => {
    const { behavior, runUiAction, spotsController, notifyPush } = createBehaviorHarness()

    const ok = await behavior.saveSpot({ title: 'Spot' })

    expect(ok).toBe(true)
    expect(spotsController.saveSpot).toHaveBeenCalled()
    expect(runUiAction).toHaveBeenCalledWith(UI_ACTIONS.MAP_RELOAD, {})
    expect(notifyPush).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Saved',
    }))
  })

  it('delegates profile navigation through behavior', async () => {
    const { behavior, navigate } = createBehaviorHarness()

    behavior.openProfile('user-22')
    expect(navigate).toHaveBeenCalledWith({
      name: 'profile',
      params: { userId: 'user-22' },
    })
  })
})
