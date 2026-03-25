<script setup>
import { ref, computed, watch } from 'vue'

let locationSearchTimeout = null
import LeafletSpotMap from './LeafletSpotMap.vue'
import SpotMiniCard from '../common/SpotMiniCard.vue'
import AppTextField from '../common/AppTextField.vue'
import AppCheckbox from '../common/AppCheckbox.vue'
import ActionButton from '../common/ActionButton.vue'

const props = defineProps({
  spots: { type: Array, default: () => [] },
  filteredSpots: { type: Array, default: () => [] },
  listedSpots: { type: Array, default: () => [] },
  center: { type: Array, default: () => [47.3769, 8.5417] },
  zoom: { type: Number, default: 12 },
  maxBounds: { type: Array, default: () => null },
  filters: { type: Object, default: () => ({}) },
  activeLocationLabel: { type: String, default: '' },
  resultCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  canReset: { type: Boolean, default: false },
  subscriptions: { type: Array, default: () => [] },
  locationQuery: { type: String, default: '' },
  locationSearchBusy: { type: Boolean, default: false },
  locationSearchError: { type: String, default: '' },
  locationResults: { type: Array, default: () => [] },
  activeLocation: { type: Object, default: null },
  ownerLabel: { type: Function, required: true },
  spotDistanceLabel: { type: Function, required: true },
  isFavorite: { type: Function, required: true },
  canReportSpot: { type: Function, required: true },
  canLoadMore: { type: Boolean, default: false },
  remainingCount: { type: Number, default: 0 },
  onMapTap: { type: Function, required: true },
  onMarkerSelect: { type: Function, required: true },
  onViewportChange: { type: Function, required: true },
  onUpdateFilters: { type: Function, required: true },
  onResetFilters: { type: Function, required: true },
  onSubscribeFilters: { type: Function, required: true },
  onApplySubscription: { type: Function, required: true },
  onRemoveSubscription: { type: Function, required: true },
  onUpdateLocationQuery: { type: Function, required: true },
  onSearchLocation: { type: Function, required: true },
  onSelectLocation: { type: Function, required: true },
  onClearLocation: { type: Function, required: true },
  onReload: { type: Function, required: true },
  onGoToCurrentLocation: { type: Function, required: true },
  onCreateSpot: { type: Function, required: true },
  onOpenSpot: { type: Function, required: true },
  onToggleFavorite: { type: Function, required: true },
  onLoadMore: { type: Function, required: true },
  onReportSpot: { type: Function, required: true },
})

const searchQuery = ref('')
const searchFocus = ref(false)
const filterPanelOpen = ref(false)
const resultsPanelOpen = ref(false)
const hasSearched = ref(false)

const hasActiveFilters = computed(() => {
  return Boolean(
    props.filters.text
    || props.filters.tagsText
    || props.filters.ownerText
    || props.filters.visibility !== 'all'
    || props.filters.onlyFavorites
    || Number(props.filters.radiusKm || 0) > 0
    || props.activeLocation
  )
})

const showSearchDropdown = computed(() => {
  return searchFocus.value && (
    (props.locationResults.length > 0) ||
    props.activeLocation ||
    spotSuggestions.value.length > 0
  )
})

const spotSuggestions = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query || query.length < 2) return []
  const spots = Array.isArray(props.spots) ? props.spots : []
  return spots
    .filter(spot => spot.title.toLowerCase().includes(query))
    .slice(0, 5)
})

watch(() => props.locationResults, () => {
  // Results updated
}, { deep: true })

const searchText = computed({
  get: () => props.filters.text || '',
  set: (val) => updateField('text', val),
})

const tagsText = computed({
  get: () => props.filters.tagsText || '',
  set: (val) => updateField('tagsText', val),
})

const ownerText = computed({
  get: () => props.filters.ownerText || '',
  set: (val) => updateField('ownerText', val),
})

const visibility = computed({
  get: () => props.filters.visibility || 'all',
  set: (val) => updateField('visibility', val),
})

const radiusKm = computed({
  get: () => Number(props.filters.radiusKm || 0),
  set: (val) => updateRadius(val),
})

