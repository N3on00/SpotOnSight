<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  BillboardGraphics,
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  EllipsoidGeodesic,
  HeightReference,
  ImageryLayer,
  Math as CesiumMath,
  OpenStreetMapImageryProvider,
  Rectangle,
  SceneTransforms,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin,
  Viewer,
} from 'cesium'
import { firstImageSource } from '../../models/imageMapper'

const EDGE_HINT_MARGIN = 42
const EDGE_HINT_MAX = 8
const EDGE_HINT_MIN_SPACING = 46
const MIN_MAP_ZOOM = 2
const MAX_MAP_ZOOM = 18
const HEIGHT_AT_ZOOM_ZERO = 80000000
const FREE_SPIN_HEIGHT = 2200000
const ZOOM_STEP = 2

const orientationHeading = ref(0)
const orientationPitch = ref(-CesiumMath.PI_OVER_TWO)

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

let viewer = null
let handler = null
let resizeObserver = null
let isDisposed = false
let suppressViewportEmit = false
let pointer = null
const spotEntities = new Map()
const previewCache = new Map()

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function normalizedZoom(value) {
  const zoom = Number(value)
  if (!Number.isFinite(zoom)) return 11
  return clamp(Math.round(zoom), MIN_MAP_ZOOM, MAX_MAP_ZOOM)
}

function zoomToCameraHeight(zoom) {
  return HEIGHT_AT_ZOOM_ZERO / (2 ** normalizedZoom(zoom))
}

function safeCameraHeight(value) {
  const minHeight = 1200
  const maxHeight = 45000000
  const next = Number(value)
  if (!Number.isFinite(next)) return zoomToCameraHeight(props.zoom)
  return clamp(next, minHeight, maxHeight)
}

function cameraHeightToZoom(height) {
  const normalized = Math.max(1, Number(height) || HEIGHT_AT_ZOOM_ZERO)
  const zoom = Math.log2(HEIGHT_AT_ZOOM_ZERO / normalized)
  return clamp(Math.round(zoom), MIN_MAP_ZOOM, MAX_MAP_ZOOM)
}

function spotTitle(spot) {
  const title = String(spot?.title || '').trim()
  return title || 'Spot'
}

function escapeSvgText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function svgDataUri(markup) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`
}

function defaultMarkerSvg(spot) {
  const initial = escapeSvgText(spotTitle(spot).charAt(0).toUpperCase() || 'S')
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="72" height="88" viewBox="0 0 72 88">
      <defs>
        <linearGradient id="pinGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#7ee0d2"/>
          <stop offset="100%" stop-color="#1f7c72"/>
        </linearGradient>
        <filter id="pinShadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#071f26" flood-opacity="0.32"/>
        </filter>
      </defs>
      <g filter="url(#pinShadow)">
        <path d="M36 6c-14.36 0-26 11.64-26 26 0 19.2 22.44 36.68 25 49.4.26 1.04 1.74 1.04 2 0C39.56 68.68 62 51.2 62 32 62 17.64 50.36 6 36 6z" fill="url(#pinGradient)"/>
        <circle cx="36" cy="32" r="17" fill="#10333c" fill-opacity="0.96"/>
        <circle cx="36" cy="32" r="14.5" fill="#f6fffd" fill-opacity="0.96"/>
        <text x="36" y="37" text-anchor="middle" font-size="15" font-weight="700" fill="#1f7c72" font-family="Inter,Segoe UI,sans-serif">${initial}</text>
      </g>
    </svg>
  `)
}

