import { UI_ACTIONS, UI_COMPONENT_IDS, UI_SCREENS } from '../core/uiElements'
import AdminHero from '../components/admin/AdminHero.vue'
import AdminModerationPanel from '../components/admin/AdminModerationPanel.vue'
import { actionLastError, runTask } from './uiShared'
import { routeToHome, routeToMap, routeToProfile } from '../router/routeSpec'

const registeredRegistries = new WeakSet()

async function refreshAdminData(app) {
  await Promise.all([
    app.action('spots').reload(),
    app.action('admin').loadReports('all', 300),
    app.action('admin').loadUsers('', 100),
    app.action('support').listAdminTickets(),
  ])
}

const ADMIN_SCREEN_DEFINITION = {
  screen: UI_SCREENS.ADMIN,
  actions: [
    {
      id: UI_ACTIONS.ADMIN_REFRESH,
      handler: async ({ app }) => {
        await refreshAdminData(app)
      },
    },
  ],
  headers: [
    {
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
    },
  ],
  main: [
    {
      id: UI_COMPONENT_IDS.ADMIN_PANEL,
      order: 10,
      component: AdminModerationPanel,
      buildProps: ({ app, router }) => ({
        reports: app.state.admin.reports,
        users: app.state.admin.users,
        supportTickets: app.state.admin.supportTickets,
        busy: app.state.loading.adminLoad || app.state.loading.adminAction,
        onOpenProfile: (userId) => {
          router.push(routeToProfile(userId))
        },
        onGoToTarget: (report) => {
          const preview = report?.target_preview
          const lat = Number(preview?.lat)
          const lon = Number(preview?.lon)
          const spotId = String(preview?.spot_id || report?.target_id || '').trim()
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            router.push(routeToMap({ lat, lon, spotId }))
            return
          }
          if (String(report?.target_type || '') === 'user') {
            router.push(routeToProfile(report?.target_id))
          }
        },
        onRefresh: async () => {
          await runTask(app, {
            task: () => refreshAdminData(app),
            loadingKey: 'adminLoad',
            errorTitle: 'Admin data failed',
            errorMessage: 'Could not refresh moderation data.',
            errorDetails: () => actionLastError(app, 'admin'),
          })
        },
        onReviewReport: async (reportId, payload) => {
          await runTask(app, {
            task: async () => {
              const result = await app.action('admin').reviewReport(reportId, payload)
              if (result) {
                await refreshAdminData(app)
              }
              return result
            },
            loadingKey: 'adminAction',
            errorTitle: 'Review failed',
            errorMessage: 'Could not update moderation report.',
            errorDetails: () => actionLastError(app, 'admin'),
            successTitle: 'Report reviewed',
            successMessage: 'Moderation action saved.',
          })
        },
        onUpdateUser: async (userId, payload) => {
          await runTask(app, {
            task: async () => {
              const result = await app.action('admin').updateUserStatus(userId, payload)
              if (result) {
                await refreshAdminData(app)
              }
              return result
            },
            loadingKey: 'adminAction',
            errorTitle: 'User update failed',
            errorMessage: 'Could not update user moderation state.',
            errorDetails: () => actionLastError(app, 'admin'),
            successTitle: 'User updated',
            successMessage: 'Moderation state saved.',
          })
        },
      }),
    },
  ],
  lifecycle: {
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
  },
}

export function registerAdminUi(registry) {
  if (registeredRegistries.has(registry)) return
  registeredRegistries.add(registry)
  registry.registerScreenDefinition(ADMIN_SCREEN_DEFINITION)
}
