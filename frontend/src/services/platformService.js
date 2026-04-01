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
import {
  loadFilterSubscriptionsForUserAsync,
  normalizeStoredSession,
  normalizeStoredTheme,
  persistFilterSubscriptionsToStorageAsync,
  SESSION_KEY,
  THEME_KEY,
} from '../stores/persistence'
import { setFilterSubscriptions, setSessionState, setTheme } from '../state/appMutations'
import { asText } from '../utils/sanitizers'
import { BaseService } from './baseService'

const nativeStorage = {
  async getItem(key) {
    return preferenceGet(key)
  },
  async setItem(key, value) {
    await preferenceSet(key, value)
  },
  async removeItem(key) {
    await preferenceRemove(key)
  },
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

    const session = normalizeStoredSession(await nativeStorage.getItem(SESSION_KEY))
    setSessionState(this.state, session)

    setTheme(this.state, normalizeStoredTheme(await nativeStorage.getItem(THEME_KEY)))

    await this.syncUserFilterSubscriptions()
  }

  async syncUserFilterSubscriptions() {
    if (!this.isNative()) return

    const ownerUserId = asText(this.state.session?.user?.id)
    if (!ownerUserId) {
      setFilterSubscriptions(this.state, [])
      return
    }

    setFilterSubscriptions(this.state, await loadFilterSubscriptionsForUserAsync(nativeStorage, ownerUserId))
  }

  async persistSession() {
    if (!this.isNative()) return

    const token = asText(this.state.session?.token)
    const user = this.state.session?.user && typeof this.state.session.user === 'object'
      ? this.state.session.user
      : null

    if (!token || !user) {
      await nativeStorage.removeItem(SESSION_KEY)
      return
    }

    await nativeStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }))
  }

  async persistTheme() {
    if (!this.isNative()) return

    const theme = normalizeStoredTheme(this.state.ui?.theme)
    await nativeStorage.setItem(THEME_KEY, theme)
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

    await persistFilterSubscriptionsToStorageAsync(nativeStorage, ownerUserId, source)
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
