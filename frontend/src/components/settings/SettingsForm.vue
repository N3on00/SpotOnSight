<script setup>
import { computed, reactive, watch } from 'vue'
import ActionButton from '../common/ActionButton.vue'
import AppAvatarPicker from '../common/AppAvatarPicker.vue'
import AppCheckbox from '../common/AppCheckbox.vue'
import AppTextField from '../common/AppTextField.vue'
import {
  createPasswordChecks,
  createSocialAccountsPayload,
  normalizeWebsiteList,
  websitesFromSocialAccounts,
} from './settingsFormModel'

const props = defineProps({
  user: { type: Object, default: null },
  theme: { type: String, default: 'light' },
  busy: { type: Boolean, default: false },
  onSave: { type: Function, required: true },
  onToggleTheme: { type: Function, required: true },
  onCopyUserId: { type: Function, required: true },
  onDeleteAccount: { type: Function, default: null },
  onExportAccount: { type: Function, default: null },
})

const form = reactive({
  username: '',
  email: '',
  displayName: '',
  bio: '',
  avatarImage: '',
  followRequiresApproval: false,
  instagram: '',
  github: '',
  websites: [''],
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
  showCurrentPassword: false,
  showNewPassword: false,
  showConfirmPassword: false,
  showDeleteConfirm: false,
  deletePassword: '',
})

const isDark = computed(() => String(props.theme || '').toLowerCase() === 'dark')

const passwordChecks = computed(() => createPasswordChecks(form))

const passwordRequirements = computed(() => [
  {
    text: 'Current password required when changing password',
    ok: passwordChecks.value.changing ? passwordChecks.value.currentProvided : false,
  },
  { text: 'Minimum 8 characters', ok: passwordChecks.value.len },
  { text: 'At least one lowercase letter', ok: passwordChecks.value.lower },
  { text: 'At least one uppercase letter', ok: passwordChecks.value.upper },
  { text: 'At least one number', ok: passwordChecks.value.digit },
  { text: 'At least one special character', ok: passwordChecks.value.special },
  { text: 'New password must match confirmation', ok: passwordChecks.value.match },
])

const canSubmitPasswordChange = computed(() => {
  if (!passwordChecks.value.changing) {
    return true
  }
  return (
    passwordChecks.value.currentProvided
    && passwordChecks.value.len
    && passwordChecks.value.lower
    && passwordChecks.value.upper
    && passwordChecks.value.digit
    && passwordChecks.value.special
    && passwordChecks.value.match
  )
})

const hasAnyWebsite = computed(() => {
  return form.websites.some((value) => String(value || '').trim())
})

function addWebsiteField() {
  form.websites.push('')
}

function removeWebsiteField(index) {
  form.websites = form.websites.filter((_, current) => current !== index)
  if (!form.websites.length) {
    form.websites = ['']
  }
}

function updateWebsite(index, value) {
  form.websites[index] = String(value || '')
}

