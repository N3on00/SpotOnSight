<script setup>
import { computed } from 'vue'

const props = defineProps({
  as: { type: String, default: 'div' },
  variant: { type: String, default: 'default' },
  className: { type: String, default: '' },
  bodyClass: { type: String, default: '' },
})

const variantClass = computed(() => {
  const raw = String(props.variant || 'default').trim().toLowerCase()
  const allowed = new Set(['default', 'flush', 'overflow-hidden'])
  const normalized = allowed.has(raw) ? raw : 'default'
  return normalized === 'default' ? '' : `card--${normalized}`
})

const classes = computed(() => {
  return [
    'card border-0 shadow-sm',
    variantClass.value,
    String(props.className || '').trim(),
  ].filter(Boolean)
})

const bodyClasses = computed(() => {
  return [
    'card-body',
    String(props.bodyClass || '').trim(),
  ].filter(Boolean)
})
</script>

<template>
  <component :is="as" :class="classes">
    <div :class="bodyClasses">
      <slot />
    </div>
  </component>
</template>
