import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC_ROOT = path.resolve(__dirname, '..')

function listFiles(rootDir) {
  const out = []
  const stack = [rootDir]

  while (stack.length) {
    const current = stack.pop()
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const next = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(next)
      } else if (entry.isFile() && /\.(js|vue)$/.test(entry.name)) {
        out.push(next)
      }
    }
  }

  return out
}

describe('Architecture guardrails', () => {
  it('keeps asText helper centralized', () => {
    const offenders = listFiles(SRC_ROOT)
      .filter((filePath) => !filePath.endsWith(path.join('utils', 'sanitizers.js')))
      .filter((filePath) => {
        const text = fs.readFileSync(filePath, 'utf8')
        return /function\s+asText\s*\(/.test(text)
      })

    expect(offenders).toEqual([])
  })

  it('keeps distanceKm helper centralized', () => {
    const offenders = listFiles(SRC_ROOT)
      .filter((filePath) => !filePath.endsWith(path.join('utils', 'sanitizers.js')))
      .filter((filePath) => {
        const text = fs.readFileSync(filePath, 'utf8')
        return /function\s+distanceKm\s*\(/.test(text)
      })

    expect(offenders).toEqual([])
  })

  it('uses shared spot action registration helpers in home/profile screens', () => {
    const homeUiPath = path.resolve(SRC_ROOT, 'registrations', 'homeUi.js')
    const profileUiPath = path.resolve(SRC_ROOT, 'registrations', 'profileUi.js')
    const homeUi = fs.readFileSync(homeUiPath, 'utf8')
    const profileUi = fs.readFileSync(profileUiPath, 'utf8')

    expect(homeUi.includes('createSpotCommentActions')).toBe(true)
    expect(homeUi.includes('createSpotFavoriteAction')).toBe(true)
    expect(profileUi.includes('createSpotCommentActions')).toBe(true)
    expect(profileUi.includes('createSpotFavoriteAction')).toBe(true)
    expect(homeUi.includes('onCreateComment: async')).toBe(false)
    expect(profileUi.includes('onCreateComment: async')).toBe(false)
  })

  it('uses shared spot interaction composable in home/profile components', () => {
    const homeDiscoverPath = path.resolve(SRC_ROOT, 'components', 'home', 'HomeDiscover.vue')
    const profileSummaryPath = path.resolve(SRC_ROOT, 'components', 'profile', 'ProfileSummary.vue')
    const homeDiscover = fs.readFileSync(homeDiscoverPath, 'utf8')
    const profileSummary = fs.readFileSync(profileSummaryPath, 'utf8')

    expect(homeDiscover.includes("useSpotInteractions")).toBe(true)
    expect(profileSummary.includes("useSpotInteractions")).toBe(true)
  })
})
