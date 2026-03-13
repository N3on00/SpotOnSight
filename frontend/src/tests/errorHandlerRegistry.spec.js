import { describe, expect, it, vi } from 'vitest'

import {
  AuthScreenErrorHandler,
  ScreenErrorHandler,
  registerScreenErrorHandler,
  resolveScreenErrorHandler,
} from '../core/errorHandlerRegistry'

class TestScreenErrorHandler extends ScreenErrorHandler {
  resolveMessage({ message }) {
    return String(message || '').trim() || 'Handled by test handler'
  }
}

class TestAuthScreenErrorHandler extends AuthScreenErrorHandler {}

function createApp({ authenticated = true } = {}) {
  const push = vi.fn()
  return {
    ui: {
      isAuthenticated: () => authenticated,
    },
    service: (id) => {
      if (id !== 'notify') {
        throw new Error(`Unknown service: ${id}`)
      }
      return { push }
    },
    _push: push,
  }
}

describe('Screen error handler registry', () => {
  it('resolves registered subclass handlers and emits notifications', () => {
    const id = `spec.handler.${Date.now()}`
    registerScreenErrorHandler({
      id,
      handlerClass: TestScreenErrorHandler,
    })

    const app = createApp({ authenticated: true })
    const handler = resolveScreenErrorHandler(id, app)

    const handled = handler.handle({
      title: 'Screen failed',
      message: '',
      error: new Error('boom'),
      route: { meta: { requiresAuth: true } },
    })

    expect(handled).toBe(true)
    expect(app._push).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Screen failed',
      message: 'Handled by test handler',
    }))
  })

  it('ignores protected-page errors when user is unauthenticated', () => {
    const id = `spec.auth-handler.${Date.now()}`
    registerScreenErrorHandler({
      id,
      handlerClass: TestAuthScreenErrorHandler,
    })

    const app = createApp({ authenticated: false })
    const handler = resolveScreenErrorHandler(id, app)

    const handled = handler.handle({
      title: 'Should be ignored',
      message: 'No notification expected',
      route: { meta: { requiresAuth: true } },
    })

    expect(handled).toBe(false)
    expect(app._push).not.toHaveBeenCalled()
  })
})