const onlyFavorites = computed({
  get: () => Boolean(props.filters.onlyFavorites),
  set: (val) => updateField('onlyFavorites', val),
})

const locationQueryLocal = computed({
  get: () => props.locationQuery,
  set: (val) => props.onUpdateLocationQuery(val),
})

watch(searchQuery, (val) => {
  props.onUpdateLocationQuery(val)
})

function toggleFilterPanel() {
  filterPanelOpen.value = !filterPanelOpen.value
}

function toggleResultsPanel() {
  resultsPanelOpen.value = !resultsPanelOpen.value
}

function updateField(key, value) {
  const current = props.filters && typeof props.filters === 'object' ? props.filters : {}
  props.onUpdateFilters({
    ...current,
    [key]: value,
  })
}

function updateRadius(value) {
  const parsed = Number(value)
  updateField('radiusKm', Number.isFinite(parsed) ? parsed : 0)
}

function runLocationSearch() {
  clearTimeout(locationSearchTimeout)
  const query = searchQuery.value.trim()
  if (query) {
    searchText.value = query
  }
  props.onSearchLocation()
  if (query) {
    resultsPanelOpen.value = true
    hasSearched.value = true
  }
}

function handleSearchInput(val) {
  const query = String(val || '').trim()
  if (query.length >= 2) {
    props.onUpdateLocationQuery(query)
    clearTimeout(locationSearchTimeout)
    locationSearchTimeout = setTimeout(() => {
      props.onSearchLocation()
    }, 300)
  }
}

function selectLocation(result) {
  props.onSelectLocation(result)
  resultsPanelOpen.value = true
  hasSearched.value = true
  searchFocus.value = false
}

function clearLocation() {
  props.onClearLocation()
  searchQuery.value = ''
  searchText.value = ''
  hasSearched.value = false
  searchFocus.value = false
}

function handleOpenSpot(spot) {
  props.onOpenSpot(spot)
  searchFocus.value = false
}

function handleToggleFavorite(spot) {
  props.onToggleFavorite(spot)
}

function selectSpotResult(spot) {
  handleOpenSpot(spot)
  searchQuery.value = ''
}

function handleSearchFocus() {
  searchFocus.value = true
}

function handleSearchBlur() {
  setTimeout(() => {
    searchFocus.value = false
  }, 200)
}

function clearSearch() {
  searchQuery.value = ''
  props.onUpdateLocationQuery('')
  searchText.value = ''
  hasSearched.value = false
}
</script>

