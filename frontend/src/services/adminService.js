import { API_ENDPOINTS } from '../api/registry'
import { normalizeUser } from '../models/userMapper'
import { asText } from '../utils/sanitizers'
import { ApiStateService } from './baseService'

function normalizeModerationReport(item) {
  const row = item && typeof item === 'object' ? item : {}
  return {
    id: asText(row.id || row._id),
    reporter_user_id: asText(row.reporter_user_id),
    target_type: asText(row.target_type),
    target_id: asText(row.target_id),
    target_owner_user_id: asText(row.target_owner_user_id),
    reason: asText(row.reason),
    details: asText(row.details),
    status: asText(row.status || 'open') || 'open',
    severity: asText(row.severity),
    action_taken: asText(row.action_taken),
    admin_notes: asText(row.admin_notes),
    created_at: asText(row.created_at),
    reviewed_at: asText(row.reviewed_at),
    reviewed_by: asText(row.reviewed_by),
  }
}

function normalizeAdminUser(item) {
  const user = normalizeUser(item)
  return {
    ...user,
    account_status: asText(item?.account_status || 'active') || 'active',
    account_status_reason: asText(item?.account_status_reason),
    posting_timeout_until: asText(item?.posting_timeout_until),
    active_strike_weight: Number(item?.active_strike_weight) || 0,
    recent_strike_count: Number(item?.recent_strike_count) || 0,
  }
}

export class AdminService extends ApiStateService {
  constructor(api, state) {
    super(api, state, { serviceName: 'admin' })
  }

  async loadReports(status = 'open', limit = 100) {
    try {
      const data = await this.api.request(API_ENDPOINTS.ADMIN_REPORTS_LIST, {
        query: {
          status: asText(status) || 'open',
          limit: Math.min(300, Math.max(1, Number(limit) || 100)),
        },
      })
      const reports = Array.isArray(data) ? data.map((item) => normalizeModerationReport(item)) : []
      this.state.admin.reports = reports
      this.clearError()
      return reports
    } catch (error) {
      this.captureError(error, 'Could not load moderation reports')
      this.state.admin.reports = []
      return []
    }
  }

  async reviewReport(reportId, payload) {
    try {
      const data = await this.api.request(API_ENDPOINTS.ADMIN_REPORTS_REVIEW, {
        params: { reportId },
        body: payload,
      })
      const report = normalizeModerationReport(data)
      this.state.admin.reports = this.state.admin.reports.map((item) => item.id === report.id ? report : item)
      this.clearError()
      return report
    } catch (error) {
      this.captureError(error, 'Could not review moderation report')
      return null
    }
  }

  async loadUsers(query = '', limit = 100) {
    try {
      const data = await this.api.request(API_ENDPOINTS.ADMIN_USERS_LIST, {
        query: {
          q: asText(query),
          limit: Math.min(300, Math.max(1, Number(limit) || 100)),
        },
      })
      const users = Array.isArray(data) ? data.map((item) => normalizeAdminUser(item)) : []
      this.state.admin.users = users
      this.clearError()
      return users
    } catch (error) {
      this.captureError(error, 'Could not load moderated users')
      this.state.admin.users = []
      return []
    }
  }

  async updateUserStatus(userId, payload) {
    try {
      const data = await this.api.request(API_ENDPOINTS.ADMIN_USERS_UPDATE, {
        params: { userId },
        body: payload,
      })
      const user = normalizeAdminUser(data)
      this.state.admin.users = this.state.admin.users.map((item) => item.id === user.id ? user : item)
      this.clearError()
      return user
    } catch (error) {
      this.captureError(error, 'Could not update user moderation status')
      return null
    }
  }
}
