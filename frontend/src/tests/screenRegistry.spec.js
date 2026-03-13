import { describe, expect, it } from 'vitest'

import { registerComponentDecorators } from '../bootstrap/componentDecoratorRegistrations'
import { ScreenErrorHandler, registerScreenErrorHandler } from '../core/errorHandlerRegistry'
import { getAction, getComponents } from '../core/registry'
import { createScreenModule, getScreenLifecycle } from '../core/screenRegistry'
import { UI_SLOTS } from '../core/uiElements'

const DummyWidget = {
  name: 'DummyWidget',
}

class TestScreenRegistryHandler extends ScreenErrorHandler {}

describe('Screen registry generic module API', () => {
  it('registers actions, widgets, and lifecycle per screen', () => {
    registerComponentDecorators()

    const screen = `spec.screen.${Date.now()}`
    const actionId = `${screen}.action`
    const headerId = `${screen}.header`
    const mainId = `${screen}.main`
    const handlerId = `${screen}.handler`

    registerScreenErrorHandler({
      id: handlerId,
      handlerClass: TestScreenRegistryHandler,
    })

    const module = createScreenModule(screen)
    const actionHandler = () => true

    module
      .action(actionId, actionHandler)
      .header({
        id: headerId,
        order: 10,
        component: DummyWidget,
        buildProps: () => ({ title: 'Header' }),
      })
      .main({
        id: mainId,
        order: 20,
        component: DummyWidget,
        buildProps: () => ({ title: 'Main' }),
      })
      .lifecycle({
        onEnter: async () => true,
        onRouteChange: async () => true,
        errorHandlerId: handlerId,
        errorTitle: 'Load failed',
        errorMessage: 'Could not initialize screen.',
      })

    const action = getAction(actionId)
    const headerWidgets = getComponents(screen, UI_SLOTS.HEADER)
    const mainWidgets = getComponents(screen, UI_SLOTS.MAIN)
    const lifecycle = getScreenLifecycle(screen)

    expect(action).toBe(actionHandler)
    expect(headerWidgets).toHaveLength(1)
    expect(mainWidgets).toHaveLength(1)
    expect(headerWidgets[0].id).toBe(headerId)
    expect(mainWidgets[0].id).toBe(mainId)
    expect(typeof lifecycle?.onEnter).toBe('function')
    expect(typeof lifecycle?.onRouteChange).toBe('function')
    expect(lifecycle?.errorHandlerId).toBe(handlerId)
    expect(lifecycle?.errorTitle).toBe('Load failed')
  })
})
