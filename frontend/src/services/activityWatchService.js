import { syncSocialActivity } from './activityWatch/socialActivitySync'
import { syncFilterSubscriptions } from './activityWatch/subscriptionSync'

export class ActivityWatchService {
  constructor(ctx) {
    this.ctx = ctx
    this._busy = false
    this._seeded = false
    this._followerIds = new Set()
    this._requestIds = new Set()
    this._moderationNotificationIds = new Set()
  }

  start() {
    this._seeded = false
  }

  stop() {
    this._busy = false
    this._seeded = false
    this._followerIds.clear()
    this._requestIds.clear()
    this._moderationNotificationIds.clear()
  }

  async tick({ notify = true } = {}) {
    if (this._busy) return

    const app = this.ctx
    if (!app.ui?.isAuthenticated()) return

    const meId = String(app.state.session.user?.id || '').trim()
    if (!meId) return

    this._busy = true
    try {
      const notifyService = app.service('notify')

      try {
        await syncSocialActivity(this, app, { notify, meId, notifyService })
      } catch {
        // Social activity polling is optional for subscription checks.
      }

      await syncFilterSubscriptions(app, { notify, meId, notifyService })

      this._seeded = true
    } catch {
      // Keep silent to avoid noisy polling errors when backend is offline.
    } finally {
      this._busy = false
    }
  }
}
