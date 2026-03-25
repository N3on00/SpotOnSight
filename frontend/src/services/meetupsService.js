import { API_ENDPOINTS } from '../api/registry'
import { asText, uniqueTextList } from '../utils/sanitizers'
import { ApiStateService } from './baseService'

function normalizeMeetup(item) {
  const row = item && typeof item === 'object' ? item : {}
  return {
    id: asText(row.id || row._id),
    host_user_id: asText(row.host_user_id),
    title: asText(row.title),
    description: asText(row.description),
    starts_at: asText(row.starts_at),
    invite_user_ids: uniqueTextList(Array.isArray(row.invite_user_ids) ? row.invite_user_ids : []),
    spot_id: asText(row.spot_id) || null,
    spot: row.spot && typeof row.spot === 'object' ? row.spot : null,
    moderation_status: asText(row.moderation_status || 'visible') || 'visible',
    created_at: asText(row.created_at),
    updated_at: asText(row.updated_at),
  }
}

function normalizeInvite(item) {
  const row = item && typeof item === 'object' ? item : {}
  return {
    meetup_id: asText(row.meetup_id),
    user_id: asText(row.user_id),
    status: asText(row.status || 'pending') || 'pending',
    response_comment: asText(row.response_comment),
    created_at: asText(row.created_at),
    responded_at: asText(row.responded_at),
  }
}

function normalizeComment(item) {
  const row = item && typeof item === 'object' ? item : {}
  return {
    id: asText(row.id || row._id),
    meetup_id: asText(row.meetup_id),
    user_id: asText(row.user_id),
    message: asText(row.message),
    created_at: asText(row.created_at),
    updated_at: asText(row.updated_at),
  }
}

export class MeetupsService extends ApiStateService {
  constructor(api, state) {
    super(api, state, { serviceName: 'meetups' })
  }

  async list(scope = 'upcoming') {
    try {
      const rows = await this.api.request(API_ENDPOINTS.SOCIAL_MEETUPS_LIST, {
        query: { scope: asText(scope || 'upcoming') || 'upcoming' },
      })
      this.clearError()
      return Array.isArray(rows) ? rows.map((entry) => normalizeMeetup(entry)) : []
    } catch (error) {
      this.captureError(error, 'Could not load meetups')
      return []
    }
  }

  async create(payload) {
    try {
      const body = {
        title: asText(payload?.title),
        description: asText(payload?.description),
        starts_at: asText(payload?.starts_at),
        invite_user_ids: uniqueTextList(payload?.invite_user_ids || []),
        spot_id: asText(payload?.spot_id) || null,
      }
      const row = await this.api.request(API_ENDPOINTS.SOCIAL_MEETUPS_CREATE, { body })
      this.clearError()
      return normalizeMeetup(row)
    } catch (error) {
      this.captureError(error, 'Could not create meetup')
      return null
    }
  }

  async update(meetupId, payload) {
    const resolvedMeetupId = asText(meetupId)
    if (!resolvedMeetupId) return null
    try {
      const body = {
        title: asText(payload?.title),
        description: asText(payload?.description),
        starts_at: asText(payload?.starts_at),
        invite_user_ids: uniqueTextList(payload?.invite_user_ids || []),
        spot_id: payload?.spot_id ? asText(payload.spot_id) : payload?.spot_id === null ? null : undefined,
      }
      const row = await this.api.request(API_ENDPOINTS.SOCIAL_MEETUPS_UPDATE, {
        params: { meetupId: resolvedMeetupId },
        body,
      })
      this.clearError()
      return normalizeMeetup(row)
    } catch (error) {
      this.captureError(error, 'Could not update meetup')
      return null
    }
  }

  async remove(meetupId) {
    const resolvedMeetupId = asText(meetupId)
    if (!resolvedMeetupId) return false
    try {
      await this.api.request(API_ENDPOINTS.SOCIAL_MEETUPS_DELETE, {
        params: { meetupId: resolvedMeetupId },
      })
      this.clearError()
      return true
    } catch (error) {
      this.captureError(error, 'Could not delete meetup')
      return false
    }
  }

  async listInvites() {
    try {
      const rows = await this.api.request(API_ENDPOINTS.SOCIAL_MEETUPS_INVITES_LIST)
      this.clearError()
      return Array.isArray(rows) ? rows.map((entry) => normalizeInvite(entry)) : []
    } catch (error) {
      this.captureError(error, 'Could not load meetup invites')
      return []
    }
  }

  async respond(meetupId, status, comment = '') {
    const resolvedMeetupId = asText(meetupId)
    if (!resolvedMeetupId) return null
    try {
      const row = await this.api.request(API_ENDPOINTS.SOCIAL_MEETUPS_RESPOND, {
        params: { meetupId: resolvedMeetupId },
        body: {
          status: asText(status),
          comment: asText(comment),
        },
      })
      this.clearError()
      return normalizeInvite(row)
    } catch (error) {
      this.captureError(error, 'Could not respond to meetup')
      return null
    }
  }

  async listComments(meetupId) {
    const resolvedMeetupId = asText(meetupId)
    if (!resolvedMeetupId) return []
    try {
      const rows = await this.api.request(API_ENDPOINTS.SOCIAL_MEETUP_COMMENTS_LIST, {
        params: { meetupId: resolvedMeetupId },
      })
      this.clearError()
      return Array.isArray(rows) ? rows.map((entry) => normalizeComment(entry)) : []
    } catch (error) {
      this.captureError(error, 'Could not load meetup comments')
      return []
    }
  }

  async createComment(meetupId, message) {
    const resolvedMeetupId = asText(meetupId)
    const resolvedMessage = asText(message)
    if (!resolvedMeetupId || !resolvedMessage) return null
    try {
      const row = await this.api.request(API_ENDPOINTS.SOCIAL_MEETUP_COMMENTS_CREATE, {
        params: { meetupId: resolvedMeetupId },
        body: { message: resolvedMessage },
      })
      this.clearError()
      return normalizeComment(row)
    } catch (error) {
      this.captureError(error, 'Could not create meetup comment')
      return null
    }
  }

  async updateComment(commentId, message) {
    const resolvedCommentId = asText(commentId)
    const resolvedMessage = asText(message)
    if (!resolvedCommentId || !resolvedMessage) return null
    try {
      const row = await this.api.request(API_ENDPOINTS.SOCIAL_MEETUP_COMMENTS_UPDATE, {
        params: { commentId: resolvedCommentId },
        body: { message: resolvedMessage },
      })
      this.clearError()
      return normalizeComment(row)
    } catch (error) {
      this.captureError(error, 'Could not update meetup comment')
      return null
    }
  }

  async deleteComment(commentId) {
    const resolvedCommentId = asText(commentId)
    if (!resolvedCommentId) return false
    try {
      await this.api.request(API_ENDPOINTS.SOCIAL_MEETUP_COMMENTS_DELETE, {
        params: { commentId: resolvedCommentId },
      })
      this.clearError()
      return true
    } catch (error) {
      this.captureError(error, 'Could not delete meetup comment')
      return false
    }
  }
}
