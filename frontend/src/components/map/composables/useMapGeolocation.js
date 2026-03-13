import { ref } from 'vue'

export function useMapGeolocation({ state, getStoredLocation, getCurrentPosition, getDefaultBounds }) {
  const mapBounds = ref(getDefaultBounds())
  const userLocation = ref(null)
  const locationLoading = ref(false)

  async function initializeUserLocation() {
    locationLoading.value = true
    try {
      const stored = getStoredLocation()
      if (stored) {
        userLocation.value = stored
        mapBounds.value = [
          [stored.lat - 0.5, stored.lon - 0.8],
          [stored.lat + 0.5, stored.lon + 0.8],
        ]
        state.map.center = [stored.lat, stored.lon]
      }

      const result = await getCurrentPosition()
      if (result.success && result.location) {
        userLocation.value = result.location
        mapBounds.value = result.bounds
        state.map.center = [result.location.lat, result.location.lon]
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
