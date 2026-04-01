import { BaseService } from './baseService'

export class DashboardService extends BaseService {
  constructor(ctx) {
    super({ serviceName: 'dashboard' })
    this.ctx = ctx
  }

  async reloadCoreData() {
    await this.ctx.action('dashboard').reloadCoreData()
  }

  async reloadDashboardData() {
    await this.ctx.action('dashboard').reloadDashboardData()
  }
}
