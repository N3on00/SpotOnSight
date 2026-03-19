import {
  sanitizeText,
  sanitizeNumber,
  normalizeVisibility,
  normalizeSearchText,
  tokenize,
  distanceKm,
} from '../utils/sanitizers'

function sanitizeOwnerUserId(value) {
  return sanitizeText(value)
}

function sanitizeRadius(value) {
  return Math.max(0, sanitizeNumber(value, 0))
}

function sanitizeSnapshot(value) {
  const src = value && typeof value === 'object' ? value : {}
  const out = {}

  for (const [rawId, rawSignature] of Object.entries(src)) {
    const id = sanitizeText(rawId)
    const signature = sanitizeText(rawSignature)
    if (!id || !signature) continue
    out[id] = signature
  }

  return out
}

function sanitizeCenter(center) {
  const src = center && typeof center === 'object' ? center : null
  if (!src) return null

  const lat = Number(src.lat)
  const lon = Number(src.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null
  }

  return {
    lat,
    lon,
    label: sanitizeText(src.label),
  }
}

function sanitizeFilters(filters) {
  const src = filters && typeof filters === 'object' ? filters : {}
  return {
    text: sanitizeText(src.text),
    tagsText: sanitizeText(src.tagsText),
    ownerText: sanitizeText(src.ownerText),
    visibility: normalizeVisibility(src.visibility),
    onlyFavorites: Boolean(src.onlyFavorites),
    radiusKm: sanitizeRadius(src.radiusKm),
  }
}

function defaultLabel(filters, center) {
  const parts = []
  if (center?.label) parts.push(center.label)
  if (filters.text) parts.push(`text: ${filters.text}`)
  if (filters.tagsText) parts.push(`tags: ${filters.tagsText}`)
  if (filters.ownerText) parts.push(`owner: ${filters.ownerText}`)
  if (filters.visibility !== 'all') parts.push(filters.visibility)
  if (filters.onlyFavorites) parts.push('favorites')
  if (filters.radiusKm > 0) parts.push(`${filters.radiusKm}km`)
  return parts.join(' | ') || 'All visible spots'
}

function spotSnapshotSignature(spot) {
  const src = spot && typeof spot === 'object' ? spot : {}

  const tags = Array.isArray(src.tags)
    ? src.tags.map((tag) => sanitizeText(tag).toLowerCase()).filter(Boolean).sort()
    : []

  const images = Array.isArray(src.images)
    ? src.images.map((image) => sanitizeText(image)).filter(Boolean)
    : []

  const inviteUserIds = Array.isArray(src.invite_user_ids)
    ? src.invite_user_ids.map((id) => sanitizeText(id)).filter(Boolean).sort()
    : []

  const lat = Number(src.lat)
  const lon = Number(src.lon)

  return JSON.stringify({
    owner_id: sanitizeText(src.owner_id),
    title: sanitizeText(src.title),
    description: sanitizeText(src.description),
    tags,
    lat: Number.isFinite(lat) ? Number(lat.toFixed(6)) : null,
    lon: Number.isFinite(lon) ? Number(lon.toFixed(6)) : null,
    visibility: sanitizeText(src.visibility || 'public'),
    images,
    invite_user_ids: inviteUserIds,
    created_at: sanitizeText(src.created_at),
    updated_at: sanitizeText(src.updated_at),
  })
}

export function createSubscriptionSnapshot(spots = []) {
  const list = Array.isArray(spots) ? spots : []
  const out = {}

  for (const spot of list) {
    const id = sanitizeText(spot?.id)
    if (!id) continue
    out[id] = spotSnapshotSignature(spot)
  }

  return out
}

