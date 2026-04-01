import { createAdminActions, createAuthActions, createCommentsActions, createDashboardActions, createMeetupsActions, createProfileActions, createSocialActions, createSpotsActions, createSupportActions, createUsersActions } from '../actions'
import { handleUnauthorizedSession } from '../bootstrap/unauthorizedHandler'
import { registerAdminUi } from '../registrations/adminUi'
import { registerAuthUi } from '../registrations/authUi'
import { registerHomeUi } from '../registrations/homeUi'
import { registerMapUi } from '../registrations/mapUi'
import { registerProfileUi } from '../registrations/profileUi'
import { registerSettingsUi } from '../registrations/settingsUi'
import { registerSocialUi } from '../registrations/socialUi'
import { registerSupportUi } from '../registrations/supportUi'
import { AdminService } from '../services/adminService'
import { ActivityWatchService } from '../services/activityWatchService'
import { ApiClient } from '../services/apiClient'
import { ApiGatewayService } from '../services/apiGatewayService'
import { AuthService } from '../services/authService'
import { CommentsService } from '../services/commentsService'
import { DashboardService } from '../services/dashboardService'
import { LocationSearchService } from '../services/locationSearchService'
import { MeetupsService } from '../services/meetupsService'
import { NotificationService } from '../services/notificationService'
import { PlatformService } from '../services/platformService'
import { RuntimeService } from '../services/runtimeService'
import { SocialService } from '../services/socialService'
import { SpotsService } from '../services/spotsService'
import { SupportService } from '../services/supportService'
import { UsersService } from '../services/usersService'
import { createActorRegistry } from './createActorRegistry'

const ACTIVITY_WATCH_BINDING = Object.freeze({
  id: 'activity.watch',
  serviceId: 'activityWatch',
  startMethod: 'start',
  stopMethod: 'stop',
  tickMethod: 'tick',
  requiresAuth: true,
})

const SERVICE_BUILDERS = Object.freeze({
  apiClient: ({ beginBackendRequest, endBackendRequest }) => (ctx) => new ApiClient(ctx.state.config.apiBaseUrl, {
    onUnauthorized: () => handleUnauthorizedSession(ctx),
    onRequestStart: beginBackendRequest,
    onRequestEnd: endBackendRequest,
  }),
  apiGateway: () => (ctx) => new ApiGatewayService(ctx.service('apiClient'), ctx.state),
  locationSearch: () => () => new LocationSearchService(),
  notify: () => (ctx) => new NotificationService(ctx.state),
  activityWatch: () => (ctx) => new ActivityWatchService(ctx),
  runtime: () => (ctx, registry) => new RuntimeService(ctx, { bindings: registry.runtimeBindings }),
  platform: () => (ctx) => new PlatformService(ctx.state),
  dashboard: () => (ctx) => new DashboardService(ctx),
  authService: () => (ctx) => new AuthService(ctx.service('apiGateway'), ctx.state),
  spotsService: () => (ctx) => new SpotsService(ctx.service('apiGateway'), ctx.state),
  socialService: () => (ctx) => new SocialService(ctx.service('apiGateway'), ctx.state),
  usersService: () => (ctx) => new UsersService(ctx.service('apiGateway'), ctx.state),
  supportService: () => (ctx) => new SupportService(ctx.service('apiGateway'), ctx.state),
  comments: () => (ctx) => new CommentsService(ctx.service('apiGateway'), ctx.state),
  meetups: () => (ctx) => new MeetupsService(ctx.service('apiGateway'), ctx.state),
  adminService: () => (ctx) => new AdminService(ctx.service('apiGateway'), ctx.state),
})

const ACTION_BUILDERS = Object.freeze({
  dashboard: () => (ctx) => createDashboardActions(ctx),
  profile: () => (ctx) => createProfileActions(ctx),
  auth: () => (ctx) => createAuthActions(ctx),
  spots: () => (ctx) => createSpotsActions(ctx),
  social: () => (ctx) => createSocialActions(ctx),
  users: () => (ctx) => createUsersActions(ctx),
  support: () => (ctx) => createSupportActions(ctx),
  comments: () => (ctx) => createCommentsActions(ctx),
  meetups: () => (ctx) => createMeetupsActions(ctx),
  admin: () => (ctx) => createAdminActions(ctx),
})

