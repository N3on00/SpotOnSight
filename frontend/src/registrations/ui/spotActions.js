import { notify } from './notify'

export function createSpotCommentActions(app) {
  return {
    onListComments: (spotId) => app.controller('comments').listBySpot(spotId),
    onCreateComment: async (spotId, message) => {
      const created = await app.controller('comments').create(spotId, message)
      if (!created) {
        notify(app, {
          level: 'error',
          title: 'Comment failed',
          message: 'Could not post your comment.',
          details: app.controller('comments').lastError(),
        })
      }
      return created
    },
    onUpdateComment: async (commentId, message) => {
      const updated = await app.controller('comments').update(commentId, message)
      if (!updated) {
        notify(app, {
          level: 'error',
          title: 'Comment update failed',
          message: 'Could not update this comment.',
          details: app.controller('comments').lastError(),
        })
      }
      return updated
    },
    onDeleteComment: async (commentId) => {
      const ok = await app.controller('comments').delete(commentId)
      if (!ok) {
        notify(app, {
          level: 'error',
          title: 'Comment delete failed',
          message: 'Could not delete this comment.',
          details: app.controller('comments').lastError(),
        })
      }
      return ok
    },
  }
}

export function createSpotFavoriteAction(app) {
  return async (spotId, currentlyFavorite) => {
    const ok = await app.controller('social').toggleFavorite(spotId, currentlyFavorite)
    if (!ok) {
      notify(app, {
        level: 'error',
        title: 'Like failed',
        message: 'Could not update like state.',
        details: app.controller('social').lastError(),
      })
      return false
    }

    notify(app, {
      level: 'success',
      title: currentlyFavorite ? 'Like removed' : 'Liked',
      message: currentlyFavorite ? 'Spot removed from your likes.' : 'Spot added to your likes.',
    })
    return true
  }
}
