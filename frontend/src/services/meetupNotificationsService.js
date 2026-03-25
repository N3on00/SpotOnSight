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
    // TODO: Implement SSE connection for real-time meetup notifications
    // This method will be called when the user wants to connect to the SSE stream
    // Usage:
    //   const eventSource = new EventSource('/social/notifications/stream', {
    //     withCredentials: true,
    //     headers: { Authorization: `Bearer ${token}` }
    //   })
    //   eventSource.onmessage = (event) => {
    //     const data = JSON.parse(event.data)
    //     onNotification(normalizeNotification(data))
    //   }
    //   eventSource.onerror = () => {
    //     // Handle reconnection logic
    //   }
    console.warn('MeetupNotificationsService.connect() - SSE not yet implemented')
  }

  disconnect() {
    // TODO: Implement disconnect for SSE connection
    // This method should close the EventSource connection when called
    console.warn('MeetupNotificationsService.disconnect() - SSE not yet implemented')
  }
}