function previewMarkerSvg(imageSrc) {
  const safeSrc = escapeSvgText(imageSrc)
  return svgDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" width="88" height="90" viewBox="0 0 88 90">
      <defs>
        <clipPath id="cardClip">
          <rect x="10" y="8" width="68" height="52" rx="16" ry="16"/>
        </clipPath>
        <filter id="cardShadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#071f26" flood-opacity="0.32"/>
        </filter>
        <linearGradient id="frameGradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#9bf0e4"/>
          <stop offset="100%" stop-color="#1f7c72"/>
        </linearGradient>
      </defs>
      <g filter="url(#cardShadow)">
        <rect x="10" y="8" width="68" height="52" rx="16" ry="16" fill="#102a34" stroke="url(#frameGradient)" stroke-width="2.2"/>
        <image href="${safeSrc}" x="10" y="8" width="68" height="52" preserveAspectRatio="xMidYMid slice" clip-path="url(#cardClip)"/>
        <rect x="10" y="8" width="68" height="52" rx="16" ry="16" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
        <path d="M44 60l-10 18h7l3 10 3-10h7L44 60z" fill="#1f7c72" stroke="#b8fff4" stroke-width="1.3" stroke-linejoin="round"/>
        <circle cx="44" cy="62" r="4.5" fill="#dffcf6" opacity="0.98"/>
      </g>
    </svg>
  `)
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

function markerImageForSpot(spot) {
  const preview = String(firstImageSource(spot?.images) || '').trim()
  if (preview) {
    const key = `preview:${preview}`
    if (!previewCache.has(key)) {
      previewCache.set(key, previewMarkerSvg(preview))
    }
    return previewCache.get(key)
  }

  const key = `default:${spotTitle(spot).charAt(0).toUpperCase() || 'S'}`
  if (!previewCache.has(key)) {
    previewCache.set(key, defaultMarkerSvg(spot))
  }
  return previewCache.get(key)
}

function cameraCenterCartographic() {
  if (!viewer || isDisposed) return null
  const scene = viewer.scene
  const canvas = scene?.canvas
  if (!canvas) return null

  const centerPoint = new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2)
  const ellipsoidPoint = viewer.camera.pickEllipsoid(centerPoint, scene.globe.ellipsoid)
  if (ellipsoidPoint) {
    return Cartographic.fromCartesian(ellipsoidPoint)
  }

  const rectangle = viewer.camera.computeViewRectangle(scene.globe.ellipsoid)
  if (!rectangle) return null

  return Cartographic.fromRadians(
    (rectangle.west + rectangle.east) / 2,
    (rectangle.south + rectangle.north) / 2,
  )
}

function emitViewportChange() {
  if (!viewer || isDisposed || suppressViewportEmit) return
  const center = cameraCenterCartographic()
  if (!center) return

  props.onViewportChange(
    [CesiumMath.toDegrees(center.latitude), CesiumMath.toDegrees(center.longitude)],
    cameraHeightToZoom(viewer.camera.positionCartographic.height),
  )
}

function syncOrientationState() {
  if (!viewer || isDisposed) return
  const heading = Number(viewer.camera.heading)
  const pitch = Number(viewer.camera.pitch)
  orientationHeading.value = Number.isFinite(heading) ? heading : 0
  orientationPitch.value = Number.isFinite(pitch) ? pitch : -CesiumMath.PI_OVER_TWO
}

function freeSpinEnabled() {
  if (!viewer || isDisposed) return false
  return Number(viewer.camera.positionCartographic?.height || 0) >= FREE_SPIN_HEIGHT
}

function updateInteractionMode() {
  if (!viewer || isDisposed) return
  const controller = viewer.scene.screenSpaceCameraController
  const freeSpin = freeSpinEnabled()

  controller.enableTilt = freeSpin
  controller.enableLook = freeSpin
  viewer.camera.constrainedAxis = freeSpin ? undefined : Cartesian3.UNIT_Z
}

function flyToPoint(lat, lon, zoom = props.zoom, immediate = false) {
  if (!viewer || isDisposed) return

  const destination = Cartesian3.fromDegrees(Number(lon), Number(lat), zoomToCameraHeight(zoom))
  const options = {
    destination,
    orientation: {
      heading: viewer.camera.heading,
      pitch: -CesiumMath.PI_OVER_TWO,
      roll: 0,
    },
    duration: immediate ? 0 : 0.8,
  }

  suppressViewportEmit = true
  viewer.camera.flyTo({
    ...options,
    complete: () => {
      suppressViewportEmit = false
      updateEdgeHints()
      emitViewportChange()
    },
    cancel: () => {
      suppressViewportEmit = false
      updateEdgeHints()
    },
  })
}

function applyMaxBounds(bounds) {
  if (!viewer || isDisposed || !bounds || !Array.isArray(bounds) || bounds.length !== 2) {
    return
  }

  const south = Number(bounds[0]?.[0])
  const west = Number(bounds[0]?.[1])
  const north = Number(bounds[1]?.[0])
  const east = Number(bounds[1]?.[1])
  if (![south, west, north, east].every(Number.isFinite)) return

  viewer.camera.setView({
    destination: Rectangle.fromDegrees(west, south, east, north),
  })
  flyToPoint(props.center[0], props.center[1], props.zoom, true)
}

function syncMarkers() {
  if (!viewer || isDisposed) return

  for (const entity of spotEntities.values()) {
    viewer.entities.remove(entity)
  }
  spotEntities.clear()

  for (const spot of props.spots) {
    if (!spot || typeof spot !== 'object') continue
    const lat = Number(spot.lat)
    const lon = Number(spot.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    const billboard = new BillboardGraphics({
      image: markerImageForSpot(spot),
      width: String(firstImageSource(spot?.images) || '').trim() ? 66 : 40,
      height: String(firstImageSource(spot?.images) || '').trim() ? 68 : 50,
      verticalOrigin: VerticalOrigin.BOTTOM,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      scaleByDistance: undefined,
      pixelOffset: new Cartesian2(0, -8),
      eyeOffset: new Cartesian3(0, 0, -16),
    })

    const entity = viewer.entities.add({
      id: `spot-${String(spot.id || `${lat},${lon}`)}`,
      position: Cartesian3.fromDegrees(lon, lat),
      billboard,
      properties: { spot },
    })
    spotEntities.set(entity.id, entity)
  }

  updateEdgeHints()
}

function updateEdgeHints() {
  if (!viewer || isDisposed) {
    edgeHints.value = []
    return
  }

  const scene = viewer.scene
  const canvas = scene?.canvas
  if (!canvas) {
    edgeHints.value = []
    return
  }

  const maxX = Number(canvas.clientWidth || 0)
  const maxY = Number(canvas.clientHeight || 0)
  if (!maxX || !maxY) {
    edgeHints.value = []
    return
  }

  const center = cameraCenterCartographic()
  if (!center) {
    edgeHints.value = []
    return
  }

  const minX = EDGE_HINT_MARGIN
  const minY = EDGE_HINT_MARGIN
  const safeMaxX = maxX - EDGE_HINT_MARGIN
  const safeMaxY = maxY - EDGE_HINT_MARGIN
  const centerLat = CesiumMath.toDegrees(center.latitude)
  const centerLon = CesiumMath.toDegrees(center.longitude)
  const hints = []

  for (const spot of props.spots) {
    if (!spot || typeof spot !== 'object') continue
    const lat = Number(spot.lat)
    const lon = Number(spot.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

    const cartesian = Cartesian3.fromDegrees(lon, lat)
    const point = SceneTransforms.worldToWindowCoordinates(scene, cartesian)
    if (!point) continue

    const inViewport = point.x >= minX
      && point.x <= safeMaxX
      && point.y >= minY
      && point.y <= safeMaxY

    if (inViewport) {
      continue
    }

    const left = clamp(point.x, minX, safeMaxX)
    const top = clamp(point.y, minY, safeMaxY)
    const angleDeg = Math.atan2(point.y - top, point.x - left) * (180 / Math.PI)
    const geodesic = new EllipsoidGeodesic(
      Cartographic.fromDegrees(centerLon, centerLat),
      Cartographic.fromDegrees(lon, lat),
    )
    const distanceM = geodesic.surfaceDistance || 0

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

  hints.sort((a, b) => a.distanceM - b.distanceM)
  edgeHints.value = compactEdgeHints(hints)
}

function adjustZoom(delta) {
  const center = cameraCenterCartographic()
  if (!center) return

  const height = safeCameraHeight(viewer.camera.positionCartographic?.height)
  const nextZoom = normalizedZoom(cameraHeightToZoom(height) + (delta * ZOOM_STEP))
  flyToPoint(CesiumMath.toDegrees(center.latitude), CesiumMath.toDegrees(center.longitude), nextZoom)
}

function resetRotation() {
  if (!viewer || isDisposed) return
  const center = cameraCenterCartographic()
  if (!center) return

  const currentHeight = safeCameraHeight(viewer.camera.positionCartographic?.height)

  suppressViewportEmit = true
  viewer.camera.flyTo({
    destination: Cartesian3.fromRadians(center.longitude, center.latitude, currentHeight),
    orientation: {
      heading: 0,
      pitch: -CesiumMath.PI_OVER_TWO,
      roll: 0,
    },
    duration: 0.65,
    complete: () => {
      suppressViewportEmit = false
      syncOrientationState()
      updateInteractionMode()
      updateEdgeHints()
      emitViewportChange()
    },
    cancel: () => {
      suppressViewportEmit = false
    },
  })
}

function selectEdgeHint(spot) {
  props.onMarkerSelect(spot)
}

function bindPointerHandlers() {
  handler = new ScreenSpaceEventHandler(viewer.scene.canvas)

  handler.setInputAction((movement) => {
    pointer = {
      x: movement.position?.x || 0,
      y: movement.position?.y || 0,
      moved: false,
    }
  }, ScreenSpaceEventType.LEFT_DOWN)

  handler.setInputAction((movement) => {
    if (!pointer) return
    const dx = Math.abs((movement.endPosition?.x || 0) - pointer.x)
    const dy = Math.abs((movement.endPosition?.y || 0) - pointer.y)
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      pointer.moved = true
    }
  }, ScreenSpaceEventType.MOUSE_MOVE)

  handler.setInputAction((movement) => {
    if (pointer?.moved) {
      pointer = null
      return
    }

    const picked = viewer.scene.pick(movement.position)
    const pickedSpot = picked?.id?.properties?.spot?.getValue?.() || picked?.id?.properties?.spot
    if (pickedSpot) {
      pointer = null
      props.onMarkerSelect(pickedSpot)
      return
    }

    const earthPosition = viewer.camera.pickEllipsoid(movement.position, viewer.scene.globe.ellipsoid)
    if (!earthPosition) {
      pointer = null
      return
    }

    const cartographic = Cartographic.fromCartesian(earthPosition)
    pointer = null
    props.onMapTap(CesiumMath.toDegrees(cartographic.latitude), CesiumMath.toDegrees(cartographic.longitude))
  }, ScreenSpaceEventType.LEFT_CLICK)
}

onMounted(() => {
  isDisposed = false

  viewer = new Viewer(host.value, {
    animation: false,
    baseLayerPicker: false,
    baseLayer: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    shouldAnimate: false,
    terrain: undefined,
  })

  viewer.imageryLayers.removeAll()
  viewer.imageryLayers.add(
    ImageryLayer.fromProviderAsync(
      Promise.resolve(new OpenStreetMapImageryProvider({
        url: 'https://tile.openstreetmap.org/',
      })),
    ),
  )

  viewer.scene.globe.enableLighting = false
  viewer.scene.globe.baseColor = Color.fromCssColorString('#dbe7d3')
  viewer.scene.globe.depthTestAgainstTerrain = true
  viewer.scene.skyBox.show = false
  viewer.scene.sun.show = false
  viewer.scene.moon.show = false
  viewer.scene.fxaa = true
  viewer.cesiumWidget.creditContainer.style.display = 'none'
  viewer.scene.screenSpaceCameraController.zoomFactor = 10
  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1200
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = 45000000
  viewer.scene.camera.percentageChanged = 0.002
  syncOrientationState()
  updateInteractionMode()

  bindPointerHandlers()

  viewer.camera.changed.addEventListener(() => {
    syncOrientationState()
    updateInteractionMode()
  })

  viewer.camera.moveEnd.addEventListener(() => {
    syncOrientationState()
    updateInteractionMode()
    updateEdgeHints()
    emitViewportChange()
  })

  resizeObserver = new ResizeObserver(() => {
    if (!viewer || isDisposed) return
    viewer.resize()
    updateEdgeHints()
  })
  resizeObserver.observe(host.value)

  syncMarkers()
  applyMaxBounds(props.maxBounds)
  flyToPoint(props.center[0], props.center[1], props.zoom, true)
})

onBeforeUnmount(() => {
  isDisposed = true
  edgeHints.value = []
  pointer = null
  if (handler) {
    handler.destroy()
    handler = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (viewer) {
    viewer.destroy()
    viewer = null
  }
  spotEntities.clear()
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
    if (!viewer || isDisposed) return
    const center = cameraCenterCartographic()
    if (!center) {
      flyToPoint(props.center[0], props.center[1], props.zoom, true)
      return
    }

    const currentLat = CesiumMath.toDegrees(center.latitude)
    const currentLon = CesiumMath.toDegrees(center.longitude)
    const currentZoom = cameraHeightToZoom(viewer.camera.positionCartographic.height)
    const nextZoom = normalizedZoom(props.zoom)

    if (
      Math.abs(currentLat - Number(props.center[0])) > 0.0001
      || Math.abs(currentLon - Number(props.center[1])) > 0.0001
      || currentZoom !== nextZoom
    ) {
      flyToPoint(props.center[0], props.center[1], props.zoom, true)
    }
  },
)

watch(
  () => props.maxBounds,
  (nextBounds) => {
    applyMaxBounds(nextBounds)
  },
)
</script>

<template>
  <div class="leaflet-map-shell cesium-map-shell" data-aos="zoom-in" data-aos-delay="80">
    <div class="leaflet-map cesium-map" ref="host" />

    <div class="cesium-map__controls" aria-label="Map zoom controls">
      <div class="cesium-map__compass" :class="{ 'cesium-map__compass--active': freeSpinEnabled() }" aria-label="Map orientation indicator">
        <div class="cesium-map__compass-ring" :style="{ transform: `rotate(${(-orientationHeading * 180) / Math.PI}deg)` }">
          <span class="cesium-map__compass-label cesium-map__compass-label--north">N</span>
          <span class="cesium-map__compass-label cesium-map__compass-label--east">E</span>
          <span class="cesium-map__compass-label cesium-map__compass-label--south">S</span>
          <span class="cesium-map__compass-label cesium-map__compass-label--west">W</span>
          <span class="cesium-map__compass-needle"></span>
        </div>
      </div>
      <button class="cesium-map__control" type="button" aria-label="Reset rotation" @click.stop="resetRotation">
        <i class="bi bi-compass"></i>
      </button>
      <button class="cesium-map__control" type="button" aria-label="Zoom in" @click.stop="adjustZoom(1)">
        <i class="bi bi-plus-lg"></i>
      </button>
      <button class="cesium-map__control" type="button" aria-label="Zoom out" @click.stop="adjustZoom(-1)">
        <i class="bi bi-dash-lg"></i>
      </button>
    </div>

    <TransitionGroup name="map-edge-fade" tag="div" class="map-edge-hints">
      <button
        v-for="hint in edgeHints"
        :key="`edge-hint-${hint.id}`"
        class="map-edge-hint"
        type="button"
        :style="{ left: `${hint.left}px`, top: `${hint.top}px`, '--edge-angle': `${hint.angleDeg}deg` }"
        :title="`${hint.title}${hint.distanceLabel ? ` (${hint.distanceLabel})` : ''}`"
        :aria-label="`Nearest spot: ${hint.title}${hint.distanceLabel ? `, ${hint.distanceLabel} away` : ''}`"
        @click.stop="selectEdgeHint(hint.spot)"
      >
        <span class="map-edge-hint__arrow"><i class="bi bi-triangle-fill"></i></span>
        <span v-if="hint.distanceLabel" class="map-edge-hint__label">{{ hint.distanceLabel }}</span>
      </button>
    </TransitionGroup>
  </div>
</template>
