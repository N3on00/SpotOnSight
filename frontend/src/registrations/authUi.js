import { AuthScreenErrorHandler } from '../core/errorHandlerRegistry'
import { UI_ACTIONS, UI_COMPONENT_IDS, UI_SCREENS } from '../core/uiElements'
import { routeToHome } from '../router/routeSpec'
import AuthHero from '../components/auth/AuthHero.vue'
import AuthForms from '../components/auth/AuthForms.vue'
import AuthSupport from '../components/auth/AuthSupport.vue'
import { toUserErrorMessage } from '../services/apiErrors'
import { actionLastError, notifyInfo, reloadCoreData, runBooleanAction } from './uiShared'

class AuthPageErrorHandler extends AuthScreenErrorHandler {}

const registeredRegistries = new WeakSet()

const AUTH_SCREEN_DEFINITION = {
  screen: UI_SCREENS.AUTH,
  errorHandlers: [
    {
      id: 'screen.auth.page',
      handlerClass: AuthPageErrorHandler,
      useForRoute: true,
    },
  ],
  actions: [
    {
      id: UI_ACTIONS.AUTH_HELP,
      handler: ({ app }) => {
        notifyInfo(
          app,
          'Support',
          'If sign-in fails, contact support with details.',
          `Support: ${app.state.config.supportEmail}\nBackend: ${app.state.config.apiBaseUrl}`,
        )
      },
    },
  ],
  headers: [
    {
      id: UI_COMPONENT_IDS.AUTH_HERO,
      order: 10,
      component: AuthHero,
      buildProps: () => ({
        title: 'Welcome to SpotOnSight',
        subtitle: 'Professional map sharing experience with secure accounts.',
      }),
    },
  ],
  main: [
    {
      id: UI_COMPONENT_IDS.AUTH_FORMS,
      order: 10,
      component: AuthForms,
      buildProps: ({ app, router }) => {
        const authError = () => actionLastError(app, 'auth')

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
              action: () => app.action('auth').login(usernameOrEmail, password),
              errorTitle: 'Login failed',
              errorMessage: () => authErrorMessage('Please check credentials and backend availability.'),
              successTitle: 'Welcome',
              successMessage: 'You are signed in.',
            })
          },
          onRegister: async ({ username, email, displayName, password }) => {
            await submitAuth({
              action: () => app.action('auth').register({ username, email, displayName, password }),
              errorTitle: 'Registration failed',
              errorMessage: () => authErrorMessage('Could not create account.'),
              successTitle: 'Account ready',
              successMessage: 'Registration completed.',
            })
          },
        }
      },
    },
  ],
  footers: [
    {
      id: UI_COMPONENT_IDS.AUTH_SUPPORT,
      order: 10,
      component: AuthSupport,
      buildProps: ({ app }) => ({
        supportEmail: app.state.config.supportEmail,
        onHelp: () => app.ui.runAction(UI_ACTIONS.AUTH_HELP),
      }),
    },
  ],
  lifecycle: {
    errorTitle: 'Authentication failed',
    errorMessage: 'Please verify your credentials and backend availability.',
  },
}

export function registerAuthUi(registry) {
  if (registeredRegistries.has(registry)) return
  registeredRegistries.add(registry)
  registry.registerScreenDefinition(AUTH_SCREEN_DEFINITION)
}