function addWebsitesToBio() {
  const websites = normalizeWebsiteList(form.websites)
  if (!websites.length) return

  const lines = String(form.bio || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const existing = new Set(lines.map((line) => line.toLowerCase()))
  let changed = false
  for (const site of websites) {
    if (existing.has(site.toLowerCase())) continue
    lines.push(site)
    existing.add(site.toLowerCase())
    changed = true
  }

  if (changed) {
    form.bio = lines.join('\n')
  }
}

watch(
  () => props.user,
  (user) => {
    const u = user || {}
    form.username = String(u.username || '')
    form.email = String(u.email || '')
    form.displayName = String(u.display_name || u.displayName || '')
    form.bio = String(u.bio || '')
    form.avatarImage = String(u.avatar_image || u.avatarImage || '')
    form.followRequiresApproval = Boolean(u.follow_requires_approval)

    const social = u.social_accounts && typeof u.social_accounts === 'object' ? u.social_accounts : {}
    form.instagram = String(social.instagram || '')
    form.github = String(social.github || '')
    form.websites = websitesFromSocialAccounts(social)

    form.currentPassword = ''
    form.newPassword = ''
    form.confirmNewPassword = ''
  },
  { immediate: true, deep: true },
)

function submit() {
  if (!canSubmitPasswordChange.value) {
    return
  }

  props.onSave({
    username: form.username,
    email: form.email,
    displayName: form.displayName,
    bio: form.bio,
    avatarImage: form.avatarImage,
    followRequiresApproval: form.followRequiresApproval,
    socialAccounts: createSocialAccountsPayload(form),
    currentPassword: form.currentPassword,
    newPassword: form.newPassword,
  })
}
</script>

<template>
  <section class="card border-0 shadow-sm" data-aos="fade-up" data-aos-delay="80">
    <div class="card-body d-grid gap-3 p-4">
      <div class="settings-theme-row">
        <div>
          <h3 class="h5 mb-1">Theme</h3>
          <p class="text-secondary mb-0">Switch between light and dark mode.</p>
        </div>
        <ActionButton
          :class-name="isDark ? 'btn btn-outline-warning' : 'btn btn-outline-secondary'"
          :icon="isDark ? 'bi-sun' : 'bi-moon-stars'"
          :label="isDark ? 'Light mode' : 'Dark mode'"
          @click="onToggleTheme"
        />
      </div>

      <div class="social-self-id">
        <span class="text-secondary">User id</span>
        <ActionButton class-name="btn btn-link p-0 social-self-id__button" aria-label="Copy user id" @click="onCopyUserId">
          <code>{{ user?.id || '-' }}</code>
          <i class="bi bi-clipboard ms-2"></i>
        </ActionButton>
      </div>

      <div class="row g-2">
        <div class="col-12 col-md-6">
          <AppTextField label="Username" v-model="form.username" :disabled="busy" />
        </div>
        <div class="col-12 col-md-6">
          <AppTextField label="Email" type="email" v-model="form.email" :disabled="busy" />
        </div>
      </div>

      <div class="row g-2">
        <div class="col-12 col-md-6">
          <AppTextField label="Display name" v-model="form.displayName" :disabled="busy" />
        </div>
        <div class="col-12 col-md-6 d-grid align-content-end">
          <AppCheckbox
            wrapper-class="app-checkbox mt-4"
            input-class="app-checkbox__input"
            label-class="app-checkbox__label"
            v-model="form.followRequiresApproval"
            :disabled="busy"
            label="Require approval for followers"
          />
        </div>
      </div>

      <AppTextField
        as="textarea"
        label="Biography"
        rows="4"
        maxlength="1200"
        v-model="form.bio"
        :disabled="busy"
      />
      <p class="small text-secondary mb-0">
        Biography supports Markdown, for example <code>**bold**</code>, <code>*italic*</code>, <code>- list item</code>, and <code>[link](https://example.com)</code>.
      </p>

      <div class="row g-2">
        <div class="col-12 col-md-6">
          <AppTextField
            label="Instagram"
            v-model="form.instagram"
            placeholder="https://instagram.com/..."
            :disabled="busy"
          />
        </div>
        <div class="col-12 col-md-6">
          <AppTextField
            label="GitHub"
            v-model="form.github"
            placeholder="https://github.com/..."
            :disabled="busy"
          />
        </div>
      </div>

      <AppAvatarPicker
        label="Profile picture"
        v-model="form.avatarImage"
        :disabled="busy"
      />

      <div class="settings-websites">
        <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <label class="form-label mb-0">Websites</label>
          <ActionButton
            class-name="btn btn-sm btn-outline-secondary"
            icon="bi-plus"
            label="Add website"
            :disabled="busy"
            @click="addWebsiteField"
          />
        </div>

        <div class="settings-websites__list">
          <div class="settings-websites__item" v-for="(value, index) in form.websites" :key="`website-${index}`">
            <AppTextField
              bare
              class-name="form-control"
              :model-value="value"
              :placeholder="index === 0 ? 'https://...' : 'Additional website URL'"
              :disabled="busy"
              :aria-label="`Website ${index + 1}`"
              @update:modelValue="(next) => updateWebsite(index, next)"
            />
            <ActionButton
              class-name="btn btn-outline-secondary"
              icon="bi-x"
              :icon-only="true"
              aria-label="Remove website"
              :disabled="busy || form.websites.length <= 1"
              @click="removeWebsiteField(index)"
            />
          </div>
        </div>

        <div class="d-flex justify-content-end">
          <ActionButton
            class-name="btn btn-sm btn-outline-primary"
            icon="bi-journal-plus"
            label="Add websites to bio"
            :disabled="busy || !hasAnyWebsite"
            @click="addWebsitesToBio"
          />
        </div>
      </div>

      <div class="row g-2">
        <div class="col-12 col-md-4">
          <label class="form-label">Current password</label>
          <div class="input-group">
            <AppTextField
              bare
              class-name="form-control"
              :type="form.showCurrentPassword ? 'text' : 'password'"
              v-model="form.currentPassword"
              :disabled="busy"
              aria-label="Current password"
            />
            <ActionButton class-name="btn btn-outline-secondary" label="Show" @click="form.showCurrentPassword = !form.showCurrentPassword" />
          </div>
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">New password</label>
          <div class="input-group">
            <AppTextField
              bare
              class-name="form-control"
              :type="form.showNewPassword ? 'text' : 'password'"
              v-model="form.newPassword"
              :disabled="busy"
              aria-label="New password"
            />
            <ActionButton class-name="btn btn-outline-secondary" label="Show" @click="form.showNewPassword = !form.showNewPassword" />
          </div>
        </div>
        <div class="col-12 col-md-4">
          <label class="form-label">Confirm password</label>
          <div class="input-group">
            <AppTextField
              bare
              class-name="form-control"
              :type="form.showConfirmPassword ? 'text' : 'password'"
              v-model="form.confirmNewPassword"
              :disabled="busy"
              aria-label="Confirm new password"
            />
            <ActionButton class-name="btn btn-outline-secondary" label="Show" @click="form.showConfirmPassword = !form.showConfirmPassword" />
          </div>
        </div>
      </div>

      <ul class="auth-rules settings-password-rules">
        <li
          class="auth-rule"
          :class="rule.ok ? 'auth-rule--ok' : 'auth-rule--pending'"
          v-for="(rule, index) in passwordRequirements"
          :key="`settings-password-rule-${index}`"
        >
          <i class="bi" :class="rule.ok ? 'bi-check-circle-fill' : 'bi-dot'"></i>
          {{ rule.text }}
        </li>
      </ul>

      <ActionButton
        label="Save settings"
        icon="bi-save"
        :busy="busy"
        busy-label="Saving..."
        class-name="btn btn-primary"
        @click="submit"
      />

      <div v-if="onExportAccount" class="settings-export-section">
        <hr class="my-4" />
        <h3 class="h5 mb-2">Export Your Data</h3>
        <p class="text-secondary mb-3">Download a copy of your account data including your profile, spots, and content.</p>
        <ActionButton
          label="Export data"
          icon="bi-download"
          class-name="btn btn-outline-secondary"
          @click="onExportAccount"
        />
      </div>

      <div v-if="onDeleteAccount" class="settings-delete-section">
        <hr class="my-4" />
        <h3 class="h5 mb-2 text-danger">Danger Zone</h3>
        <p class="text-secondary mb-3">Once you delete your account, there is no going back.</p>
        
        <div v-if="!form.showDeleteConfirm">
          <ActionButton
            label="Delete account"
            icon="bi-trash"
            class-name="btn btn-outline-danger"
            @click="form.showDeleteConfirm = true"
          />
        </div>
        
        <div v-else class="settings-delete-confirm">
          <p class="text-danger fw-bold mb-2">Type your password to confirm deletion:</p>
          <div class="input-group mb-2">
            <AppTextField
              bare
              class-name="form-control"
              type="password"
              v-model="form.deletePassword"
              placeholder="Enter password"
              aria-label="Password confirmation"
            />
          </div>
          <div class="d-flex gap-2">
            <ActionButton
              label="Cancel"
              class-name="btn btn-outline-secondary"
              @click="form.showDeleteConfirm = false; form.deletePassword = ''"
            />
            <ActionButton
              label="Confirm Delete"
              icon="bi-trash"
              class-name="btn btn-danger"
              :busy="busy"
              :disabled="!form.deletePassword"
              @click="onDeleteAccount(form.deletePassword)"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
