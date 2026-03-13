import { vi } from 'vitest'

import { registerComponentDecorators } from '../../bootstrap/componentDecoratorRegistrations'
import { registerErrorHandlers } from '../../bootstrap/errorHandlerRegistrations'
import { registerUi } from '../../bootstrap/uiRegistrations'
import { getAction, getComponents } from '../../core/registry'
import { getScreenLifecycle } from '../../core/screenRegistry'
import { UI_ACTIONS, UI_COMPONENT_IDS, UI_SCREENS, UI_SLOTS } from '../../core/uiElements'

let initialized = false

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function mergeRecords(base, override) {
  if (!isPlainObject(base)) return override
  if (!isPlainObject(override)) return base

  const out = { ...base }
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = mergeRecords(out[key], value)
      continue
    }
    out[key] = value
  }
  return out
}

function cloneState(value) {
  return JSON.parse(JSON.stringify(value))
}

function createDefaultState() {
  return {
    config: {
      apiBaseUrl: 'https://api.example.test',
      supportEmail: 'support@example.test',
    },
    session: {
      token: 'session-token',
      user: {
        id: 'user-1',
        username: 'demo-user',
        display_name: 'Demo User',
        email: 'demo@example.test',
      },
    },
    spots: [
      {
        id: 'spot-1',
        title: 'Alpine Viewpoint',
        description: 'Scenic mountain lookout.',
        owner_id: 'user-2',
        lat: 47.3769,
        lon: 8.5417,
        tags: ['nature', 'hiking'],
        visibility: 'public',
        invite_user_ids: [],
        images: [],
      },
      {
        id: 'spot-2',
        title: 'City Riverside',
        description: 'Evening city walk.',
        owner_id: 'user-3',
        lat: 47.3842,
        lon: 8.5324,
        tags: ['city'],
        visibility: 'public',
        invite_user_ids: [],
        images: [],
      },
    ],
    favorites: ['spot-1'],
    notifications: [],
    notificationLog: [],
    loading: {
      authLogin: false,
      authRegister: false,
      homeRefresh: false,
      socialReload: false,
      socialFollow: false,
      socialUnfollow: false,
      socialSearch: false,
      mapReload: false,
      mapSave: false,
      mapDelete: false,
      mapFavorite: false,
      mapShare: false,
      settingsLoad: false,
      settingsSave: false,
      profileLoad: false,
      supportSubmit: false,
    },
    loadingCounts: {},
    social: {
      followersCount: 1,
      followingCount: 1,
      followers: [
        { id: 'user-4', username: 'follower-one', display_name: 'Follower One' },
      ],
      following: [
        { id: 'user-2', username: 'owner-two', display_name: 'Owner Two' },
      ],
      searchResults: [],
      incomingRequests: [
        { id: 'user-5', username: 'pending-user', display_name: 'Pending User' },
      ],
      blockedUsers: [
        { id: 'user-6', username: 'blocked-user', display_name: 'Blocked User' },
      ],
    },
    map: {
      center: [47.3769, 8.5417],
      zoom: 12,
      draftLat: null,
      draftLon: null,
      filterSubscriptions: [],
    },
    profile: {
      current: {
        id: 'user-2',
        username: 'owner-two',
        display_name: 'Owner Two',
        email: 'owner.two@example.test',
      },
      createdSpots: [],
      favoriteSpots: [],
      viewedUserId: 'user-2',
    },
    ui: {
      theme: 'light',
      activeScreen: '',
    },
  }
}

