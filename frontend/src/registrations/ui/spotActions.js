import { notify } from './notify'

function reportDefaults(targetType) {
  const normalized = String(targetType || '').trim().toLowerCase()
  if (normalized === 'user') {
    return {
      failureTitle: 'Report failed',
      failureMessage: 'Could not submit this account report.',
      successTitle: 'Account reported',
      successMessage: 'Admins have been notified and will review this account.',
    }
  }

  const label = normalized === 'meetup_comment'
    ? 'comment'
    : normalized || 'content'

  return {
    failureTitle: 'Report failed',
    failureMessage: `Could not submit this ${label} report.`,
    successTitle: `${label.charAt(0).toUpperCase()}${label.slice(1)} reported`,
    successMessage: 'Admins have been notified and will review this content.',
  }
}

async function submitModerationReport(app, {
  targetType,
  targetId,
  reason = 'other',
  details = '',
  failureTitle,
  failureMessage,
  successTitle,
  successMessage,
}) {
  const normalizedTargetType = String(targetType || '').trim()
  const normalizedTargetId = String(targetId || '').trim()
  if (!normalizedTargetType || !normalizedTargetId) return false

  const defaults = reportDefaults(normalizedTargetType)
  const result = await app.controller('social').reportContent(
    normalizedTargetType,
    normalizedTargetId,
    String(reason || 'other').trim() || 'other',
    String(details || '').trim(),
  )
  if (!result) {
    notify(app, {
      level: 'error',
      title: failureTitle || defaults.failureTitle,
      message: failureMessage || defaults.failureMessage,
      details: app.controller('social').lastError(),
    })
    return false
  }

  notify(app, {
    level: 'warning',
    title: successTitle || defaults.successTitle,
    message: successMessage || defaults.successMessage,
  })
  return true
}

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

export function createModerationActions(app) {
  return {
    onReportContent: async (payload) => submitModerationReport(app, payload),
    onReportSpot: async (spot, reason = 'other', details = '') => {
      const spotId = String(spot?.id || '').trim()
      return submitModerationReport(app, {
        targetType: 'spot',
        targetId: spotId,
        reason,
        details,
      })
    },
    onReportUser: async (user, reason = 'other', details = '') => {
      const userId = String(user?.id || '').trim()
      return submitModerationReport(app, {
        targetType: 'user',
        targetId: userId,
        reason,
        details,
      })
    },
    onReportComment: async (comment, reason = 'other', details = '') => submitModerationReport(app, {
      targetType: 'comment',
      targetId: String(comment?.id || '').trim(),
      reason,
      details,
    }),
    onReportMeetup: async (meetup, reason = 'other', details = '') => submitModerationReport(app, {
      targetType: 'meetup',
      targetId: String(meetup?.id || '').trim(),
      reason,
      details,
    }),
    onReportMeetupComment: async (comment, reason = 'other', details = '') => submitModerationReport(app, {
      targetType: 'meetup_comment',
      targetId: String(comment?.id || '').trim(),
      reason,
      details,
    }),
  }
}
