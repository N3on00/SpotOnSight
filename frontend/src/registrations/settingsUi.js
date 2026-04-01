import { UI_ACTIONS, UI_COMPONENT_IDS, UI_SCREENS } from '../core/uiElements'
import SettingsHero from '../components/settings/SettingsHero.vue'
import SettingsForm from '../components/settings/SettingsForm.vue'
import {
  copyTextToClipboard,
  actionLastError,
  reloadDashboardData,
  runBooleanAction,
  runTask,
  toggleTheme,
} from './uiShared'

const registeredRegistries = new WeakSet()

const SETTINGS_SCREEN_DEFINITION = {
  screen: UI_SCREENS.SETTINGS,
  actions: [
    {
      id: UI_ACTIONS.SETTINGS_LOAD,
      handler: async ({ app }) => {
        await app.action('users').refreshProfile()
        await reloadDashboardData(app)
      },
    },
  ],
  headers: [
    {
      id: UI_COMPONENT_IDS.SETTINGS_HERO,
      order: 10,
      component: SettingsHero,
    },
  ],
  main: [
    {
      id: UI_COMPONENT_IDS.SETTINGS_FORM,
      order: 10,
      component: SettingsForm,
      buildProps: ({ app }) => ({
        user: app.state.session.user,
        theme: app.state.ui.theme,
        busy: app.state.loading.settingsSave,
        onCopyUserId: () => copyTextToClipboard(app, {
          text: app.state.session.user?.id,
          successTitle: 'Copied',
          successMessage: 'Your user id was copied.',
        }),
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
            action: () => app.action('users').updateProfile(payload),
            loadingKey: 'settingsSave',
            errorTitle: 'Settings save failed',
            errorMessage: 'Could not update your profile settings.',
            errorDetails: () => actionLastError(app, 'users'),
            onSuccess: async () => {
              await reloadDashboardData(app)
            },
            successTitle: 'Settings saved',
            successMessage: 'Your profile has been updated.',
          })
        },
      }),
    },
  ],
  lifecycle: {
    onEnter: async ({ app }) => {
      await app.ui.runAction(UI_ACTIONS.SETTINGS_LOAD)
    },
    errorTitle: 'Settings load failed',
    errorMessage: 'Could not initialize settings page.',
  },
}

export function registerSettingsUi(registry) {
  if (registeredRegistries.has(registry)) return
  registeredRegistries.add(registry)
  registry.registerScreenDefinition(SETTINGS_SCREEN_DEFINITION)
}
