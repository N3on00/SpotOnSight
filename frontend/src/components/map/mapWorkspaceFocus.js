export function focusSignature(input) {
  const src = input && typeof input === 'object' ? input : {}
  const lat = Number(src.lat)
  const lon = Number(src.lon)
  const spotId = String(src.spotId || '').trim()
  return [
    Number.isFinite(lat) ? lat.toFixed(6) : '',
    Number.isFinite(lon) ? lon.toFixed(6) : '',
    spotId,
  ].join('|')
}

export function applyFocusRequest({ input, state, lastFocusSignature, showSpotDetails }) {
  const sig = focusSignature(input)
  if (!sig || sig === '||' || lastFocusSignature.value === sig) return

  const src = input && typeof input === 'object' ? input : {}
  const lat = Number(src.lat)
  const lon = Number(src.lon)
  const spotId = String(src.spotId || '').trim()

  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    state.map.center = [lat, lon]
    state.map.zoom = Math.max(14, Number(state.map.zoom || 12))
  }

  if (spotId) {
    const spot = (Array.isArray(state.spots) ? state.spots : [])
      .find((entry) => String(entry?.id || '').trim() === spotId)
    if (spot) showSpotDetails(spot)
  }

  lastFocusSignature.value = sig
}
