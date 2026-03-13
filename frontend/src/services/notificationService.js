let seq = 1

export class NotificationService {
  constructor(state) {
    this.state = state
    this._timers = new Map()
  }

  _defaultDuration(level) {
    if (level === 'error') return 9000
    if (level === 'warning') return 7500
    return 5000
  }

  push({ level = 'info', title, message, details = '', sticky = false, durationMs }) {
    const id = seq++
    const entry = {
      id,
      createdAt: new Date().toISOString(),
      level: String(level || 'info'),
      title: String(title || '').trim(),
      message: String(message || '').trim(),
      details: String(details || ''),
    }

    if (!Array.isArray(this.state.notificationLog)) {
      this.state.notificationLog = []
    }
    this.state.notificationLog.push(entry)
    if (this.state.notificationLog.length > 200) {
      this.state.notificationLog = this.state.notificationLog.slice(-200)
    }

    this.state.notifications.push(entry)

    if (!sticky) {
      const timeout = Number.isFinite(durationMs) ? Number(durationMs) : this._defaultDuration(level)
      const timer = setTimeout(() => {
        this.remove(id)
      }, Math.max(1200, timeout))
      this._timers.set(id, timer)
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
    const t = this._timers.get(id)
    if (t) {
      clearTimeout(t)
      this._timers.delete(id)
    }
    this.state.notifications = this.state.notifications.filter((n) => n.id !== id)
  }

  clearLog() {
    this.state.notificationLog = []
  }
}
