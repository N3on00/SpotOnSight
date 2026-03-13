import { resetAuthenticatedState } from './sessionReset'

export function handleUnauthorizedSession(ctx) {
  const activeToken = String(ctx.state.session.token || '').trim()
  if (!activeToken) return

  resetAuthenticatedState(ctx.state)
  ctx.service('notify').push({
    level: 'warning',
    title: 'Session expired',
    message: 'Your credentials are no longer valid. Please sign in again.',
    details: 'Please login again to continue.',
    sticky: true,
  })
}
