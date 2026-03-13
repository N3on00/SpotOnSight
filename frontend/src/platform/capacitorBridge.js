import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Keyboard } from '@capacitor/keyboard'
import { Preferences } from '@capacitor/preferences'
import { StatusBar, Style } from '@capacitor/status-bar'
import { asText } from '../utils/sanitizers'

export function getPlatformName() {
  try {
    return asText(Capacitor.getPlatform()) || 'web'
  } catch {
    return 'web'
  }
}

export function isNativePlatform() {
  try {
    if (typeof Capacitor.isNativePlatform === 'function') {
      return Boolean(Capacitor.isNativePlatform())
    }
    return getPlatformName() !== 'web'
  } catch {
    return false
  }
}

export async function preferenceGet(key) {
  const normalized = asText(key)
  if (!normalized) return ''

  try {
    const result = await Preferences.get({ key: normalized })
    return String(result?.value || '')
  } catch {
    return ''
  }
}

export async function preferenceSet(key, value) {
  const normalized = asText(key)
  if (!normalized) return false

  try {
    await Preferences.set({ key: normalized, value: String(value || '') })
    return true
  } catch {
    return false
  }
}

export async function preferenceRemove(key) {
  const normalized = asText(key)
  if (!normalized) return false

  try {
    await Preferences.remove({ key: normalized })
    return true
  } catch {
    return false
  }
}

export async function addAppStateChangeListener(listener) {
  if (typeof listener !== 'function') return null

  try {
    return await App.addListener('appStateChange', listener)
  } catch {
    return null
  }
}

export async function addKeyboardVisibilityListeners({ onShow, onHide } = {}) {
  const handles = []

  if (typeof onShow === 'function') {
    try {
      const showHandle = await Keyboard.addListener('keyboardDidShow', onShow)
      if (showHandle) {
        handles.push(showHandle)
      }
    } catch {}
  }

  if (typeof onHide === 'function') {
    try {
      const hideHandle = await Keyboard.addListener('keyboardDidHide', onHide)
      if (hideHandle) {
        handles.push(hideHandle)
      }
    } catch {}
  }

  return handles
}

export async function setStatusBarTheme(theme) {
  const normalized = asText(theme).toLowerCase()
  const style = normalized === 'dark' ? Style.Dark : Style.Light

  try {
    await StatusBar.setStyle({ style })
    return true
  } catch {
    return false
  }
}

export async function removeListener(handle) {
  if (!handle || typeof handle.remove !== 'function') return
  await handle.remove()
}
