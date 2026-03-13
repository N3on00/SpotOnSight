import { BaseController } from './baseController'

export class SpotsController extends BaseController {
  constructor(ctx) {
    super(ctx, 'spotsService')
  }

  async reload() {
    return this.service().list()
  }

  async saveSpot(spot) {
    const service = this.service()
    if (spot.id) {
      return service.update(spot.id, spot)
    }
    const id = await service.create(spot)
    return Boolean(id)
  }

  async deleteSpot(id) {
    return this.service().delete(id)
  }

  async byUser(userId) {
    return this.service().byUser(userId)
  }

  async favoritesOfUser(userId) {
    return this.service().favoritesOfUser(userId)
  }
}
