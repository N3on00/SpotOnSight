import { asText } from '../utils/sanitizers'

export function summarizeCollapsedFilters(filters) {
  const source = filters && typeof filters === 'object' ? filters : {}
  const active = []

  if (asText(source.text)) active.push('text')
  if (asText(source.tagsText)) active.push('tags')
  if (asText(source.ownerText)) active.push('profile')

  const visibility = asText(source.visibility).toLowerCase()
  if (visibility && visibility !== 'all') {
    active.push(visibility)
  }

  if (Boolean(source.onlyFavorites)) {
    active.push('liked spots only')
  }

  const radiusKm = Number(source.radiusKm || 0)
  if (Number.isFinite(radiusKm) && radiusKm > 0) {
    active.push(`${radiusKm} km radius`)
  }

  if (!active.length) {
    return 'Filter panel collapsed. No active filters.'
  }
  return `Filter panel collapsed. Active: ${active.join(', ')}.`
}
