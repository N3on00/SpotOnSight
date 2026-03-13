import { BaseController } from './baseController'

export class SocialController extends BaseController {
  constructor(ctx) {
    super(ctx, 'socialService')
  }

  async reloadFavorites() {
    return this.service().loadFavorites()
  }

  async toggleFavorite(spotId, currentlyFavorite) {
    const service = this.service()
    if (currentlyFavorite) {
      return service.unfavoriteSpot(spotId)
    }
    return service.favoriteSpot(spotId)
  }

  async share(spotId, message) {
    return this.service().shareSpot(spotId, message)
  }

  async follow(userId) {
    return this.service().followUser(userId)
  }

  async unfollow(userId) {
    return this.service().unfollowUser(userId)
  }

  async removeFollower(userId) {
    return this.service().removeFollower(userId)
  }

  async incomingRequests() {
    return this.service().incomingFollowRequests()
  }

  async approveRequest(userId) {
    return this.service().approveFollowRequest(userId)
  }

  async rejectRequest(userId) {
    return this.service().rejectFollowRequest(userId)
  }

  async block(userId) {
    return this.service().blockUser(userId)
  }

  async unblock(userId) {
    return this.service().unblockUser(userId)
  }

  async blockedUsers() {
    return this.service().blockedUsers()
  }

  async followersOf(userId) {
    return this.service().followersOf(userId)
  }

  async followingOf(userId) {
    return this.service().followingOf(userId)
  }
}
