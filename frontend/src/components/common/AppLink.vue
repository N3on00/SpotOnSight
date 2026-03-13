<script setup>
import AppTextElement from './AppTextElement.vue'

const props = defineProps({
  href: { type: String, default: '#' },
  target: { type: String, default: '' },
  rel: { type: String, default: '' },
  variant: { type: String, default: 'body' },
  className: { type: String, default: '' },
  underline: { type: Boolean, default: false },
})

function computedRel() {
  const r = String(props.rel || '').trim()
  if (props.target === '_blank' && !r.includes('noreferrer')) {
    return `${r} noreferrer noopener`.trim()
  }
  return r || undefined
}
</script>

<template>
  <a
    :href="href"
    :target="target || undefined"
    :rel="computedRel()"
    :class="['app-link', underline ? 'app-link--underline' : '', String(className || '').trim()]"
  >
    <slot><AppTextElement :variant="variant" /></slot>
  </a>
</template>

<style>
.app-link {
  color: var(--bs-primary);
  text-decoration: none;
  transition: color 0.2s ease;
}

.app-link:hover {
  color: var(--bs-primary-hover, #0a58ca);
}

.app-link--underline {
  text-decoration: underline;
}
</style>
