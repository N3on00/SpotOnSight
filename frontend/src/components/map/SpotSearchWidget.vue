<script setup>
import { computed, ref } from 'vue'
import ActionButton from '../common/ActionButton.vue'
import AppCheckbox from '../common/AppCheckbox.vue'
import AppTextField from '../common/AppTextField.vue'
import { summarizeCollapsedFilters } from '../../models/mapFilterSummary'

const props = defineProps({
  filters: { type: Object, default: () => ({}) },
  activeLocationLabel: { type: String, default: '' },
  resultCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  canReset: { type: Boolean, default: false },
  subscriptions: { type: Array, default: () => [] },
  initialExpanded: { type: Boolean, default: false },
})

const emit = defineEmits(['update:filters', 'reset', 'subscribe', 'apply-subscription', 'remove-subscription'])
const isExpanded = ref(Boolean(props.initialExpanded))

const collapsedSummary = computed(() => {
  return summarizeCollapsedFilters(props.filters)
})

function updateField(key, value) {
  const current = props.filters && typeof props.filters === 'object' ? props.filters : {}
  emit('update:filters', {
    ...current,
    [key]: value,
  })
}

function updateRadius(value) {
  const parsed = Number(value)
  updateField('radiusKm', Number.isFinite(parsed) ? parsed : 0)
}

function subscribe() {
  emit('subscribe')
}

function applySubscription(subscription) {
  emit('apply-subscription', subscription)
}

function removeSubscription(subscription) {
  emit('remove-subscription', subscription?.id)
}
</script>

<template>
  <section class="card border-0 shadow-sm map-widget-card" data-aos="fade-up" data-aos-delay="55">
    <div class="card-body d-grid gap-3 p-3">
      <header class="d-flex flex-wrap align-items-start justify-content-between gap-2">
        <div>
          <h3 class="h6 mb-1">Search spots</h3>
          <p class="small text-secondary mb-0">Filter by text, tags, profile, visibility, and distance.</p>
        </div>
        <div class="d-flex flex-wrap align-items-center justify-content-end gap-2">
          <span class="badge-soft">{{ resultCount }} / {{ totalCount }}</span>
          <ActionButton
            class-name="btn btn-sm btn-outline-secondary"
            :icon="isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'"
            :label="isExpanded ? 'Hide filters' : 'Show filters'"
            :aria-expanded="isExpanded"
            @click="isExpanded = !isExpanded"
          />
        </div>
      </header>

      <div class="small text-secondary" v-if="!isExpanded">
        {{ collapsedSummary }}
      </div>

      <template v-else>
        <div class="map-search-grid">
          <AppTextField
            label="Search text"
            label-class="small text-secondary"
            :model-value="String(filters.text || '')"
            placeholder="Title, description"
            @update:modelValue="updateField('text', $event)"
          />

          <AppTextField
            label="Tags"
            label-class="small text-secondary"
            :model-value="String(filters.tagsText || '')"
            placeholder="nature, quiet"
            @update:modelValue="updateField('tagsText', $event)"
          />

          <AppTextField
            label="Profile"
            label-class="small text-secondary"
            :model-value="String(filters.ownerText || '')"
            placeholder="@username or name"
            @update:modelValue="updateField('ownerText', $event)"
          />

          <label>
            <span class="small text-secondary">Visibility</span>
            <select
              class="form-select"
              :value="String(filters.visibility || 'all')"
              @change="updateField('visibility', $event.target.value)"
            >
              <option value="all">All</option>
              <option value="public">Public</option>
              <option value="following">Followers only</option>
              <option value="invite_only">Invite only</option>
              <option value="personal">Personal</option>
            </select>
          </label>

          <label>
            <span class="small text-secondary">Radius</span>
            <select
              class="form-select"
              :value="Number(filters.radiusKm || 0)"
              @change="updateRadius($event.target.value)"
            >
              <option :value="0">All distances</option>
              <option :value="1">1 km</option>
              <option :value="5">5 km</option>
              <option :value="10">10 km</option>
              <option :value="25">25 km</option>
              <option :value="50">50 km</option>
            </select>
          </label>

          <AppCheckbox
            wrapper-class="app-checkbox map-search-checkbox"
            :model-value="Boolean(filters.onlyFavorites)"
            label="Only liked spots"
            @update:modelValue="updateField('onlyFavorites', $event)"
          />
        </div>

        <div class="map-active-location" v-if="activeLocationLabel">
          <span class="badge-soft badge-soft--info">Location: {{ activeLocationLabel }}</span>
        </div>

        <div class="d-flex justify-content-end" v-if="canReset">
          <ActionButton class-name="btn btn-sm btn-outline-secondary" label="Reset spot filters" @click="emit('reset')" />
        </div>

        <section class="d-grid gap-2" v-if="subscriptions.length">
          <header class="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <h4 class="h6 mb-0">Filter subscriptions</h4>
          </header>

          <article class="social-user-row" v-for="sub in subscriptions" :key="`spot-sub-${sub.id}`">
            <div class="social-user-main">
              <div>
                <div class="fw-semibold">{{ sub.label }}</div>
                <div class="small text-secondary">{{ String(sub.createdAt || '').slice(0, 10) }}</div>
              </div>
            </div>
            <div class="social-user-row__actions">
              <ActionButton
                class-name="btn btn-sm btn-outline-primary"
                icon="bi-funnel"
                label="Use"
                @click="applySubscription(sub)"
              />
              <ActionButton
                class-name="btn btn-sm btn-outline-danger"
                icon="bi-trash"
                label="Remove"
                @click="removeSubscription(sub)"
              />
            </div>
          </article>
        </section>

        <div class="d-flex justify-content-end">
          <ActionButton
            class-name="btn btn-sm btn-primary"
            icon="bi-bell"
            label="Subscribe this filter"
            @click="subscribe"
          />
        </div>
      </template>
    </div>
  </section>
</template>
