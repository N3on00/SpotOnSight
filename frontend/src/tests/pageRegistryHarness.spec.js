import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../components/home/HomeMapWidget.vue', () => ({
  default: { name: 'HomeMapWidgetMock' },
}))

vi.mock('../components/map/MapWorkspace.vue', () => ({
  default: { name: 'MapWorkspaceMock' },
}))

import { MapWorkspaceBehavior } from '../components/map/MapWorkspaceBehavior'
import { UI_ACTIONS, UI_COMPONENT_IDS, UI_SCREENS, UI_SLOTS } from '../core/uiElements'
import {
  AuthPageHarness,
  HomePageHarness,
  MapPageHarness,
  PAGE_ACTIONS,
  PAGE_COMPONENTS,
  PAGE_HARNESS_CLASSES,
  ProfilePageHarness,
  SettingsPageHarness,
  SocialPageHarness,
  SupportPageHarness,
  createMockRouter,
} from './harness/pageRegistryHarness'

function flatten(values) {
  return Object.values(values || {}).flat()
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Page harness classes and registry contracts', () => {
  it.each(Object.values(UI_SCREENS))('exposes all registered components for %s', (screen) => {
    const PageClass = PAGE_HARNESS_CLASSES[screen]
    const page = new PageClass()
    const expectedBySlot = PAGE_COMPONENTS[screen] || {}

    for (const slot of Object.values(UI_SLOTS)) {
      expect(page.slotComponentIds(slot)).toEqual(expectedBySlot[slot] || [])
    }

    for (const componentId of flatten(expectedBySlot)) {
      const spec = page.componentSpec(componentId)
      expect(spec).toBeTruthy()

      const props = page.buildComponentProps(componentId)
      expect(props && typeof props).toBe('object')
    }
  })

  it.each(Object.values(UI_SCREENS))('exposes lifecycle and registered actions for %s', async (screen) => {
    const PageClass = PAGE_HARNESS_CLASSES[screen]
    const page = new PageClass()

    expect(page.lifecycle()).toBeTruthy()

    const actions = PAGE_ACTIONS[screen] || []
    for (const actionId of actions) {
      const payload = actionId === UI_ACTIONS.PROFILE_REFRESH ? { userId: 'user-2' } : {}
      await page.runAction(actionId, payload)
    }

    if (screen === UI_SCREENS.HOME || screen === UI_SCREENS.MAP || screen === UI_SCREENS.SOCIAL) {
      expect(page.controllers.spots.reload).toHaveBeenCalled()
      expect(page.controllers.social.reloadFavorites).toHaveBeenCalled()
    }
  })
})

describe('Auth page harness', () => {
  it('runs support and auth form callbacks with mock data', async () => {
    const page = new AuthPageHarness()

    const supportProps = page.buildComponentProps(UI_COMPONENT_IDS.AUTH_SUPPORT)
    await supportProps.onHelp()
    expect(page.app.ui.runAction).toHaveBeenCalledWith(UI_ACTIONS.AUTH_HELP)
    expect(page.services.notify.push).toHaveBeenCalledWith(expect.objectContaining({
      level: 'info',
      title: 'Support',
    }))

    const formsProps = page.buildComponentProps(UI_COMPONENT_IDS.AUTH_FORMS)
    await formsProps.onLogin({ usernameOrEmail: 'demo-user', password: 'Password123!' })
    await formsProps.onRegister({
      username: 'new-user',
      email: 'new-user@example.test',
      displayName: 'New User',
      password: 'Password123!',
    })

    expect(page.controllers.auth.login).toHaveBeenCalledWith('demo-user', 'Password123!')
    expect(page.controllers.auth.register).toHaveBeenCalledWith(expect.objectContaining({
      username: 'new-user',
      email: 'new-user@example.test',
    }))
    expect(page.controllers.spots.reload).toHaveBeenCalled()
    expect(page.controllers.social.reloadFavorites).toHaveBeenCalled()
    expect(page.router.push).toHaveBeenCalledWith({ name: UI_SCREENS.HOME })
  })
})

