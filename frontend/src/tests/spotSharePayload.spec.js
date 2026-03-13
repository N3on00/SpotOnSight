import { describe, expect, it } from 'vitest'

import { buildSpotSharePayload } from '../models/spotSharePayload'

describe('buildSpotSharePayload', () => {
  it('builds deep link and composed text with coordinates', () => {
    const payload = buildSpotSharePayload(
      {
        id: 'spot-42',
        title: 'Hidden Waterfall',
        lat: 47.3769,
        lon: 8.5417,
      },
      'Take a look at this place',
      'https://app.spotonsight.example',
    )

    expect(payload.title).toBe('SpotOnSight - Hidden Waterfall')
    expect(payload.text).toContain('Take a look at this place')
    expect(payload.text).toContain('Coordinates: 47.376900, 8.541700')
    expect(payload.url).toBe('https://app.spotonsight.example/map?lat=47.3769&lon=8.5417&spotId=spot-42')
  })

  it('falls back safely when optional fields are missing', () => {
    const payload = buildSpotSharePayload({}, '', '')
    expect(payload.title).toBe('SpotOnSight - Spot')
    expect(payload.text).toBe('Spot: Spot')
    expect(payload.url).toBe('')
  })
})
