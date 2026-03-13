import { persistSession } from '../stores/appState'
import { BaseController } from './baseController'

export class UsersController extends BaseController {
  constructor(ctx) {
    super(ctx, 'usersService')
  }

  async refreshProfile() {
    const user = await this.service().me()
    if (!user) return false
    this.ctx.state.session.user = user
    persistSession(this.ctx.state)
    return true
  }

  async updateProfile(input) {
    const user = await this.service().updateMe(input)
    if (!user) return false
    this.ctx.state.session.user = user
    persistSession(this.ctx.state)
    return true
  }

  async searchUsers(query, limit = 20) {
    return this.service().searchByUsername(query, limit)
  }

  async friendDirectory() {
    return this.service().friendDirectory()
  }

  async searchFriends(query, limit = 20) {
    return this.service().searchFriends(query, limit)
  }

  async profile(userId) {
    return this.service().profile(userId)
  }
}
