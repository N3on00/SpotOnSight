<script setup>
import ActionButton from '../common/ActionButton.vue'
import SpotMiniCard from '../common/SpotMiniCard.vue'

defineProps({
  filteredSpots: { type: Array, default: () => [] },
  listedSpots: { type: Array, default: () => [] },
  spotResultsExpanded: { type: Boolean, default: true },
  canLoadMoreSpots: { type: Boolean, default: false },
  remainingSpotCount: { type: Number, default: 0 },
  pageSize: { type: Number, default: 10 },
  ownerLabel: { type: Function, required: true },
  spotDistanceLabel: { type: Function, required: true },
  isFavorite: { type: Function, required: true },
  canReportSpot: { type: Function, required: true },
  onReportSpot: { type: Function, required: true },
  onToggleExpanded: { type: Function, required: true },
  onOpenSpot: { type: Function, required: true },
  onToggleFavorite: { type: Function, required: true },
  onLoadMore: { type: Function, required: true },
})
</script>

<template>
  <section class="card border-0 shadow-sm map-widget-card" data-aos="fade-up" data-aos-delay="65">
    <div class="card-body d-grid gap-2 p-3">
      <header class="d-flex flex-wrap align-items-start justify-content-between gap-2">
        <div>
          <h3 class="h6 mb-1">Spot search results</h3>
          <p class="small text-secondary mb-0">Results are grouped directly under the spot search card.</p>
        </div>

        <ActionButton
          class-name="btn btn-sm btn-outline-secondary"
          :icon="spotResultsExpanded ? 'bi-chevron-up' : 'bi-chevron-down'"
          :label="spotResultsExpanded ? 'Collapse results' : `Expand results (${filteredSpots.length})`"
          :disabled="!filteredSpots.length"
          @click="onToggleExpanded"
        />
      </header>

      <div class="small text-secondary" v-if="!filteredSpots.length">
        No spots match your current filters.
      </div>

      <template v-else-if="spotResultsExpanded">
        <div class="small text-secondary">Tap a card to open full details.</div>

        <div class="spot-feed map-spot-feed">
          <SpotMiniCard
            v-for="spot in listedSpots"
            :key="`map-list-${spot.id}`"
            :spot="spot"
            :owner-label="ownerLabel(spot)"
            :distance-label="spotDistanceLabel(spot)"
            :interactive="true"
            :can-report="canReportSpot(spot)"
            :on-report="onReportSpot"
            @open="onOpenSpot"
          >
            <template #top-actions>
              <div class="spot-card-mini__quick-actions">
                <ActionButton
                  :class-name="isFavorite(spot) ? 'btn btn-sm btn-warning' : 'btn btn-sm btn-outline-warning'"
                  :icon="isFavorite(spot) ? 'bi-heart-fill' : 'bi-heart'"
                  :icon-only="true"
                  :aria-label="isFavorite(spot) ? 'Unlike spot' : 'Like spot'"
                  @click.stop="onToggleFavorite(spot)"
                />
                <ActionButton
                  class-name="btn btn-sm btn-outline-secondary"
                  label="Details"
                  @click.stop="onOpenSpot(spot)"
                />
              </div>
            </template>
          </SpotMiniCard>
        </div>

        <div class="map-spot-feed__load-more" v-if="canLoadMoreSpots">
          <span class="map-spot-feed__bar" aria-hidden="true"></span>
          <ActionButton
            class-name="btn btn-sm btn-outline-primary"
            :label="`Load ${Math.min(pageSize, remainingSpotCount)} more (${remainingSpotCount} left)`"
            @click="onLoadMore"
          />
        </div>
      </template>

      <div class="small text-secondary" v-else>
        {{ filteredSpots.length }} result(s) hidden. Expand to view.
      </div>
    </div>
  </section>
</template>
