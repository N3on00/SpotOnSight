function ensureLoadingState(app, key) {
  if (!key) return
  if (!(key in app.state.loading)) {
    app.state.loading[key] = false
  }
  if (!app.state.loadingCounts) {
    app.state.loadingCounts = {}
  }
  if (!(key in app.state.loadingCounts)) {
    app.state.loadingCounts[key] = 0
  }
}

export function beginLoading(app, key) {
  if (!key) return
  ensureLoadingState(app, key)
  app.state.loadingCounts[key] += 1
  app.state.loading[key] = true
}

export function endLoading(app, key) {
  if (!key) return
  ensureLoadingState(app, key)
  app.state.loadingCounts[key] = Math.max(0, (app.state.loadingCounts[key] || 0) - 1)
  app.state.loading[key] = app.state.loadingCounts[key] > 0
}
