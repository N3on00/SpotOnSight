import { BaseController } from './baseController'

export class ApiController extends BaseController {
  constructor(ctx) {
    super(ctx, 'apiGateway')
  }

  async request(endpointKey, options = {}) {
    return this.service().request(endpointKey, options)
  }
}
