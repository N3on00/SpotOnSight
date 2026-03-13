export const SPOT_FEED_SCOPES = {
  ALL: 'all',
  NEAR: 'near',
  FILTER: 'filter',
}

export function isValidScope(value) {
  return Object.values(SPOT_FEED_SCOPES).includes(value)
}

export function getDefaultScope() {
  return SPOT_FEED_SCOPES.ALL
}

export function getScopeLabel(scope) {
  switch (scope) {
    case SPOT_FEED_SCOPES.ALL:
      return 'All'
    case SPOT_FEED_SCOPES.NEAR:
      return 'Near'
    case SPOT_FEED_SCOPES.FILTER:
      return 'Filtered'
    default:
      return 'All'
  }
}

export function getScopeIcon(scope) {
  switch (scope) {
    case SPOT_FEED_SCOPES.ALL:
      return 'bi-globe'
    case SPOT_FEED_SCOPES.NEAR:
      return 'bi-geo-alt'
    case SPOT_FEED_SCOPES.FILTER:
      return 'bi-funnel'
    default:
      return 'bi-globe'
  }
}
