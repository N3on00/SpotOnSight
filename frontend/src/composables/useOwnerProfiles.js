import { reactive } from 'vue'
import { asText, uniqueTextList } from '../utils/sanitizers'

function normalizeOwnerIds(spots) {
  return uniqueTextList(
    (Array.isArray(spots) ? spots : [])
      .map((spot) => asText(spot?.owner_id)),
  )
}

export function useOwnerProfiles(loadUserProfile) {
  if (typeof loadUserProfile !== 'function') {
    throw new Error('useOwnerProfiles requires a profile loader function')
  }

  const ownerProfiles = reactive({})
  const ownerLoading = reactive({})
  const pendingLoads = new Map()

  function ownerIdOf(spot) {
    return asText(spot?.owner_id)
  }

  function ownerProfileOf(spotOrOwnerId) {
    const ownerId = typeof spotOrOwnerId === 'string'
      ? asText(spotOrOwnerId)
      : ownerIdOf(spotOrOwnerId)
    if (!ownerId) return null
    return ownerProfiles[ownerId] || null
  }

  function ownerSearchText(spot) {
    const ownerId = ownerIdOf(spot)
    const profile = ownerProfileOf(ownerId)
    return [ownerId, profile?.username, profile?.display_name, profile?.email]
      .map((entry) => String(entry || '').toLowerCase())
      .join(' ')
  }

  function ownerLabel(spot) {
    const ownerId = ownerIdOf(spot)
    if (!ownerId) return 'unknown creator'

    if (ownerLoading[ownerId]) {
      return 'loading creator...'
    }

    const profile = ownerProfileOf(ownerId)
    const username = asText(profile?.username)
    if (username) {
      return `@${username}`
    }

    const displayName = asText(profile?.display_name)
    if (displayName) {
      return displayName
    }

    return `id: ${ownerId}`
  }

  async function loadOwnerProfile(ownerId) {
    const normalized = asText(ownerId)
    if (!normalized) return null

    if (normalized in ownerProfiles) {
      return ownerProfiles[normalized]
    }

    if (pendingLoads.has(normalized)) {
      return pendingLoads.get(normalized)
    }

    ownerLoading[normalized] = true
    const request = Promise.resolve(loadUserProfile(normalized))
      .then((profile) => {
        ownerProfiles[normalized] = profile && typeof profile === 'object' ? profile : null
        return ownerProfiles[normalized]
      })
      .catch(() => {
        ownerProfiles[normalized] = null
        return null
      })
      .finally(() => {
        ownerLoading[normalized] = false
        pendingLoads.delete(normalized)
      })

    pendingLoads.set(normalized, request)
    return request
  }

  async function warmOwnerProfiles(spots) {
    const ownerIds = normalizeOwnerIds(spots)
    await Promise.all(ownerIds.map((ownerId) => loadOwnerProfile(ownerId)))
  }

  return {
    ownerProfiles,
    ownerLoading,
    ownerProfileOf,
    ownerSearchText,
    ownerLabel,
    warmOwnerProfiles,
  }
}
