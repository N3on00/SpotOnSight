import { BaseController } from './baseController'

export class AdminController extends BaseController {
  constructor(ctx) {
    super(ctx, 'adminService')
  }

  async loadReports(status, limit) {
    return this.service().loadReports(status, limit)
  }

  async reviewReport(reportId, payload) {
    return this.service().reviewReport(reportId, payload)
  }

  async loadUsers(query, limit) {
    return this.service().loadUsers(query, limit)
  }

  async updateUserStatus(userId, payload) {
    return this.service().updateUserStatus(userId, payload)
  }
}
