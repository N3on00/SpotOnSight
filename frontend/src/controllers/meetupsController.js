import { BaseController } from './baseController'

export class MeetupsController extends BaseController {
  constructor(ctx) {
    super(ctx, 'meetups')
  }

  async list(scope) {
    return this.service().list(scope)
  }

  async create(payload) {
    return this.service().create(payload)
  }

  async update(meetupId, payload) {
    return this.service().update(meetupId, payload)
  }

  async remove(meetupId) {
    return this.service().remove(meetupId)
  }

  async listInvites() {
    return this.service().listInvites()
  }

  async respond(meetupId, status, comment) {
    return this.service().respond(meetupId, status, comment)
  }

  async listComments(meetupId) {
    return this.service().listComments(meetupId)
  }

  async createComment(meetupId, message) {
    return this.service().createComment(meetupId, message)
  }

  async updateComment(commentId, message) {
    return this.service().updateComment(commentId, message)
  }

  async deleteComment(commentId) {
    return this.service().deleteComment(commentId)
  }
}
