<script setup>
import { computed, ref } from 'vue'
import ActionButton from '../common/ActionButton.vue'

const props = defineProps({
  reports: { type: Array, default: () => [] },
  users: { type: Array, default: () => [] },
  supportTickets: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
  onRefresh: { type: Function, required: true },
  onReviewReport: { type: Function, required: true },
  onUpdateUser: { type: Function, required: true },
  onOpenProfile: { type: Function, required: true },
  onGoToTarget: { type: Function, required: true },
})

const expandedReports = ref({})

const openReports = computed(() => props.reports.filter((item) => String(item?.status || 'open') === 'open'))
const watchedUsers = computed(() => props.users.filter((item) => String(item?.account_status || '') !== 'active' || Number(item?.active_strike_weight || 0) > 0))
const debugTickets = computed(() => props.supportTickets.filter((item) => String(item?.category || '') === 'bug'))

function formatReason(value) {
  return String(value || 'other').replaceAll('_', ' ')
}

function formatTimestamp(value) {
  const text = String(value || '').trim()
  if (!text) return 'Not set'
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return date.toLocaleString()
}

function reportKey(report) {
  return String(report?.id || '')
}

function reportExpanded(report) {
  return Boolean(expandedReports.value[reportKey(report)])
}

function toggleReport(report) {
  const key = reportKey(report)
  expandedReports.value = {
    ...expandedReports.value,
    [key]: !expandedReports.value[key],
  }
}

function openProfile(userId) {
  const id = String(userId || '').trim()
  if (!id) return
  props.onOpenProfile(id)
}

function displayUser(user) {
  const row = user && typeof user === 'object' ? user : null
  if (!row) return 'Unknown user'
  const display = String(row.display_name || '').trim()
  const username = String(row.username || '').trim()
  if (display && username) return `${display} (@${username})`
  return display || (username ? `@${username}` : 'Unknown user')
}

function previewLabel(report) {
  return String(report?.target_preview?.label || '').trim() || `${String(report?.target_type || 'content')} report`
}

function previewSubtitle(report) {
  return String(report?.target_preview?.subtitle || '').trim()
}

function previewBody(report) {
  return String(report?.target_preview?.body || report?.details || '').trim()
}

function canGoToTarget(report) {
  const preview = report?.target_preview
  return Number.isFinite(Number(preview?.lat))
    && Number.isFinite(Number(preview?.lon))
    || String(report?.target_type || '') === 'user'
}
</script>

