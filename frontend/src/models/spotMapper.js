function asNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asVisibility(value) {
  const next = String(value || '').trim().toLowerCase()
  if (next === 'following' || next === 'invite_only' || next === 'personal') {
    return next
  }
  return 'public'
}

function asStringList(value) {
  if (!Array.isArray(value)) {
    return []
  }
  return value.map((x) => String(x || '').trim()).filter(Boolean)
}

export function extractSpotId(raw) {
  if (!raw || typeof raw !== 'object') {
    return ''
  }
  if (raw.id) {
    return String(raw.id)
  }
  if (typeof raw._id === 'string') {
    return raw._id
  }
  if (raw._id && typeof raw._id === 'object' && raw._id.$oid) {
    return String(raw._id.$oid)
  }
  return ''
}

export function normalizeSpot(raw) {
  const item = raw && typeof raw === 'object' ? raw : {}
  return {
    id: extractSpotId(item),
    owner_id: String(item.owner_id || ''),
    title: String(item.title || ''),
    description: String(item.description || ''),
    tags: asStringList(item.tags),
    lat: asNumber(item.lat, 0),
    lon: asNumber(item.lon, 0),
    images: asStringList(item.images),
    visibility: asVisibility(item.visibility),
    invite_user_ids: asStringList(item.invite_user_ids),
    created_at: String(item.created_at || ''),
  }
}

export function toSpotPayload(spot) {
  const item = spot && typeof spot === 'object' ? spot : {}
  return {
    title: String(item.title || ''),
    description: String(item.description || ''),
    tags: asStringList(item.tags),
    lat: asNumber(item.lat, 0),
    lon: asNumber(item.lon, 0),
    images: asStringList(item.images),
    visibility: asVisibility(item.visibility),
    invite_user_ids: asStringList(item.invite_user_ids),
  }
}
