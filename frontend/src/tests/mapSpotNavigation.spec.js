import { describe, expect, it } from 'vitest'

import { resolveGoToSpot } from '../models/mapSpotNavigation'

describe('resolveGoToSpot', () => {
  it('returns centered map target for valid spot coords', () => {
    const result = resolveGoToSpot({ lat: '47.5', lon: 8.6 }, 11, 14)

    expect(result).toEqual({
      center: [47.5, 8.6],
      zoom: 14,
    })
  })

  it('preserves higher current zoom', () => {
    const result = resolveGoToSpot({ lat: 47.4, lon: 8.5 }, 16, 14)

    expect(result).toEqual({
      center: [47.4, 8.5],
      zoom: 16,
    })
  })

  it('returns null for invalid coordinates', () => {
    expect(resolveGoToSpot({ lat: 'x', lon: 8.5 }, 12, 14)).toBeNull()
    expect(resolveGoToSpot({ lat: 47.4, lon: null }, 12, 14)).toBeNull()
  })
})
