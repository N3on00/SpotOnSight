import { BaseController } from './baseController'

export class CommentsController extends BaseController {
  constructor(ctx) {
    super(ctx, 'comments')
  }

  async listBySpot(spotId) {
    return this.service().getComments(spotId)
  }

  async create(spotId, message) {
    return this.service().createComment(spotId, message)
  }

  async update(commentId, message) {
    return this.service().updateComment(commentId, message)
  }

  async delete(commentId) {
    return this.service().deleteComment(commentId)
  }
}
