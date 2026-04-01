import { beginLoadingState, endLoadingState } from '../../state/appMutations'

export function beginLoading(app, key) {
  beginLoadingState(app.state, key)
}

export function endLoading(app, key) {
  endLoadingState(app.state, key)
}
