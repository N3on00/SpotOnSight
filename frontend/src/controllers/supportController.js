import { BaseController } from './baseController'

export class SupportController extends BaseController {
  constructor(ctx) {
    super(ctx, 'supportService')
  }

  async submitTicket(input) {
    return this.service().createTicket(input)
  }
}
