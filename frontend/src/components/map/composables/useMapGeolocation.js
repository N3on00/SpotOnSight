import { ref } from 'vue'

export function useMapGeolocation({ state, getStoredLocation, getCurrentPosition }) {
  const mapBounds = ref(null)
  const userLocation = ref(null)
  const locationLoading = ref(false)

  async function initializeUserLocation() {
    locationLoading.value = true
    try {
      const stored = getStoredLocation()
      let hasStoredLocation = false
      if (stored) {
        hasStoredLocation = true
        userLocation.value = stored
        state.map.center = [stored.lat, stored.lon]
      }

      const result = await getCurrentPosition()
      if (result.success && result.location) {
        userLocation.value = result.location
        state.map.center = [result.location.lat, result.location.lon]
        mapBounds.value = Array.isArray(result.bounds) ? result.bounds : null
      } else if (!hasStoredLocation && result?.fallback) {
        const fallbackCenter = Array.isArray(result.fallback.center) ? result.fallback.center : null
        if (fallbackCenter?.length >= 2) {
          state.map.center = [Number(fallbackCenter[0]), Number(fallbackCenter[1])]
        }
        if (Number.isFinite(Number(result.fallback.zoom))) {
          state.map.zoom = Number(result.fallback.zoom)
        }
        mapBounds.value = Array.isArray(result.fallback.bounds) ? result.fallback.bounds : null
      }
    } finally {
      locationLoading.value = false
    }
  }

  return {
    mapBounds,
    userLocation,
    locationLoading,
    initializeUserLocation,
  }
}
