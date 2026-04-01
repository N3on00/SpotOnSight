import { NOTIFICATION_CATEGORIES } from '../notificationService'
import { setActivitySocial } from '../../state/appMutations'

function userIdOf(entry) {
  return String(entry?.id || entry?.follower?.id || '').trim()
}

function requestIdOf(entry) {
  const followerId = String(entry?.follower?.id || '').trim()
  const created = String(entry?.created_at || '').trim()
  return `${followerId}|${created}`
}

export async function syncSocialActivity(service, app, { notify = true, meId, notifyService }) {
  const social = app.action('social')
  const [followers, incomingRequests] = await Promise.all([
    social.followersOf(meId),
    social.incomingRequests(),
  ])

  const followerList = Array.isArray(followers) ? followers : []
  const requestList = Array.isArray(incomingRequests) ? incomingRequests : []

  const nextFollowerIds = new Set(followerList.map((entry) => userIdOf(entry)).filter(Boolean))
  const nextRequestIds = new Set(requestList.map((entry) => requestIdOf(entry)).filter(Boolean))

  if (notify && service._seeded) {
    for (const follower of followerList) {
      const fid = userIdOf(follower)
      if (!fid || service._followerIds.has(fid)) continue
      const who = String(follower.display_name || follower.username || 'A user')
      notifyService.push({
        category: NOTIFICATION_CATEGORIES.SOCIAL,
        level: 'info',
        title: 'New follower',
        message: `${who} started following you.`,
      })
    }

    for (const request of requestList) {
      const rid = requestIdOf(request)
      if (!rid || service._requestIds.has(rid)) continue
      const who = String(request?.follower?.display_name || request?.follower?.username || 'A user')
      notifyService.push({
        category: NOTIFICATION_CATEGORIES.SOCIAL,
        level: 'info',
        title: 'Follow request',
        message: `${who} requested to follow you.`,
      })
    }
  }

  service._followerIds = nextFollowerIds
  service._requestIds = nextRequestIds

  const moderationNotifications = await social.moderationNotifications()
  const moderationList = Array.isArray(moderationNotifications) ? moderationNotifications : []
  setActivitySocial(app.state, {
    followers: followerList,
    incomingRequests: requestList,
    moderationNotifications: moderationList,
  })

  const nextModerationIds = new Set(
    moderationList.map((entry) => String(entry?.id || '').trim()).filter(Boolean),
  )

  if (notify && service._seeded) {
    for (const entry of moderationList) {
      const nid = String(entry?.id || '').trim()
      if (!nid || service._moderationNotificationIds.has(nid)) continue
      notifyService.push({
        level: 'warning',
        title: String(entry?.title || 'Moderation notice'),
        message: String(entry?.message || 'Your content was reviewed by an admin.'),
        details: String(entry?.details || ''),
        sticky: true,
      })
    }
  }

  service._moderationNotificationIds = nextModerationIds
}
