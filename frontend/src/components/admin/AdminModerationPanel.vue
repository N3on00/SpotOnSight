<script setup>
import { computed } from 'vue'
import ActionButton from '../common/ActionButton.vue'

const props = defineProps({
  reports: { type: Array, default: () => [] },
  users: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
  onRefresh: { type: Function, required: true },
  onReviewReport: { type: Function, required: true },
  onUpdateUser: { type: Function, required: true },
})

const openReports = computed(() => props.reports.filter((item) => String(item?.status || 'open') === 'open'))
const watchedUsers = computed(() => props.users.filter((item) => String(item?.account_status || '') !== 'active' || Number(item?.active_strike_weight || 0) > 0))

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
            class-name="btn btn-outline-primary"
            icon="bi-arrow-clockwise"
            label="Refresh"
            :disabled="busy"
            @click="onRefresh"
          />
        </div>

        <div v-if="openReports.length" class="admin-stack">
          <article class="admin-item" v-for="report in openReports" :key="report.id">
            <div class="d-flex flex-wrap justify-content-between gap-2">
              <div>
                <strong class="d-block">{{ report.target_type }} · {{ formatReason(report.reason) }}</strong>
                <span class="text-secondary small">Target: {{ report.target_id }}</span>
              </div>
              <span class="badge text-bg-light border">{{ formatTimestamp(report.created_at) }}</span>
            </div>
            <p class="small text-secondary my-2">{{ report.details || 'No extra details provided.' }}</p>
            <div class="d-flex flex-wrap gap-2">
              <ActionButton class-name="btn btn-sm btn-outline-secondary" icon="bi-x-circle" label="Dismiss" :disabled="busy" @click="onReviewReport(report.id, { status: 'dismissed', action: 'none', severity: 'low', admin_notes: 'Dismissed by admin review.' })" />
              <ActionButton class-name="btn btn-sm btn-warning" icon="bi-flag" label="Hide + strike" :disabled="busy" @click="onReviewReport(report.id, { status: 'upheld', action: 'hide_content', severity: 'medium', admin_notes: 'Content hidden after moderation review.' })" />
              <ActionButton class-name="btn btn-sm btn-danger" icon="bi-slash-circle" label="Ban user" :disabled="busy" @click="onReviewReport(report.id, { status: 'upheld', action: 'ban_user', severity: 'high', admin_notes: 'User banned after severe or repeated violations.' })" />
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
                <strong class="d-block">{{ user.display_name || user.username }}</strong>
                <span class="text-secondary small">@{{ user.username }} · {{ user.email }}</span>
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

@media (max-width: 991px) {
  .admin-grid {
    grid-template-columns: 1fr;
  }
}
</style>
