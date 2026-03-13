<script setup>
import AppTextElement from './AppTextElement.vue'

const props = defineProps({
  for: { type: String, default: '' },
  className: { type: String, default: 'form-label' },
})

const inputId = computed(() => String(props.for || '').trim())
</script>

<script>
import { computed } from 'vue'
</script>

<template>
  <AppTextElement
    as="label"
    variant="label"
    :for="inputId || undefined"
    :class-name="className"
  >
    <slot />
  </AppTextElement>
</template>