<template>
  <div class="fullscreen-map">
    <div class="fullscreen-map__toolbar">
      <div class="fullscreen-map__toolbar-row">
        <div class="fullscreen-map__toolbar-brand">
          <i class="bi bi-compass-fill"></i>
        </div>
        
        <div class="fullscreen-map__search-container" @click.stop>
          <div class="fullscreen-map__search-bar">
            <AppTextField
              bare
              class-name="form-control fullscreen-map__search-input"
              placeholder="Search spots or places..."
              v-model="searchQuery"
              aria-label="Search spots or places"
              @focus="handleSearchFocus"
              @blur="handleSearchBlur"
              @update:model-value="handleSearchInput"
              @enter="runLocationSearch"
            />
            <div class="fullscreen-map__search-actions">
              <button 
                class="fullscreen-map__search-clear"
                v-if="searchQuery"
                @click="clearSearch"
                type="button"
              >
                <i class="bi bi-x"></i>
              </button>
              <button 
                class="fullscreen-map__search-submit"
                v-if="locationQueryLocal || searchQuery"
                @click="runLocationSearch"
                :disabled="locationSearchBusy"
                type="button"
              >
                <i class="bi bi-search"></i>
              </button>
            </div>
          </div>
          
          <Transition name="dropdown-fade">
            <div class="fullscreen-map__search-dropdown" v-if="showSearchDropdown">
              <div v-if="spotSuggestions.length > 0" class="fullscreen-map__search-section">
                <div class="fullscreen-map__search-section-title">
                  <i class="bi bi-pin"></i>
                  Spots
                </div>
                <button
                  class="fullscreen-map__search-result"
                  v-for="spot in spotSuggestions"
                  :key="`search-spot-${spot.id}`"
                  @click="selectSpotResult(spot)"
                  type="button"
                >
                  <i class="bi bi-geo-alt"></i>
                  <div class="fullscreen-map__search-result-content">
                    <span class="fullscreen-map__search-result-title">{{ spot.title }}</span>
                    <span class="fullscreen-map__search-result-meta">{{ spot.tags?.slice(0, 3).join(', ') || 'spot' }}</span>
                  </div>
                </button>
              </div>
              
              <div v-if="props.locationResults.length > 0" class="fullscreen-map__search-section">
                <div class="fullscreen-map__search-section-title">
                  <i class="bi bi-building"></i>
                  Places
                </div>
                <button
                  class="fullscreen-map__search-result"
                  v-for="result in props.locationResults.slice(0, 5)"
                  :key="`search-loc-${result.id}-${result.lat}`"
                  @click="selectLocation(result)"
                  type="button"
                >
                  <i class="bi bi-geo-alt"></i>
                  <div class="fullscreen-map__search-result-content">
                    <span class="fullscreen-map__search-result-title">{{ result.label }}</span>
                    <span class="fullscreen-map__search-result-meta">{{ result.type || 'place' }}</span>
                  </div>
                </button>
              </div>
              
              <div v-if="props.activeLocation" class="fullscreen-map__search-section">
                <div class="fullscreen-map__search-section-title">
                  <i class="bi bi-pin-map-fill"></i>
                  Active Location
                </div>
                <button
                  class="fullscreen-map__search-result fullscreen-map__search-result--active"
                  @click="clearLocation"
                  type="button"
                >
                  <i class="bi bi-geo-alt-fill"></i>
                  <div class="fullscreen-map__search-result-content">
                    <span class="fullscreen-map__search-result-title">{{ props.activeLocation.label }}</span>
                    <span class="fullscreen-map__search-result-meta">Click to clear</span>
                  </div>
                  <i class="bi bi-x-circle-fill fullscreen-map__search-result-clear"></i>
                </button>
              </div>
            </div>
          </Transition>
        </div>
        
        <div class="fullscreen-map__toolbar-actions">
          <ActionButton
            class-name="btn btn-outline-secondary fullscreen-map__toolbar-btn"
            icon="bi-crosshair"
            icon-only
            label="Current location"
            @click="onGoToCurrentLocation"
          />
          
          <ActionButton
            class-name="btn btn-primary fullscreen-map__toolbar-btn"
            icon="bi-plus-circle"
            icon-only
            label="New spot"
            @click="onCreateSpot"
          />
        </div>
      </div>
      
      <div class="fullscreen-map__toolbar-meta">
        <span class="fullscreen-map__count">
          {{ resultCount }} {{ resultCount === 1 ? 'spot' : 'spots' }}
          <span v-if="hasActiveFilters" class="fullscreen-map__count-filtered">filtered</span>
          <span v-if="resultCount !== totalCount" class="fullscreen-map__count-total">of {{ totalCount }}</span>
        </span>
        
        <div class="fullscreen-map__toolbar-toggles">
          <button 
            class="fullscreen-map__toggle"
            :class="{ 'fullscreen-map__toggle--active': filterPanelOpen }"
            @click="toggleFilterPanel"
          >
            <i class="bi bi-sliders"></i>
            Filters
            <span v-if="hasActiveFilters" class="fullscreen-map__toggle-dot"></span>
          </button>
          
          <button 
            class="fullscreen-map__toggle"
            :class="{ 'fullscreen-map__toggle--active': resultsPanelOpen }"
            @click="toggleResultsPanel"
          >
            <i class="bi bi-list"></i>
            Results
          </button>
          
          <ActionButton
            class-name="btn btn-sm btn-outline-secondary"
            icon="bi-arrow-repeat"
            label="Reload"
            @click="onReload"
          />
        </div>
      </div>

      <Transition name="filter-slide">
        <div class="fullscreen-map__filter-panel" v-if="filterPanelOpen">
          <div class="fullscreen-map__filter-inner">
            <div class="fullscreen-map__filter-section">
              <label class="fullscreen-map__filter-label">Quick Location</label>
              <div class="fullscreen-map__location-row">
                <AppTextField
                  bare
                  class-name="form-control"
                  placeholder="Find place or address..."
                  v-model="locationQueryLocal"
                  @enter="runLocationSearch"
                />
                <ActionButton
                  class-name="btn btn-outline-primary"
                  icon="bi-search"
                  icon-only
                  :label="locationSearchBusy ? 'Searching...' : 'Search'"
                  :disabled="locationSearchBusy || !locationQueryLocal"
                  @click="runLocationSearch"
                />
                <ActionButton
                  class-name="btn btn-outline-secondary"
                  icon="bi-x-circle"
                  icon-only
                  label="Clear"
                  :disabled="!activeLocation"
                  @click="clearLocation"
                />
              </div>
              
              <div class="fullscreen-map__location-results" v-if="locationResults.length">
                <button
                  class="fullscreen-map__location-result"
                  v-for="result in locationResults.slice(0, 3)"
                  :key="`filter-loc-${result.id}-${result.lat}`"
                  @click="selectLocation(result)"
                >
                  <i class="bi bi-geo-alt"></i>
                  <span>{{ result.label }}</span>
                  <small class="text-muted">{{ result.type || 'place' }}</small>
                </button>
              </div>
              
              <div class="fullscreen-map__active-location" v-if="activeLocation">
                <i class="bi bi-pin-map"></i>
                {{ activeLocation.label }}
              </div>
            </div>
            
            <div class="fullscreen-map__filter-row">
              <div class="fullscreen-map__filter-group">
                <label class="fullscreen-map__filter-label">Tags</label>
                <AppTextField
                  bare
                  class-name="form-control form-control-sm"
                  placeholder="nature, quiet..."
                  v-model="tagsText"
                />
              </div>
              
              <div class="fullscreen-map__filter-group">
                <label class="fullscreen-map__filter-label">Profile</label>
                <AppTextField
                  bare
                  class-name="form-control form-control-sm"
                  placeholder="@username"
                  v-model="ownerText"
                />
              </div>
            </div>
            
            <div class="fullscreen-map__filter-row">
              <div class="fullscreen-map__filter-group">
                <label class="fullscreen-map__filter-label">Visibility</label>
                <select 
                  class="form-select form-select-sm"
                  v-model="visibility"
                >
                  <option value="all">All</option>
                  <option value="public">Public</option>
                  <option value="following">Followers</option>
                  <option value="invite_only">Invite</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
              
              <div class="fullscreen-map__filter-group">
                <label class="fullscreen-map__filter-label">Radius</label>
                <select 
                  class="form-select form-select-sm"
                  v-model="radiusKm"
                >
                  <option :value="0">Any</option>
                  <option :value="1">1 km</option>
                  <option :value="5">5 km</option>
                  <option :value="10">10 km</option>
                  <option :value="25">25 km</option>
                  <option :value="50">50 km</option>
                  <option :value="100">100 km</option>
                </select>
              </div>
            </div>
            
            <div class="fullscreen-map__filter-footer">
              <AppCheckbox
                wrapper-class="app-checkbox"
                v-model="onlyFavorites"
                label="Liked spots only"
              />
              
              <button 
                class="btn btn-sm btn-link text-secondary"
                v-if="canReset"
                @click="onResetFilters"
              >
                Reset all
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <div class="fullscreen-map__content">
      <div class="fullscreen-map__map">
        <LeafletSpotMap
          :spots="filteredSpots"
          :center="center"
          :zoom="zoom"
          :max-bounds="maxBounds"
          :on-map-tap="onMapTap"
          :on-marker-select="onMarkerSelect"
          :on-viewport-change="onViewportChange"
        />
      </div>
      
      <Transition name="results-slide">
        <div class="fullscreen-map__results" v-if="resultsPanelOpen">
          <div class="fullscreen-map__results-header">
            <span class="fullscreen-map__results-title">
              <i class="bi bi-list-ul"></i>
              Results
            </span>
            <button class="fullscreen-map__results-close" @click="toggleResultsPanel">
              <i class="bi bi-chevron-down"></i>
            </button>
          </div>
          
          <div class="fullscreen-map__location-result-item" v-if="activeLocation">
            <div class="fullscreen-map__location-result-header">
              <i class="bi bi-pin-map-fill text-primary"></i>
              <span>{{ activeLocation.label }}</span>
            </div>
            <button 
              class="btn btn-sm btn-outline-secondary"
              @click="clearLocation"
            >
              Clear
            </button>
          </div>
          
          <div class="fullscreen-map__results-list" v-if="filteredSpots.length">
            <SpotMiniCard
              v-for="spot in listedSpots"
              :key="`map-spot-${spot.id}`"
              :spot="spot"
              :owner-label="ownerLabel(spot)"
              :distance-label="spotDistanceLabel(spot)"
              :interactive="true"
              :can-report="canReportSpot(spot)"
              :on-report="onReportSpot"
              @open="handleOpenSpot"
            >
              <template #top-actions>
                <div class="spot-card-mini__quick-actions">
                  <ActionButton
                    :class-name="isFavorite(spot) ? 'btn btn-sm btn-warning' : 'btn btn-sm btn-outline-warning'"
                    :icon="isFavorite(spot) ? 'bi-heart-fill' : 'bi-heart'"
                    :icon-only="true"
                    :aria-label="isFavorite(spot) ? 'Unlike spot' : 'Like spot'"
                    @click.stop="handleToggleFavorite(spot)"
                  />
                  <ActionButton
                    class-name="btn btn-sm btn-outline-secondary"
                    label="Details"
                    @click.stop="handleOpenSpot(spot)"
                  />
                </div>
              </template>
            </SpotMiniCard>
            
            <div class="fullscreen-map__load-more" v-if="canLoadMore">
              <button 
                class="btn btn-sm btn-outline-primary"
                @click="onLoadMore"
              >
                Load {{ remainingCount > 10 ? 10 : remainingCount }} more ({{ remainingCount }} left)
              </button>
            </div>
          </div>
          
          <div class="fullscreen-map__results-empty" v-else>
            <i class="bi bi-map"></i>
            <p>No spots match your filters</p>
            <button 
              class="btn btn-sm btn-outline-secondary"
              v-if="canReset"
              @click="onResetFilters"
            >
              Reset filters
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.fullscreen-map {
  position: fixed;
  inset: 0;
  z-index: 1150;
  background: var(--app-body-bg);
}

