import {
  ComponentActionDecorator,
  ComponentBehaviorDecorator,
  ComponentDecorator,
  ComponentErrorDecorator,
  ComponentNavigationDecorator,
  registerComponentDecorator,
} from '../core/componentDecoratorRegistry'

let registered = false

export function registerComponentDecorators() {
  if (registered) return
  registered = true

  registerComponentDecorator({
    id: 'component.base',
    decoratorClass: ComponentDecorator,
  })

  registerComponentDecorator({
    id: 'component.error',
    decoratorClass: ComponentErrorDecorator,
  })

  registerComponentDecorator({
    id: 'component.navigation',
    decoratorClass: ComponentNavigationDecorator,
  })

  registerComponentDecorator({
    id: 'component.action',
    decoratorClass: ComponentActionDecorator,
  })

  registerComponentDecorator({
    id: 'component.behavior',
    decoratorClass: ComponentBehaviorDecorator,
  })
}
