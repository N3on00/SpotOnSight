<script setup>
import { computed, ref, watch } from 'vue'
import ActionButton from '../common/ActionButton.vue'
import LeafletSpotMap from '../map/LeafletSpotMap.vue'

const DEFAULT_CENTER = [47.3769, 8.5417]

const props = defineProps({
  spots: { type: Array, default: () => [] },
  onOpenMap: { type: Function, required: true },
  onOpenSpot: { type: Function, required: true },
})

const center = ref([...DEFAULT_CENTER])
const zoom = ref(11)

const mappedSpots = computed(() => {
  return (Array.isArray(props.spots) ? props.spots : [])
    .filter((spot) => {
      const lat = Number(spot?.lat)
      const lon = Number(spot?.lon)
      return Number.isFinite(lat) && Number.isFinite(lon)
    })
})

watch(
  () => mappedSpots.value,
  (spots) => {
    if (!spots.length) {
      center.value = [...DEFAULT_CENTER]
      zoom.value = 11
      return
    }

    const first = spots[0]
    center.value = [Number(first.lat), Number(first.lon)]
  },
  { immediate: true },
)

function openFullMap() {
  props.onOpenMap()
}

function openMapAt(lat, lon) {
  props.onOpenMap({ lat, lon })
}

function onMapTap(lat, lon) {
  openMapAt(lat, lon)
}

function onMarkerSelect(spot) {
  props.onOpenSpot(spot)
}

function onViewportChange(nextCenter, nextZoom) {
  center.value = Array.isArray(nextCenter) ? nextCenter : [...DEFAULT_CENTER]
  zoom.value = Number(nextZoom) || 11
}
</script>

<template>
  <section class="card border-0 shadow-sm home-map-widget" data-aos="fade-up" data-aos-delay="45">
    <div class="card-body d-grid gap-3 p-4">
      <header class="discover-header">
        <div>
          <h3 class="h4 mb-1">Map preview</h3>
          <p class="text-secondary mb-0">Tap the map or a spot marker to jump into Explore Map.</p>
        </div>
        <ActionButton
          label="Open map"
          icon="bi-map"
          class-name="btn btn-outline-primary btn-sm"
          @click="openFullMap"
        />
      </header>

      <LeafletSpotMap
        :spots="mappedSpots"
        :center="center"
        :zoom="zoom"
        :on-map-tap="onMapTap"
        :on-marker-select="onMarkerSelect"
        :on-viewport-change="onViewportChange"
      />
    </div>
  </section>
</template>
