<script setup>
import ActionButton from '../common/ActionButton.vue'

defineProps({
  entries: { type: Array, default: () => [] },
  categoryOptions: { type: Array, default: () => [] },
  activeCategory: { type: String, default: 'all' },
  categoryFor: { type: Function, required: true },
  isExpanded: { type: Function, required: true },
  hasDetails: { type: Function, required: true },
  messageFor: { type: Function, required: true },
  detailsFor: { type: Function, required: true },
  timestampFor: { type: Function, required: true },
  onToggleExpanded: { type: Function, required: true },
  onSelectCategory: { type: Function, required: true },
  onClear: { type: Function, required: true },
})
</script>

<template>
  <section class="card border-0 shadow-sm app-top-nav__panel-card">
    <div class="app-top-nav__panel-header">
      <h4 class="h6 mb-0">Notification log</h4>
      <ActionButton
        class-name="btn btn-sm btn-outline-secondary"
        label="Clear log"
        :disabled="!entries.length"
        @click="onClear"
      />
    </div>

    <div class="d-flex flex-wrap gap-2 mb-3" v-if="categoryOptions.length">
      <ActionButton
        v-for="option in categoryOptions"
        :key="option.key"
        :class-name="activeCategory === option.key ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary'"
        :label="`${option.label} (${option.count})`"
        @click="onSelectCategory(option.key)"
      />
    </div>

    <div class="app-top-nav__notification-list" v-if="entries.length">
      <article class="app-top-nav__notification-item" v-for="entry in entries" :key="`log-${entry.id}-${entry.createdAt}`">
        <div class="app-top-nav__notification-title-row">
          <div class="d-flex flex-wrap align-items-center gap-2">
            <strong>{{ entry.title || 'Notification' }}</strong>
            <span class="badge text-bg-light border">{{ categoryFor(entry) }}</span>
          </div>
          <span class="small text-secondary">{{ timestampFor(entry) }}</span>
        </div>

        <p class="small mb-0 app-top-nav__notification-message">{{ messageFor(entry) }}</p>

        <div class="app-top-nav__notification-actions" v-if="hasDetails(entry)">
          <ActionButton
            class-name="btn btn-sm btn-link p-0"
            :icon="isExpanded(entry) ? 'bi-chevron-up' : 'bi-chevron-down'"
            :label="isExpanded(entry) ? 'Hide details' : 'Show details'"
            @click="onToggleExpanded(entry)"
          />
        </div>

        <pre class="app-top-nav__notification-details" v-if="isExpanded(entry)">{{ detailsFor(entry) }}</pre>
      </article>
    </div>

    <p class="small text-secondary mb-0" v-else>No notifications in this category yet.</p>
  </section>
</template>
