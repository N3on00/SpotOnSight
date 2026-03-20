<script setup>
import { computed, ref, useSlots } from 'vue'
import { firstImageSource } from '../../models/imageMapper'
import ActionButton from './ActionButton.vue'
import ReportContentModal from './ReportContentModal.vue'

const props = defineProps({
  spot: { type: Object, required: true },
  ownerLabel: { type: String, default: '' },
  distanceLabel: { type: String, default: '' },
  interactive: { type: Boolean, default: false },
  showVisibilityBadge: { type: Boolean, default: false },
  showFavoriteBadge: { type: Boolean, default: false },
  isFavorite: { type: Boolean, default: false },
  showGoTo: { type: Boolean, default: false },
  maxTags: { type: Number, default: 4 },
  descriptionMaxLength: { type: Number, default: 120 },
  canReport: { type: Boolean, default: false },
  onReport: { type: Function, default: null },
})

const emit = defineEmits(['open', 'go-to'])
const slots = useSlots()
const hoverPulseActive = ref(false)
const reportOpen = ref(false)
const reportBusy = ref(false)

const preview = computed(() => firstImageSource(props.spot?.images))

const hasTopRail = computed(() => {
  return Boolean(slots['top-actions'] || props.showFavoriteBadge || props.showVisibilityBadge)
})

const hasActions = computed(() => {
  return Boolean(slots.actions || props.showGoTo || props.canReport)
})

const normalizedDescriptionLimit = computed(() => {
  const value = Number(props.descriptionMaxLength)
  if (!Number.isFinite(value)) return 120
  const rounded = Math.floor(value)
  return Math.max(20, rounded)
})

const descriptionText = computed(() => {
  const value = String(props.spot?.description || '').trim()
  if (!value) return 'No description yet.'
  if (value.length <= normalizedDescriptionLimit.value) return value
  const clipAt = Math.max(1, normalizedDescriptionLimit.value - 3)
  return `${value.slice(0, clipAt).trimEnd()}...`
})

const imageCount = computed(() => {
  return Array.isArray(props.spot?.images) ? props.spot.images.length : 0
})

const visibleTags = computed(() => {
  const tags = Array.isArray(props.spot?.tags) ? props.spot.tags : []
  return tags.slice(0, Math.max(0, Number(props.maxTags) || 0))
})

function openCard() {
  if (!props.interactive) return
  emit('open', props.spot)
}

function onKeydown(event) {
  if (!props.interactive) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    emit('open', props.spot)
  }
}

function goToSpot(event) {
  event?.stopPropagation?.()
  emit('go-to', props.spot)
}

function triggerHoverPulse() {
  if (!props.interactive) return
  hoverPulseActive.value = false
  if (typeof window === 'undefined') {
    hoverPulseActive.value = true
    return
  }
  window.requestAnimationFrame(() => {
    hoverPulseActive.value = true
  })
}

function clearHoverPulse() {
  hoverPulseActive.value = false
}

function openReportDialog(event) {
  event?.stopPropagation?.()
  if (!props.canReport || typeof props.onReport !== 'function') return
  reportOpen.value = true
}

function closeReportDialog() {
  reportOpen.value = false
}

async function submitReport(payload) {
  if (typeof props.onReport !== 'function') return false
  reportBusy.value = true
  try {
    return await props.onReport(props.spot, payload.reason, payload.details)
  } finally {
    reportBusy.value = false
  }
}
</script>

<template>
  <article
    class="spot-card-mini"
    :class="{ 'spot-card-mini--interactive': interactive, 'interactive-hover': interactive, 'spot-card-mini--pulse': hoverPulseActive }"
    :role="interactive ? 'button' : undefined"
    :tabindex="interactive ? 0 : undefined"
    @click="openCard"
    @keydown="onKeydown"
    @mouseenter="triggerHoverPulse"
    @focus="triggerHoverPulse"
    @animationend="clearHoverPulse"
  >
    <div class="spot-card-mini__media" v-if="preview">
      <img :src="preview" alt="spot image" loading="lazy" />
    </div>
    <div class="spot-card-mini__media spot-card-mini__media--empty" v-else>
      <i class="bi bi-image"></i>
    </div>

    <div class="spot-card-mini__body" :class="{ 'spot-card-mini__body--with-rail': hasTopRail }">
      <div class="spot-card-mini__main">
        <div class="spot-card-mini__top">
          <h4 class="h6 mb-0 spot-card-mini__title">{{ spot?.title || 'Untitled spot' }}</h4>
        </div>

        <p class="small text-secondary mb-0 spot-card-mini__description">{{ descriptionText }}</p>

        <div class="spot-card-mini__meta">
          <span><i class="bi bi-geo-alt me-1"></i>{{ Number(spot?.lat || 0).toFixed(3) }}, {{ Number(spot?.lon || 0).toFixed(3) }}</span>
          <span><i class="bi bi-images me-1"></i>{{ imageCount }} image(s)</span>
          <span v-if="ownerLabel"><i class="bi bi-person-circle me-1"></i>{{ ownerLabel }}</span>
          <span v-if="distanceLabel"><i class="bi bi-signpost-2 me-1"></i>{{ distanceLabel }}</span>
        </div>

        <div class="tag-row" v-if="visibleTags.length">
          <span class="tag" v-for="tag in visibleTags" :key="`${spot?.id || spot?.title || 'spot'}-${tag}`">{{ tag }}</span>
        </div>

        <div class="spot-card-mini__actions" v-if="hasActions">
          <ActionButton
            v-if="showGoTo"
            class-name="btn btn-sm btn-outline-primary"
            icon="bi-signpost-2"
            label="Go to"
            @click.stop="goToSpot"
          />
          <ActionButton
            v-if="canReport"
            class-name="btn btn-sm btn-outline-danger"
            icon="bi-flag"
            label="Report"
            @click.stop="openReportDialog"
          />
          <slot name="actions" :spot="spot" />
        </div>
      </div>

      <div class="spot-card-mini__rail" v-if="hasTopRail">
        <slot name="top-actions" :spot="spot" />
        <span class="badge-soft" v-if="showFavoriteBadge && isFavorite">
          <i class="bi bi-heart-fill text-danger me-1"></i>
          Favorite
        </span>
        <span class="badge-soft" v-if="showVisibilityBadge">{{ spot?.visibility || 'public' }}</span>
      </div>
    </div>
  </article>

  <ReportContentModal
    :open="reportOpen"
    title="Report spot"
    target-label="this spot"
    :target-description="spot?.title || 'Untitled spot'"
    :busy="reportBusy"
    :on-close="closeReportDialog"
    :on-submit="submitReport"
  />
</template>
