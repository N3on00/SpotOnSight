<script setup>
import SosLoader from './SosLoader.vue'
import AppTextElement from './AppTextElement.vue'

const props = defineProps({
  label: { type: String, default: '' },
  icon: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  type: { type: String, default: 'button' },
  className: { type: String, default: 'btn btn-outline-secondary' },
  busyLabel: { type: String, default: 'Loading...' },
  ariaLabel: { type: String, default: '' },
  iconOnly: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])

function onClick(event) {
  if (props.busy || props.disabled) return
  emit('click', event)
  if (Number(event?.detail || 0) > 0) {
    event?.currentTarget?.blur?.()
  }
}

function buttonAriaLabel() {
  if (props.ariaLabel) return props.ariaLabel
  if (props.label) return props.label
  if (props.busy && props.busyLabel) return props.busyLabel
  return 'Action'
}

function buttonClass() {
  const raw = String(props.className || '').trim()
  return raw ? `interactive-hover ${raw}` : 'interactive-hover'
}
</script>

<template>
  <button
    :type="type"
    :class="buttonClass()"
    :disabled="busy || disabled"
    :aria-label="buttonAriaLabel()"
    @click="onClick"
  >
    <SosLoader v-if="busy" size="sm" :label="busyLabel" inline />
    <template v-else-if="$slots.default">
      <slot />
    </template>
    <template v-else-if="iconOnly">
      <i v-if="icon" class="bi" :class="icon"></i>
      <span class="visually-hidden">{{ buttonAriaLabel() }}</span>
    </template>
    <template v-else>
      <i v-if="icon" class="bi me-2 action-button__icon" :class="icon"></i>
      <AppTextElement as="span" variant="button" class-name="action-button__label" nowrap>{{ label }}</AppTextElement>
    </template>
  </button>
</template>