function createDefaultControllers(state) {
  return {
    auth: {
      login: vi.fn(async () => true),
      register: vi.fn(async () => true),
      lastError: vi.fn(() => ''),
    },
    spots: {
      reload: vi.fn(async () => state.spots),
      saveSpot: vi.fn(async () => true),
      deleteSpot: vi.fn(async () => true),
      byUser: vi.fn(async (userId) => {
        return state.spots.filter((spot) => String(spot.owner_id) === String(userId))
      }),
      favoritesOfUser: vi.fn(async () => state.spots.slice(0, 1)),
      lastError: vi.fn(() => ''),
    },
    social: {
      reloadFavorites: vi.fn(async () => state.favorites),
      toggleFavorite: vi.fn(async () => true),
      share: vi.fn(async () => true),
      follow: vi.fn(async () => true),
      unfollow: vi.fn(async () => true),
      removeFollower: vi.fn(async () => true),
      incomingRequests: vi.fn(async () => state.social.incomingRequests),
      approveRequest: vi.fn(async () => true),
      rejectRequest: vi.fn(async () => true),
      block: vi.fn(async () => true),
      unblock: vi.fn(async () => true),
      blockedUsers: vi.fn(async () => state.social.blockedUsers),
      followersOf: vi.fn(async () => state.social.followers),
      followingOf: vi.fn(async () => state.social.following),
      lastError: vi.fn(() => ''),
    },
    users: {
      refreshProfile: vi.fn(async () => true),
      updateProfile: vi.fn(async () => true),
      searchUsers: vi.fn(async (query) => {
        const q = String(query || '').trim().toLowerCase()
        if (!q) return []
        return [
          {
            id: 'user-8',
            username: `${q}-match`,
            display_name: 'Matched User',
            email: `${q}@example.test`,
          },
        ]
      }),
      friendDirectory: vi.fn(async () => state.social.following),
      profile: vi.fn(async (userId) => ({
        id: String(userId || 'user-2'),
        username: `user-${String(userId || 'user-2')}`,
        display_name: `Profile ${String(userId || 'user-2')}`,
        email: `${String(userId || 'user-2')}@example.test`,
      })),
      lastError: vi.fn(() => ''),
    },
    support: {
      submitTicket: vi.fn(async () => ({ id: 'ticket-1' })),
      lastError: vi.fn(() => ''),
    },
    comments: {
      listBySpot: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: 'comment-1', message: 'hello' })),
      update: vi.fn(async () => ({ id: 'comment-1', message: 'updated' })),
      delete: vi.fn(async () => true),
      lastError: vi.fn(() => ''),
    },
    meetups: {
      list: vi.fn(async () => []),
      listInvites: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: 'meetup-1', title: 'Meetup' })),
      remove: vi.fn(async () => true),
      respond: vi.fn(async () => ({ meetup_id: 'meetup-1', status: 'accepted' })),
      listComments: vi.fn(async () => []),
      createComment: vi.fn(async () => ({ id: 'meetup-comment-1', message: 'hello' })),
      lastError: vi.fn(() => ''),
    },
  }
}

function createDefaultServices() {
  return {
    notify: {
      push: vi.fn(),
    },
    locationSearch: {
      searchPlaces: vi.fn(async () => []),
    },
  }
}

export function initializeRegistryTestHarness() {
  if (initialized) return
  initialized = true
  registerComponentDecorators()
  registerErrorHandlers()
  registerUi()
}

export function createMockRouter({
  path = '/',
  name = '',
  params = {},
  query = {},
  meta = {},
} = {}) {
  const route = {
    fullPath: path,
    name,
    params: { ...params },
    query: { ...query },
    meta: { ...meta },
  }

  const router = {
    push: vi.fn(async () => true),
    replace: vi.fn(async () => true),
    currentRoute: {
      value: route,
    },
  }

  return {
    router,
    route,
  }
}

