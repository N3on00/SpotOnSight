export class AppContext {
  constructor({ state, serviceFactories, actionFactories = {}, actorRegistry = null }) {
    this.state = state
    this._serviceFactories = serviceFactories
    this._actionFactories = actionFactories
    this.actorRegistry = actorRegistry
    this._services = new Map()
    this._actions = new Map()
    this.ui = null
  }

  service(id) {
    if (this._services.has(id)) {
      return this._services.get(id)
    }
    const factory = this._serviceFactories[id]
    if (!factory) {
      throw new Error(`Unknown service_id: ${id}`)
    }
    const service = factory(this)
    this._services.set(id, service)
    return service
  }

  action(id) {
    if (this._actions.has(id)) {
      return this._actions.get(id)
    }
    const factory = this._actionFactories[id]
    if (!factory) {
      throw new Error(`Unknown action_id: ${id}`)
    }
    const action = factory(this)
    this._actions.set(id, action)
    return action
  }
}
