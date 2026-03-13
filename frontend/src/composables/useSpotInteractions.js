import { ref } from 'vue'

export function useSpotInteractions({ isFavorite, onToggleFavorite, onGoToSpot }) {
  const detailsOpen = ref(false)
  const selectedSpot = ref(null)

  function openSpotDetails(spot) {
    selectedSpot.value = spot
    detailsOpen.value = true
  }

  function closeSpotDetails() {
    detailsOpen.value = false
  }

  async function toggleFavoriteForSpot(spot) {
    const spotId = String(spot?.id || '').trim()
    if (!spotId) return false
    return onToggleFavorite(spotId, Boolean(isFavorite(spot)))
  }

  function goToSpot(spot) {
    onGoToSpot(spot)
  }

  return {
    detailsOpen,
    selectedSpot,
    openSpotDetails,
    closeSpotDetails,
    toggleFavoriteForSpot,
    goToSpot,
  }
}
