import { describe, expect, it } from 'vitest'

import { summarizeCollapsedFilters } from '../models/mapFilterSummary'

describe('summarizeCollapsedFilters', () => {
  it('returns empty-state message when no filters are active', () => {
    expect(summarizeCollapsedFilters({})).toBe('Filter panel collapsed. No active filters.')
  })

  it('lists active filter fragments in summary text', () => {
    const summary = summarizeCollapsedFilters({
      text: 'forest',
      tagsText: 'quiet',
      ownerText: '@alice',
      visibility: 'following',
      onlyFavorites: true,
      radiusKm: 10,
    })

    expect(summary).toContain('text')
    expect(summary).toContain('tags')
    expect(summary).toContain('profile')
    expect(summary).toContain('following')
    expect(summary).toContain('liked spots only')
    expect(summary).toContain('10 km radius')
  })
})
