<script setup>
import { computed, reactive } from 'vue'
import AuthField from './AuthField.vue'
import AuthIssues from './AuthIssues.vue'
import ActionButton from '../common/ActionButton.vue'

const props = defineProps({
  onLogin: { type: Function, required: true },
  onRegister: { type: Function, required: true },
  busy: { type: Boolean, default: false },
})

const login = reactive({ usernameOrEmail: '', password: '' })
const reg = reactive({ username: '', email: '', displayName: '', password: '', confirmPassword: '' })
const ui = reactive({
  loginTried: false,
  registerTried: false,
})

const loginIssues = computed(() => {
  const issues = []
  if (!String(login.usernameOrEmail || '').trim()) {
    issues.push('Username or email is required.')
  }
  if (!String(login.password || '')) {
    issues.push('Password is required.')
  }
  return issues
})

const regChecks = computed(() => {
  const username = String(reg.username || '').trim()
  const email = String(reg.email || '').trim()
  const password = String(reg.password || '')
  const confirmPassword = String(reg.confirmPassword || '')
  const displayName = String(reg.displayName || '').trim()

  return {
    usernameLen: username.length >= 3,
    emailValid: /^\S+@\S+\.\S+$/.test(email),
    passwordLen: password.length >= 8,
    passwordLower: /[a-z]/.test(password),
    passwordUpper: /[A-Z]/.test(password),
    passwordDigit: /\d/.test(password),
    passwordSpecial: /[^A-Za-z0-9]/.test(password),
    passwordMatch: password.length > 0 && confirmPassword.length > 0 && password === confirmPassword,
    displayProvided: displayName.length > 0,
    displayLen: displayName.length <= 120,
  }
})

const regIssues = computed(() => {
  const issues = []
  if (!regChecks.value.usernameLen) {
    issues.push('Username must be at least 3 characters.')
  }
  if (!String(reg.email || '').trim()) {
    issues.push('Email is required.')
  } else if (!regChecks.value.emailValid) {
    issues.push('Email format is invalid.')
  }
  if (!regChecks.value.passwordLen) {
    issues.push('Password must be at least 8 characters.')
  }
  if (!regChecks.value.passwordLower) {
    issues.push('Password must include at least one lowercase letter.')
  }
  if (!regChecks.value.passwordUpper) {
    issues.push('Password must include at least one uppercase letter.')
  }
  if (!regChecks.value.passwordDigit) {
    issues.push('Password must include at least one number.')
  }
  if (!regChecks.value.passwordSpecial) {
    issues.push('Password must include at least one special character.')
  }
  if (!regChecks.value.passwordMatch) {
    issues.push('Password confirmation does not match.')
  }
  if (regChecks.value.displayProvided && !regChecks.value.displayLen) {
    issues.push('Display name must be 120 characters or less.')
  }
  return issues
})

const usernameRequirements = computed(() => [
  { text: 'At least 3 characters', ok: regChecks.value.usernameLen },
])

const emailRequirements = computed(() => [
  { text: 'Valid email format', ok: regChecks.value.emailValid },
])

const displayNameRequirements = computed(() => [
  {
    text: 'If provided, max 120 characters',
    ok: regChecks.value.displayProvided && regChecks.value.displayLen,
  },
])

const passwordRequirements = computed(() => [
  { text: 'Minimum 8 characters', ok: regChecks.value.passwordLen },
  { text: 'At least one lowercase letter', ok: regChecks.value.passwordLower },
  { text: 'At least one uppercase letter', ok: regChecks.value.passwordUpper },
  { text: 'At least one number', ok: regChecks.value.passwordDigit },
  { text: 'At least one special character', ok: regChecks.value.passwordSpecial },
])

const confirmPasswordRequirements = computed(() => [
  { text: 'Must match password', ok: regChecks.value.passwordMatch },
])

const canLogin = computed(() => {
  return loginIssues.value.length === 0
})

const canRegister = computed(() => {
  return regIssues.value.length === 0
})

const showLoginIssues = computed(() => ui.loginTried && loginIssues.value.length > 0)
const showRegisterIssues = computed(() => ui.registerTried && regIssues.value.length > 0)

function submitLogin() {
  ui.loginTried = true
  if (props.busy || !canLogin.value) {
    return
  }
  props.onLogin({ ...login })
}

function submitRegister() {
  ui.registerTried = true
  if (props.busy || !canRegister.value) {
    return
  }
  props.onRegister({ ...reg })
}
</script>

<template>
  <section class="row g-3" data-aos="fade-up" data-aos-delay="40">
    <div class="col-12 col-lg-6">
      <form class="card border-0 shadow-sm h-100" @submit.prevent.stop="submitLogin" novalidate>
        <div class="card-body p-4 d-flex flex-column gap-3">
          <div>
            <h2 class="h4 mb-1">Login</h2>
            <p class="text-secondary mb-0">Use username or email.</p>
          </div>

          <AuthField
            v-model="login.usernameOrEmail"
            label="Username / Email"
            autocomplete="username"
            placeholder="e.g. max.mustermann or max@mail.com"
            @enter="submitLogin"
          />

          <AuthField
            v-model="login.password"
            label="Password"
            type="password"
            autocomplete="current-password"
            placeholder="Enter your password"
            hint-text="Press Enter to sign in."
            allow-reveal
            @enter="submitLogin"
          />

          <AuthIssues
            :show="showLoginIssues"
            title="Please fix before signing in:"
            :issues="loginIssues"
            issue-prefix="login"
          />

          <ActionButton
            type="submit"
            class-name="btn btn-primary btn-lg mt-auto"
            label="Sign in"
            :disabled="busy || !canLogin"
          />
        </div>
      </form>
    </div>

    <div class="col-12 col-lg-6">
      <form class="card border-0 shadow-sm h-100" @submit.prevent.stop="submitRegister" novalidate>
        <div class="card-body p-4 d-flex flex-column gap-3">
          <div>
            <h2 class="h4 mb-1">Register</h2>
            <p class="text-secondary mb-0">Create your account in seconds.</p>
          </div>

          <AuthField
            v-model="reg.username"
            label="Username"
            autocomplete="username"
            placeholder="e.g. maxmustermann"
            :requirements="usernameRequirements"
            @enter="submitRegister"
          />

          <AuthField
            v-model="reg.email"
            label="Email"
            autocomplete="email"
            type="email"
            placeholder="name@example.com"
            :requirements="emailRequirements"
            @enter="submitRegister"
          />

          <AuthField
            v-model="reg.displayName"
            label="Display name"
            autocomplete="name"
            placeholder="Display name (optional)"
            :requirements="displayNameRequirements"
            @enter="submitRegister"
          />

          <AuthField
            v-model="reg.password"
            label="Password"
            type="password"
            autocomplete="new-password"
            placeholder="At least 8 characters"
            :requirements="passwordRequirements"
            allow-reveal
            @enter="submitRegister"
          />

          <AuthField
            v-model="reg.confirmPassword"
            label="Confirm password"
            type="password"
            autocomplete="new-password"
            placeholder="Repeat your password"
            :requirements="confirmPasswordRequirements"
            allow-reveal
            @enter="submitRegister"
          />

          <AuthIssues
            :show="showRegisterIssues"
            title="Please fix before creating account:"
            :issues="regIssues"
            issue-prefix="register"
          />

          <ActionButton
            type="submit"
            class-name="btn btn-outline-primary"
            label="Create account"
            :disabled="busy || !canRegister"
          />
        </div>
      </form>
    </div>
  </section>
</template>
