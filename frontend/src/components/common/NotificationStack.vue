<script setup>
import { computed, reactive, watch } from 'vue'
import { useApp } from '../../core/injection'
import ActionButton from './ActionButton.vue'

const app = useApp()

const notifications = computed(() => app.state.notifications)
const detailsExpanded = reactive({})

watch(
  notifications,
  (list) => {
    const activeIds = new Set(
      (Array.isArray(list) ? list : []).map((entry) => String(entry?.id || '')),
    )

    for (const id of Object.keys(detailsExpanded)) {
      if (!activeIds.has(id)) {
        delete detailsExpanded[id]
      }
    }
  },
  { immediate: true, deep: true },
)

function titleOf(n) {
  const t = String(n?.title || '').trim()
  return t || 'Notification'
}

function detailLinesOf(n) {
  const raw = String(n?.details || '')
  if (!raw) return []

  const lines = []
  const seen = new Set()
  for (const line of raw.split(/\r?\n+/)) {
    const normalized = String(line || '').trim()
    if (!normalized) continue

    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    lines.push(normalized)
  }

  return lines
}

function detailsOf(n) {
  return detailLinesOf(n).join('\n')
}

function expandedDetailsOf(n) {
  const lines = detailLinesOf(n)
  if (!lines.length) return ''

  const message = String(n?.message || '').trim()
  if (!message) {
    return lines.slice(1).join('\n')
  }

  const messageKey = message.toLowerCase()
  return lines
    .filter((line, index) => !(index === 0 && line.toLowerCase() === messageKey))
    .join('\n')
}

function messageOf(n) {
  const m = String(n?.message || '').trim()
  if (m) return m

  const [firstLine] = detailLinesOf(n)
  if (firstLine) return firstLine

  return 'No details provided.'
}

function shouldShowMessage(n) {
  const message = messageOf(n)
  if (!message) return false
  return message.toLowerCase() !== titleOf(n).toLowerCase()
}

function hasDetails(n) {
  return detailLinesOf(n).length > 0
}

function canToggleDetails(n) {
  return Boolean(expandedDetailsOf(n))
}

function isDetailsExpanded(n) {
  const id = String(n?.id || '')
  if (!id) return false
  return Boolean(detailsExpanded[id])
}

function toggleDetails(n) {
  const id = String(n?.id || '')
  if (!id) return
  detailsExpanded[id] = !detailsExpanded[id]
}

function close(id) {
  delete detailsExpanded[String(id)]
  app.service('notify').remove(id)
}

async function copyDetails(details) {
  if (!details) return
  try {
    await navigator.clipboard.writeText(details)
    app.service('notify').push({
      level: 'success',
      title: 'Copied',
      message: 'Details copied to clipboard.',
    })
  } catch {
    app.service('notify').push({
      level: 'warning',
      title: 'Clipboard Error',
      message: 'Could not copy details from browser.',
    })
  }
}
</script>

<template>
  <TransitionGroup name="notify-slide" tag="div" class="notify-stack">
    <article
      class="alert shadow-sm border-0 mb-0 notify-alert"
      :class="`notify-alert--${n.level || 'info'}`"
      v-for="n in notifications"
      :key="n.id"
    >
      <header class="d-flex align-items-center justify-content-between gap-2 mb-1">
        <h4 class="h6 mb-0">{{ titleOf(n) }}</h4>
        <ActionButton class-name="btn btn-sm btn-outline-secondary" icon="bi-x-lg" :icon-only="true" aria-label="Close notification" @click="close(n.id)" />
      </header>
      <p class="mb-2 small" v-if="shouldShowMessage(n)">{{ messageOf(n) }}</p>
      <Transition name="app-nav-expand">
        <pre class="notify-alert__details mb-2" v-if="isDetailsExpanded(n)">{{ expandedDetailsOf(n) }}</pre>
      </Transition>
      <div class="d-flex flex-wrap gap-2">
        <ActionButton
          v-if="canToggleDetails(n)"
          class-name="btn btn-sm btn-outline-secondary"
          :icon="isDetailsExpanded(n) ? 'bi-chevron-up' : 'bi-chevron-down'"
          :label="isDetailsExpanded(n) ? 'Hide details' : 'Show details'"
          @click="toggleDetails(n)"
        />
        <ActionButton
          v-if="hasDetails(n)"
          class-name="btn btn-sm btn-outline-secondary"
          icon="bi-clipboard"
          label="Copy details"
          @click="copyDetails(detailsOf(n))"
        />
        <ActionButton class-name="btn btn-sm btn-outline-secondary" label="Close" @click="close(n.id)" />
      </div>
    </article>
  </TransitionGroup>
</template>
