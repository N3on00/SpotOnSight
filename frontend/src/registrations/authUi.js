import { createScreenModule } from '../core/screenRegistry'
import { AuthScreenErrorHandler } from '../core/errorHandlerRegistry'
import { UI_ACTIONS, UI_COMPONENT_IDS, UI_SCREENS } from '../core/uiElements'
import { routeToHome } from '../router/routeSpec'
import AuthHero from '../components/auth/AuthHero.vue'
import AuthForms from '../components/auth/AuthForms.vue'
import AuthSupport from '../components/auth/AuthSupport.vue'
import { toUserErrorMessage } from '../services/apiErrors'
import { controllerLastError, notifyInfo, reloadCoreData, runBooleanAction } from './uiShared'

class AuthPageErrorHandler extends AuthScreenErrorHandler {}

const authScreen = createScreenModule(UI_SCREENS.AUTH)

authScreen.errorHandler({
  id: 'screen.auth.page',
  handlerClass: AuthPageErrorHandler,
  useForRoute: true,
})

authScreen.action(UI_ACTIONS.AUTH_HELP, ({ app }) => {
  notifyInfo(
    app,
    'Support',
    'If sign-in fails, contact support with details.',
    `Support: ${app.state.config.supportEmail}\nBackend: ${app.state.config.apiBaseUrl}`,
  )
})

authScreen.header({
  id: UI_COMPONENT_IDS.AUTH_HERO,
  order: 10,
  component: AuthHero,
  buildProps: () => ({
    title: 'Welcome to SpotOnSight',
    subtitle: 'Professional map sharing experience with secure accounts.',
  }),
})

authScreen.main({
  id: UI_COMPONENT_IDS.AUTH_FORMS,
  order: 10,
  component: AuthForms,
  buildProps: ({ app, router }) => {
    const authError = () => controllerLastError(app, 'auth')

    function authErrorMessage(fallback) {
      return toUserErrorMessage(authError(), fallback)
    }

    const authErrorDetails = () => authErrorMessage('')

    async function submitAuth({
      action,
      errorTitle,
      errorMessage,
      successTitle,
      successMessage,
    }) {
      await runBooleanAction(app, {
        action,
        errorTitle,
        errorMessage,
        errorDetails: authErrorDetails,
        successTitle,
        successMessage,
        onSuccess: async () => {
          await reloadCoreData(app)
          router.push(routeToHome())
        },
      })
    }

    return {
      onLogin: async ({ usernameOrEmail, password }) => {
        await submitAuth({
          action: () => app.controller('auth').login(usernameOrEmail, password),
          errorTitle: 'Login failed',
          errorMessage: () => authErrorMessage('Please check credentials and backend availability.'),
          successTitle: 'Welcome',
          successMessage: 'You are signed in.',
        })
      },
      onRegister: async ({ username, email, displayName, password }) => {
        await submitAuth({
          action: () => app.controller('auth').register({ username, email, displayName, password }),
          errorTitle: 'Registration failed',
          errorMessage: () => authErrorMessage('Could not create account.'),
          successTitle: 'Account ready',
          successMessage: 'Registration completed.',
        })
      },
    }
  },
})

authScreen.footer({
  id: UI_COMPONENT_IDS.AUTH_SUPPORT,
  order: 10,
  component: AuthSupport,
  buildProps: ({ app }) => ({
    supportEmail: app.state.config.supportEmail,
    onHelp: () => app.ui.runAction(UI_ACTIONS.AUTH_HELP),
  }),
})

authScreen.lifecycle({
  errorTitle: 'Authentication failed',
  errorMessage: 'Please verify your credentials and backend availability.',
})