.fullscreen-map__content {
  position: absolute;
  inset: 0;
  z-index: 1;
}

@media (min-width: 768px) {
  .fullscreen-map {
    display: flex;
    flex-direction: row;
  }

  .fullscreen-map__content {
    position: relative;
    flex: 1;
  }
}

.fullscreen-map__toolbar {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  right: 0.75rem;
  z-index: 100;
  background: var(--app-surface);
  backdrop-filter: blur(12px);
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  border-radius: var(--bs-border-radius-lg);
  border: 1px solid var(--soft-line);
  box-shadow: var(--surface-shadow);
  max-height: calc(100vh - 1.5rem);
  overflow-y: auto;
}

@media (min-width: 768px) {
  .fullscreen-map__toolbar {
    position: relative;
    top: auto;
    left: auto;
    right: auto;
    flex: 0 0 auto;
    margin: 0.75rem;
    width: auto;
    max-width: 400px;
    max-height: none;
  }
}

.fullscreen-map__toolbar-row {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}

.fullscreen-map__toolbar-brand {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bs-primary);
  color: var(--btn-primary-text);
  border-radius: var(--bs-border-radius);
  font-size: 1.1rem;
  flex-shrink: 0;
}

.fullscreen-map__search-container {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 2000;
}

.fullscreen-map__search-bar {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--app-surface-soft);
  border: 1px solid var(--soft-line);
  border-radius: var(--bs-border-radius);
  padding: 0 0.5rem;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

