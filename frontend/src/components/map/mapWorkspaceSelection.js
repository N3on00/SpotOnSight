import { nextTick } from 'vue'
import { resolveGoToSpot } from '../../models/mapSpotNavigation'

export function showSpotDetails({ selectedSpot, detailsOpen, spot }) {
  selectedSpot.value = spot
  detailsOpen.value = true
}

export function closeSpotDetails({ detailsOpen }) {
  detailsOpen.value = false
}

export function closeEditorState({ editorOpen, pickMode }) {
  editorOpen.value = false
  pickMode.value = false
}

export function scrollMapIntoView(mapViewportAnchor) {
  const host = mapViewportAnchor.value
  if (!host || typeof host.scrollIntoView !== 'function') {
    return
  }

  const reduceMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  host.scrollIntoView({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'start',
    inline: 'nearest',
  })
}

export function goToSpotSelection({ spot, selectedSpot, detailsOpen, state, mapViewportAnchor }) {
  detailsOpen.value = false
  const target = resolveGoToSpot(spot, state.map.zoom, 14)
  if (!target) {
    selectedSpot.value = spot
    return
  }

  state.map.center = target.center
  state.map.zoom = target.zoom
  selectedSpot.value = spot
  void nextTick(() => {
    scrollMapIntoView(mapViewportAnchor)
  })
}
