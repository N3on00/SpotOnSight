import { describe, expect, it, vi, beforeEach } from 'vitest'

import {
  buildSpotSharePayload,
} from '../models/spotSharePayload'

import {
  createFilterSubscription,
  createSubscriptionSnapshot,
  normalizeFilterSubscription,
} from '../models/spotSubscriptions'

import {
  resolveGoToSpot,
} from '../models/mapSpotNavigation'

describe('spotSharePayload', () => {
  it('builds share payload with title and coordinates', () => {
    const spot = {
      id: 'spot-123',
      title: 'Test Spot',
      lat: 47.5,
      lon: 8.6,
    }
    const payload = buildSpotSharePayload(spot, '', 'https://app.example.com')
    
    expect(payload.title).toBe('SpotOnSight - Test Spot')
    expect(payload.url).toContain('spot-123')
    expect(payload.url).toContain('app.example.com')
  })

  it('includes custom message and spot details', () => {
    const spot = { id: 's1', title: 'Spot', lat: 1, lon: 2 }
    const payload = buildSpotSharePayload(spot, 'Great place!', 'https://app.com')
    
    expect(payload.text).toContain('Great place!')
    expect(payload.text).toContain('Spot: Spot')
    expect(payload.text).toContain('Coordinates:')
  })

  it('generates valid deep-link URL with query params', () => {
    const spot = { id: 'abc123', title: 'My Spot', lat: 47.0, lon: 8.0 }
    const payload = buildSpotSharePayload(spot, '', 'https://app.com')
    
    expect(payload.url).toContain('/map')
    expect(payload.url).toContain('spotId=abc123')
  })
})

describe('spotSubscriptions', () => {
  describe('createSubscriptionSnapshot', () => {
    it('creates snapshot from spot list', () => {
      const spots = [
        { id: 's1', title: 'Spot 1' },
        { id: 's2', title: 'Spot 2' },
      ]
      const snapshot = createSubscriptionSnapshot(spots)
      
      expect(snapshot).toHaveProperty('s1')
      expect(snapshot).toHaveProperty('s2')
    })

    it('returns empty object for empty list', () => {
      const snapshot = createSubscriptionSnapshot([])
      expect(Object.keys(snapshot).length).toBe(0)
    })
  })

  describe('createFilterSubscription', () => {
    it('creates subscription with filters and center', () => {
      const filters = { text: 'beach', tagsText: '', visibility: 'all', onlyFavorites: false, ownerText: '', radiusKm: 0 }
      const center = { lat: 47.5, lon: 8.5, label: 'Zurich' }
      const snapshot = { s1: true }
      
      const sub = createFilterSubscription({
        filters,
        center,
        label: 'Beach Spots',
        snapshot,
        ownerUserId: 'user-123',
      })
      
      expect(sub.filters.text).toBe('beach')
      expect(sub.center).toEqual(center)
      expect(sub.label).toBe('Beach Spots')
      expect(sub.ownerUserId).toBe('user-123')
    })
  })

  describe('normalizeFilterSubscription', () => {
    it('normalizes valid subscription with defaults', () => {
      const sub = {
        id: 'sub-1',
        filters: { text: 'test', tagsText: '', visibility: 'all', onlyFavorites: false, ownerText: '', radiusKm: 0 },
        center: { lat: 1, lon: 2, label: '' },
        ownerUserId: 'u1',
        snapshot: {},
        createdAt: '2026-02-18T13:24:12.904Z',
        label: 'text: test',
      }
      const normalized = normalizeFilterSubscription(sub)
      
      expect(normalized.id).toBe('sub-1')
      expect(normalized.ownerUserId).toBe('u1')
      expect(normalized.filters).toBeDefined()
    })

    it('returns null for invalid input', () => {
      expect(normalizeFilterSubscription(null)).toBeNull()
      expect(normalizeFilterSubscription(undefined)).toBeNull()
      expect(normalizeFilterSubscription('invalid')).toBeNull()
    })
  })
})

describe('mapSpotNavigation', () => {
  describe('resolveGoToSpot', () => {
    it('resolves valid spot to map target', () => {
      const spot = { lat: 47.5, lon: 8.6 }
      const result = resolveGoToSpot(spot, 12, 14)
      
      expect(result).toEqual({
        center: [47.5, 8.6],
        zoom: 14,
      })
    })

    it('preserves higher zoom level', () => {
      const spot = { lat: 47.0, lon: 8.0 }
      const result = resolveGoToSpot(spot, 16, 14)
      
      expect(result.zoom).toBe(16)
    })

    it('returns null for invalid coordinates', () => {
      expect(resolveGoToSpot({ lat: null, lon: 8.0 }, 12, 14)).toBeNull()
      expect(resolveGoToSpot({ lat: 47.0, lon: 'invalid' }, 12, 14)).toBeNull()
      expect(resolveGoToSpot({ lat: 'x', lon: 8.0 }, 12, 14)).toBeNull()
    })

    it('handles string coordinates', () => {
      const spot = { lat: '47.5', lon: '8.6' }
      const result = resolveGoToSpot(spot, 10, 14)
      
      expect(result).toEqual({
        center: [47.5, 8.6],
        zoom: 14,
      })
    })
  })
})
