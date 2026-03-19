import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { NotificationService, NOTIFICATION_CATEGORIES } from '../services/notificationService'

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

  it('auto-dismisses error notifications after the standard few-second timeout', () => {
    const state = { notifications: [], notificationLog: [] }
    const service = new NotificationService(state)

    service.push({ level: 'error', title: 'Failed', message: 'Save failed.' })

    vi.advanceTimersByTime(4999)
    expect(state.notifications).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(state.notifications).toHaveLength(0)
  })

  it('defaults notifications to the system category and preserves explicit categories', () => {
    const state = { notifications: [], notificationLog: [] }
    const service = new NotificationService(state)

    service.push({ title: 'Defaulted' })
    service.push({ title: 'Social', category: NOTIFICATION_CATEGORIES.SOCIAL })

    expect(state.notifications[0].category).toBe(NOTIFICATION_CATEGORIES.SYSTEM)
    expect(state.notifications[1].category).toBe(NOTIFICATION_CATEGORIES.SOCIAL)
    expect(state.notificationLog[0].category).toBe(NOTIFICATION_CATEGORIES.SYSTEM)
    expect(state.notificationLog[1].category).toBe(NOTIFICATION_CATEGORIES.SOCIAL)
  })

  it('can reschedule dismissal for expanded notifications without making them sticky', () => {
    const state = { notifications: [], notificationLog: [] }
    const service = new NotificationService(state)

    const id = service.push({ title: 'Failed', message: 'Spot save failed.', durationMs: 2000 })
    service.reschedule(id, 9000)

    vi.advanceTimersByTime(8999)
    expect(state.notifications).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(state.notifications).toHaveLength(0)
  })
})
