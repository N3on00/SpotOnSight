<script setup>
import { computed, ref } from 'vue'
import ActionButton from '../common/ActionButton.vue'
import AppTextField from '../common/AppTextField.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  type: { type: String, default: 'text' },
  autocomplete: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  hintText: { type: String, default: '' },
  ruleText: { type: String, default: '' },
  ruleOk: { type: Boolean, default: false },
  requirements: { type: Array, default: () => [] },
  allowReveal: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'enter'])

function onEnter() {
  emit('enter')
}

const reveal = ref(false)

const inputType = computed(() => {
  if (props.allowReveal && props.type === 'password') {
    return reveal.value ? 'text' : 'password'
  }
  return props.type
})

const normalizedRequirements = computed(() => {
  if (Array.isArray(props.requirements) && props.requirements.length > 0) {
    return props.requirements
      .map((item) => {
        if (!item) return null
        if (typeof item === 'string') {
          const text = item.trim()
          if (!text) return null
          return { text, ok: false }
        }

        const text = String(item.text || '').trim()
        if (!text) return null
        return {
          text,
          ok: Boolean(item.ok),
        }
      })
      .filter(Boolean)
  }

  if (props.ruleText) {
    return [{ text: props.ruleText, ok: props.ruleOk }]
  }

  return []
})
</script>

<template>
  <div>
    <label class="form-label">{{ label }}</label>
    <div class="input-group" v-if="allowReveal && type === 'password'">
      <AppTextField
        bare
        class-name="form-control auth-form-input"
        :type="inputType"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :model-value="modelValue"
        :aria-label="label"
        @update:modelValue="(value) => emit('update:modelValue', value)"
        @enter="onEnter"
      />
      <ActionButton
        class-name="btn btn-outline-secondary"
        :label="reveal ? 'Hide' : 'Show'"
        @click="reveal = !reveal"
      />
    </div>
    <AppTextField
      v-else
      bare
      class-name="form-control auth-form-input"
      :type="inputType"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      :model-value="modelValue"
      :aria-label="label"
      @update:modelValue="(value) => emit('update:modelValue', value)"
      @enter="onEnter"
    />
    <div class="form-text" v-if="hintText">{{ hintText }}</div>

    <ul class="auth-rules" v-if="normalizedRequirements.length > 0">
      <li
        class="auth-rule"
        :class="rule.ok ? 'auth-rule--ok' : 'auth-rule--pending'"
        v-for="(rule, index) in normalizedRequirements"
        :key="`${label}-${index}-${rule.text}`"
      >
        <i class="bi" :class="rule.ok ? 'bi-check-circle-fill' : 'bi-dot'"></i>
        {{ rule.text }}
      </li>
    </ul>
  </div>
</template>
