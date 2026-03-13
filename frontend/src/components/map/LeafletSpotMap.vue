<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { firstImageSource } from '../../models/imageMapper'

const EDGE_HINT_MARGIN = 42
const EDGE_HINT_MAX = 8
const EDGE_HINT_MIN_SPACING = 46

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

const props = defineProps({
  spots: { type: Array, default: () => [] },
  center: { type: Array, default: () => [47.3769, 8.5417] },
  zoom: { type: Number, default: 12 },
  maxBounds: { type: Array, default: () => null },
  onMapTap: { type: Function, required: true },
  onMarkerSelect: { type: Function, required: true },
  onViewportChange: { type: Function, required: true },
})

const host = ref(null)
const edgeHints = ref([])
let map = null
let markersLayer = null
let wheelAt = 0
let pointer = null
const previewIconCache = new Map()

function escapeHtmlAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function previewMarkerIcon(imageSrc) {
  const key = String(imageSrc || '').trim()
  if (!key) return null

  if (previewIconCache.has(key)) {
    return previewIconCache.get(key)
  }

  const safeSrc = escapeHtmlAttr(key)
  const icon = L.divIcon({
    className: 'spot-preview-marker',
    html: `<div class="spot-preview-marker__card"><img class="spot-preview-marker__backdrop" src="${safeSrc}" alt="" loading="lazy" /><img class="spot-preview-marker__image" src="${safeSrc}" alt="spot preview" loading="lazy" /></div><div class="spot-preview-marker__tip"></div>`,
    iconSize: [62, 76],
    iconAnchor: [31, 38],
  })

  previewIconCache.set(key, icon)
  return icon
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function spotTitle(spot) {
  const title = String(spot?.title || '').trim()
  return title || 'Spot'
}

function edgeDistanceLabel(distanceM) {
  const km = Number(distanceM || 0) / 1000
  if (!Number.isFinite(km) || km <= 0) return ''
  if (km < 1) {
    return `${Math.max(0.1, Math.round(km * 10) / 10).toFixed(1)} km`
  }
  if (km < 10) {
    return `${km.toFixed(1)} km`
  }
  return `${Math.round(km)} km`
}

function compactEdgeHints(items) {
  const out = []

  for (const item of items) {
    const tooClose = out.some((candidate) => {
      const dx = candidate.left - item.left
      const dy = candidate.top - item.top
      return Math.sqrt(dx * dx + dy * dy) < EDGE_HINT_MIN_SPACING
    })

    if (!tooClose) {
      out.push(item)
    }
    if (out.length >= EDGE_HINT_MAX) {
      break
    }
  }

  return out
}

function updateEdgeHints() {
  if (!map) {
    edgeHints.value = []
    return
  }

  const size = map.getSize()
  const maxX = Number(size?.x || 0)
  const maxY = Number(size?.y || 0)
  if (!maxX || !maxY) {
    edgeHints.value = []
    return
  }

  const minX = EDGE_HINT_MARGIN
  const minY = EDGE_HINT_MARGIN
  const safeMaxX = maxX - EDGE_HINT_MARGIN
  const safeMaxY = maxY - EDGE_HINT_MARGIN
  if (safeMaxX <= minX || safeMaxY <= minY) {
    edgeHints.value = []
    return
  }

  const center = map.getCenter()
  const bounds = map.getBounds()
  const hints = []
  for (const spot of props.spots) {
    if (!spot || typeof spot !== 'object') continue

    const lat = Number(spot.lat)
    const lon = Number(spot.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    const latLng = L.latLng(lat, lon)
    const point = map.latLngToContainerPoint(latLng)
    const inViewport = point.x >= minX
      && point.x <= safeMaxX
      && point.y >= minY
      && point.y <= safeMaxY

    if (inViewport || bounds.contains(latLng)) {
      continue
    }

    const left = clamp(point.x, minX, safeMaxX)
    const top = clamp(point.y, minY, safeMaxY)
    const angleDeg = Math.atan2(point.y - top, point.x - left) * (180 / Math.PI)
    const distanceM = map.distance(center, latLng)

    hints.push({
      id: String(spot.id || `${lat},${lon}`),
      spot,
      left,
      top,
      angleDeg,
      distanceM,
      title: spotTitle(spot),
      distanceLabel: edgeDistanceLabel(distanceM),
    })
  }

  if (!hints.length) {
    edgeHints.value = []
    return
  }

  hints.sort((a, b) => a.distanceM - b.distanceM)
  edgeHints.value = compactEdgeHints(hints)
}

function syncMarkers() {
  if (!markersLayer) return
  markersLayer.clearLayers()

  for (const spot of props.spots) {
    if (!spot || typeof spot !== 'object') continue
    const lat = Number(spot.lat)
    const lon = Number(spot.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    const preview = firstImageSource(spot.images)
    const icon = preview ? previewMarkerIcon(preview) : null
    const marker = icon
      ? L.marker([lat, lon], { icon })
      : L.marker([lat, lon])

    marker.on('click', () => props.onMarkerSelect(spot))
    marker.addTo(markersLayer)
  }

  updateEdgeHints()
}

function shouldIgnoreTap(ev) {
  if (Date.now() - wheelAt < 350) {
    return true
  }
  if (!pointer) {
    return false
  }
  const dt = Date.now() - pointer.t
  const dx = Math.abs((ev.originalEvent?.clientX || 0) - pointer.x)
  const dy = Math.abs((ev.originalEvent?.clientY || 0) - pointer.y)
  const moved = Math.sqrt(dx * dx + dy * dy)
  return dt > 450 || moved > 12 || pointer.moved
}

onMounted(() => {
  const mapOptions = {
    zoomControl: true,
    scrollWheelZoom: true,
  }

  if (props.maxBounds && Array.isArray(props.maxBounds) && props.maxBounds.length === 2) {
    mapOptions.maxBounds = props.maxBounds
    mapOptions.maxBoundsViscosity = 0.7
  }

  map = L.map(host.value, mapOptions).setView(props.center, props.zoom)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)

  markersLayer = L.layerGroup().addTo(map)
  syncMarkers()
  updateEdgeHints()

  map.on('wheel', () => {
    wheelAt = Date.now()
  })

  map.on('mousedown', (ev) => {
    pointer = {
      x: ev.originalEvent?.clientX || 0,
      y: ev.originalEvent?.clientY || 0,
      t: Date.now(),
      moved: false,
    }
  })

  map.on('mousemove', (ev) => {
    if (!pointer) return
    const dx = Math.abs((ev.originalEvent?.clientX || 0) - pointer.x)
    const dy = Math.abs((ev.originalEvent?.clientY || 0) - pointer.y)
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      pointer.moved = true
    }
  })

  map.on('moveend zoomend', () => {
    const c = map.getCenter()
    props.onViewportChange([c.lat, c.lng], map.getZoom())
    updateEdgeHints()
  })

  map.on('resize', () => {
    updateEdgeHints()
  })

  map.on('dragstart zoomstart', () => {
    if (pointer) {
      pointer.moved = true
    }
  })

  map.on('click', (ev) => {
    const ignore = shouldIgnoreTap(ev)
    pointer = null
    if (ignore) {
      return
    }
    props.onMapTap(ev.latlng.lat, ev.latlng.lng)
  })
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})

watch(
  () => props.spots,
  () => {
    syncMarkers()
  },
  { deep: true },
)

watch(
  () => [props.center[0], props.center[1], props.zoom],
  () => {
    if (!map) return
    const center = map.getCenter()
    const z = map.getZoom()
    if (
      Math.abs(center.lat - props.center[0]) > 0.000001 ||
      Math.abs(center.lng - props.center[1]) > 0.000001 ||
      z !== props.zoom
    ) {
      map.setView(props.center, props.zoom)
      updateEdgeHints()
    }
  },
)

watch(
  () => props.maxBounds,
  (newBounds) => {
    if (!map) return
    if (newBounds && Array.isArray(newBounds) && newBounds.length === 2) {
      map.setMaxBounds(newBounds)
      map.setMaxBoundsViscosity(0.7)
    } else {
      map.setMaxBounds(null)
    }
  },
)

function selectEdgeHint(spot) {
  props.onMarkerSelect(spot)
}
</script>

<template>
  <div class="leaflet-map-shell" data-aos="zoom-in" data-aos-delay="80">
    <div class="leaflet-map" ref="host" />

    <TransitionGroup name="map-edge-fade" tag="div" class="map-edge-hints">
      <button
        class="map-edge-hint"
        type="button"
        v-for="hint in edgeHints"
        :key="`edge-hint-${hint.id}`"
        :style="{ left: `${hint.left}px`, top: `${hint.top}px`, '--edge-angle': `${hint.angleDeg}deg` }"
        :title="`${hint.title}${hint.distanceLabel ? ` (${hint.distanceLabel})` : ''}`"
        :aria-label="`Nearest spot: ${hint.title}${hint.distanceLabel ? `, ${hint.distanceLabel} away` : ''}`"
        @click.stop="selectEdgeHint(hint.spot)"
      >
        <span class="map-edge-hint__arrow"><i class="bi bi-triangle-fill"></i></span>
        <span class="map-edge-hint__label" v-if="hint.distanceLabel">{{ hint.distanceLabel }}</span>
      </button>
    </TransitionGroup>
  </div>
</template>
