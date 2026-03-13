import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readText(relativePath) {
  const url = new URL(relativePath, import.meta.url)
  return readFileSync(url, 'utf8')
}

function fileExists(relativePath) {
  const url = new URL(relativePath, import.meta.url)
  return existsSync(url)
}

describe('native shell project contracts', () => {
  it('contains Android shell with expected package and permissions', () => {
    expect(fileExists('../../../mobile/capacitor/android/app/src/main/AndroidManifest.xml')).toBe(true)
    expect(fileExists('../../../mobile/capacitor/android/app/src/main/java/ch/spotonsight/mobile/MainActivity.java')).toBe(true)

    const manifest = readText('../../../mobile/capacitor/android/app/src/main/AndroidManifest.xml')
    expect(manifest).toContain('android.permission.INTERNET')
    expect(manifest).toContain('android:exported="true"')

    const activity = readText('../../../mobile/capacitor/android/app/src/main/java/ch/spotonsight/mobile/MainActivity.java')
    expect(activity).toContain('package ch.spotonsight.mobile;')
  })

  it('contains iOS shell with expected app identity fields', () => {
    expect(fileExists('../../../mobile/capacitor/ios/App/App/Info.plist')).toBe(true)
    expect(fileExists('../../../mobile/capacitor/ios/App/App/AppDelegate.swift')).toBe(true)

    const plist = readText('../../../mobile/capacitor/ios/App/App/Info.plist')
    expect(plist).toContain('<key>CFBundleDisplayName</key>')
    expect(plist).toContain('<string>SpotOnSight</string>')
  })
})