const UI_REGISTRATIONS = Object.freeze({
  auth: registerAuthUi,
  home: registerHomeUi,
  map: registerMapUi,
  profile: registerProfileUi,
  settings: registerSettingsUi,
  social: registerSocialUi,
  support: registerSupportUi,
  admin: registerAdminUi,
})

const RUNTIME_BINDINGS = Object.freeze({
  activityWatch: ACTIVITY_WATCH_BINDING,
})

const FRONTEND_ACTOR_SPECS = Object.freeze([
  Object.freeze({
    id: 'core',
    serviceIds: Object.freeze(['apiClient', 'apiGateway', 'locationSearch', 'notify', 'activityWatch', 'runtime', 'platform', 'dashboard']),
    actionIds: Object.freeze(['dashboard', 'profile']),
    runtimeBindingIds: Object.freeze(['activityWatch']),
  }),
  Object.freeze({ id: 'auth', serviceIds: Object.freeze(['authService']), actionIds: Object.freeze(['auth']), uiIds: Object.freeze(['auth']) }),
  Object.freeze({ id: 'spots', serviceIds: Object.freeze(['spotsService']), actionIds: Object.freeze(['spots']), uiIds: Object.freeze(['home', 'map']) }),
  Object.freeze({ id: 'social', serviceIds: Object.freeze(['socialService']), actionIds: Object.freeze(['social']), uiIds: Object.freeze(['social']) }),
  Object.freeze({ id: 'users', serviceIds: Object.freeze(['usersService']), actionIds: Object.freeze(['users']), uiIds: Object.freeze(['settings', 'profile']) }),
  Object.freeze({ id: 'support', serviceIds: Object.freeze(['supportService']), actionIds: Object.freeze(['support']), uiIds: Object.freeze(['support']) }),
  Object.freeze({ id: 'comments', serviceIds: Object.freeze(['comments']), actionIds: Object.freeze(['comments']) }),
  Object.freeze({ id: 'meetups', serviceIds: Object.freeze(['meetups']), actionIds: Object.freeze(['meetups']) }),
  Object.freeze({ id: 'admin', serviceIds: Object.freeze(['adminService']), actionIds: Object.freeze(['admin']), uiIds: Object.freeze(['admin']) }),
])

function buildFactories(ids, catalog, runtimeOptions) {
  const factories = {}
  for (const id of ids || []) {
    const build = catalog[id]
    if (!build) {
      throw new Error(`Unknown catalog id '${id}'`)
    }
    factories[id] = build(runtimeOptions)
  }
  return factories
}

function buildUiHook(ids) {
  const registrations = (ids || []).map((id) => {
    const register = UI_REGISTRATIONS[id]
    if (!register) {
      throw new Error(`Unknown ui registration '${id}'`)
    }
    return register
  })

  if (!registrations.length) {
    return undefined
  }

  return (registry) => {
    for (const register of registrations) {
      register(registry)
    }
  }
}

function buildActor(spec, runtimeOptions) {
  const actor = {
    id: spec.id,
    services: buildFactories(spec.serviceIds, SERVICE_BUILDERS, runtimeOptions),
    actions: buildFactories(spec.actionIds, ACTION_BUILDERS, runtimeOptions),
    runtimeBindings: (spec.runtimeBindingIds || []).map((id) => {
      const binding = RUNTIME_BINDINGS[id]
      if (!binding) {
        throw new Error(`Unknown runtime binding '${id}'`)
      }
      return binding
    }),
  }

  const registerUi = buildUiHook(spec.uiIds)
  if (registerUi) {
    actor.registerUi = registerUi
  }
  return actor
}

export function createFrontendActorRegistry({ beginBackendRequest, endBackendRequest }) {
  return createActorRegistry(
    FRONTEND_ACTOR_SPECS.map((spec) => buildActor(spec, { beginBackendRequest, endBackendRequest })),
  )
}