.fullscreen-map__search-bar:focus-within {
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 2px var(--interactive-ring);
}

.fullscreen-map__search-input {
  flex: 1;
  border: none;
  background: transparent;
  height: 2.5rem;
  padding: 0;
  box-shadow: none !important;
}

.fullscreen-map__search-input:focus {
  box-shadow: none !important;
}

.fullscreen-map__search-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.fullscreen-map__search-clear,
.fullscreen-map__search-submit {
  width: 1.8rem;
  height: 1.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--app-text-muted);
  transition: background 150ms ease, color 150ms ease;
}

.fullscreen-map__search-clear:hover,
.fullscreen-map__search-submit:hover {
  background: var(--interactive-ring-soft);
  color: var(--app-text);
}

.fullscreen-map__search-submit {
  color: var(--bs-primary);
}

.fullscreen-map__search-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.25rem;
  background: var(--app-surface);
  border: 1px solid var(--soft-line);
  border-radius: var(--bs-border-radius);
  z-index: 2000;
  box-shadow: var(--surface-shadow);
  max-height: 60vh;
  overflow-y: auto;
  z-index: 10;
}

.fullscreen-map__search-section {
  padding: 0.5rem 0;
}

.fullscreen-map__search-section:not(:last-child) {
  border-bottom: 1px solid var(--soft-line);
}

