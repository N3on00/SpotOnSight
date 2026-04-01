import { ComponentBehavior } from '../../core/componentBehavior'
import { UI_ACTIONS } from '../../core/uiElements'
import { routeToProfile, routeToSocial } from '../../router/routeSpec'
import { setMeetupCreationSpot } from '../../state/appMutations'
import { asText } from '../../utils/sanitizers'

function actionError(app, actionId) {
  try {
    const action = app.action(actionId)
    if (!action || typeof action.lastError !== 'function') return ''
    return asText(action.lastError())
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
      const ok = await this.app.action('spots').saveSpot(spot)
      if (!ok) {
        this.handleError({
          title: 'Save failed',
          message: 'Spot could not be persisted.',
          details: actionError(this.app, 'spots'),
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
      const ok = await this.app.action('spots').deleteSpot(spotId)
      if (!ok) {
        this.handleError({
          title: 'Delete failed',
          message: 'Spot could not be deleted.',
          details: actionError(this.app, 'spots'),
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
      const ok = await this.app.action('social').toggleFavorite(spotId, isFavorite)
      if (!ok) {
        this.handleError({
          title: 'Favorite failed',
          message: 'Could not update favorite state.',
          details: actionError(this.app, 'social'),
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
      const ok = await this.app.action('social').share(spotId, message)
      if (!ok) {
        this.handleError({
          title: 'Share failed',
          message: 'Could not share spot.',
          details: actionError(this.app, 'social'),
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

  async reportContent(targetType, targetId, reason = 'other', details = '') {
    try {
      const result = await this.app.action('social').reportContent(
        targetType,
        targetId,
        reason,
        details,
      )
      if (!result) {
        this.handleError({
          title: 'Report failed',
          message: 'Could not submit this report.',
          details: actionError(this.app, 'social'),
        })
        return false
      }
      this.notify({
        level: 'warning',
        title: 'Report submitted',
        message: 'Admins have been notified and will review this content.',
      })
      return true
    } catch (error) {
      this.handleError({
        title: 'Report failed',
        message: 'Could not submit this report.',
        error,
      })
      return false
    }
  }

  async reportSpot(spotId, reason = 'other', details = '') {
    return this.reportContent('spot', spotId, reason, details)
  }

  async searchUsers(query, limit = 20) {
    return this.app.action('users').searchUsers(query, limit)
  }

  async loadFriendUsers() {
    return this.app.action('users').friendDirectory()
  }

  async loadUserProfile(userId) {
    try {
      return await this.app.action('users').profile(userId)
    } catch {
      return null
    }
  }

  async searchLocations(query, limit = 6) {
    return this.app.service('locationSearch').searchPlaces(query, limit)
  }

  async listComments(spotId) {
    try {
      return await this.app.action('comments').listBySpot(spotId)
    } catch {
      return []
    }
  }

  async createComment(spotId, message) {
    try {
      const created = await this.app.action('comments').create(spotId, message)
      if (!created) {
        this.handleError({
          title: 'Comment failed',
          message: 'Could not post your comment.',
          details: actionError(this.app, 'comments'),
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
      const updated = await this.app.action('comments').update(commentId, message)
      if (!updated) {
        this.handleError({
          title: 'Comment update failed',
          message: 'Could not update this comment.',
          details: actionError(this.app, 'comments'),
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
      const ok = await this.app.action('comments').delete(commentId)
      if (!ok) {
        this.handleError({
          title: 'Comment delete failed',
          message: 'Could not delete this comment.',
          details: actionError(this.app, 'comments'),
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

  createMeetupAtSpot(spot) {
    setMeetupCreationSpot(this.app.state, spot)
    void this.navigate(routeToSocial())
  }
}
