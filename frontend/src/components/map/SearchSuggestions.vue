<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  spots: { type: Array, default: () => [] },
  locationResults: { type: Array, default: () => [] },
  activeLocation: { type: Object, default: null },
  query: { type: String, default: '' },
  isOpen: { type: Boolean, default: false },
  anchor: { type: Object, default: null },
  anchorElement: { type: Object, default: null },
})

const emit = defineEmits(['select-spot', 'select-location', 'clear-location'])
const anchoredStyle = ref(null)

const isVisible = computed(() => {
  return props.isOpen
})

const dropdownStyle = computed(() => {
  if (anchoredStyle.value) return anchoredStyle.value

  const anchor = props.anchor && typeof props.anchor === 'object' ? props.anchor : null
  if (!anchor) return null

  const top = Number(anchor.top)
  const left = Number(anchor.left)
  const width = Number(anchor.width)

  if (!Number.isFinite(top) || !Number.isFinite(left) || !Number.isFinite(width)) {
    return null
  }

  return {
    top: `${top + 8}px`,
    left: `${left}px`,
    width: `${width}px`,
    maxWidth: `${width}px`,
    transform: 'none',
  }
})

function syncAnchorPosition() {
  const element = props.anchorElement
  if (!element || typeof element.getBoundingClientRect !== 'function') {
    anchoredStyle.value = null
    return
  }

  const rect = element.getBoundingClientRect()
  if (!Number.isFinite(rect.top) || !Number.isFinite(rect.left) || !Number.isFinite(rect.width)) {
    anchoredStyle.value = null
    return
  }

  anchoredStyle.value = {
    top: `${rect.bottom + 8}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    maxWidth: `${rect.width}px`,
    transform: 'none',
  }
}

watch(
  () => [props.isOpen, props.anchor, props.anchorElement],
  () => {
    syncAnchorPosition()
  },
  { immediate: true },
)

onMounted(() => {
  if (typeof window === 'undefined') return
  window.addEventListener('resize', syncAnchorPosition)
  window.addEventListener('scroll', syncAnchorPosition, true)
  syncAnchorPosition()
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('resize', syncAnchorPosition)
  window.removeEventListener('scroll', syncAnchorPosition, true)
})

const spotSuggestions = computed(() => {
  const query = props.query.trim().toLowerCase()
  if (!query || query.length < 2) return []
  const spots = Array.isArray(props.spots) ? props.spots : []
  return spots
    .filter((spot) => {
      const title = String(spot?.title || '').toLowerCase()
      const description = String(spot?.description || '').toLowerCase()
      const tags = Array.isArray(spot?.tags) ? spot.tags.join(' ').toLowerCase() : ''
      return title.includes(query) || description.includes(query) || tags.includes(query)
    })
    .slice(0, 5)
})

function handleSelectSpot(spot) {
  emit('select-spot', spot)
}

function handleSelectLocation(result) {
  emit('select-location', result)
}

function handleClearLocation() {
  emit('clear-location')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dropdown-fade">
      <div 
        v-if="isVisible && (spotSuggestions.length > 0 || locationResults.length > 0 || activeLocation)"
        class="search-suggestions-widget"
        :style="dropdownStyle"
      >
        <div v-if="spotSuggestions.length > 0" class="search-suggestions-widget__section">
          <div class="search-suggestions-widget__title">
            <i class="bi bi-pin"></i>
            Spots
          </div>
          <button
            v-for="spot in spotSuggestions"
            :key="`suggestion-spot-${spot.id}`"
            class="search-suggestions-widget__item"
            type="button"
            @click="handleSelectSpot(spot)"
          >
            <i class="bi bi-geo-alt"></i>
            <div class="search-suggestions-widget__content">
              <span class="search-suggestions-widget__item-title">{{ spot.title }}</span>
              <span class="search-suggestions-widget__item-meta">{{ spot.tags?.slice(0, 3).join(', ') || 'spot' }}</span>
            </div>
          </button>
        </div>
        
        <div v-if="locationResults.length > 0" class="search-suggestions-widget__section">
          <div class="search-suggestions-widget__title">
            <i class="bi bi-building"></i>
            Places
          </div>
          <button
            v-for="result in locationResults.slice(0, 5)"
            :key="`suggestion-loc-${result.id}-${result.lat}`"
            class="search-suggestions-widget__item"
            type="button"
            @click="handleSelectLocation(result)"
          >
            <i class="bi bi-geo-alt"></i>
            <div class="search-suggestions-widget__content">
              <span class="search-suggestions-widget__item-title">{{ result.label }}</span>
              <span class="search-suggestions-widget__item-meta">{{ result.type || 'place' }}</span>
            </div>
          </button>
        </div>
        
        <div v-if="activeLocation" class="search-suggestions-widget__section">
          <div class="search-suggestions-widget__title">
            <i class="bi bi-pin-map-fill"></i>
            Active Location
          </div>
          <button
            class="search-suggestions-widget__item search-suggestions-widget__item--active"
            type="button"
            @click="handleClearLocation"
          >
            <i class="bi bi-geo-alt-fill"></i>
            <div class="search-suggestions-widget__content">
              <span class="search-suggestions-widget__item-title">{{ activeLocation.label }}</span>
              <span class="search-suggestions-widget__item-meta">Click to clear</span>
            </div>
            <i class="bi bi-x-circle-fill search-suggestions-widget__clear"></i>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.search-suggestions-widget {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 2rem);
  max-width: 500px;
  background: var(--app-surface, #fff);
  border: 1px solid var(--soft-line, #ddd);
  border-radius: var(--bs-border-radius, 0.5rem);
  z-index: 99999;
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
  max-height: 60vh;
  overflow-y: auto;
}

.search-suggestions-widget__section {
  padding: 0.5rem 0;
}

.search-suggestions-widget__section:not(:last-child) {
  border-bottom: 1px solid var(--soft-line, #ddd);
}

.search-suggestions-widget__title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--app-text-muted, #666);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.search-suggestions-widget__item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.6rem 0.75rem;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background 150ms ease;
}

.search-suggestions-widget__item:hover {
  background: var(--app-surface-soft, #f5f5f5);
}

.search-suggestions-widget__item i {
  color: var(--bs-primary, #0d6efd);
  flex-shrink: 0;
  font-size: 1rem;
}

.search-suggestions-widget__item--active {
  background: rgba(13, 110, 253, 0.1);
}

.search-suggestions-widget__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.search-suggestions-widget__item-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--app-text, #333);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-suggestions-widget__item-meta {
  font-size: 0.75rem;
  color: var(--app-text-muted, #666);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-suggestions-widget__clear {
  color: var(--app-text-muted, #666);
  font-size: 0.9rem;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}
</style>
