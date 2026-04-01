export class UIController {
  constructor(ctx) {
    this.ctx = ctx
  }

  registry() {
    return this.ctx.actorRegistry?.uiRegistry || null
  }

  isAuthenticated() {
    return Boolean(this.ctx.state.session.token)
  }

  getScreenLifecycle(screen) {
    return this.registry()?.getScreenLifecycle(screen) || null
  }

  getSlotComponents(screen, slot, screenCtx = {}) {
    const specs = this.registry()?.getComponents(screen, slot) || []
    return specs.map((spec) => ({
      id: spec.id,
      component: spec.component,
      props: spec.buildProps ? spec.buildProps({ ...screenCtx, app: this.ctx }) : {},
    }))
  }

  runAction(actionId, payload = {}) {
    const handler = this.registry()?.getAction(actionId)
    if (!handler) {
      throw new Error(`Unknown action_id: ${actionId}`)
    }
    return handler({ app: this.ctx, payload })
  }
}
