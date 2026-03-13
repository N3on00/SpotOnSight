export function meetupsController(app) {
  try {
    return app.controller('meetups')
  } catch {
    return null
  }
}

export async function loadMeetupsSafe(app, scope = 'upcoming') {
  const ctrl = meetupsController(app)
  if (!ctrl) return []
  return ctrl.list(scope)
}

export async function loadMeetupInvitesSafe(app) {
  const ctrl = meetupsController(app)
  if (!ctrl) return []
  return ctrl.listInvites()
}
