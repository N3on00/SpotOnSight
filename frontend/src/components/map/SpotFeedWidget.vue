<script setup>
import { computed, ref, watch } from 'vue'
import { SPOT_FEED_SCOPES, getScopeLabel, getScopeIcon, isValidScope } from '../../models/spotFeedScopes'
import { getStoredLocation, updateStoredRadius } from '../../services/geolocationService'
import { distanceKm, normalizeSearchText, tokenize } from '../../utils/sanitizers'
import ActionButton from '../common/ActionButton.vue'
import SpotMiniCard from '../common/SpotMiniCard.vue'

const props = defineProps({
  spots: { type: Array, default: () => [] },
  filters: { type: Object, default: () => ({}) },
  activeScope: { type: String, default: SPOT_FEED_SCOPES.ALL },
  nearRadiusKm: { type: Number, default: 25 },
  currentUserId: { type: String, default: '' },
  onReportSpot: { type: Function, default: null },
})

const emit = defineEmits([
  'update:activeScope',
  'update:near-radius-km',
  'open-spot',
  'go-to-spot',
  'like-spot',
  'share-spot',
  'comment-spot',
  'visit-owner',
])

const localRadius = ref(props.nearRadiusKm)
const showRadiusPicker = ref(false)

const scopes = Object.values(SPOT_FEED_SCOPES)

const activeScopeLocal = computed({
  get: () => isValidScope(props.activeScope) ? props.activeScope : SPOT_FEED_SCOPES.ALL,
  set: (value) => {
    if (isValidScope(value)) {
      emit('update:activeScope', value)
    }
  },
})

watch(
  () => Number(props.nearRadiusKm || 25),
  (next) => {
    localRadius.value = Math.max(1, Math.min(500, Number(next) || 25))
  },
)

const nearLocation = computed(() => {
  return getStoredLocation()
})

const filteredByScope = computed(() => {
  let result = [...props.spots]

  if (activeScopeLocal.value === SPOT_FEED_SCOPES.NEAR && nearLocation.value) {
    const lat = nearLocation.value.lat
    const lon = nearLocation.value.lon
    const radius = localRadius.value

    result = result.filter((spot) => {
      const spotLat = Number(spot.lat)
      const spotLon = Number(spot.lon)
      if (!Number.isFinite(spotLat) || !Number.isFinite(spotLon)) return false

      const dist = distanceKm(lat, lon, spotLat, spotLon)
      return dist <= radius
    })
  }

  if (activeScopeLocal.value === SPOT_FEED_SCOPES.FILTER && props.filters) {
    const normalizedFilterText = normalizeSearchText(props.filters.text)
    const filterTags = normalizeSearchText(props.filters.tagsText)

    if (normalizedFilterText || filterTags) {
      const tokens = normalizedFilterText ? tokenize(normalizedFilterText) : []
      const tagTokens = filterTags ? tokenize(filterTags) : []

      result = result.filter((spot) => {
        const title = normalizeSearchText(spot.title)
        const desc = normalizeSearchText(spot.description)
        const tags = Array.isArray(spot.tags) ? spot.tags.map((t) => normalizeSearchText(t)) : []

        if (tokens.length > 0) {
          const matchesText = tokens.some(
            (t) => title.includes(t) || desc.includes(t)
          )
          if (!matchesText) return false
        }

        if (tagTokens.length > 0) {
          const matchesTags = tagTokens.every((t) =>
            tags.some((tag) => tag.includes(t))
          )
          if (!matchesTags) return false
        }

        return true
      })
    }
  }

  return result
})

function setScope(scope) {
  activeScopeLocal.value = scope
}

function applyRadius() {
  updateStoredRadius(localRadius.value)
  emit('update:near-radius-km', localRadius.value)
  showRadiusPicker.value = false
}

function handleRadiusChange(e) {
  localRadius.value = Math.max(1, Math.min(500, Number(e.target.value) || 25))
}

function emitOpenSpot(spot) {
  emit('open-spot', spot)
}

function emitGoToSpot(spot) {
  emit('go-to-spot', spot)
}

function emitLikeSpot(spot) {
  emit('like-spot', spot)
}

function emitCommentSpot(spot) {
  emit('comment-spot', spot)
}

function emitShareSpot(spot) {
  emit('share-spot', spot)
}

function emitVisitOwner(spot) {
  emit('visit-owner', spot)
}
</script>

<template>
  <section class="spot-feed-widget card border-0 shadow-sm" data-aos="fade-up" data-aos-delay="30">
    <div class="card-body p-3">
      <header class="spot-feed-widget__header mb-3">
        <div class="spot-feed-widget__tabs d-flex flex-wrap gap-2">
          <ActionButton
            v-for="scope in scopes"
            :key="`scope-${scope}`"
            :class-name="activeScopeLocal === scope ? 'btn btn-primary btn-sm' : 'btn btn-outline-secondary btn-sm'"
            :icon="getScopeIcon(scope)"
            :label="getScopeLabel(scope)"
            @click="setScope(scope)"
          />
        </div>

        <div v-if="activeScopeLocal === SPOT_FEED_SCOPES.NEAR" class="spot-feed-widget__radius mt-2">
          <button
            type="button"
            class="btn btn-link btn-sm p-0 text-decoration-none"
            @click="showRadiusPicker = !showRadiusPicker"
          >
            <i class="bi bi-rulers me-1"></i>
            {{ localRadius }} km radius
          </button>

          <div v-if="showRadiusPicker" class="spot-feed-widget__radius-picker mt-2 p-2 border rounded bg-light">
            <label class="form-label small mb-1">Radius: {{ localRadius }} km</label>
            <input
              type="range"
              class="form-range"
              min="1"
              max="100"
              :value="localRadius"
              @input="handleRadiusChange"
            />
            <div class="d-flex justify-content-between small text-muted">
              <span>1 km</span>
              <span>100 km</span>
            </div>
            <ActionButton
              class-name="btn btn-primary btn-sm mt-2"
              label="Apply"
              @click="applyRadius"
            />
          </div>
        </div>
      </header>

      <div class="spot-feed-widget__results">
        <p v-if="filteredByScope.length === 0" class="text-muted small mb-0">
          No spots found for this scope.
        </p>

        <div v-else class="spot-feed-widget__list d-grid gap-3">
          <SpotMiniCard
            v-for="spot in filteredByScope"
            :key="`feed-spot-${spot.id || spot._id}`"
            :spot="spot"
            :interactive="true"
            show-go-to
            :can-report="String(spot?.owner_id || '').trim() !== String(currentUserId || '').trim() && typeof onReportSpot === 'function'"
            :on-report="onReportSpot"
            @open="emitOpenSpot(spot)"
            @go-to="emitGoToSpot(spot)"
            @owner-click="emitVisitOwner(spot)"
          >
            <template #actions>
              <ActionButton
                class-name="btn btn-sm btn-outline-danger"
                icon="bi-heart"
                label="Like"
                @click.stop="emitLikeSpot(spot)"
              />
              <ActionButton
                class-name="btn btn-sm btn-outline-secondary"
                icon="bi-chat"
                label="Comment"
                @click.stop="emitCommentSpot(spot)"
              />
              <ActionButton
                class-name="btn btn-sm btn-outline-primary"
                icon="bi-share"
                label="Share"
                @click.stop="emitShareSpot(spot)"
              />
            </template>
          </SpotMiniCard>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.spot-feed-widget__radius-picker {
  max-width: 250px;
}
</style>
