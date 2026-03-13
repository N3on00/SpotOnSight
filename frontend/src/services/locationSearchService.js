import { BaseService } from './baseService'
import { asText } from '../utils/sanitizers'

function asNumber(value) {
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function toLocationResult(item) {
  const lat = asNumber(item?.lat)
  const lon = asNumber(item?.lon)
  const label = asText(item?.display_name || item?.name)
  if (lat == null || lon == null || !label) {
    return null
  }

  return {
    id: asText(item?.place_id || `${lat},${lon}`),
    label,
    type: asText(item?.type || item?.class),
    lat,
    lon,
  }
}

function toPhotonResult(feature) {
  const coords = Array.isArray(feature?.geometry?.coordinates)
    ? feature.geometry.coordinates
    : []
  const lon = asNumber(coords[0])
  const lat = asNumber(coords[1])
  if (lat == null || lon == null) {
    return null
  }

  const props = feature?.properties || {}
  const labelParts = [
    props.name,
    props.street,
    props.city,
    props.country,
  ]
    .map((entry) => asText(entry))
    .filter(Boolean)

  const label = labelParts.join(', ')
  if (!label) {
    return null
  }

  return {
    id: asText(props.osm_id || feature?.id || `${lat},${lon}`),
    label,
    type: asText(props.osm_value || props.type),
    lat,
    lon,
  }
}

export class LocationSearchService extends BaseService {
  constructor() {
    super({ serviceName: 'locationSearch' })
  }

  async searchPlaces(query, limit = 6) {
    const q = asText(query)
    if (!q) {
      this.clearError()
      return []
    }

    const safeLimit = Math.min(12, Math.max(1, Number(limit) || 6))
    const language = typeof navigator !== 'undefined' && navigator?.language
      ? navigator.language
      : 'en'

    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search')
    nominatimUrl.searchParams.set('format', 'jsonv2')
    nominatimUrl.searchParams.set('addressdetails', '0')
    nominatimUrl.searchParams.set('limit', String(safeLimit))
    nominatimUrl.searchParams.set('q', q)

    try {
      const response = await fetch(nominatimUrl.toString(), {
        headers: {
          'Accept-Language': language,
        },
      })

      if (!response.ok) {
        throw new Error(`Primary location search failed (${response.status})`)
      }

      const data = await response.json()
      const mapped = Array.isArray(data)
        ? data
        .map((entry) => toLocationResult(entry))
        .filter(Boolean)
        : []

      if (mapped.length) {
        this.clearError()
        return mapped
      }
    } catch (error) {
      this.captureError(error, 'Could not search locations')
    }

    const photonUrl = new URL('https://photon.komoot.io/api/')
    photonUrl.searchParams.set('q', q)
    photonUrl.searchParams.set('limit', String(safeLimit))

    try {
      const response = await fetch(photonUrl.toString())
      if (!response.ok) {
        throw new Error(`Fallback location search failed (${response.status})`)
      }

      const data = await response.json()
      const features = Array.isArray(data?.features) ? data.features : []
      const mapped = features
        .map((feature) => toPhotonResult(feature))
        .filter(Boolean)

      this.clearError()
      return mapped
    } catch (error) {
      this.captureError(error, 'Could not search locations')
      return []
    }
  }
}