<template>
  <section class="admin-grid" data-aos="fade-up" data-aos-delay="100">
    <article class="card border-0 shadow-sm admin-panel">
      <div class="card-body p-4">
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <div>
            <p class="text-uppercase text-secondary small mb-1">Queue</p>
            <h2 class="h4 mb-0">Open reports</h2>
          </div>
          <ActionButton
            class-name="btn btn-outline-primary admin-refresh-btn mobile-compact-action"
            icon="bi-arrow-clockwise"
            label="Refresh"
            aria-label="Refresh moderation data"
            :disabled="busy"
            @click="onRefresh"
          />
        </div>

        <div v-if="openReports.length" class="admin-stack">
          <article class="admin-item" v-for="report in openReports" :key="report.id">
            <div class="d-flex flex-wrap justify-content-between gap-2 align-items-start">
              <div class="admin-report-head">
                <strong class="d-block">{{ previewLabel(report) }}</strong>
                <span class="text-secondary small">{{ report.target_type }} · {{ formatReason(report.reason) }}</span>
                <span class="text-secondary small d-block" v-if="previewSubtitle(report)">{{ previewSubtitle(report) }}</span>
              </div>
              <span class="badge text-bg-light border">{{ formatTimestamp(report.created_at) }}</span>
            </div>

            <div class="admin-report-links my-2">
              <button type="button" class="admin-link-btn" v-if="report.reporter_user" @click="openProfile(report.reporter_user.id)">
                Reporter: {{ displayUser(report.reporter_user) }}
              </button>
              <button type="button" class="admin-link-btn" v-if="report.target_user" @click="openProfile(report.target_user.id)">
                Reported: {{ displayUser(report.target_user) }}
              </button>
            </div>

            <div class="admin-user-meta small text-secondary mb-2">
              <span>{{ report.target_distinct_reporter_count }} reporter(s) flagged this user</span>
              <span>{{ report.target_report_count }} total report(s) on this user/content</span>
              <span>{{ report.reporter_distinct_target_count }} distinct user target(s) reported by reporter</span>
            </div>

            <p class="small text-secondary my-2 admin-report-body">{{ previewBody(report) || 'No extra details provided.' }}</p>

            <div class="d-flex flex-wrap gap-2">
              <ActionButton
                class-name="btn btn-sm btn-outline-secondary"
                :icon="reportExpanded(report) ? 'bi-chevron-up' : 'bi-chevron-down'"
                :label="reportExpanded(report) ? 'Hide details' : 'Open report'"
                :disabled="busy"
                @click="toggleReport(report)"
              />
              <ActionButton
                v-if="canGoToTarget(report)"
                class-name="btn btn-sm btn-outline-primary"
                icon="bi-box-arrow-up-right"
                label="Go to"
                :disabled="busy"
                @click="onGoToTarget(report)"
              />
              <ActionButton class-name="btn btn-sm btn-outline-secondary" icon="bi-x-circle" label="Dismiss" :disabled="busy" @click="onReviewReport(report.id, { status: 'dismissed', action: 'none', severity: 'low', admin_notes: 'Dismissed by admin review.' })" />
              <ActionButton class-name="btn btn-sm btn-warning" icon="bi-flag" label="Hide + strike" :disabled="busy" @click="onReviewReport(report.id, { status: 'upheld', action: 'hide_content', severity: 'medium', admin_notes: 'Content hidden after moderation review.' })" />
              <ActionButton class-name="btn btn-sm btn-danger" icon="bi-slash-circle" label="Ban user" :disabled="busy" @click="onReviewReport(report.id, { status: 'upheld', action: 'ban_user', severity: 'high', admin_notes: 'User banned after severe or repeated violations.' })" />
            </div>

            <div class="admin-report-details mt-3" v-if="reportExpanded(report)">
              <div class="admin-detail-grid">
                <div>
                  <span class="text-secondary small d-block">Report ID</span>
                  <code>{{ report.id }}</code>
                </div>
                <div>
                  <span class="text-secondary small d-block">Target ID</span>
                  <code>{{ report.target_id }}</code>
                </div>
                <div>
                  <span class="text-secondary small d-block">Target owner ID</span>
                  <code>{{ report.target_owner_user_id || '-' }}</code>
                </div>
                <div>
                  <span class="text-secondary small d-block">Reporter ID</span>
                  <code>{{ report.reporter_user_id || '-' }}</code>
                </div>
                <div>
                  <span class="text-secondary small d-block">Moderation status</span>
                  <code>{{ report.target_preview?.moderation_status || 'visible' }}</code>
                </div>
                <div>
                  <span class="text-secondary small d-block">Review status</span>
                  <code>{{ report.status }}</code>
                </div>
              </div>
              <p class="small text-secondary mb-0 mt-3" v-if="report.details">Reporter notes: {{ report.details }}</p>
            </div>
          </article>
        </div>
        <p v-else class="text-secondary mb-0">No open reports right now.</p>
      </div>
    </article>

    <article class="card border-0 shadow-sm admin-panel">
      <div class="card-body p-4">
        <div class="mb-3">
          <p class="text-uppercase text-secondary small mb-1">Accounts</p>
          <h2 class="h4 mb-0">Strike watchlist</h2>
        </div>

        <div v-if="watchedUsers.length" class="admin-stack">
          <article class="admin-item" v-for="user in watchedUsers" :key="user.id">
            <div class="d-flex flex-wrap justify-content-between gap-2 align-items-start">
              <div>
                <button type="button" class="admin-link-btn admin-link-btn--title p-0 border-0 bg-transparent" @click="openProfile(user.id)">
                  {{ user.display_name || user.username }}
                </button>
                <span class="text-secondary small d-block">@{{ user.username }} · {{ user.email }}</span>
              </div>
              <span class="badge text-bg-light border">{{ user.account_status || 'active' }}</span>
            </div>
            <div class="admin-user-meta small text-secondary my-2">
              <span>{{ user.active_strike_weight }} active strike weight</span>
              <span>{{ user.recent_strike_count }} recent strike(s)</span>
              <span v-if="user.posting_timeout_until">Timeout until {{ formatTimestamp(user.posting_timeout_until) }}</span>
            </div>
            <p class="small text-secondary mb-2" v-if="user.account_status_reason">{{ user.account_status_reason }}</p>
            <div class="d-flex flex-wrap gap-2">
              <ActionButton class-name="btn btn-sm btn-outline-secondary" icon="bi-arrow-counterclockwise" label="Clear" :disabled="busy" @click="onUpdateUser(user.id, { account_status: 'active', reason: 'Restrictions cleared after admin review.', posting_timeout_until: null })" />
              <ActionButton class-name="btn btn-sm btn-outline-warning" icon="bi-hourglass-split" label="24h timeout" :disabled="busy" @click="onUpdateUser(user.id, { account_status: 'watch', reason: 'Posting restricted for 24 hours after moderation review.', posting_timeout_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() })" />
              <ActionButton class-name="btn btn-sm btn-danger" icon="bi-person-x" label="Ban" :disabled="busy" @click="onUpdateUser(user.id, { account_status: 'banned', reason: 'Account banned after repeated or severe violations.', posting_timeout_until: null })" />
            </div>
          </article>
        </div>
        <p v-else class="text-secondary mb-0">No watched or restricted users right now.</p>
      </div>
    </article>

    <article class="card border-0 shadow-sm admin-panel admin-panel--wide">
      <div class="card-body p-4">
        <div class="mb-3">
          <p class="text-uppercase text-secondary small mb-1">Diagnostics</p>
          <h2 class="h4 mb-0">Client error reports</h2>
        </div>

        <div v-if="debugTickets.length" class="admin-stack">
          <details class="admin-item" v-for="ticket in debugTickets.slice(0, 20)" :key="ticket.id">
            <summary class="admin-debug-summary">
              <span>
                <strong class="d-block">{{ ticket.subject }}</strong>
                <span class="text-secondary small">{{ formatTimestamp(ticket.createdAt) }} · {{ ticket.contactEmail || 'no contact email' }}</span>
              </span>
              <span class="badge text-bg-light border">{{ ticket.status }}</span>
            </summary>
            <p class="small text-secondary mt-3 mb-2">{{ ticket.message }}</p>
            <pre class="admin-debug-code mb-0">{{ ticket.technicalDetails || 'No technical details attached.' }}</pre>
          </details>
        </div>
        <p v-else class="text-secondary mb-0">No client debug reports yet.</p>
      </div>
    </article>
  </section>
