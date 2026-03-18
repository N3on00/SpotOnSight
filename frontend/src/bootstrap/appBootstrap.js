import { AppContext } from '../core/context'
import { UIController } from '../core/uiController'
import { createAppState } from '../stores/appState'
import { ApiClient } from '../services/apiClient'
import { ApiGatewayService } from '../services/apiGatewayService'
import { AuthService } from '../services/authService'
import { SpotsService } from '../services/spotsService'
import { SocialService } from '../services/socialService'
import { UsersService } from '../services/usersService'
import { LocationSearchService } from '../services/locationSearchService'
import { SupportService } from '../services/supportService'
import { NotificationService } from '../services/notificationService'
import { ActivityWatchService } from '../services/activityWatchService'
import { RuntimeService } from '../services/runtimeService'
import { PlatformService } from '../services/platformService'
import { CommentsService } from '../services/commentsService'
import { DashboardService } from '../services/dashboardService'
import { MeetupsService } from '../services/meetupsService'
import { AdminService } from '../services/adminService'
import { ApiController } from '../controllers/apiController'
import { AuthController } from '../controllers/authController'
import { SpotsController } from '../controllers/spotsController'
import { SocialController } from '../controllers/socialController'
import { UsersController } from '../controllers/usersController'
import { SupportController } from '../controllers/supportController'
import { CommentsController } from '../controllers/commentsController'
import { MeetupsController } from '../controllers/meetupsController'
import { AdminController } from '../controllers/adminController'
import { registerUi } from './uiRegistrations'
import { registerComponentDecorators } from './componentDecoratorRegistrations'
import { registerErrorHandlers } from './errorHandlerRegistrations'
import { registerRuntime } from './runtimeRegistrations'
import { handleUnauthorizedSession } from './unauthorizedHandler'

export function buildAppContext() {
  const state = createAppState()
  registerComponentDecorators()
  registerErrorHandlers()
  registerRuntime()

  const serviceFactories = {
    apiClient: (ctx) => new ApiClient(ctx.state.config.apiBaseUrl, {
      onUnauthorized: () => handleUnauthorizedSession(ctx),
    }),
    apiGateway: (ctx) => new ApiGatewayService(ctx.service('apiClient'), ctx.state),
    authService: (ctx) => new AuthService(ctx.service('apiGateway'), ctx.state),
    spotsService: (ctx) => new SpotsService(ctx.service('apiGateway'), ctx.state),
    socialService: (ctx) => new SocialService(ctx.service('apiGateway'), ctx.state),
    usersService: (ctx) => new UsersService(ctx.service('apiGateway'), ctx.state),
    locationSearch: () => new LocationSearchService(),
    supportService: (ctx) => new SupportService(ctx.service('apiGateway'), ctx.state),
    notify: (ctx) => new NotificationService(ctx.state),
    activityWatch: (ctx) => new ActivityWatchService(ctx),
    runtime: (ctx) => new RuntimeService(ctx),
    platform: (ctx) => new PlatformService(ctx.state),
    comments: (ctx) => new CommentsService(ctx.service('apiGateway'), ctx.state),
    meetups: (ctx) => new MeetupsService(ctx.service('apiGateway'), ctx.state),
    adminService: (ctx) => new AdminService(ctx.service('apiGateway'), ctx.state),
    dashboard: (ctx) => new DashboardService(ctx),
  }

  const controllerFactories = {
    api: (ctx) => new ApiController(ctx),
    auth: (ctx) => new AuthController(ctx),
    spots: (ctx) => new SpotsController(ctx),
    social: (ctx) => new SocialController(ctx),
    users: (ctx) => new UsersController(ctx),
    support: (ctx) => new SupportController(ctx),
    comments: (ctx) => new CommentsController(ctx),
    meetups: (ctx) => new MeetupsController(ctx),
    admin: (ctx) => new AdminController(ctx),
  }

  const ctx = new AppContext({ state, serviceFactories, controllerFactories })
  ctx.ui = new UIController(ctx)
  registerUi()
  return ctx
}
