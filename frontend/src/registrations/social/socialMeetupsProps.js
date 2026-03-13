import { controllerLastError, runBooleanAction, runTask } from '../uiShared'
import { loadMeetupInvitesSafe, loadMeetupsSafe, meetupsController } from './meetupsControllerAccess'

export function buildSocialMeetupsProps({ app }) {
  async function refreshMeetups() {
    await runTask(app, {
      loadingKey: 'socialMeetups',
      task: async () => {
        const [meetups, invites] = await Promise.all([
          loadMeetupsSafe(app, 'upcoming'),
          loadMeetupInvitesSafe(app),
        ])
        app.state.social.meetups = Array.isArray(meetups) ? meetups : []
        app.state.social.meetupInvites = Array.isArray(invites) ? invites : []
      },
      errorTitle: 'Meetups sync failed',
      errorMessage: 'Could not load meetups right now.',
      errorDetails: () => controllerLastError(app, 'meetups'),
    })
  }

  return {
    meetups: app.state.social.meetups,
    invites: app.state.social.meetupInvites,
    people: [...(app.state.social.followers || []), ...(app.state.social.following || [])],
    currentUserId: app.state.session.user?.id || '',
    busy: app.state.loading.socialMeetups || app.state.loading.socialMeetupMutate,
    onRefresh: refreshMeetups,
    onCreateMeetup: async (payload) => {
      const ctrl = meetupsController(app)
      if (!ctrl) return null
      let created = null
      await runTask(app, {
        loadingKey: 'socialMeetupMutate',
        task: async () => {
          created = await ctrl.create(payload)
          await refreshMeetups()
        },
        errorTitle: 'Meetup creation failed',
        errorMessage: 'Could not create meetup.',
        errorDetails: () => controllerLastError(app, 'meetups'),
        successTitle: 'Meetup created',
        successMessage: 'Invites were sent to selected users.',
      })
      return created
    },
    onDeleteMeetup: async (meetupId) => {
      const ctrl = meetupsController(app)
      if (!ctrl) return
      await runBooleanAction(app, {
        loadingKey: 'socialMeetupMutate',
        action: () => ctrl.remove(meetupId),
        errorTitle: 'Meetup delete failed',
        errorMessage: 'Could not remove meetup.',
        errorDetails: () => controllerLastError(app, 'meetups'),
        successTitle: 'Meetup removed',
        successMessage: 'The meetup has been deleted.',
        onSuccess: refreshMeetups,
      })
    },
    onRespond: async (meetupId, status, comment) => {
      const ctrl = meetupsController(app)
      if (!ctrl) return
      await runTask(app, {
        loadingKey: 'socialMeetupMutate',
        task: async () => {
          await ctrl.respond(meetupId, status, comment)
          await refreshMeetups()
        },
        errorTitle: 'Response failed',
        errorMessage: 'Could not send meetup response.',
        errorDetails: () => controllerLastError(app, 'meetups'),
        successTitle: status === 'accepted' ? 'Accepted' : 'Declined',
        successMessage: 'Your RSVP was saved.',
      })
    },
    onLoadComments: async (meetupId) => {
      const ctrl = meetupsController(app)
      if (!ctrl) return []
      return ctrl.listComments(meetupId)
    },
    onCreateComment: async (meetupId, message) => {
      const ctrl = meetupsController(app)
      if (!ctrl) return null
      return ctrl.createComment(meetupId, message)
    },
  }
}
