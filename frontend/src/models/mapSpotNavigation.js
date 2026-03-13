import { parseCoordinate } from '../utils/sanitizers'

export function resolveGoToSpot(spot, currentZoom, minZoom = 14) {
  const lat = parseCoordinate(spot?.lat)
  const lon = parseCoordinate(spot?.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null
  }

  return {
    center: [lat, lon],
    zoom: Math.max(Number(minZoom) || 14, Number(currentZoom) || 12),
  }
}
