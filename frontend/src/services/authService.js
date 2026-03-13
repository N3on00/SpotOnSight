import { ApiStateService } from './baseService'
import { normalizeUser } from '../models/userMapper'
import { API_ENDPOINTS } from '../api/registry'

export class AuthService extends ApiStateService {
  constructor(api, state) {
    super(api, state, { serviceName: 'auth' })
  }

  _loginValidationHints(error) {
    const detail = error?.data?.detail
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (!item || typeof item !== 'object') return ''
          const loc = Array.isArray(item.loc) ? item.loc.map((part) => String(part || '').trim()).join('.') : ''
          const msg = String(item.msg || '').trim()
          return `${loc} ${msg}`.trim().toLowerCase()
        })
        .filter(Boolean)
    }
    const text = String(detail || '').trim().toLowerCase()
    return text ? [text] : []
  }

  _shouldTryUsernamePassword(error) {
    const status = Number(error?.status) || 0
    if (![400, 415, 422].includes(status)) return false
    const hints = this._loginValidationHints(error)
    return hints.some((hint) => hint.includes('body.username') && hint.includes('field required'))
  }

  async _loginWithUsernameOrEmail(usernameOrEmail, password) {
    return this.api.request(API_ENDPOINTS.AUTH_LOGIN, {
      body: {
        username_or_email: usernameOrEmail,
        password,
      },
    })
  }

  async _loginWithUsername(usernameOrEmail, password) {
    return this.api.request(API_ENDPOINTS.AUTH_LOGIN, {
      body: {
        username: usernameOrEmail,
        password,
      },
    })
  }

  async _loginWithForm(usernameOrEmail, password) {
    return this.api.request(API_ENDPOINTS.AUTH_LOGIN, {
      body: {
        username: usernameOrEmail,
        password,
      },
      formEncoded: true,
    })
  }

  _applySession(data) {
    if (!data || typeof data !== 'object' || !data.access_token || !data.user) {
      this.captureError('Invalid authentication response', 'Invalid authentication response')
      return false
    }
    this.state.session.token = data.access_token
    this.state.session.user = normalizeUser(data.user)
    this.clearError()
    return true
  }

  async login(usernameOrEmail, password) {
    const loginValue = String(usernameOrEmail || '').trim()
    const passValue = String(password || '')

    try {
      const data = await this._loginWithUsernameOrEmail(loginValue, passValue)
      return this._applySession(data)
    } catch (firstError) {
      if (!this._shouldTryUsernamePassword(firstError)) {
        this.captureError(firstError, 'Login failed')
        return false
      }

      try {
        const data = await this._loginWithUsername(loginValue, passValue)
        return this._applySession(data)
      } catch (secondError) {
        if (!this._shouldTryUsernamePassword(secondError)) {
          this.captureError(secondError, 'Login failed')
          return false
        }

        try {
          const data = await this._loginWithForm(loginValue, passValue)
          return this._applySession(data)
        } catch (thirdError) {
          this.captureError(thirdError, 'Login failed')
          return false
        }
      }
    }
  }

  async register({ username, email, password, displayName }) {
    try {
      const data = await this.api.request(API_ENDPOINTS.AUTH_REGISTER, {
        body: {
          username,
          email,
          password,
          display_name: displayName,
        },
      })
      return this._applySession(data)
    } catch (error) {
      this.captureError(error, 'Registration failed')
      return false
    }
  }

  logout() {
    this.state.session.token = ''
    this.state.session.user = null
    this.clearError()
  }
}
