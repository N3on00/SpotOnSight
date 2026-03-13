export class AppContext {
  constructor({ state, serviceFactories, controllerFactories }) {
    this.state = state
    this._serviceFactories = serviceFactories
    this._controllerFactories = controllerFactories
    this._services = new Map()
    this._controllers = new Map()
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

  controller(id) {
    if (this._controllers.has(id)) {
      return this._controllers.get(id)
    }
    const factory = this._controllerFactories[id]
    if (!factory) {
      throw new Error(`Unknown controller_id: ${id}`)
    }
    const controller = factory(this)
    this._controllers.set(id, controller)
    return controller
  }
}
