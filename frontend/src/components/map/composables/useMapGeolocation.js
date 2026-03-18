import { ref } from 'vue'

export function useMapGeolocation({ state, getStoredLocation, getCurrentPosition }) {
  const mapBounds = ref(null)
  const userLocation = ref(null)
  const locationLoading = ref(false)

  async function initializeUserLocation() {
    locationLoading.value = true
    try {
      const stored = getStoredLocation()
      if (stored) {
        userLocation.value = stored
        state.map.center = [stored.lat, stored.lon]
      }

      const result = await getCurrentPosition()
      if (result.success && result.location) {
        userLocation.value = result.location
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
