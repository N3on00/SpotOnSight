import { normalizeFilterSubscription } from '../../models/spotSubscriptions'
import { normalizeVisibility } from '../../utils/sanitizers'

export function defaultSpotFilters() {
  return {
    text: '',
    tagsText: '',
    ownerText: '',
    visibility: 'all',
    onlyFavorites: false,
    radiusKm: 0,
  }
}

export function sanitizeSpotFilters(source) {
  const src = source && typeof source === 'object' ? source : {}
  return {
    text: String(src.text || '').trim(),
    tagsText: String(src.tagsText || '').trim(),
    ownerText: String(src.ownerText || '').trim(),
    visibility: normalizeVisibility(src.visibility || 'all'),
    onlyFavorites: Boolean(src.onlyFavorites),
    radiusKm: Math.max(0, Number(src.radiusKm) || 0),
  }
}

export function normalizeSubscriptionForUser(entry, fallbackOwnerUserId = '') {
  const normalized = normalizeFilterSubscription(entry)
  if (!normalized) return null

  const ownerUserId = String(normalized.ownerUserId || '').trim() || String(fallbackOwnerUserId || '').trim()
  return {
    ...normalized,
    ownerUserId,
  }
}

export function ownedSubscriptions(entries, ownerUserId) {
  const owner = String(ownerUserId || '').trim()
  if (!owner) return []

  return (Array.isArray(entries) ? entries : [])
    .map((entry) => normalizeSubscriptionForUser(entry, owner))
    .filter(Boolean)
    .filter((entry) => String(entry.ownerUserId || '').trim() === owner)
}
