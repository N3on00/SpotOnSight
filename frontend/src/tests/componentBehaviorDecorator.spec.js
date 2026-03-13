import { describe, expect, it, vi } from 'vitest'

import { registerComponentDecorators } from '../bootstrap/componentDecoratorRegistrations'
import { ComponentBehavior } from '../core/componentBehavior'
import { getComponents } from '../core/registry'
import { createScreenModule } from '../core/screenRegistry'
import { UI_SLOTS } from '../core/uiElements'

class TestWidgetBehavior extends ComponentBehavior {
  updateContext(context = {}) {
    super.updateContext(context)
    if (!Array.isArray(this.seenScreens)) {
      this.seenScreens = []
    }
    this.seenScreens.push(String(context?.screen || ''))
    return this
  }
}

const DummyWidget = {
  name: 'DummyWidget',
}

function createContext() {
  const notifyPush = vi.fn()
  const app = {
    ui: {
      runAction: vi.fn(async () => true),
      isAuthenticated: () => true,
    },
    service: (id) => {
      if (id !== 'notify') {
        throw new Error(`Unknown service: ${id}`)
      }
      return { push: notifyPush }
    },
  }

  return {
    app,
    router: {
      push: vi.fn(async () => true),
      replace: vi.fn(async () => true),
    },
    route: {
      fullPath: '/spec',
      meta: {},
      params: {},
      query: {},
    },
  }
}

describe('Component behavior decorator', () => {
  it('injects behavior instance into widget props', () => {
    registerComponentDecorators()

    const screen = `spec.behavior.${Date.now()}`
    const widgetId = `${screen}.widget`
    const module = createScreenModule(screen)

    module.main({
      id: widgetId,
      order: 10,
      component: DummyWidget,
      behaviorClass: TestWidgetBehavior,
      buildProps: ({ screen: currentScreen }) => ({
        title: currentScreen,
      }),
    })

    const specs = getComponents(screen, UI_SLOTS.MAIN)
    expect(specs).toHaveLength(1)

    const ctx = createContext()
    const firstProps = specs[0].buildProps(ctx)
    const secondProps = specs[0].buildProps(ctx)

    expect(firstProps.title).toBe(screen)
    expect(firstProps.behavior).toBeInstanceOf(TestWidgetBehavior)
    expect(secondProps.behavior).toBe(firstProps.behavior)
    expect(firstProps.behavior.seenScreens.includes(screen)).toBe(true)
  })
})
