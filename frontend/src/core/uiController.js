import { getAction, getComponents } from './registry'

export class UIController {
  constructor(ctx) {
    this.ctx = ctx
  }

  isAuthenticated() {
    return Boolean(this.ctx.state.session.token)
  }

  getSlotComponents(screen, slot, screenCtx = {}) {
    return getComponents(screen, slot).map((spec) => ({
      id: spec.id,
      component: spec.component,
      props: spec.buildProps ? spec.buildProps({ ...screenCtx, app: this.ctx }) : {},
    }))
  }

  runAction(actionId, payload = {}) {
    const handler = getAction(actionId)
    if (!handler) {
      throw new Error(`Unknown action_id: ${actionId}`)
    }
    return handler({ app: this.ctx, payload })
  }
}