export function diffSubscriptionSnapshot(previousSnapshot, nextSnapshot) {
  const previous = sanitizeSnapshot(previousSnapshot)
  const next = sanitizeSnapshot(nextSnapshot)

  const addedIds = []
  const changedIds = []
  const removedIds = []

  for (const [id, signature] of Object.entries(next)) {
    if (!(id in previous)) {
      addedIds.push(id)
      continue
    }
    if (previous[id] !== signature) {
      changedIds.push(id)
    }
  }

  for (const id of Object.keys(previous)) {
    if (!(id in next)) {
      removedIds.push(id)
    }
  }

  return {
    addedIds,
    changedIds,
    removedIds,
  }
}

export function snapshotsEqual(previousSnapshot, nextSnapshot) {
  const { addedIds, changedIds, removedIds } = diffSubscriptionSnapshot(previousSnapshot, nextSnapshot)
  return addedIds.length === 0 && changedIds.length === 0 && removedIds.length === 0
}

export function createFilterSubscription({
  label = '',
  filters = {},
  center = null,
  snapshot = {},
  ownerUserId = '',
} = {}) {
  const normalizedFilters = sanitizeFilters(filters)
  const normalizedCenter = sanitizeCenter(center)
  const normalizedLabel = sanitizeText(label) || defaultLabel(normalizedFilters, normalizedCenter)
  const normalizedSnapshot = sanitizeSnapshot(snapshot)
  const normalizedOwnerUserId = sanitizeOwnerUserId(ownerUserId)

  return {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ownerUserId: normalizedOwnerUserId,
    label: normalizedLabel,
    filters: normalizedFilters,
    center: normalizedCenter,
    snapshot: normalizedSnapshot,
  }
}

export function normalizeFilterSubscription(input) {
  if (!input || typeof input !== 'object') return null

  const id = sanitizeText(input.id)
  if (!id) return null

  const filters = sanitizeFilters(input.filters)
  const center = sanitizeCenter(input.center)
  const label = sanitizeText(input.label) || defaultLabel(filters, center)
  const createdAt = sanitizeText(input.createdAt) || new Date().toISOString()
  const snapshot = sanitizeSnapshot(input.snapshot)
  const ownerUserId = sanitizeOwnerUserId(input.ownerUserId || input.owner_user_id)

  return {
    id,
    createdAt,
    ownerUserId,
    label,
    filters,
    center,
    snapshot,
  }
}

export function subscriptionMatchesSpot(subscription, spot, favoritesSet = new Set()) {
  if (!subscription || typeof subscription !== 'object') return false
  if (!spot || typeof spot !== 'object') return false

  const filters = sanitizeFilters(subscription.filters)
  const center = sanitizeCenter(subscription.center)

  const spotId = String(spot.id || '').trim()
  const title = String(spot.title || '')
  const description = String(spot.description || '')
  const visibility = String(spot.visibility || 'public')
  const tags = Array.isArray(spot.tags) ? spot.tags.map((x) => normalizeSearchText(x)) : []
  const owner = normalizeSearchText(spot.owner_id)

  if (filters.onlyFavorites) {
    if (!spotId || !favoritesSet.has(spotId)) return false
  }

  if (filters.visibility !== 'all' && visibility !== filters.visibility) {
    return false
  }

  if (filters.text) {
    const needle = normalizeSearchText(filters.text)
    const haystack = [title, description, ...tags]
      .map((x) => normalizeSearchText(x))
      .join(' ')
    if (!haystack.includes(needle)) {
      return false
    }
  }

  if (filters.tagsText) {
    const requested = tokenize(filters.tagsText)
    const hasAll = requested.every((entry) => tags.some((tag) => tag.includes(entry)))
    if (!hasAll) {
      return false
    }
  }

  if (filters.ownerText) {
    const ownerNeedle = normalizeSearchText(filters.ownerText)
    if (!owner.includes(ownerNeedle)) {
      return false
    }
  }

  if (filters.radiusKm > 0 && center) {
    const lat = Number(spot.lat)
    const lon = Number(spot.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return false
    }
    const dist = distanceKm(lat, lon, center.lat, center.lon)
    if (!Number.isFinite(dist) || dist > filters.radiusKm) {
      return false
    }
  }

  return true
}
