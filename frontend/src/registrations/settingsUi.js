import { createScreenModule } from '../core/screenRegistry'
import { UI_ACTIONS, UI_COMPONENT_IDS, UI_SCREENS } from '../core/uiElements'
import SettingsHero from '../components/settings/SettingsHero.vue'
import SettingsForm from '../components/settings/SettingsForm.vue'
import {
  copyTextToClipboard,
  controllerLastError,
  reloadDashboardData,
  runBooleanAction,
  runTask,
  toggleTheme,
} from './uiShared'

const settingsScreen = createScreenModule(UI_SCREENS.SETTINGS)

settingsScreen.action(UI_ACTIONS.SETTINGS_LOAD, async ({ app }) => {
  await app.controller('users').refreshProfile()
  await reloadDashboardData(app)
})

settingsScreen.header({
  id: UI_COMPONENT_IDS.SETTINGS_HERO,
  order: 10,
  component: SettingsHero,
})

settingsScreen.main({
  id: UI_COMPONENT_IDS.SETTINGS_FORM,
  order: 10,
  component: SettingsForm,
  buildProps: ({ app }) => ({
    user: app.state.session.user,
    theme: app.state.ui.theme,
    busy: app.state.loading.settingsSave,
    onCopyUserId: () => {
      return copyTextToClipboard(app, {
        text: app.state.session.user?.id,
        successTitle: 'Copied',
        successMessage: 'Your user id was copied.',
      })
    },
    onToggleTheme: async () => {
      const next = toggleTheme(app)
      await runTask(app, {
        task: async () => next,
        successTitle: 'Theme updated',
        successMessage: () => `Switched to ${next} mode.`,
      })
    },
    onSave: async (payload) => {
      await runBooleanAction(app, {
        action: () => app.controller('users').updateProfile(payload),
        loadingKey: 'settingsSave',
        errorTitle: 'Settings save failed',
        errorMessage: 'Could not update your profile settings.',
        errorDetails: () => controllerLastError(app, 'users'),
        onSuccess: async () => {
          await reloadDashboardData(app)
        },
        successTitle: 'Settings saved',
        successMessage: 'Your profile has been updated.',
      })
    },
  }),
})

settingsScreen.lifecycle({
  onEnter: async ({ app }) => {
    await app.ui.runAction(UI_ACTIONS.SETTINGS_LOAD)
  },
  errorTitle: 'Settings load failed',
  errorMessage: 'Could not initialize settings page.',
})
