import { AppContext } from '../core/context'
import { UIController } from '../core/uiController'
import { createFrontendActorRegistry } from '../actors'
import { createAppState } from '../stores/appState'
import { registerComponentDecorators } from './componentDecoratorRegistrations'
import { registerErrorHandlers } from './errorHandlerRegistrations'

export function buildAppContext() {
  const state = createAppState()
  registerComponentDecorators()
  registerErrorHandlers()

  function beginBackendRequest() {
    state.ui.backendRequestCount = Math.max(0, Number(state.ui.backendRequestCount) || 0) + 1
  }

  function endBackendRequest() {
    state.ui.backendRequestCount = Math.max(0, (Number(state.ui.backendRequestCount) || 0) - 1)
  }

  const actorRegistry = createFrontendActorRegistry({ beginBackendRequest, endBackendRequest })
  actorRegistry.registerUi()

  const ctx = new AppContext({
    state,
    serviceFactories: actorRegistry.serviceFactories,
    actionFactories: actorRegistry.actionFactories,
    actorRegistry,
  })
  ctx.ui = new UIController(ctx)
  return ctx
}
