import { UI_COMPONENT_IDS, UI_SCREENS } from '../core/uiElements'
import SupportHero from '../components/support/SupportHero.vue'
import SupportForm from '../components/support/SupportForm.vue'
import { actionLastError, runBooleanAction } from './uiShared'

const registeredRegistries = new WeakSet()

const SUPPORT_SCREEN_DEFINITION = {
  screen: UI_SCREENS.SUPPORT,
  headers: [
    {
      id: UI_COMPONENT_IDS.SUPPORT_HERO,
      order: 10,
      component: SupportHero,
    },
  ],
  main: [
    {
      id: UI_COMPONENT_IDS.SUPPORT_FORM,
      order: 10,
      component: SupportForm,
      buildProps: ({ app, router }) => ({
        user: app.state.session.user,
        currentPath: router.currentRoute.value.fullPath,
        busy: app.state.loading.supportSubmit,
        onSubmit: async (payload) => runBooleanAction(app, {
          action: () => app.action('support').submitTicket(payload),
          loadingKey: 'supportSubmit',
          errorTitle: 'Support request failed',
          errorMessage: 'Could not submit your support request.',
          errorDetails: () => actionLastError(app, 'support'),
          successTitle: 'Request sent',
          successMessage: (ticket) => {
            const id = String(ticket?.id || '').trim()
            if (!id) return 'Support request submitted successfully.'
            return `Support ticket ${id} submitted.`
          },
        }),
      }),
    },
  ],
}

export function registerSupportUi(registry) {
  if (registeredRegistries.has(registry)) return
  registeredRegistries.add(registry)
  registry.registerScreenDefinition(SUPPORT_SCREEN_DEFINITION)
}
