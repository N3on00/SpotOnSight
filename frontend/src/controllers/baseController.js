export class BaseController {
  constructor(ctx, serviceId) {
    this.ctx = ctx
    this.serviceId = serviceId
  }

  service() {
    return this.ctx.service(this.serviceId)
  }

  lastError() {
    const service = this.service()
    if (!service || typeof service.lastError !== 'function') {
      return ''
    }
    return service.lastError()
  }
}
