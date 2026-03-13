import {
  AuthScreenErrorHandler,
  ProfileScreenErrorHandler,
  ScreenErrorHandler,
  registerScreenErrorHandler,
} from '../core/errorHandlerRegistry'

let registered = false

export function registerErrorHandlers() {
  if (registered) return
  registered = true

  registerScreenErrorHandler({
    id: 'screen.default',
    handlerClass: ScreenErrorHandler,
  })

  registerScreenErrorHandler({
    id: 'screen.auth',
    handlerClass: AuthScreenErrorHandler,
  })

  registerScreenErrorHandler({
    id: 'screen.profile',
    handlerClass: ProfileScreenErrorHandler,
  })
}
