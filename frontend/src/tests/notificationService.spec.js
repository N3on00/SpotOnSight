import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NotificationService } from '../services/notificationService'

describe('NotificationService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps a notification open while hovered and removes it after release delay', () => {
    const state = { notifications: [], notificationLog: [] }
    const service = new NotificationService(state)

    const id = service.push({ title: 'Saved', message: 'Spot saved.', durationMs: 2000 })
    service.hold(id)

    vi.advanceTimersByTime(5000)
    expect(state.notifications).toHaveLength(1)

    service.release(id, 4000)
    vi.advanceTimersByTime(3999)
    expect(state.notifications).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(state.notifications).toHaveLength(0)
  })

  it('does not schedule dismissal for released notifications that were never held', () => {
    const state = { notifications: [], notificationLog: [] }
    const service = new NotificationService(state)

    const id = service.push({ title: 'Saved', message: 'Spot saved.', durationMs: 2000 })
    service.release(id, 4000)

    vi.advanceTimersByTime(1999)
    expect(state.notifications).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(state.notifications).toHaveLength(0)
  })

  it('keeps a notification open until all hover and expand holds are released', () => {
    const state = { notifications: [], notificationLog: [] }
    const service = new NotificationService(state)

    const id = service.push({ title: 'Saved', message: 'Spot saved.', durationMs: 2000 })
    service.hold(id)
    service.hold(id)

    vi.advanceTimersByTime(5000)
    expect(state.notifications).toHaveLength(1)

    service.release(id, 4000)
    vi.advanceTimersByTime(5000)
    expect(state.notifications).toHaveLength(1)

    service.release(id, 4000)
    vi.advanceTimersByTime(3999)
    expect(state.notifications).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(state.notifications).toHaveLength(0)
  })
})
