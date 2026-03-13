import { normalizeFilterSubscription } from '../models/spotSubscriptions'
import { normalizeUser } from '../models/userMapper'
import {
  addAppStateChangeListener,
  addKeyboardVisibilityListeners,
  getPlatformName,
  isNativePlatform,
  preferenceGet,
  preferenceRemove,
  preferenceSet,
  removeListener,
  setStatusBarTheme,
} from '../platform/capacitorBridge'
import { asText } from '../utils/sanitizers'
import { BaseService } from './baseService'

const SESSION_KEY = 'sos_web_session_v1'
const THEME_KEY = 'sos_web_theme_v1'
const FILTER_SUBSCRIPTIONS_KEY_PREFIX = 'sos_map_filter_subscriptions_v2'

function parseJson(value, fallback) {
  try {
    return JSON.parse(String(value || ''))
  } catch {
    return fallback
  }
}

function normalizeStoredSession(rawValue) {
  const parsed = parseJson(rawValue, null)
  if (!parsed || typeof parsed !== 'object') {
    return { token: '', user: null }
  }

  return {
    token: asText(parsed.token),
    user: parsed.user && typeof parsed.user === 'object' ? normalizeUser(parsed.user) : null,
  }
}

function normalizeStoredTheme(rawValue) {
  return asText(rawValue).toLowerCase() === 'dark' ? 'dark' : 'light'
}

function filterSubscriptionsStorageKey(userId) {
  return `${FILTER_SUBSCRIPTIONS_KEY_PREFIX}:${asText(userId)}`
}

function normalizeStoredFilterSubscriptions(rawValue, userId) {
  const ownerUserId = asText(userId)
  if (!ownerUserId) return []

  const parsed = parseJson(rawValue, [])
  if (!Array.isArray(parsed)) return []

  return parsed
    .map((entry) => normalizeFilterSubscription(entry))
    .filter(Boolean)
    .map((entry) => ({
      ...entry,
      ownerUserId,
    }))
}

function bodyClassList() {
  if (typeof document === 'undefined') return null
  return document.body?.classList || null
}

export class PlatformService extends BaseService {
  constructor(state) {
    super({ serviceName: 'platform' })
    this.state = state
    this._initialized = false
    this._listenerHandles = []
  }

  platform() {
    return getPlatformName()
  }

  isNative() {
    return isNativePlatform()
  }

  isAndroid() {
    return this.platform() === 'android'
  }

  isIos() {
    return this.platform() === 'ios'
  }

  async hydrateState() {
    if (!this.isNative()) return

    const session = normalizeStoredSession(await preferenceGet(SESSION_KEY))
    this.state.session.token = session.token
    this.state.session.user = session.user

    this.state.ui.theme = normalizeStoredTheme(await preferenceGet(THEME_KEY))

    await this.syncUserFilterSubscriptions()
  }

  async syncUserFilterSubscriptions() {
    if (!this.isNative()) return

    const ownerUserId = asText(this.state.session?.user?.id)
    if (!ownerUserId) {
      this.state.map.filterSubscriptions = []
      return
    }

    const raw = await preferenceGet(filterSubscriptionsStorageKey(ownerUserId))
    this.state.map.filterSubscriptions = normalizeStoredFilterSubscriptions(raw, ownerUserId)
  }

  async persistSession() {
    if (!this.isNative()) return

    const token = asText(this.state.session?.token)
    const user = this.state.session?.user && typeof this.state.session.user === 'object'
      ? this.state.session.user
      : null

    if (!token || !user) {
      await preferenceRemove(SESSION_KEY)
      return
    }

    await preferenceSet(SESSION_KEY, JSON.stringify({ token, user }))
  }

  async persistTheme() {
    if (!this.isNative()) return

    const theme = normalizeStoredTheme(this.state.ui?.theme)
    await preferenceSet(THEME_KEY, theme)
  }

  async persistFilterSubscriptions() {
    if (!this.isNative()) return

    const ownerUserId = asText(this.state.session?.user?.id)
    if (!ownerUserId) {
      return
    }

    const source = Array.isArray(this.state.map?.filterSubscriptions)
      ? this.state.map.filterSubscriptions
      : []
    const normalized = source
      .map((entry) => normalizeFilterSubscription(entry))
      .filter(Boolean)
      .map((entry) => ({
        ...entry,
        ownerUserId,
      }))

    await preferenceSet(filterSubscriptionsStorageKey(ownerUserId), JSON.stringify(normalized))
  }

  async initializeRuntimeLifecycle(runtime) {
    if (this._initialized) return
    this._initialized = true

    if (!this.isNative()) return

    const appStateHandle = await addAppStateChangeListener((event) => {
      if (!runtime) return
      if (event?.isActive) {
        runtime.start()
        void runtime.tick({ notify: true, source: 'native-resume' })
        return
      }
      runtime.stop()
    })
    if (appStateHandle) {
      this._listenerHandles.push(appStateHandle)
    }

    const keyboardHandles = await addKeyboardVisibilityListeners({
      onShow: () => {
        bodyClassList()?.add('app-keyboard-open')
      },
      onHide: () => {
        bodyClassList()?.remove('app-keyboard-open')
      },
    })
    this._listenerHandles.push(...keyboardHandles)

    await this.applyStatusBarTheme()
  }

  async applyStatusBarTheme() {
    if (!this.isNative()) return
    await setStatusBarTheme(this.state.ui?.theme)
  }

  async disposeRuntimeLifecycle() {
    const handles = [...this._listenerHandles]
    this._listenerHandles = []
    this._initialized = false
    bodyClassList()?.remove('app-keyboard-open')

    await Promise.all(handles.map((handle) => removeListener(handle)))
  }
}
