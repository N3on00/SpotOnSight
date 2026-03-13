import { asText, parseCoordinate } from '../utils/sanitizers'

function asCoord(value) {
  return parseCoordinate(value)
}

function deepLinkUrl(spot, origin = '') {
  const baseOrigin = asText(origin)
  if (!baseOrigin) return ''

  const url = new URL('/map', baseOrigin)
  const lat = asCoord(spot?.lat)
  const lon = asCoord(spot?.lon)
  const spotId = asText(spot?.id)

  if (lat != null && lon != null) {
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lon))
  }
  if (spotId) {
    url.searchParams.set('spotId', spotId)
  }

  return url.toString()
}

export function buildSpotSharePayload(spot, message = '', origin = '') {
  const title = asText(spot?.title) || 'Spot'
  const lat = asCoord(spot?.lat)
  const lon = asCoord(spot?.lon)
  const userMessage = asText(message)

  const lines = []
  if (userMessage) {
    lines.push(userMessage)
  }
  lines.push(`Spot: ${title}`)
  if (lat != null && lon != null) {
    lines.push(`Coordinates: ${lat.toFixed(6)}, ${lon.toFixed(6)}`)
  }

  return {
    title: `SpotOnSight - ${title}`,
    text: lines.join('\n'),
    url: deepLinkUrl(spot, origin),
  }
}
