import { routeToProfile } from '../../router/routeSpec'
import { setSocialSearchResults } from '../../state/appMutations'
import { actionLastError, reloadDashboardData, runBooleanAction, runTask } from '../uiShared'

export function buildSocialHubProps({ app, router }) {
  const socialError = () => actionLastError(app, 'social')
  const usersError = () => actionLastError(app, 'users')

  async function refreshAll() {
    await runTask(app, {
      loadingKey: 'socialReload',
      task: () => reloadDashboardData(app),
      errorTitle: 'Social sync failed',
      errorMessage: 'Could not refresh social data.',
    })
  }

  async function runSocialMutation({ action, loadingKey, errorTitle, successTitle, successMessage }) {
    await runBooleanAction(app, {
      action,
      loadingKey,
      errorTitle,
      errorMessage: 'Social action failed.',
      errorDetails: socialError,
      successTitle,
      successMessage,
      onSuccess: () => refreshAll(),
    })
  }

  return {
    searchResults: app.state.social.searchResults,
    searchBusy: app.state.loading.socialSearch,
    followers: app.state.social.followers,
    following: app.state.social.following,
    incomingRequests: app.state.social.incomingRequests,
    blockedUsers: app.state.social.blockedUsers,
    onSearch: async (query) => {
      await runTask(app, {
        loadingKey: 'socialSearch',
        task: async () => {
          const out = await app.action('users').searchUsers(query, 30)
          setSocialSearchResults(app.state, out)
        },
        errorTitle: 'Search failed',
        errorMessage: 'Could not search users.',
        errorDetails: usersError,
      })
    },
    onRefresh: refreshAll,
    onFollow: async (userId) => runSocialMutation({
      action: () => app.action('social').follow(userId),
      loadingKey: 'socialFollow',
      errorTitle: 'Follow failed',
      successTitle: (result) => (result === 'pending' ? 'Request sent' : 'Followed'),
      successMessage: (result) => (result === 'pending' ? 'Waiting for user approval.' : 'User followed.'),
    }),
    onUnfollow: async (userId) => runSocialMutation({
      action: () => app.action('social').unfollow(userId),
      loadingKey: 'socialUnfollow',
      errorTitle: 'Unfollow failed',
      successTitle: 'Unfollowed',
      successMessage: 'User unfollowed.',
    }),
    onApproveRequest: async (userId) => runSocialMutation({
      action: () => app.action('social').approveRequest(userId),
      loadingKey: 'socialFollow',
      errorTitle: 'Approve failed',
      successTitle: 'Approved',
      successMessage: 'Follow request approved.',
    }),
    onRejectRequest: async (userId) => runSocialMutation({
      action: () => app.action('social').rejectRequest(userId),
      loadingKey: 'socialUnfollow',
      errorTitle: 'Reject failed',
      successTitle: 'Rejected',
      successMessage: 'Follow request rejected.',
    }),
    onRemoveFollower: async (userId) => runSocialMutation({
      action: () => app.action('social').removeFollower(userId),
      loadingKey: 'socialUnfollow',
      errorTitle: 'Remove follower failed',
      successTitle: 'Follower removed',
      successMessage: 'Follower removed from your account.',
    }),
    onBlock: async (userId) => runSocialMutation({
      action: () => app.action('social').block(userId),
      loadingKey: 'socialUnfollow',
      errorTitle: 'Block failed',
      successTitle: 'Blocked',
      successMessage: 'User blocked.',
    }),
    onUnblock: async (userId) => runSocialMutation({
      action: () => app.action('social').unblock(userId),
      loadingKey: 'socialFollow',
      errorTitle: 'Unblock failed',
      successTitle: 'Unblocked',
      successMessage: 'User unblocked.',
    }),
    onOpenProfile: (userId) => {
      router.push(routeToProfile(userId))
    },
  }
}
