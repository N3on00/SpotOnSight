import { resolveScreenErrorHandler } from '../../core/errorHandlerRegistry'
import { beginLoading, endLoading } from './loading'
import { notify } from './notify'
import { resolve, resolveText, toDetails } from './text'

function authState(app) {
  if (!app?.ui || typeof app.ui.isAuthenticated !== 'function') return false
  return app.ui.isAuthenticated()
}

function authDropped(app, wasAuthenticated) {
  return Boolean(wasAuthenticated && !authState(app))
}

function activeScreen(app) {
  return String(app?.state?.ui?.activeScreen || '').trim()
}

function resolveDefaultErrorHandlerId(app) {
  const screen = activeScreen(app)
  if (!screen) return 'screen.default'

  const lifecycle = app?.ui?.getScreenLifecycle(screen)
  return String(lifecycle?.errorHandlerId || 'screen.default').trim() || 'screen.default'
}

function dispatchError(app, {
  errorHandlerId = '',
  title,
  message,
  details = '',
  error = null,
  level = 'error',
  scope = 'action',
}) {
  const handlerId = String(errorHandlerId || '').trim() || resolveDefaultErrorHandlerId(app)
  const handler = resolveScreenErrorHandler(handlerId, app)
  handler.handle({
    level,
    title,
    message,
    details,
    error,
    scope,
    screen: activeScreen(app),
    route: null,
  })
}

export function observeAction(app, {
  loadingKey = '',
  errorHandlerId = '',
  errorTitle = 'Action failed',
  errorMessage = 'Please try again.',
  errorDetails,
  successTitle = '',
  successMessage = '',
  successLevel = 'success',
  successWhen,
  onSuccess,
}, action) {
  return async (...args) => {
    const wasAuthenticated = authState(app)
    beginLoading(app, loadingKey)
    try {
      const result = await action(...args)
      const pass = typeof successWhen === 'function' ? !!successWhen(result) : true

      if (!pass) {
        const details = toDetails(resolve(errorDetails, result) || '')
        dispatchError(app, {
          errorHandlerId,
          title: resolveText(errorTitle, 'Action failed', result),
          message: resolveText(errorMessage, 'Please try again.', result),
          details,
          scope: 'action',
        })
        return result
      }

      if (onSuccess) {
        await onSuccess(result)
      }

      const nextSuccessTitle = toDetails(resolve(successTitle, result))
      const nextSuccessMessage = toDetails(resolve(successMessage, result))
      if (nextSuccessTitle || nextSuccessMessage) {
        notify(app, {
          level: successLevel,
          title: nextSuccessTitle || 'Done',
          message: nextSuccessMessage || '',
        })
      }

      return result
    } catch (error) {
      if (authDropped(app, wasAuthenticated)) {
        return null
      }

      const details = toDetails(resolve(errorDetails, error) || error?.message || error)
      dispatchError(app, {
        errorHandlerId,
        title: resolveText(errorTitle, 'Action failed', error),
        message: resolveText(errorMessage, 'Please try again.', error),
        details,
        error,
        scope: 'action',
      })
      return null
    } finally {
      endLoading(app, loadingKey)
    }
  }
}

export function actionLastError(app, actionId) {
  try {
    const action = app.action(actionId)
    if (!action || typeof action.lastError !== 'function') return ''
    return toDetails(action.lastError())
  } catch {
    return ''
  }
}

export async function runTask(app, {
  task,
  loadingKey = '',
  errorHandlerId = '',
  errorTitle = 'Action failed',
  errorMessage = 'Please try again.',
  errorDetails,
  successTitle = '',
  successMessage = '',
  successLevel = 'success',
  onSuccess,
}) {
  const wasAuthenticated = authState(app)
  beginLoading(app, loadingKey)
  try {
    const result = await task()
    if (onSuccess) {
      await onSuccess(result)
    }
    const nextSuccessTitle = toDetails(resolve(successTitle, result))
    const nextSuccessMessage = toDetails(resolve(successMessage, result))
    if (nextSuccessTitle || nextSuccessMessage) {
      notify(app, {
        level: successLevel,
        title: nextSuccessTitle || 'Done',
        message: nextSuccessMessage || '',
      })
    }
    return { ok: true, result }
  } catch (error) {
    if (authDropped(app, wasAuthenticated)) {
      return { ok: false, error, authDropped: true }
    }

    const details = toDetails(resolve(errorDetails, error) || error?.message || error)
    dispatchError(app, {
      errorHandlerId,
      title: resolveText(errorTitle, 'Action failed', error),
      message: resolveText(errorMessage, 'Please try again.', error),
      details,
      error,
      scope: 'action',
    })
    return { ok: false, error }
  } finally {
    endLoading(app, loadingKey)
  }
}

export async function runBooleanAction(app, {
  action,
  loadingKey = '',
  errorHandlerId = '',
  errorTitle,
  errorMessage,
  errorDetails,
  successTitle = '',
  successMessage = '',
  successLevel = 'success',
  onSuccess,
}) {
  const { ok, result } = await runTask(app, {
    task: action,
    loadingKey,
    errorHandlerId,
    errorTitle,
    errorMessage,
    errorDetails,
  })

  if (!ok) {
    return false
  }

  if (!result) {
    const details = toDetails(resolve(errorDetails, result) || '')
    dispatchError(app, {
      errorHandlerId,
      title: resolveText(errorTitle, 'Action failed', result),
      message: resolveText(errorMessage, 'Please try again.', result),
      details,
      scope: 'action',
    })
    return false
  }

  if (onSuccess) {
    await onSuccess(result)
  }
  const nextSuccessTitle = toDetails(resolve(successTitle, result))
  const nextSuccessMessage = toDetails(resolve(successMessage, result))
  if (nextSuccessTitle || nextSuccessMessage) {
    notify(app, {
      level: successLevel,
      title: nextSuccessTitle || 'Done',
      message: nextSuccessMessage || '',
    })
  }
  return true
}
