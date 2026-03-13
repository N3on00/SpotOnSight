<script setup>
import { computed } from 'vue'
import AppTextElement from './AppTextElement.vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  id: { type: String, default: '' },
  name: { type: String, default: '' },
  type: { type: String, default: 'text' },
  as: { type: String, default: 'input' },
  rows: { type: [Number, String], default: 4 },
  placeholder: { type: String, default: '' },
  autocomplete: { type: String, default: '' },
  ariaLabel: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  readonly: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  maxlength: { type: [Number, String], default: null },
  minlength: { type: [Number, String], default: null },
  min: { type: [Number, String], default: null },
  max: { type: [Number, String], default: null },
  step: { type: [Number, String], default: null },
  className: { type: String, default: 'form-control' },
  wrapperClass: { type: String, default: '' },
  labelClass: { type: String, default: 'form-label' },
  hideLabel: { type: Boolean, default: false },
  bare: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'enter', 'change', 'focus', 'blur'])

const controlId = computed(() => String(props.id || '').trim())

const modelText = computed(() => {
  if (props.modelValue == null) return ''
  return String(props.modelValue)
})

const isTextarea = computed(() => String(props.as || 'input').toLowerCase() === 'textarea')

function onInput(event) {
  emit('update:modelValue', event?.target?.value || '')
}

function onEnter() {
  emit('enter')
}

function onChange(event) {
  emit('change', event?.target?.value || '')
}

function onFocus(event) {
  emit('focus', event)
}

function onBlur(event) {
  emit('blur', event)
}
</script>

<template>
  <template v-if="bare">
    <textarea
      v-if="isTextarea"
      :id="controlId || undefined"
      :name="name || undefined"
      :class="className"
      :rows="rows"
      :placeholder="placeholder"
      :aria-label="ariaLabel || label || undefined"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :maxlength="maxlength"
      :minlength="minlength"
      :value="modelText"
      @input="onInput"
      @change="onChange"
      @focus="onFocus"
      @blur="onBlur"
    />

    <input
      v-else
      :id="controlId || undefined"
      :name="name || undefined"
      :type="type"
      :class="className"
      :autocomplete="autocomplete || undefined"
      :placeholder="placeholder"
      :aria-label="ariaLabel || label || undefined"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :maxlength="maxlength"
      :minlength="minlength"
      :min="min"
      :max="max"
      :step="step"
      :value="modelText"
      @input="onInput"
      @change="onChange"
      @focus="onFocus"
      @blur="onBlur"
      @keydown.enter.prevent="onEnter"
    />
  </template>

  <div v-else :class="['app-text-field', wrapperClass]">
    <AppTextElement
      v-if="!hideLabel && label"
      as="label"
      variant="label"
      :for="controlId || undefined"
      :class-name="labelClass"
    >
      {{ label }}
    </AppTextElement>

    <textarea
      v-if="isTextarea"
      :id="controlId || undefined"
      :name="name || undefined"
      :class="className"
      :rows="rows"
      :placeholder="placeholder"
      :aria-label="ariaLabel || label || undefined"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :maxlength="maxlength"
      :minlength="minlength"
      :value="modelText"
      @input="onInput"
      @change="onChange"
      @focus="onFocus"
      @blur="onBlur"
    />

    <input
      v-else
      :id="controlId || undefined"
      :name="name || undefined"
      :type="type"
      :class="className"
      :autocomplete="autocomplete || undefined"
      :placeholder="placeholder"
      :aria-label="ariaLabel || label || undefined"
      :disabled="disabled"
      :readonly="readonly"
      :required="required"
      :maxlength="maxlength"
      :minlength="minlength"
      :min="min"
      :max="max"
      :step="step"
      :value="modelText"
      @input="onInput"
      @change="onChange"
      @focus="onFocus"
      @blur="onBlur"
      @keydown.enter.prevent="onEnter"
    />
  </div>
</template>
