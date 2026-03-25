import { ApiStateService } from './baseService'
import { API_ENDPOINTS } from '../api/registry'
import { asText } from '../utils/sanitizers'

function normalizeCategory(value) {
  const next = asText(value).toLowerCase()
  if (next === 'bug' || next === 'feature' || next === 'complaint' || next === 'question') {
    return next
  }
  return 'other'
}

function normalizeTicket(input, fallbackEmail = '') {
  const src = input && typeof input === 'object' ? input : {}
  return {
    category: normalizeCategory(src.category),
    subject: asText(src.subject),
    message: asText(src.message),
    page: asText(src.page),
    contact_email: asText(src.contactEmail || fallbackEmail),
    allow_contact: Boolean(src.allowContact),
    technical_details: asText(src.technicalDetails),
  }
}

function normalizeCreatedTicket(value) {
  const src = value && typeof value === 'object' ? value : {}
  return {
    id: asText(src.id),
    userId: asText(src.user_id),
    category: normalizeCategory(src.category),
    subject: asText(src.subject),
    message: asText(src.message),
    page: asText(src.page),
    contactEmail: asText(src.contact_email),
    allowContact: Boolean(src.allow_contact),
    technicalDetails: asText(src.technical_details),
    status: asText(src.status || 'open').toLowerCase() === 'closed' ? 'closed' : 'open',
    createdAt: asText(src.created_at),
  }
}

export class SupportService extends ApiStateService {
  constructor(api, state) {
    super(api, state, { serviceName: 'support' })
  }

  async createTicket(input) {
    if (!this.token()) {
      this.captureError('Authentication required', 'Authentication required')
      return null
    }

    const fallbackEmail = asText(this.state?.session?.user?.email)
    const payload = normalizeTicket(input, fallbackEmail)

    try {
      const data = await this.api.request(API_ENDPOINTS.SOCIAL_SUPPORT_TICKETS_CREATE, {
        body: payload,
      })
      this.clearError()
      return normalizeCreatedTicket(data)
    } catch (error) {
      this.captureError(error, 'Could not submit support request')
      return null
    }
  }

  async createDebugTicket(input) {
    return this.createTicket(input)
  }

  async listAdminTickets() {
    try {
      const data = await this.api.request(API_ENDPOINTS.SUPPORT_ADMIN_TICKETS_LIST)
      const tickets = Array.isArray(data) ? data.map((item) => normalizeCreatedTicket(item)) : []
      this.state.admin.supportTickets = tickets
      this.clearError()
      return tickets
    } catch (error) {
      this.captureError(error, 'Could not load support tickets')
      this.state.admin.supportTickets = []
      return []
    }
  }
}
