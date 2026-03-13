<script setup>
import { computed } from 'vue'

const props = defineProps({
  text: { type: [String, Number], default: '' },
  as: { type: String, default: 'span' },
  variant: { type: String, default: 'body' },
  className: { type: String, default: '' },
  truncate: { type: Boolean, default: false },
  nowrap: { type: Boolean, default: false },
})

const variantClass = computed(() => {
  const raw = String(props.variant || 'body').trim().toLowerCase()
  const allowed = new Set(['body', 'title', 'subtitle', 'label', 'button', 'caption'])
  const normalized = allowed.has(raw) ? raw : 'body'
  return `app-text-element--${normalized}`
})

const classes = computed(() => {
  return [
    'app-text-element',
    variantClass.value,
    props.truncate ? 'app-text-element--truncate' : '',
    props.nowrap ? 'app-text-element--nowrap' : '',
    String(props.className || '').trim(),
  ].filter(Boolean)
})
</script>

<template>
  <component :is="as" :class="classes">
    <slot>{{ text }}</slot>
  </component>
</template>
