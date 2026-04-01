import { API_ENDPOINTS } from '../api/registry'
import { asText } from '../utils/sanitizers'
import { BaseService } from './baseService'

function normalizeNotification(item) {
  const row = item && typeof item === 'object' ? item : {}
  return {
    id: asText(row.id || row._id),
    user_id: asText(row.user_id),
    meetup_id: asText(row.meetup_id),
    meetup_title: asText(row.meetup_title),
    notification_type: asText(row.notification_type),
    from_user_id: asText(row.from_user_id),
    from_username: asText(row.from_username),
    message: asText(row.message),
    created_at: asText(row.created_at),
  }
}

export class MeetupNotificationsService extends BaseService {
  constructor(api, state) {
    super({ serviceName: 'meetupNotifications' })
    this.api = api
    this.state = state
  }

  async list() {
    try {
      const rows = await this.api.request(API_ENDPOINTS.SOCIAL_MEETUP_NOTIFICATIONS_LIST)
      this.clearError()
      return Array.isArray(rows) ? rows.map((entry) => normalizeNotification(entry)) : []
    } catch (error) {
      this.captureError(error, 'Could not load meetup notifications')
      return []
    }
  }

  connect(onNotification) {
    void onNotification
    console.warn('MeetupNotificationsService.connect() is currently a no-op')
  }

  disconnect() {
    console.warn('MeetupNotificationsService.disconnect() is currently a no-op')
  }
}
