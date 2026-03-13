import { computed, ref } from 'vue'

export function useMapLocationSearch({ state, searchLocations, notify, onResetPagination }) {
  const locationQuery = ref('')
  const locationSearchBusy = ref(false)
  const locationSearchError = ref('')
  const locationResults = ref([])
  const activeLocation = ref(null)

  const activeLocationLabel = computed(() => String(activeLocation.value?.label || ''))

  function updateLocationQuery(next) {
    locationQuery.value = String(next || '')
  }

  async function runLocationSearch() {
    const query = String(locationQuery.value || '').trim()
    if (!query || locationSearchBusy.value) {
      return
    }

    locationSearchBusy.value = true
    locationSearchError.value = ''
    locationResults.value = []

    try {
      const out = await searchLocations(query, 7)
      const results = Array.isArray(out) ? out : []
      locationResults.value = results
      if (!results.length) {
        locationSearchError.value = 'No places matched this search.'
      }
    } catch (error) {
      locationSearchError.value = String(error?.message || error || 'Location search failed')
    } finally {
      locationSearchBusy.value = false
    }
  }

  function selectLocation(result) {
    if (!result) return

    activeLocation.value = result
    locationResults.value = []
    state.map.center = [Number(result.lat), Number(result.lon)]
    state.map.zoom = Math.max(14, Number(state.map.zoom || 12))
    onResetPagination()

    notify({
      level: 'info',
      title: 'Location selected',
      message: `Map moved to ${result.label}.`,
    })
  }

  function clearLocationFilter() {
    activeLocation.value = null
    onResetPagination()
  }

  function radiusCenter() {
    if (activeLocation.value) {
      return [Number(activeLocation.value.lat), Number(activeLocation.value.lon)]
    }

    const center = Array.isArray(state.map?.center) ? state.map.center : []
    if (center.length >= 2 && Number.isFinite(Number(center[0])) && Number.isFinite(Number(center[1]))) {
      return [Number(center[0]), Number(center[1])]
    }

    return null
  }

  function currentSubscriptionCenter() {
    if (activeLocation.value) {
      return {
        lat: Number(activeLocation.value.lat),
        lon: Number(activeLocation.value.lon),
        label: String(activeLocation.value.label || ''),
      }
    }

    const center = Array.isArray(state.map?.center) ? state.map.center : []
    if (center.length < 2) return null

    const lat = Number(center[0])
    const lon = Number(center[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

    return {
      lat,
      lon,
      label: '',
    }
  }

  return {
    locationQuery,
    locationSearchBusy,
    locationSearchError,
    locationResults,
    activeLocation,
    activeLocationLabel,
    updateLocationQuery,
    runLocationSearch,
    selectLocation,
    clearLocationFilter,
    radiusCenter,
    currentSubscriptionCenter,
  }
}