export function createMockApp({
  state: stateOverride = {},
  controllers: controllerOverride = {},
  services: serviceOverride = {},
} = {}) {
  initializeRegistryTestHarness()

  const state = mergeRecords(cloneState(createDefaultState()), stateOverride)
  const controllers = mergeRecords(createDefaultControllers(state), controllerOverride)
  const services = mergeRecords(createDefaultServices(), serviceOverride)

  const app = {
    state,
    controller(id) {
      if (!(id in controllers)) {
        throw new Error(`Unknown controller: ${id}`)
      }
      return controllers[id]
    },
    service(id) {
      if (!(id in services)) {
        throw new Error(`Unknown service: ${id}`)
      }
      return services[id]
    },
  }

  app.ui = {
    runAction: vi.fn(async (actionId, payload = {}) => {
      const handler = getAction(actionId)
      if (!handler) {
        throw new Error(`Unknown action_id: ${actionId}`)
      }
      return handler({ app, payload })
    }),
    isAuthenticated: () => Boolean(String(app.state.session.token || '').trim()),
  }

  return {
    app,
    state,
    controllers,
    services,
  }
}

export class RegisteredPageHarness {
  static screen = ''

  constructor({ screen = '', app, state, controllers, services, router, route } = {}) {
    initializeRegistryTestHarness()

    const targetScreen = String(screen || this.constructor.screen || '').trim()
    if (!targetScreen) {
      throw new Error('RegisteredPageHarness requires a screen id')
    }

    const appBundle = app
      ? {
          app,
          state: app.state,
          controllers: controllers || null,
          services: services || null,
        }
      : createMockApp({ state, controllers, services })

    const routeBundle = createMockRouter({
      path: `/${targetScreen}`,
      name: targetScreen,
    })

    this.screen = targetScreen
    this.app = appBundle.app
    this.state = appBundle.state
    this.controllers = appBundle.controllers
    this.services = appBundle.services
    this.router = router || routeBundle.router
    this.route = route || routeBundle.route

    if (this.router?.currentRoute && this.router.currentRoute.value !== this.route) {
      this.router.currentRoute.value = this.route
    }
  }

  lifecycle() {
    return getScreenLifecycle(this.screen)
  }

  componentSpecs(slot) {
    return getComponents(this.screen, slot)
  }

  slotComponentIds(slot) {
    return this.componentSpecs(slot).map((spec) => spec.id)
  }

  componentIds() {
    const ids = []
    for (const slot of Object.values(UI_SLOTS)) {
      ids.push(...this.slotComponentIds(slot))
    }
    return ids
  }

  componentSpec(componentId) {
    const target = String(componentId || '').trim()
    if (!target) return null

    for (const slot of Object.values(UI_SLOTS)) {
      const spec = this.componentSpecs(slot).find((entry) => entry.id === target)
      if (spec) return spec
    }
    return null
  }

  buildComponentProps(componentId, contextOverride = {}) {
    const spec = this.componentSpec(componentId)
    if (!spec) {
      throw new Error(`Unknown component '${componentId}' for screen '${this.screen}'`)
    }

    const buildProps = typeof spec.buildProps === 'function' ? spec.buildProps : () => ({})
    return buildProps({
      app: this.app,
      router: this.router,
      route: this.route,
      screen: this.screen,
      ...contextOverride,
    })
  }

  async runAction(actionId, payload = {}) {
    return this.app.ui.runAction(actionId, payload)
  }
}

export class AuthPageHarness extends RegisteredPageHarness {
  static screen = UI_SCREENS.AUTH
}

export class HomePageHarness extends RegisteredPageHarness {
  static screen = UI_SCREENS.HOME
}

export class MapPageHarness extends RegisteredPageHarness {
  static screen = UI_SCREENS.MAP
}

export class SocialPageHarness extends RegisteredPageHarness {
  static screen = UI_SCREENS.SOCIAL
}

export class SettingsPageHarness extends RegisteredPageHarness {
  static screen = UI_SCREENS.SETTINGS
}

export class ProfilePageHarness extends RegisteredPageHarness {
  static screen = UI_SCREENS.PROFILE
}

export class SupportPageHarness extends RegisteredPageHarness {
  static screen = UI_SCREENS.SUPPORT
}

