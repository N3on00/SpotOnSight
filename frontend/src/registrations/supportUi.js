import { createScreenModule } from '../core/screenRegistry'
import { UI_COMPONENT_IDS, UI_SCREENS } from '../core/uiElements'
import SupportHero from '../components/support/SupportHero.vue'
import SupportForm from '../components/support/SupportForm.vue'
import { controllerLastError, runBooleanAction } from './uiShared'

const supportScreen = createScreenModule(UI_SCREENS.SUPPORT)

supportScreen.header({
  id: UI_COMPONENT_IDS.SUPPORT_HERO,
  order: 10,
  component: SupportHero,
})

supportScreen.main({
  id: UI_COMPONENT_IDS.SUPPORT_FORM,
  order: 10,
  component: SupportForm,
  buildProps: ({ app, router }) => ({
    user: app.state.session.user,
    currentPath: router.currentRoute.value.fullPath,
    busy: app.state.loading.supportSubmit,
    onSubmit: async (payload) => {
      return runBooleanAction(app, {
        action: () => app.controller('support').submitTicket(payload),
        loadingKey: 'supportSubmit',
        errorTitle: 'Support request failed',
        errorMessage: 'Could not submit your support request.',
        errorDetails: () => controllerLastError(app, 'support'),
        successTitle: 'Request sent',
        successMessage: (ticket) => {
          const id = String(ticket?.id || '').trim()
          if (!id) return 'Support request submitted successfully.'
          return `Support ticket ${id} submitted.`
        },
      })
    },
  }),
})
