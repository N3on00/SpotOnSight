import { actionLastError, createModerationActions, runBooleanAction, runTask } from '../uiShared'
import { getMeetupsActions, loadMeetupInvitesSafe, loadMeetupsSafe } from './meetupsAccess'
import { clearMeetupCreationSpot, setSocialMeetupState } from '../../state/appMutations'

export function buildSocialMeetupsProps({ app }) {
  const moderation = createModerationActions(app)

  async function refreshMeetups() {
    await runTask(app, {
      loadingKey: 'socialMeetups',
      task: async () => {
        const [meetups, invites] = await Promise.all([
          loadMeetupsSafe(app, 'upcoming'),
          loadMeetupInvitesSafe(app),
        ])
        setSocialMeetupState(app.state, { meetups, meetupInvites: invites })
      },
      errorTitle: 'Meetups sync failed',
      errorMessage: 'Could not load meetups right now.',
      errorDetails: () => actionLastError(app, 'meetups'),
    })
  }

  return {
    meetups: app.state.social.meetups,
    invites: app.state.social.meetupInvites,
    people: [...(app.state.social.followers || []), ...(app.state.social.following || [])],
    preselectedSpot: app.state.map.meetupCreationSpot,
    currentUserId: app.state.session.user?.id || '',
    busy: app.state.loading.socialMeetups || app.state.loading.socialMeetupMutate,
    onLoadUserProfile: async (userId) => app.action('users').profile(userId),
    onReportMeetup: moderation.onReportMeetup,
    onReportComment: moderation.onReportMeetupComment,
    onRefresh: refreshMeetups,
    onCreateMeetup: async (payload) => {
      const meetups = getMeetupsActions(app)
      if (!meetups) return null
      let created = null
      await runTask(app, {
        loadingKey: 'socialMeetupMutate',
        task: async () => {
          created = await meetups.create(payload)
          clearMeetupCreationSpot(app.state)
          await refreshMeetups()
        },
        errorTitle: 'Meetup creation failed',
        errorMessage: 'Could not create meetup.',
        errorDetails: () => actionLastError(app, 'meetups'),
        successTitle: 'Meetup created',
        successMessage: 'Invites were sent to selected users.',
      })
      return created
    },
    onDeleteMeetup: async (meetupId) => {
      const meetups = getMeetupsActions(app)
      if (!meetups) return
      await runBooleanAction(app, {
        loadingKey: 'socialMeetupMutate',
        action: () => meetups.remove(meetupId),
        errorTitle: 'Meetup delete failed',
        errorMessage: 'Could not remove meetup.',
        errorDetails: () => actionLastError(app, 'meetups'),
        successTitle: 'Meetup removed',
        successMessage: 'The meetup has been deleted.',
        onSuccess: refreshMeetups,
      })
    },
    onRespond: async (meetupId, status, comment) => {
      const meetups = getMeetupsActions(app)
      if (!meetups) return
      await runTask(app, {
        loadingKey: 'socialMeetupMutate',
        task: async () => {
          await meetups.respond(meetupId, status, comment)
          await refreshMeetups()
        },
        errorTitle: 'Response failed',
        errorMessage: 'Could not send meetup response.',
        errorDetails: () => actionLastError(app, 'meetups'),
        successTitle: status === 'accepted' ? 'Accepted' : 'Declined',
        successMessage: 'Your RSVP was saved.',
      })
    },
    onLoadComments: async (meetupId) => {
      const meetups = getMeetupsActions(app)
      if (!meetups) return []
      return meetups.listComments(meetupId)
    },
    onCreateComment: async (meetupId, message) => {
      const meetups = getMeetupsActions(app)
      if (!meetups) return null
      return meetups.createComment(meetupId, message)
    },
  }
}
