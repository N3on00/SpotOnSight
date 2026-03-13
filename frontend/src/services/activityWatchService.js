import {
  createSubscriptionSnapshot,
  diffSubscriptionSnapshot,
  normalizeFilterSubscription,
  snapshotsEqual,
  subscriptionMatchesSpot,
} from '../models/spotSubscriptions'

function userIdOf(entry) {
  return String(entry?.id || entry?.follower?.id || '').trim()
}

function requestIdOf(entry) {
  const followerId = String(entry?.follower?.id || '').trim()
  const created = String(entry?.created_at || '').trim()
  return `${followerId}|${created}`
}

export class ActivityWatchService {
  constructor(ctx) {
    this.ctx = ctx
    this._busy = false
    this._seeded = false
    this._followerIds = new Set()
    this._requestIds = new Set()
  }

  start() {
    this._seeded = false
  }

  stop() {
    this._busy = false
    this._seeded = false
    this._followerIds.clear()
    this._requestIds.clear()
  }

  async tick({ notify = true } = {}) {
    if (this._busy) return

    const app = this.ctx
    if (!app.ui?.isAuthenticated()) return

    const meId = String(app.state.session.user?.id || '').trim()
    if (!meId) return

    this._busy = true
    try {
      const spotsCtrl = app.controller('spots')
      const notifyService = app.service('notify')

      try {
        const social = app.controller('social')
        const [followers, incomingRequests] = await Promise.all([
          social.followersOf(meId),
          social.incomingRequests(),
        ])

        const followerList = Array.isArray(followers) ? followers : []
        const requestList = Array.isArray(incomingRequests) ? incomingRequests : []

        app.state.social.followers = followerList
        app.state.social.followersCount = followerList.length
        app.state.social.incomingRequests = requestList

        const nextFollowerIds = new Set(followerList.map((entry) => userIdOf(entry)).filter(Boolean))
        const nextRequestIds = new Set(requestList.map((entry) => requestIdOf(entry)).filter(Boolean))

        if (notify && this._seeded) {
          for (const follower of followerList) {
            const fid = userIdOf(follower)
            if (!fid || this._followerIds.has(fid)) continue

            const who = String(follower.display_name || follower.username || 'A user')
            notifyService.push({
              level: 'info',
              title: 'New follower',
              message: `${who} started following you.`,
            })
          }

          for (const request of requestList) {
            const rid = requestIdOf(request)
            if (!rid || this._requestIds.has(rid)) continue

            const who = String(request?.follower?.display_name || request?.follower?.username || 'A user')
            notifyService.push({
              level: 'info',
              title: 'Follow request',
              message: `${who} requested to follow you.`,
            })
          }
        }

        this._followerIds = nextFollowerIds
        this._requestIds = nextRequestIds
      } catch {
        // Social activity polling is optional for subscription checks.
      }

      const rawSubs = Array.isArray(app.state.map?.filterSubscriptions)
        ? app.state.map.filterSubscriptions
        : []
      const subscriptions = rawSubs
        .map((entry) => normalizeFilterSubscription(entry))
        .filter(Boolean)
        .map((entry) => {
          const ownerUserId = String(entry.ownerUserId || '').trim() || meId
          return {
            ...entry,
            ownerUserId,
          }
        })
        .filter((entry) => String(entry?.ownerUserId || '').trim() === meId)
        .filter(Boolean)

      if (subscriptions.length) {
        await spotsCtrl.reload()
        const allSpots = Array.isArray(app.state.spots) ? app.state.spots : []
        const favoritesSet = new Set((app.state.favorites || []).map((id) => String(id)))

        const nextSubscriptions = []
        let subscriptionsUpdated = subscriptions.length !== rawSubs.length

        for (const sub of subscriptions) {
          const matchedSpots = allSpots.filter((spot) => subscriptionMatchesSpot(sub, spot, favoritesSet))
          const nextSnapshot = createSubscriptionSnapshot(matchedSpots)
          const previousSnapshot = sub.snapshot || {}

          const { addedIds, changedIds } = diffSubscriptionSnapshot(previousSnapshot, nextSnapshot)

          if (notify && (addedIds.length || changedIds.length)) {
            const changeSummary = []
            if (addedIds.length) changeSummary.push(`${addedIds.length} new`)
            if (changedIds.length) changeSummary.push(`${changedIds.length} changed`)

            notifyService.push({
              level: 'success',
              title: 'Subscription update',
              message: `${changeSummary.join(', ')} spot(s): ${sub.label}`,
            })
          }

          if (!snapshotsEqual(previousSnapshot, nextSnapshot)) {
            subscriptionsUpdated = true
          }

          nextSubscriptions.push({
            ...sub,
            snapshot: nextSnapshot,
          })
        }

        if (subscriptionsUpdated) {
          app.state.map.filterSubscriptions = nextSubscriptions
        }
      }

      this._seeded = true
    } catch {
      // Keep silent to avoid noisy polling errors when backend is offline.
    } finally {
      this._busy = false
    }
  }
}
