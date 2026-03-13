export async function reloadCoreData(app) {
  let dashboardService = null
  try {
    dashboardService = app.service('dashboard')
  } catch {
    dashboardService = null
  }

  if (dashboardService && typeof dashboardService.reloadCoreData === 'function') {
    await dashboardService.reloadCoreData()
    return
  }

  await app.controller('spots').reload()
  await app.controller('social').reloadFavorites()
}

export async function reloadDashboardData(app) {
  let dashboardService = null
  try {
    dashboardService = app.service('dashboard')
  } catch {
    dashboardService = null
  }

  if (dashboardService && typeof dashboardService.reloadDashboardData === 'function') {
    await dashboardService.reloadDashboardData()
    return
  }

  await reloadCoreData(app)

  const uid = app.state.session.user?.id
  if (!uid) {
    app.state.social.followersCount = 0
    app.state.social.followingCount = 0
    app.state.social.followers = []
    app.state.social.following = []
    app.state.social.incomingRequests = []
    app.state.social.blockedUsers = []
    return
  }

  const [followers, following, incomingRequests, blockedUsers] = await Promise.all([
    app.controller('social').followersOf(uid),
    app.controller('social').followingOf(uid),
    app.controller('social').incomingRequests(),
    app.controller('social').blockedUsers(),
  ])
  app.state.social.followers = Array.isArray(followers) ? followers : []
  app.state.social.following = Array.isArray(following) ? following : []
  app.state.social.incomingRequests = Array.isArray(incomingRequests) ? incomingRequests : []
  app.state.social.blockedUsers = Array.isArray(blockedUsers) ? blockedUsers : []
  app.state.social.followersCount = app.state.social.followers.length
  app.state.social.followingCount = app.state.social.following.length
}
