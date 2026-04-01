import {
  createSubscriptionSnapshot,
  diffSubscriptionSnapshot,
  normalizeFilterSubscription,
  snapshotsEqual,
  subscriptionMatchesSpot,
} from '../../models/spotSubscriptions'
import { NOTIFICATION_CATEGORIES } from '../notificationService'
import { setFilterSubscriptions } from '../../state/appMutations'

export async function syncFilterSubscriptions(app, { notify = true, meId, notifyService }) {
  const rawSubs = Array.isArray(app.state.map?.filterSubscriptions)
    ? app.state.map.filterSubscriptions
    : []
  const subscriptions = rawSubs
    .map((entry) => normalizeFilterSubscription(entry))
    .filter(Boolean)
    .map((entry) => ({
      ...entry,
      ownerUserId: String(entry.ownerUserId || '').trim() || meId,
    }))
    .filter((entry) => String(entry?.ownerUserId || '').trim() === meId)
    .filter(Boolean)

  if (!subscriptions.length) {
    if (subscriptions.length !== rawSubs.length) {
      setFilterSubscriptions(app.state, subscriptions)
    }
    return
  }

  await app.action('spots').reload()
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
        category: NOTIFICATION_CATEGORIES.MAP,
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
    setFilterSubscriptions(app.state, nextSubscriptions)
  }
}
