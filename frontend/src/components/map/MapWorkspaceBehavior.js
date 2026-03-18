import { ComponentBehavior } from '../../core/componentBehavior'
import { UI_ACTIONS } from '../../core/uiElements'
import { routeToProfile } from '../../router/routeSpec'
import { asText } from '../../utils/sanitizers'

function controllerError(app, controllerId) {
  try {
    const ctrl = app.controller(controllerId)
    if (!ctrl || typeof ctrl.lastError !== 'function') return ''
    return asText(ctrl.lastError())
  } catch {
    return ''
  }
}

export class MapWorkspaceBehavior extends ComponentBehavior {
  static parseFocusRequest(route) {
    const query = route && typeof route === 'object' ? route.query : null
    const lat = Number(query?.lat)
    const lon = Number(query?.lon)
    const spotId = asText(query?.spotId)
    return {
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
      spotId,
    }
  }

  async reload() {
    try {
      await this.runUiAction(UI_ACTIONS.MAP_RELOAD)
      return true
    } catch (error) {
      this.handleError({
        title: 'Map refresh failed',
        message: 'Could not reload map data from backend.',
        error,
      })
      return false
    }
  }

  async saveSpot(spot) {
    try {
      const ok = await this.app.controller('spots').saveSpot(spot)
      if (!ok) {
        this.handleError({
          title: 'Save failed',
          message: 'Spot could not be persisted.',
          details: controllerError(this.app, 'spots'),
        })
        return false
      }

      await this.reload()
      this.notify({
        level: 'success',
        title: 'Saved',
        message: 'Spot saved successfully.',
      })
      return true
    } catch (error) {
      this.handleError({
        title: 'Save failed',
        message: 'Spot could not be persisted.',
        error,
      })
      return false
    }
  }

  async deleteSpot(spotId) {
    try {
      const ok = await this.app.controller('spots').deleteSpot(spotId)
      if (!ok) {
        this.handleError({
          title: 'Delete failed',
          message: 'Spot could not be deleted.',
          details: controllerError(this.app, 'spots'),
        })
        return false
      }

      await this.reload()
      this.notify({
        level: 'info',
        title: 'Deleted',
        message: 'Spot removed.',
      })
      return true
    } catch (error) {
      this.handleError({
        title: 'Delete failed',
        message: 'Spot could not be deleted.',
        error,
      })
      return false
    }
  }

  async toggleFavorite(spotId, isFavorite) {
    try {
      const ok = await this.app.controller('social').toggleFavorite(spotId, isFavorite)
      if (!ok) {
        this.handleError({
          title: 'Favorite failed',
          message: 'Could not update favorite state.',
          details: controllerError(this.app, 'social'),
        })
        return false
      }

      this.notify({
        level: 'success',
        title: isFavorite ? 'Removed favorite' : 'Added favorite',
        message: 'Favorite status updated.',
      })
      return true
    } catch (error) {
      this.handleError({
        title: 'Favorite failed',
        message: 'Could not update favorite state.',
        error,
      })
      return false
    }
  }

  async shareSpot(spotId, message) {
    try {
      const ok = await this.app.controller('social').share(spotId, message)
      if (!ok) {
        this.handleError({
          title: 'Share failed',
          message: 'Could not share spot.',
          details: controllerError(this.app, 'social'),
        })
        return false
      }

      this.notify({
        level: 'success',
        title: 'Shared',
        message: 'Spot was shared.',
      })
      return true
    } catch (error) {
      this.handleError({
        title: 'Share failed',
        message: 'Could not share spot.',
        error,
      })
      return false
    }
  }

  async reportSpot(spotId) {
    try {
      const result = await this.app.controller('social').reportContent(
        'spot',
        spotId,
        'other',
        'Submitted from the map spot details view for admin moderation review.',
      )
      if (!result) {
        this.handleError({
          title: 'Report failed',
          message: 'Could not submit this spot report.',
          details: controllerError(this.app, 'social'),
        })
        return false
      }
      this.notify({
        level: 'warning',
        title: 'Spot reported',
        message: 'Admins have been notified and will review this content.',
      })
      return true
    } catch (error) {
      this.handleError({
        title: 'Report failed',
        message: 'Could not submit this spot report.',
        error,
      })
      return false
    }
  }

  async searchUsers(query, limit = 20) {
    return this.app.controller('users').searchUsers(query, limit)
  }

  async loadFriendUsers() {
    return this.app.controller('users').friendDirectory()
  }

  async loadUserProfile(userId) {
    try {
      return await this.app.controller('users').profile(userId)
    } catch {
      return null
    }
  }

  async searchLocations(query, limit = 6) {
    return this.app.service('locationSearch').searchPlaces(query, limit)
  }

  async listComments(spotId) {
    try {
      return await this.app.controller('comments').listBySpot(spotId)
    } catch {
      return []
    }
  }

  async createComment(spotId, message) {
    try {
      const created = await this.app.controller('comments').create(spotId, message)
      if (!created) {
        this.handleError({
          title: 'Comment failed',
          message: 'Could not post your comment.',
          details: controllerError(this.app, 'comments'),
        })
      }
      return created
    } catch (error) {
      this.handleError({
        title: 'Comment failed',
        message: 'Could not post your comment.',
        error,
      })
      return null
    }
  }

  async updateComment(commentId, message) {
    try {
      const updated = await this.app.controller('comments').update(commentId, message)
      if (!updated) {
        this.handleError({
          title: 'Comment update failed',
          message: 'Could not update this comment.',
          details: controllerError(this.app, 'comments'),
        })
      }
      return updated
    } catch (error) {
      this.handleError({
        title: 'Comment update failed',
        message: 'Could not update this comment.',
        error,
      })
      return null
    }
  }

  async deleteComment(commentId) {
    try {
      const ok = await this.app.controller('comments').delete(commentId)
      if (!ok) {
        this.handleError({
          title: 'Comment delete failed',
          message: 'Could not delete this comment.',
          details: controllerError(this.app, 'comments'),
        })
      }
      return Boolean(ok)
    } catch (error) {
      this.handleError({
        title: 'Comment delete failed',
        message: 'Could not delete this comment.',
        error,
      })
      return false
    }
  }

  openProfile(userId) {
    const nextId = asText(userId)
    if (!nextId) return
    void this.navigate(routeToProfile(nextId))
  }
}
