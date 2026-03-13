<script setup>
const props = defineProps({
  size: { type: String, default: 'md' },
  label: { type: String, default: '' },
  inline: { type: Boolean, default: false },
})

const sizeClass = {
  sm: 'sos-loader--sm',
  md: 'sos-loader--md',
  lg: 'sos-loader--lg',
}[props.size] || 'sos-loader--md'
</script>

<template>
  <span class="sos-loader-wrap" :class="{ 'sos-loader-wrap--inline': inline }" role="status" aria-live="polite">
    <span class="sos-loader" :class="sizeClass" aria-hidden="true">
      <span class="sos-loader__ring"></span>
      <span class="sos-loader__ring sos-loader__ring--alt"></span>
      <span class="sos-loader__core">
        <i class="bi bi-compass-fill"></i>
      </span>
    </span>
    <span class="sos-loader__label" v-if="label">{{ label }}</span>
  </span>
</template>
