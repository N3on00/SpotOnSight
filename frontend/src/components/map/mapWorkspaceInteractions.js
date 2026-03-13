import { buildSpotSharePayload } from '../../models/spotSharePayload'

export async function toggleFavoriteSelection({ selectedSpot, behavior, isFavorite }) {
  if (!selectedSpot.value?.id) return
  await behavior.toggleFavorite(selectedSpot.value.id, isFavorite(selectedSpot.value))
}

export async function toggleFavoriteForSpot({ spot, behavior, isFavorite }) {
  if (!spot?.id) return
  await behavior.toggleFavorite(String(spot.id), isFavorite(spot))
}

export async function shareExternally(payload) {
  if (typeof navigator === 'undefined') return ''

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(payload)
      return 'shared'
    } catch (error) {
      if (String(error?.name || '') === 'AbortError') {
        return 'cancelled'
      }
    }
  }

  const shareUrl = String(payload?.url || '').trim()
  if (shareUrl && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(shareUrl)
      return 'copied'
    } catch {
      return ''
    }
  }

  return ''
}

export async function shareSelectedSpot({ selectedSpot, behavior, notify, message }) {
  const spot = selectedSpot.value
  const spotId = String(spot?.id || '').trim()
  if (!spotId) return false

  const sharePayload = buildSpotSharePayload(
    spot,
    message,
    typeof window !== 'undefined' ? window.location.origin : '',
  )

  const backendShared = await behavior.shareSpot(spotId, String(message || ''))
  const externalShareResult = await shareExternally(sharePayload)

  if (externalShareResult === 'copied') {
    notify({
      level: 'info',
      title: 'Link copied',
      message: 'Spot link copied to clipboard.',
    })
  }

  if (!backendShared && (externalShareResult === 'shared' || externalShareResult === 'copied')) {
    notify({
      level: 'warning',
      title: 'Shared locally only',
      message: 'Spot was shared from this device, but backend share logging failed.',
    })
    return true
  }

  return backendShared
}
