export class BaseSearchProvider {
  constructor({ minQueryLength = 0, defaultLimit = 20 } = {}) {
    this.minQueryLength = Math.max(0, Number(minQueryLength) || 0)
    this.defaultLimit = Math.max(1, Number(defaultLimit) || 20)
  }

  normalizeQuery(query) {
    return String(query || '').trim()
  }

  shouldSearch(query) {
    return query.length >= this.minQueryLength
  }

  normalizeLimit(limit) {
    const value = Number(limit)
    if (Number.isFinite(value) && value > 0) {
      return Math.max(1, Math.floor(value))
    }
    return this.defaultLimit
  }

  async execute(_query, _context) {
    throw new Error('execute(query, context) must be implemented by subclass')
  }

  async search(query, context = {}) {
    const normalizedQuery = this.normalizeQuery(query)
    if (!this.shouldSearch(normalizedQuery)) {
      return []
    }

    const normalizedContext = {
      ...context,
      limit: this.normalizeLimit(context.limit),
    }

    const results = await this.execute(normalizedQuery, normalizedContext)
    return Array.isArray(results) ? results : []
  }
}
