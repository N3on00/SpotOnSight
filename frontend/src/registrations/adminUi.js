import { createScreenModule } from '../core/screenRegistry'
import { UI_ACTIONS, UI_COMPONENT_IDS, UI_SCREENS } from '../core/uiElements'
import AdminHero from '../components/admin/AdminHero.vue'
import AdminModerationPanel from '../components/admin/AdminModerationPanel.vue'
import { controllerLastError, runTask } from './uiShared'
import { routeToHome } from '../router/routeSpec'

const adminScreen = createScreenModule(UI_SCREENS.ADMIN)

async function refreshAdminData(app) {
  await Promise.all([
    app.controller('spots').reload(),
    app.controller('admin').loadReports('open', 100),
    app.controller('admin').loadUsers('', 100),
  ])
}

adminScreen.action(UI_ACTIONS.ADMIN_REFRESH, async ({ app }) => {
  await refreshAdminData(app)
})

adminScreen.header({
  id: UI_COMPONENT_IDS.ADMIN_HERO,
  order: 10,
  component: AdminHero,
  buildProps: ({ app }) => {
    const reports = Array.isArray(app.state.admin?.reports) ? app.state.admin.reports : []
    const users = Array.isArray(app.state.admin?.users) ? app.state.admin.users : []
    const spots = Array.isArray(app.state.spots) ? app.state.spots : []
    return {
      reportsCount: reports.filter((item) => String(item?.status || 'open') === 'open').length,
      flaggedUsersCount: users.filter((item) => String(item?.account_status || '') !== 'active' || Number(item?.active_strike_weight || 0) > 0).length,
      hiddenSpotsCount: spots.filter((item) => String(item?.moderation_status || 'visible') === 'hidden').length,
    }
  },
})

adminScreen.main({
  id: UI_COMPONENT_IDS.ADMIN_PANEL,
  order: 10,
  component: AdminModerationPanel,
  buildProps: ({ app }) => ({
    reports: app.state.admin.reports,
    users: app.state.admin.users,
    busy: app.state.loading.adminLoad || app.state.loading.adminAction,
    onRefresh: async () => {
      await runTask(app, {
        task: () => refreshAdminData(app),
        loadingKey: 'adminLoad',
        errorTitle: 'Admin data failed',
        errorMessage: 'Could not refresh moderation data.',
        errorDetails: () => controllerLastError(app, 'admin'),
      })
    },
    onReviewReport: async (reportId, payload) => {
      await runTask(app, {
        task: async () => {
          const result = await app.controller('admin').reviewReport(reportId, payload)
          if (result) {
            await refreshAdminData(app)
          }
          return result
        },
        loadingKey: 'adminAction',
        errorTitle: 'Review failed',
        errorMessage: 'Could not update moderation report.',
        errorDetails: () => controllerLastError(app, 'admin'),
        successTitle: 'Report reviewed',
        successMessage: 'Moderation action saved.',
      })
    },
    onUpdateUser: async (userId, payload) => {
      await runTask(app, {
        task: async () => {
          const result = await app.controller('admin').updateUserStatus(userId, payload)
          if (result) {
            await refreshAdminData(app)
          }
          return result
        },
        loadingKey: 'adminAction',
        errorTitle: 'User update failed',
        errorMessage: 'Could not update user moderation state.',
        errorDetails: () => controllerLastError(app, 'admin'),
        successTitle: 'User updated',
        successMessage: 'Moderation state saved.',
      })
    },
  }),
})

adminScreen.lifecycle({
  onEnter: async ({ app, router }) => {
    if (!app.state.session.user?.is_admin) {
      await router.replace(routeToHome())
      app.service('notify').push({
        level: 'warning',
        title: 'Admin only',
        message: 'You do not have access to moderation tools.',
      })
      return
    }
    await refreshAdminData(app)
  },
  errorTitle: 'Admin load failed',
  errorMessage: 'Could not initialize the admin moderation screen.',
})
