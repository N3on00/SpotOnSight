import { describe, expect, it } from 'vitest'

import { compareText, isValidUsername, normalizeSearchText, tokenize } from '../utils/sanitizers'

describe('sanitizers unicode support', () => {
  it('folds accents for search without stripping emoji', () => {
    expect(normalizeSearchText('J\u00f6rg 🚀')).toBe('jorg 🚀')
    expect(normalizeSearchText('Cafe\u0301')).toBe('cafe')
  })

  it('accepts umlaut usernames and rejects emoji usernames', () => {
    expect(isValidUsername('j\u00f6rg')).toBe(true)
    expect(isValidUsername('joerg🚀')).toBe(false)
  })

  it('tokenizes unicode search text consistently', () => {
    expect(tokenize('Caf\u00e9, Gr\u00fcn')).toEqual(['cafe', 'grun'])
  })

  it('sorts text with base sensitivity', () => {
    expect(compareText('Andr\u00e9', 'Andre')).toBe(0)
  })
})
