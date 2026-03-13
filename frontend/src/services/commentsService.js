import { ApiStateService } from './baseService'
import { API_ENDPOINTS } from '../api/registry'
import { asText } from '../utils/sanitizers'

export class CommentsService extends ApiStateService {
  constructor(api, state) {
    super(api, state, { serviceName: 'comments' })
  }

  async getComments(spotId) {
    const resolvedSpotId = asText(spotId)
    if (!resolvedSpotId) {
      this.captureError(new Error('spotId is required'), 'Cannot get comments')
      return []
    }

    try {
      const result = await this.api.request(API_ENDPOINTS.SOCIAL_COMMENTS_LIST, {
        params: { spotId: resolvedSpotId },
      })
      this.clearError()
      return Array.isArray(result) ? result : []
    } catch (e) {
      this.captureError(e, 'Failed to load comments')
      return []
    }
  }

  async createComment(spotId, message) {
    const resolvedSpotId = asText(spotId)
    if (!resolvedSpotId) {
      this.captureError(new Error('spotId is required'), 'Cannot create comment')
      return null
    }

    const trimmedMessage = String(message || '').trim()
    if (!trimmedMessage) {
      this.captureError(new Error('Message is required'), 'Cannot create comment')
      return null
    }

    try {
      const result = await this.api.request(API_ENDPOINTS.SOCIAL_COMMENTS_CREATE, {
        params: { spotId: resolvedSpotId },
        body: { message: trimmedMessage },
      })
      this.clearError()
      return result
    } catch (e) {
      this.captureError(e, 'Failed to create comment')
      return null
    }
  }

  async updateComment(commentId, message) {
    const resolvedCommentId = asText(commentId)
    if (!resolvedCommentId) {
      this.captureError(new Error('commentId is required'), 'Cannot update comment')
      return null
    }

    const trimmedMessage = String(message || '').trim()
    if (!trimmedMessage) {
      this.captureError(new Error('Message is required'), 'Cannot update comment')
      return null
    }

    try {
      const result = await this.api.request(API_ENDPOINTS.SOCIAL_COMMENTS_UPDATE, {
        params: { commentId: resolvedCommentId },
        body: { message: trimmedMessage },
      })
      this.clearError()
      return result
    } catch (e) {
      this.captureError(e, 'Failed to update comment')
      return null
    }
  }

  async deleteComment(commentId) {
    const resolvedCommentId = asText(commentId)
    if (!resolvedCommentId) {
      this.captureError(new Error('commentId is required'), 'Cannot delete comment')
      return false
    }

    try {
      await this.api.request(API_ENDPOINTS.SOCIAL_COMMENTS_DELETE, {
        params: { commentId: resolvedCommentId },
      })
      this.clearError()
      return true
    } catch (e) {
      this.captureError(e, 'Failed to delete comment')
      return false
    }
  }
}
