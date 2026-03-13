export function notify(app, payload) {
  app.service('notify').push(payload)
}

export function notifyInfo(app, title, message, details = '') {
  notify(app, { level: 'info', title, message, details })
}

export function notifySuccess(app, title, message, details = '') {
  notify(app, { level: 'success', title, message, details })
}

export function notifyError(app, title, message, details = '') {
  notify(app, { level: 'error', title, message, details })
}
