export function getMeetupsActions(app) {
  try {
    return app.action('meetups')
  } catch {
    return null
  }
}

export async function loadMeetupsSafe(app, scope = 'upcoming') {
  const actions = getMeetupsActions(app)
  if (!actions) return []
  return actions.list(scope)
}

export async function loadMeetupInvitesSafe(app) {
  const actions = getMeetupsActions(app)
  if (!actions) return []
  return actions.listInvites()
}
