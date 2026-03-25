import { BaseController } from './baseController'

export class SupportController extends BaseController {
  constructor(ctx) {
    super(ctx, 'supportService')
  }

  async submitTicket(input) {
    return this.service().createTicket(input)
  }

  async submitDebugTicket(input) {
    return this.service().createDebugTicket(input)
  }

  async listAdminTickets() {
    return this.service().listAdminTickets()
  }
}
