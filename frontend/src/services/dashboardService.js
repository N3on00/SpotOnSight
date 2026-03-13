import { BaseService } from './baseService'

export class DashboardService extends BaseService {
  constructor(ctx) {
    super({ serviceName: 'dashboard' })
    this.ctx = ctx
  }

  async reloadCoreData() {
    await this.ctx.controller('spots').reload()
    await this.ctx.controller('social').reloadFavorites()
  }

  async reloadDashboardData() {
    await this.reloadCoreData()

    const uid = this.ctx.state.session.user?.id
    if (!uid) {
      this.ctx.state.social.followersCount = 0
      this.ctx.state.social.followingCount = 0
      this.ctx.state.social.followers = []
      this.ctx.state.social.following = []
      this.ctx.state.social.incomingRequests = []
      this.ctx.state.social.blockedUsers = []
      return
    }

    const [followers, following, incomingRequests, blockedUsers] = await Promise.all([
      this.ctx.controller('social').followersOf(uid),
      this.ctx.controller('social').followingOf(uid),
      this.ctx.controller('social').incomingRequests(),
      this.ctx.controller('social').blockedUsers(),
    ])

    this.ctx.state.social.followers = Array.isArray(followers) ? followers : []
    this.ctx.state.social.following = Array.isArray(following) ? following : []
    this.ctx.state.social.incomingRequests = Array.isArray(incomingRequests) ? incomingRequests : []
    this.ctx.state.social.blockedUsers = Array.isArray(blockedUsers) ? blockedUsers : []
    this.ctx.state.social.followersCount = this.ctx.state.social.followers.length
    this.ctx.state.social.followingCount = this.ctx.state.social.following.length
  }
}