</template>

<style scoped>
.admin-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.95fr;
  gap: 1.25rem;
}

.admin-panel {
  background: linear-gradient(180deg, color-mix(in oklab, var(--app-surface) 96%, white 4%), color-mix(in oklab, var(--app-surface-soft) 92%, rgba(255, 201, 112, 0.08) 8%));
  border: 1px solid var(--soft-line);
}

.admin-panel--wide {
  grid-column: 1 / -1;
}

.admin-stack {
  display: grid;
  gap: 0.9rem;
}

.admin-item {
  border: 1px solid var(--soft-line);
  border-radius: 1rem;
  padding: 1rem;
  background: color-mix(in oklab, var(--app-surface) 92%, var(--app-surface-soft) 8%);
}

[data-theme='dark'] .admin-item {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.admin-user-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
}

.admin-link-btn {
  border: 0;
  padding: 0;
  background: transparent;
  color: var(--bs-primary);
  text-align: left;
  text-decoration: underline;
  text-underline-offset: 0.12em;
}

.admin-link-btn--title {
  font-weight: 700;
  color: inherit;
  text-decoration: none;
}

.admin-report-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
}

.admin-report-body {
  white-space: pre-wrap;
}

.admin-report-details {
  border-top: 1px solid var(--soft-line);
  padding-top: 0.9rem;
}

.admin-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.8rem;
}

.admin-detail-grid code {
  white-space: pre-wrap;
  word-break: break-word;
}

.admin-debug-summary {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 0.8rem;
  cursor: pointer;
}

.admin-debug-code {
  max-height: 340px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  border-radius: 0.75rem;
  padding: 0.85rem;
  background: color-mix(in oklab, var(--app-surface-soft) 88%, var(--app-surface) 12%);
  border: 1px solid var(--soft-line);
}

@media (max-width: 991px) {
  .admin-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .admin-refresh-btn :deep(.action-button__label) {
    display: none;
  }

  .admin-refresh-btn {
    min-width: 2.65rem;
    padding-inline: 0.7rem;
  }
}
</style>