export const PAGE_COMPONENTS = Object.freeze({
  [UI_SCREENS.AUTH]: Object.freeze({
    [UI_SLOTS.HEADER]: Object.freeze([UI_COMPONENT_IDS.AUTH_HERO]),
    [UI_SLOTS.MAIN]: Object.freeze([UI_COMPONENT_IDS.AUTH_FORMS]),
    [UI_SLOTS.FOOTER]: Object.freeze([UI_COMPONENT_IDS.AUTH_SUPPORT]),
  }),
  [UI_SCREENS.HOME]: Object.freeze({
    [UI_SLOTS.HEADER]: Object.freeze([UI_COMPONENT_IDS.HOME_HERO]),
    [UI_SLOTS.MAIN]: Object.freeze([UI_COMPONENT_IDS.HOME_MAP_WIDGET, UI_COMPONENT_IDS.HOME_DISCOVER]),
  }),
  [UI_SCREENS.MAP]: Object.freeze({
    [UI_SLOTS.HEADER]: Object.freeze([UI_COMPONENT_IDS.MAP_HEADER]),
    [UI_SLOTS.MAIN]: Object.freeze([UI_COMPONENT_IDS.MAP_WORKSPACE]),
  }),
  [UI_SCREENS.SOCIAL]: Object.freeze({
    [UI_SLOTS.HEADER]: Object.freeze([UI_COMPONENT_IDS.SOCIAL_HERO]),
    [UI_SLOTS.MAIN]: Object.freeze([UI_COMPONENT_IDS.SOCIAL_HUB, UI_COMPONENT_IDS.SOCIAL_MEETUPS]),
  }),
  [UI_SCREENS.SETTINGS]: Object.freeze({
    [UI_SLOTS.HEADER]: Object.freeze([UI_COMPONENT_IDS.SETTINGS_HERO]),
    [UI_SLOTS.MAIN]: Object.freeze([UI_COMPONENT_IDS.SETTINGS_FORM]),
  }),
  [UI_SCREENS.PROFILE]: Object.freeze({
    [UI_SLOTS.HEADER]: Object.freeze([UI_COMPONENT_IDS.PROFILE_HERO]),
    [UI_SLOTS.MAIN]: Object.freeze([UI_COMPONENT_IDS.PROFILE_SUMMARY]),
  }),
  [UI_SCREENS.SUPPORT]: Object.freeze({
    [UI_SLOTS.HEADER]: Object.freeze([UI_COMPONENT_IDS.SUPPORT_HERO]),
    [UI_SLOTS.MAIN]: Object.freeze([UI_COMPONENT_IDS.SUPPORT_FORM]),
  }),
})

export const PAGE_ACTIONS = Object.freeze({
  [UI_SCREENS.AUTH]: Object.freeze([UI_ACTIONS.AUTH_HELP]),
  [UI_SCREENS.HOME]: Object.freeze([UI_ACTIONS.HOME_REFRESH]),
  [UI_SCREENS.MAP]: Object.freeze([UI_ACTIONS.MAP_RELOAD]),
  [UI_SCREENS.SOCIAL]: Object.freeze([UI_ACTIONS.SOCIAL_REFRESH]),
  [UI_SCREENS.SETTINGS]: Object.freeze([UI_ACTIONS.SETTINGS_LOAD]),
  [UI_SCREENS.PROFILE]: Object.freeze([UI_ACTIONS.PROFILE_REFRESH]),
  [UI_SCREENS.SUPPORT]: Object.freeze([]),
})

export const PAGE_HARNESS_CLASSES = Object.freeze({
  [UI_SCREENS.AUTH]: AuthPageHarness,
  [UI_SCREENS.HOME]: HomePageHarness,
  [UI_SCREENS.MAP]: MapPageHarness,
  [UI_SCREENS.SOCIAL]: SocialPageHarness,
  [UI_SCREENS.SETTINGS]: SettingsPageHarness,
  [UI_SCREENS.PROFILE]: ProfilePageHarness,
  [UI_SCREENS.SUPPORT]: SupportPageHarness,
})