.fullscreen-map__search-section-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--app-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.fullscreen-map__search-result {
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

.fullscreen-map__search-result:hover {
  background: var(--app-surface-soft);
}

.fullscreen-map__search-result i {
  color: var(--bs-primary);
  flex-shrink: 0;
  font-size: 1rem;
}

.fullscreen-map__search-result--active {
  background: var(--interactive-ring-soft);
}

.fullscreen-map__search-result-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.fullscreen-map__search-result-title {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fullscreen-map__search-result-meta {
  font-size: 0.75rem;
  color: var(--app-text-muted);
}

.fullscreen-map__search-result-clear {
  color: var(--app-text-muted) !important;
  font-size: 0.9rem !important;
}

.fullscreen-map__toolbar-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.fullscreen-map__toolbar-btn {
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fullscreen-map__toolbar-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.fullscreen-map__count {
  font-size: 0.85rem;
  color: var(--app-text-muted);
}

.fullscreen-map__count-filtered {
  color: var(--bs-primary);
  font-weight: 500;
}

.fullscreen-map__count-total {
  color: var(--app-text-muted);
}

.fullscreen-map__toolbar-toggles {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.fullscreen-map__toggle {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  background: var(--app-surface-soft);
  border: 1px solid var(--soft-line);
  border-radius: var(--bs-border-radius);
  font-size: 0.85rem;
  color: var(--app-text);
  cursor: pointer;
  transition: all 150ms ease;
  position: relative;
}

.fullscreen-map__toggle:hover {
  background: var(--interactive-ring-soft);
}

.fullscreen-map__toggle--active {
  color: var(--bs-primary);
  border-color: var(--bs-primary);
  background: var(--interactive-ring-soft);
}

.fullscreen-map__toggle-dot {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  width: 0.5rem;
  height: 0.5rem;
  background: var(--bs-primary);
  border-radius: 50%;
}

.fullscreen-map__filter-panel {
  flex-shrink: 0;
  background: var(--app-surface);
  border-bottom: 1px solid var(--soft-line);
  max-height: 50vh;
  overflow-y: auto;
}

.fullscreen-map__filter-inner {
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.fullscreen-map__filter-section {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.fullscreen-map__filter-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--app-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin: 0;
}

.fullscreen-map__location-row {
  display: flex;
  gap: 0.4rem;
}

.fullscreen-map__location-row .form-control {
  flex: 1;
}

.fullscreen-map__location-row .btn {
  flex-shrink: 0;
  width: 2.2rem;
  height: 2.2rem;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fullscreen-map__location-results {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.fullscreen-map__location-result {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  background: var(--app-surface-soft);
  border: 1px solid var(--soft-line);
  border-radius: var(--bs-border-radius);
  font-size: 0.85rem;
  color: var(--app-text);
  cursor: pointer;
  transition: background 150ms ease;
  text-align: left;
}

.fullscreen-map__location-result:hover {
  background: var(--interactive-ring-soft);
}

.fullscreen-map__location-result i {
  color: var(--bs-primary);
  flex-shrink: 0;
}

.fullscreen-map__location-result span {
  flex: 1;
}

.fullscreen-map__location-result small {
  font-size: 0.75rem;
}

.fullscreen-map__active-location {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.6rem;
  background: var(--interactive-ring-soft);
  border-radius: var(--bs-border-radius);
  font-size: 0.85rem;
  color: var(--bs-primary);
  margin-top: 0.25rem;
}

.fullscreen-map__filter-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.6rem;
}

.fullscreen-map__filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.fullscreen-map__filter-group .form-select,
.fullscreen-map__filter-group input {
  font-size: 0.9rem;
  padding: 0.45rem 0.6rem;
}

.fullscreen-map__filter-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.25rem;
  border-top: 1px solid var(--soft-line);
}

.fullscreen-map__filter-footer .app-checkbox {
  font-size: 0.9rem;
}

.fullscreen-map__map {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.fullscreen-map__map :deep(.leaflet-map-shell) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.fullscreen-map__map :deep(.leaflet-map) {
  width: 100%;
  height: 100%;
}

.fullscreen-map__results {
  position: absolute;
  bottom: 0.75rem;
  left: 0.75rem;
  right: 0.75rem;
  z-index: 100;
  max-height: 45vh;
  background: var(--app-surface);
  border-radius: var(--bs-border-radius-lg);
  border: 1px solid var(--soft-line);
  box-shadow: var(--surface-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.fullscreen-map__results-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--soft-line);
}

.fullscreen-map__results-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
  font-size: 0.9rem;
}

.fullscreen-map__results-close {
  width: 1.8rem;
  height: 1.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-surface-soft);
  border: 1px solid var(--soft-line);
  border-radius: 50%;
  cursor: pointer;
  transition: background 150ms ease;
}

.fullscreen-map__results-close:hover {
  background: var(--interactive-ring-soft);
}

.fullscreen-map__location-result-item {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--soft-line);
  background: var(--app-surface-soft);
}

.fullscreen-map__location-result-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 500;
  font-size: 0.85rem;
}

.fullscreen-map__results-list {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.fullscreen-map__load-more {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 0.5rem;
  border-top: 1px solid var(--soft-line);
}

.fullscreen-map__results-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--app-text-muted);
  text-align: center;
}

.fullscreen-map__results-empty i {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
  opacity: 0.5;
}

.fullscreen-map__results-empty p {
  margin: 0 0 0.75rem;
}

.filter-slide-enter-active,
.filter-slide-leave-active {
  transition: max-height 280ms ease, opacity 220ms ease;
  overflow: hidden;
}

.filter-slide-enter-from,
.filter-slide-leave-to {
  max-height: 0;
  opacity: 0;
}

.filter-slide-enter-to,
.filter-slide-leave-from {
  max-height: 50vh;
  opacity: 1;
}

.results-slide-enter-active,
.results-slide-leave-active {
  transition: transform 280ms ease, opacity 220ms ease;
}

.results-slide-enter-from,
.results-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.fullscreen-map__toolbar {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  right: 0.75rem;
  z-index: 100;
  background: var(--app-surface);
  backdrop-filter: blur(12px);
  padding: 0.6rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  border-radius: var(--bs-border-radius-lg);
  border: 1px solid var(--soft-line);
  box-shadow: var(--surface-shadow);
  max-height: calc(100vh - 1.5rem);
  overflow-y: auto;
}

.fullscreen-map__results {
  position: absolute;
  bottom: 0.75rem;
  left: 0.75rem;
  right: 0.75rem;
  max-height: 45vh;
  border-radius: var(--bs-border-radius-lg);
  border: 1px solid var(--soft-line);
  box-shadow: var(--surface-shadow);
}

@media (min-width: 768px) {
  .fullscreen-map__results {
    left: auto;
    right: 0.75rem;
    bottom: 0.75rem;
    width: 380px;
    max-height: 60vh;
  }
}

@media (max-width: 600px) {
  .fullscreen-map__toolbar-brand {
    display: none;
  }
  
  .fullscreen-map__filter-row {
    grid-template-columns: 1fr;
  }
  
  .fullscreen-map__toolbar-toggles .btn {
    display: none;
  }
}
</style>
