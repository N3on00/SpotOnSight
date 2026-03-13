<script setup>
import ActionButton from '../common/ActionButton.vue'
import AppTextField from '../common/AppTextField.vue'

const props = defineProps({
  query: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  errorText: { type: String, default: '' },
  results: { type: Array, default: () => [] },
  activeLocation: { type: Object, default: null },
})

const emit = defineEmits(['update:query', 'search', 'select', 'clear'])

function updateQuery(value) {
  emit('update:query', String(value || ''))
}

function runSearch() {
  emit('search')
}

function selectResult(result) {
  emit('select', result)
}

function clearActiveLocation() {
  emit('clear')
}
</script>

<template>
  <section class="card border-0 shadow-sm map-widget-card" data-aos="fade-up" data-aos-delay="60">
    <div class="card-body d-grid gap-3 p-3">
      <header>
        <h3 class="h6 mb-1">Find place or address</h3>
        <p class="small text-secondary mb-0">Search streets, places, and areas without leaving the app.</p>
      </header>

      <div class="map-location-search-row">
        <AppTextField
          bare
          class-name="form-control"
          :model-value="query"
          placeholder="Zurich HB, Bahnhofstrasse"
          aria-label="Search place or address"
          @update:modelValue="updateQuery"
          @enter="runSearch"
        />
        <div class="map-search-actions">
          <ActionButton
            class-name="btn btn-outline-primary"
            icon="bi-search"
            :label="busy ? 'Searching...' : 'Find place'"
            :busy="busy"
            busy-label="Searching..."
            @click="runSearch"
          />
          <ActionButton
            class-name="btn btn-outline-secondary"
            icon="bi-x-circle"
            label="Clear place"
            :disabled="!activeLocation"
            @click="clearActiveLocation"
          />
        </div>
      </div>

      <div class="small text-danger" v-if="errorText">{{ errorText }}</div>

      <div class="map-location-results" v-if="results.length">
        <ActionButton
          class-name="map-location-result"
          v-for="result in results"
          :key="`${result.id}-${result.lat}-${result.lon}`"
          :aria-label="`Select location ${result.label}`"
          @click="selectResult(result)"
        >
          <strong>{{ result.label }}</strong>
          <span class="small text-secondary">{{ result.type || 'place' }} · {{ result.lat.toFixed(4) }}, {{ result.lon.toFixed(4) }}</span>
        </ActionButton>
      </div>

      <div class="map-active-location" v-if="activeLocation">
        <span class="badge-soft badge-soft--info">Active location: {{ activeLocation.label }}</span>
      </div>
    </div>
  </section>
</template>