describe('Home page harness', () => {
  it('navigates and executes main discover callbacks', async () => {
    const page = new HomePageHarness()

    const mapWidgetProps = page.buildComponentProps(UI_COMPONENT_IDS.HOME_MAP_WIDGET)
    mapWidgetProps.onOpenMap({ lat: 47.39, lon: 8.53 })
    mapWidgetProps.onOpenSpot({ id: 'spot-1', lat: 47.4, lon: 8.5 })

    expect(page.router.push).toHaveBeenNthCalledWith(1, {
      name: UI_SCREENS.MAP,
      query: {
        lat: '47.39',
        lon: '8.53',
      },
    })

    expect(page.router.push).toHaveBeenNthCalledWith(2, {
      name: UI_SCREENS.MAP,
      query: {
        lat: '47.4',
        lon: '8.5',
        spotId: 'spot-1',
      },
    })

    const discoverProps = page.buildComponentProps(UI_COMPONENT_IDS.HOME_DISCOVER)
    await discoverProps.onRefresh()
    await discoverProps.onToggleFavorite('spot-1', true)
    await discoverProps.onLoadUserProfile('user-2')
    discoverProps.onOpenProfile('user-3')

    expect(page.controllers.spots.reload).toHaveBeenCalled()
    expect(page.controllers.social.toggleFavorite).toHaveBeenCalledWith('spot-1', true)
    expect(page.controllers.users.profile).toHaveBeenCalledWith('user-2')
    expect(page.router.push).toHaveBeenCalledWith({
      name: UI_SCREENS.PROFILE,
      params: {
        userId: 'user-3',
      },
    })
  })
})

describe('Map page harness', () => {
  it('injects map behavior and parses focus request from route', async () => {
    const routeBundle = createMockRouter({
      path: '/map?lat=47.381&lon=8.538&spotId=spot-2',
      name: UI_SCREENS.MAP,
      query: {
        lat: '47.381',
        lon: '8.538',
        spotId: 'spot-2',
      },
    })

    const page = new MapPageHarness({
      router: routeBundle.router,
      route: routeBundle.route,
    })

    const headerProps = page.buildComponentProps(UI_COMPONENT_IDS.MAP_HEADER)
    await headerProps.onReload()
    expect(page.controllers.spots.reload).toHaveBeenCalled()
    expect(page.controllers.social.reloadFavorites).toHaveBeenCalled()
    expect(page.services.notify.push).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Map refreshed',
    }))

    const workspaceProps = page.buildComponentProps(UI_COMPONENT_IDS.MAP_WORKSPACE)
    expect(workspaceProps.state).toBe(page.state)
    expect(workspaceProps.focusRequest).toEqual({
      lat: 47.381,
      lon: 8.538,
      spotId: 'spot-2',
    })
    expect(workspaceProps.behavior).toBeInstanceOf(MapWorkspaceBehavior)
  })
})

describe('Profile page harness', () => {
  it('loads profile state and executes summary callbacks', async () => {
    const page = new ProfilePageHarness()

    await page.runAction(UI_ACTIONS.PROFILE_REFRESH, { userId: 'user-2' })
    expect(page.controllers.users.profile).toHaveBeenCalledWith('user-2')
    expect(page.controllers.spots.byUser).toHaveBeenCalledWith('user-2')
    expect(page.controllers.spots.favoritesOfUser).toHaveBeenCalledWith('user-2')
    expect(page.controllers.social.followingOf).toHaveBeenCalledWith('user-1')

    const summaryProps = page.buildComponentProps(UI_COMPONENT_IDS.PROFILE_SUMMARY)
    await summaryProps.onFollowProfile()
    await summaryProps.onUnfollowProfile()
    summaryProps.onGoToSpot({ id: 'spot-2', lat: 47.38, lon: 8.54 })
    await summaryProps.onToggleFavorite('spot-2', false)
    summaryProps.onOpenProfile('user-3')

    expect(page.controllers.social.follow).toHaveBeenCalledWith('user-2')
    expect(page.controllers.social.unfollow).toHaveBeenCalledWith('user-2')
    expect(page.controllers.social.toggleFavorite).toHaveBeenCalledWith('spot-2', false)
    expect(page.router.push).toHaveBeenCalledWith({
      name: UI_SCREENS.MAP,
      query: {
        lat: '47.38',
        lon: '8.54',
        spotId: 'spot-2',
      },
    })
    expect(page.router.push).toHaveBeenCalledWith({
      name: UI_SCREENS.PROFILE,
      params: {
        userId: 'user-3',
      },
    })
  })
})

