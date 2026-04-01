import { clearNotificationLog, pushNotification, removeNotification } from '../state/appMutations'

let seq = 1

export const NOTIFICATION_CATEGORIES = Object.freeze({
  SYSTEM: 'system',
  SOCIAL: 'social',
  MAP: 'map',
  ACCOUNT: 'account',
})

function normalizeCategory(category) {
  const value = String(category || '').trim().toLowerCase()
  return Object.values(NOTIFICATION_CATEGORIES).includes(value)
    ? value
    : NOTIFICATION_CATEGORIES.SYSTEM
}

export class NotificationService {
  constructor(state) {
    this.state = state
    this._timers = new Map()
    this._holdCounts = new Map()
  }

  _defaultDuration(level) {
    if (level === 'error') return 5000
    if (level === 'warning') return 7500
    return 5000
  }

  push({ level = 'info', title, message, details = '', sticky = false, durationMs, category, meta = null }) {
    const id = seq++
    const entry = {
      id,
      createdAt: new Date().toISOString(),
      category: normalizeCategory(category),
      level: String(level || 'info'),
      title: String(title || '').trim(),
      message: String(message || '').trim(),
      details: String(details || ''),
      meta: meta && typeof meta === 'object' ? meta : null,
    }

    pushNotification(this.state, entry)

    if (!sticky) {
      const timeout = Number.isFinite(durationMs) ? Number(durationMs) : this._defaultDuration(level)
      this._scheduleRemoval(id, timeout)
    }

    if (this.state.notifications.length > 6) {
      const oldest = this.state.notifications[0]
      if (oldest) {
        this.remove(oldest.id)
      }
    }

    return id
  }

  remove(id) {
    this._clearTimer(id)
    this._holdCounts.delete(id)
    removeNotification(this.state, id)
  }

  hold(id) {
    if (!this._hasNotification(id)) return
    const nextCount = (this._holdCounts.get(id) || 0) + 1
    this._holdCounts.set(id, nextCount)
    this._clearTimer(id)
  }

  release(id, delayMs = 4000) {
    if (!this._hasNotification(id)) return
    const currentCount = this._holdCounts.get(id) || 0
    if (currentCount <= 0) return
    if (currentCount === 1) {
      this._holdCounts.delete(id)
    } else {
      this._holdCounts.set(id, currentCount - 1)
      return
    }
    this._scheduleRemoval(id, delayMs)
  }

  reschedule(id, delayMs = 4000) {
    if (!this._hasNotification(id)) return
    if ((this._holdCounts.get(id) || 0) > 0) return
    this._scheduleRemoval(id, delayMs)
  }

  clearLog() {
    clearNotificationLog(this.state)
  }

  _hasNotification(id) {
    return this.state.notifications.some((entry) => entry.id === id)
  }

  _clearTimer(id) {
    const t = this._timers.get(id)
    if (t) {
      clearTimeout(t)
      this._timers.delete(id)
    }
  }

  _scheduleRemoval(id, delayMs) {
    this._clearTimer(id)
    const timer = setTimeout(() => {
      this.remove(id)
    }, Math.max(1200, Number(delayMs) || 4000))
    this._timers.set(id, timer)
  }
}
