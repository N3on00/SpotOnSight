import { notifyError, notifyInfo, notifySuccess } from './notify'
import { toDetails } from './text'
import { setTheme } from '../../state/appMutations'

export function toggleTheme(app) {
  const current = String(app?.state?.ui?.theme || 'light').toLowerCase()
  const next = current === 'dark' ? 'light' : 'dark'
  setTheme(app.state, next)
  return next
}

export async function copyTextToClipboard(app, {
  text,
  successTitle = 'Copied',
  successMessage = 'Copied to clipboard.',
  emptyTitle = 'Missing value',
  emptyMessage = 'There is nothing to copy.',
  errorTitle = 'Clipboard Error',
  errorMessage = 'Could not copy value from browser.',
} = {}) {
  const value = String(text || '').trim()
  if (!value) {
    notifyInfo(app, emptyTitle, emptyMessage)
    return false
  }

  try {
    await navigator.clipboard.writeText(value)
    notifySuccess(app, successTitle, successMessage)
    return true
  } catch (error) {
    notifyError(app, errorTitle, errorMessage, toDetails(error?.message || error))
    return false
  }
}