describe('Settings page harness', () => {
  it('executes copy, theme toggle, and save callbacks', async () => {
    const page = new SettingsPageHarness()
    const writeText = vi.fn(async () => true)
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText,
      },
    })

    const formProps = page.buildComponentProps(UI_COMPONENT_IDS.SETTINGS_FORM)
    await formProps.onCopyUserId()
    await formProps.onToggleTheme()
    await formProps.onSave({ displayName: 'Updated Demo User' })

    expect(writeText).toHaveBeenCalledWith('user-1')
    expect(page.state.ui.theme).toBe('dark')
    expect(page.controllers.users.updateProfile).toHaveBeenCalledWith(expect.objectContaining({
      displayName: 'Updated Demo User',
    }))
    expect(page.controllers.spots.reload).toHaveBeenCalled()
    expect(page.controllers.social.followersOf).toHaveBeenCalledWith('user-1')
  })
})

describe('Social page harness', () => {
  it('runs social hub callbacks against mock controllers', async () => {
    const page = new SocialPageHarness()
    const hubProps = page.buildComponentProps(UI_COMPONENT_IDS.SOCIAL_HUB)

    await hubProps.onSearch('demo')
    await hubProps.onRefresh()
    await hubProps.onFollow('user-2')
    await hubProps.onUnfollow('user-2')
    await hubProps.onApproveRequest('user-5')
    await hubProps.onRejectRequest('user-5')
    await hubProps.onRemoveFollower('user-4')
    await hubProps.onBlock('user-6')
    await hubProps.onUnblock('user-6')
    hubProps.onOpenProfile('user-3')

    expect(page.controllers.users.searchUsers).toHaveBeenCalledWith('demo', 30)
    expect(page.state.social.searchResults).toEqual(expect.arrayContaining([
      expect.objectContaining({
        username: 'demo-match',
      }),
    ]))
    expect(page.controllers.social.follow).toHaveBeenCalledWith('user-2')
    expect(page.controllers.social.unfollow).toHaveBeenCalledWith('user-2')
    expect(page.controllers.social.approveRequest).toHaveBeenCalledWith('user-5')
    expect(page.controllers.social.rejectRequest).toHaveBeenCalledWith('user-5')
    expect(page.controllers.social.removeFollower).toHaveBeenCalledWith('user-4')
    expect(page.controllers.social.block).toHaveBeenCalledWith('user-6')
    expect(page.controllers.social.unblock).toHaveBeenCalledWith('user-6')
    expect(page.router.push).toHaveBeenCalledWith({
      name: UI_SCREENS.PROFILE,
      params: {
        userId: 'user-3',
      },
    })
  })
})

describe('Support page harness', () => {
  it('submits support payload with route context', async () => {
    const routeBundle = createMockRouter({
      path: '/support?from=map',
      name: UI_SCREENS.SUPPORT,
    })

    const page = new SupportPageHarness({
      router: routeBundle.router,
      route: routeBundle.route,
    })

    const supportProps = page.buildComponentProps(UI_COMPONENT_IDS.SUPPORT_FORM)
    expect(supportProps.currentPath).toBe('/support?from=map')

    const payload = {
      category: 'feature',
      subject: 'Offline map cache',
      message: 'Please add optional offline map downloads.',
      contactEmail: 'demo@example.test',
      allowContact: true,
      page: '/map',
    }

    const ok = await supportProps.onSubmit(payload)
    expect(ok).toBe(true)
    expect(page.controllers.support.submitTicket).toHaveBeenCalledWith(payload)
  })
})
