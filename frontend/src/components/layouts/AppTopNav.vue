<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApp } from '../../core/injection'
import { toImageSource } from '../../models/imageMapper'
import {
  ROUTE_NAMES,
  routeToAuth,
  routeToHome,
  routeToMap,
  routeToProfile,
  routeToSettings,
  routeToSocial,
  routeToSupport,
} from '../../router/routeSpec'
import ActionButton from '../common/ActionButton.vue'
import TopNavLinks from './TopNavLinks.vue'
import TopNavNotificationsPanel from './TopNavNotificationsPanel.vue'
import TopNavUserMenu from './TopNavUserMenu.vue'
import { useResponsiveTopNav } from './composables/useResponsiveTopNav'

const app = useApp()
const route = useRoute()
const router = useRouter()

const notificationsOpen = ref(false)
const userMenuOpen = ref(false)
const expandedLogEntries = ref({})

const navEntries = computed(() => {
  return [
    { key: ROUTE_NAMES.SOCIAL, label: 'Social', icon: 'bi-people', to: routeToSocial() },
    { key: ROUTE_NAMES.MAP, label: 'Map', icon: 'bi-map', to: routeToMap() },
    { key: ROUTE_NAMES.HOME, label: 'Home', icon: 'bi-house', to: routeToHome() },
  ]
})

const me = computed(() => app.state.session.user || null)

const logEntries = computed(() => {
  const source = Array.isArray(app.state.notificationLog) ? app.state.notificationLog : []
  return [...source].reverse()
})

const logCount = computed(() => logEntries.value.length)

const userTriggerClass = computed(() => {
  if (userMenuOpen.value) {
    return 'btn btn-primary app-top-nav__tool-btn app-top-nav__user-trigger-btn app-top-nav__user-trigger--active'
  }
  return 'btn btn-outline-secondary app-top-nav__tool-btn app-top-nav__user-trigger-btn'
})

const incomingCount = computed(() => {
  const list = Array.isArray(app.state.social?.incomingRequests)
    ? app.state.social.incomingRequests
    : []
  return list.length
})

const primaryEntries = computed(() => navEntries.value)

const show = computed(() => {
  if (!app.ui.isAuthenticated()) return false
  return route.name !== ROUTE_NAMES.AUTH
})

const navIconOnly = computed(() => isMobile.value || compactBySpace.value)

const userAvatar = computed(() => {
  const raw = String(me.value?.avatar_image || '').trim()
  if (!raw) return ''
  return toImageSource(raw)
})

const userTitle = computed(() => {
  return String(me.value?.display_name || me.value?.username || 'Your account')
})

const userNavName = computed(() => {
  const username = String(me.value?.username || '').trim()
  if (username) return `@${username}`
  return String(me.value?.display_name || 'Profile')
})

const userSubtitle = computed(() => {
  const username = String(me.value?.username || '').trim()
  if (!username) return ''
  return `@${username}`
})

const userDetails = computed(() => {
  const details = []
  const email = String(me.value?.email || '').trim()
  if (email) details.push(email)
  if (incomingCount.value > 0) {
    details.push(`${incomingCount.value} follow request(s)`)
  }
  return details
})

watch(
  () => route.fullPath,
  () => {
    notificationsOpen.value = false
    userMenuOpen.value = false
  },
)

const {
  isMobile,
  compactBySpace,
  navRoot,
  panelRoot,
  primaryLinksRoot,
} = useResponsiveTopNav({
  show,
  notificationsOpen,
  userMenuOpen,
  routePath: computed(() => route.fullPath),
})

function closePanels() {
  notificationsOpen.value = false
  userMenuOpen.value = false
}

function open(entry) {
  if (!entry?.to) return
  closePanels()
  router.push(entry.to)
}

function isActive(entry) {
  return String(route.name || '') === String(entry.key)
}

function logout() {
  closePanels()
  app.controller('auth').logout()
  app.service('notify').push({
    level: 'info',
    title: 'Logged out',
    message: 'Session ended.',
  })
  router.push(routeToAuth())
}

function openHome() {
  closePanels()
  router.push(routeToHome())
}

function toggleNotifications() {
  userMenuOpen.value = false
  notificationsOpen.value = !notificationsOpen.value
}

function toggleUserMenu() {
  notificationsOpen.value = false
  userMenuOpen.value = !userMenuOpen.value
}

