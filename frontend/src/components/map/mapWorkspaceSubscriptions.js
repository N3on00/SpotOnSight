import {
  createFilterSubscription,
  createSubscriptionSnapshot,
} from '../../models/spotSubscriptions'
import { ownedSubscriptions, sanitizeSpotFilters } from './mapWorkspaceState'

export function subscribeCurrentFilters({ currentUserId, filteredSpots, spotFilters, currentSubscriptionCenter, state, notify }) {
  const ownerUserId = currentUserId.value
  if (!ownerUserId) {
    notify({ level: 'warning', title: 'Sign in required', message: 'Please sign in again before creating filter subscriptions.' })
    return
  }

  const baselineSnapshot = createSubscriptionSnapshot(filteredSpots.value)
  const sub = createFilterSubscription({
    filters: spotFilters,
    center: currentSubscriptionCenter(),
    label: '',
    snapshot: baselineSnapshot,
    ownerUserId,
  })

  const out = ownedSubscriptions(state.map?.filterSubscriptions, ownerUserId)
  const signature = JSON.stringify({ filters: sub.filters, center: sub.center })
  const alreadyExists = out.some((entry) => JSON.stringify({ filters: entry.filters, center: entry.center }) === signature)
  if (alreadyExists) {
    notify({ level: 'info', title: 'Already subscribed', message: 'This filter is already in your subscriptions.' })
    return
  }

  out.push(sub)
  state.map.filterSubscriptions = out
  notify({
    level: 'success',
    title: 'Filter subscribed',
    message: `Saved current result (${Object.keys(baselineSnapshot).length} spots) for: ${sub.label}`,
    details: 'You will only get alerts for newly matching spots or changed matching spots.',
  })
}

export function removeFilterSubscription({ currentUserId, subId, state, notify }) {
  const ownerUserId = currentUserId.value
  state.map.filterSubscriptions = ownedSubscriptions(state.map?.filterSubscriptions, ownerUserId)
    .filter((entry) => !(String(entry.ownerUserId || '').trim() === ownerUserId && String(entry.id || '') === String(subId || '')))

  notify({ level: 'info', title: 'Subscription removed', message: 'This map filter subscription was deleted.' })
}

export function applyFilterSubscription({ subscription, currentUserId, activeLocation, spotFilters, state, visibleSpotCount, pageSize, normalizeSubscriptionForUser, notify }) {
  const sub = normalizeSubscriptionForUser(subscription, currentUserId.value)
  if (!sub || String(sub.ownerUserId || '').trim() !== currentUserId.value) return

  Object.assign(spotFilters, sanitizeSpotFilters(sub.filters))

  if (sub.center) {
    activeLocation.value = {
      id: `sub-${sub.id}`,
      label: String(sub.center.label || 'Subscribed area'),
      lat: Number(sub.center.lat),
      lon: Number(sub.center.lon),
      type: 'subscription',
    }
    state.map.center = [Number(sub.center.lat), Number(sub.center.lon)]
    state.map.zoom = Math.max(14, Number(state.map.zoom || 12))
  } else {
    activeLocation.value = null
  }

  visibleSpotCount.value = pageSize
  notify({ level: 'info', title: 'Subscription applied', message: `Applied filter: ${sub.label}` })
}
