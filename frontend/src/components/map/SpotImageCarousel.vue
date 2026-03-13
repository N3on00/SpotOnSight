<script setup>
import { computed, ref, watch } from 'vue'
import { toImageSource } from '../../models/imageMapper'
import ActionButton from '../common/ActionButton.vue'

const props = defineProps({
  spot: { type: Object, default: null },
  onNotify: { type: Function, required: true },
})

const imageIndex = ref(0)

watch(
  () => props.spot?.id,
  () => {
    imageIndex.value = 0
  },
)

const images = computed(() => (Array.isArray(props.spot?.images) ? props.spot.images : []))
const currentImage = computed(() => (images.value.length ? toImageSource(images.value[imageIndex.value]) : ''))

function prevImage() {
  if (!images.value.length) return
  imageIndex.value = (imageIndex.value - 1 + images.value.length) % images.value.length
}

function nextImage() {
  if (!images.value.length) return
  imageIndex.value = (imageIndex.value + 1) % images.value.length
}

function onImageError() {
  props.onNotify({
    level: 'warning',
    title: 'Invalid Image',
    message: 'This spot image cannot be displayed.',
  })
}
</script>

<template>
  <div class="image-viewer" v-if="images.length">
    <img :src="currentImage" alt="spot image" @error="onImageError" loading="lazy" />
    <div class="viewer-actions">
      <ActionButton class-name="btn btn-outline-secondary" label="Prev" @click="prevImage" />
      <span class="text-secondary small">{{ imageIndex + 1 }} / {{ images.length }}</span>
      <ActionButton class-name="btn btn-outline-secondary" label="Next" @click="nextImage" />
    </div>
  </div>
</template>
