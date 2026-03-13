export function asText(value) {
  return String(value || '').trim()
}

export function sanitizeText(value) {
  return asText(value)
}

export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function uniqueTextList(items) {
  const out = []
  const seen = new Set()

  for (const item of Array.isArray(items) ? items : []) {
    const normalized = asText(item)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }

  return out
}

export function distanceKm(latA, lonA, latB, lonB) {
  const dLat = (Number(latB) - Number(latA)) * (Math.PI / 180)
  const dLon = (Number(lonB) - Number(lonA)) * (Math.PI / 180)
  const radLatA = Number(latA) * (Math.PI / 180)
  const radLatB = Number(latB) * (Math.PI / 180)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radLatA) * Math.cos(radLatB) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return 6371 * c
}

export function parseCoordinate(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const out = Number(value)
  return Number.isFinite(out) ? out : null
}

export function sanitizeNumber(value, defaultValue = 0) {
  const out = Number(value)
  return Number.isFinite(out) ? out : defaultValue
}

export function sanitizeBoolean(value) {
  return Boolean(value)
}

export function sanitizeArray(value) {
  return Array.isArray(value) ? value : []
}

export function sanitizeObject(value) {
  return value && typeof value === 'object' ? value : {}
}

export function sanitizeId(value) {
  return asText(value)
}

export function normalizeVisibility(value) {
  const out = String(value || '').trim().toLowerCase()
  if (out === 'public' || out === 'following' || out === 'invite_only' || out === 'personal') {
    return out
  }
  return 'all'
}
