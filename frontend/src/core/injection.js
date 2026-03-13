import { inject } from 'vue'

export const APP_CTX_KEY = Symbol('app-ctx')

export function useApp() {
  const app = inject(APP_CTX_KEY)
  if (!app) {
    throw new Error('App context not provided')
  }
  return app
}