function openMyProfile() {
  const userId = String(me.value?.id || '').trim()
  closePanels()
  router.push(routeToProfile(userId))
}

function openSettings() {
  closePanels()
  router.push(routeToSettings())
}

function openSupport() {
  closePanels()
  router.push(routeToSupport())
}

function clearNotificationLog() {
  app.service('notify').clearLog()
  expandedLogEntries.value = {}
}

function notificationEntryKey(entry) {
  const id = String(entry?.id || '').trim()
  if (id) return id
  const createdAt = String(entry?.createdAt || '').trim()
  const title = String(entry?.title || '').trim()
  return `${createdAt}-${title}`
}

function notificationDetails(entry) {
  return String(entry?.details || '').trim()
}

function hasNotificationDetails(entry) {
  return Boolean(notificationDetails(entry))
}

function isNotificationExpanded(entry) {
  return Boolean(expandedLogEntries.value[notificationEntryKey(entry)])
}

function toggleNotificationExpanded(entry) {
  const key = notificationEntryKey(entry)
  expandedLogEntries.value = {
    ...expandedLogEntries.value,
    [key]: !isNotificationExpanded(entry),
  }
}

function notificationMessage(entry) {
  const message = String(entry?.message || '').trim()
  if (message) return message
  const details = String(entry?.details || '').trim()
  if (!details) return 'No details provided.'
  return details.split(/\r?\n/)[0]
}

function notificationTimestamp(entry) {
  const text = String(entry?.createdAt || '').trim()
  if (!text) return ''

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <nav class="app-top-nav card border-0 shadow-sm" v-if="show" data-aos="fade-down" ref="navRoot">
    <div class="app-top-nav__inner">
      <button class="app-top-nav__brand app-top-nav__brand-button" type="button" aria-label="Go to home" @click="openHome">
        <span class="brand rounded-4"><i class="bi bi-compass-fill"></i></span>
        <div>
          <strong>SpotOnSight</strong>
          <div class="small text-secondary">Navigation</div>
        </div>
      </button>

      <div class="app-top-nav__center">
        <div ref="primaryLinksRoot">
          <TopNavLinks :entries="primaryEntries" :nav-icon-only="navIconOnly" :is-active="isActive" :on-open="open" />
        </div>
      </div>

      <div class="app-top-nav__tools">
        <ActionButton
          :class-name="notificationsOpen ? 'btn btn-primary app-top-nav__tool-btn' : 'btn btn-outline-secondary app-top-nav__tool-btn'"
          icon="bi-bell"
          :label="navIconOnly ? '' : `Notifications (${logCount})`"
          :icon-only="navIconOnly"
          aria-label="Open notification log"
          @click="toggleNotifications"
        />
        <ActionButton
          :class-name="userTriggerClass"
          aria-label="Open user menu"
          @click="toggleUserMenu"
        >
          <span class="app-top-nav__user-trigger">
            <span class="app-top-nav__user-avatar" v-if="userAvatar">
              <img :src="userAvatar" alt="profile avatar" loading="lazy" />
            </span>
            <span class="app-top-nav__user-avatar app-top-nav__user-avatar--empty" v-else>
              <i class="bi bi-person"></i>
            </span>
            <span class="app-top-nav__user-name" v-if="!navIconOnly">{{ userNavName }}</span>
          </span>
        </ActionButton>
      </div>
    </div>

    <Transition name="app-nav-expand">
      <div class="app-top-nav__panel" ref="panelRoot" v-if="notificationsOpen || userMenuOpen">
        <TopNavNotificationsPanel
          v-if="notificationsOpen"
          :entries="logEntries"
          :is-expanded="isNotificationExpanded"
          :has-details="hasNotificationDetails"
          :message-for="notificationMessage"
          :details-for="notificationDetails"
          :timestamp-for="notificationTimestamp"
          :on-toggle-expanded="toggleNotificationExpanded"
          :on-clear="clearNotificationLog"
        />

        <TopNavUserMenu
          v-if="userMenuOpen"
          :title="userTitle"
          :subtitle="userSubtitle"
          :avatar="userAvatar"
          :details="userDetails"
          :on-profile="openMyProfile"
          :on-settings="openSettings"
          :on-support="openSupport"
          :on-logout="logout"
        />
      </div>
    </Transition>
  </nav>
</template>
