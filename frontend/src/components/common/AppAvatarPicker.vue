<script setup>
import { computed, ref } from 'vue'
import { toImageSource } from '../../models/imageMapper'
import { readFileAsBase64 } from '../../utils/fileBase64'
import ActionButton from './ActionButton.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: 'Profile picture' },
  disabled: { type: Boolean, default: false },
  accept: { type: String, default: 'image/png,image/jpeg,image/webp' },
  clearable: { type: Boolean, default: true },
})

const emit = defineEmits(['update:modelValue'])
const fileInput = ref(null)

const previewSrc = computed(() => {
  const raw = String(props.modelValue || '').trim()
  if (!raw) return ''
  return toImageSource(raw)
})

function openPicker() {
  if (props.disabled) return
  fileInput.value?.click()
}

async function onFileChange(event) {
  const file = event?.target?.files?.[0]
  if (!file) return

  try {
    const imageBase64 = await readFileAsBase64(file)
    emit('update:modelValue', imageBase64)
  } catch {
    emit('update:modelValue', '')
  }

  if (event.target) {
    event.target.value = ''
  }
}

function clearImage() {
  emit('update:modelValue', '')
}
</script>

<template>
  <div class="app-avatar-picker">
    <label class="form-label mb-1">{{ label }}</label>

    <div class="app-avatar-picker__row">
      <button
        type="button"
        class="app-avatar-picker__trigger"
        :disabled="disabled"
        :aria-label="previewSrc ? 'Change profile picture' : 'Upload profile picture'"
        @click="openPicker"
      >
        <span class="app-avatar-picker__image" v-if="previewSrc">
          <img :src="previewSrc" alt="Profile picture preview" loading="lazy" />
        </span>
        <span class="app-avatar-picker__image app-avatar-picker__image--empty" v-else>
          <i class="bi bi-person"></i>
        </span>
      </button>

      <div class="app-avatar-picker__meta">
        <p class="small text-secondary mb-1">Click the avatar to choose your profile picture.</p>
        <p class="small text-secondary mb-0">PNG, JPG, and WEBP are supported.</p>
        <ActionButton
          v-if="clearable && previewSrc"
          class-name="btn btn-sm btn-outline-secondary mt-2"
          icon="bi-x-circle"
          label="Remove photo"
          :disabled="disabled"
          @click="clearImage"
        />
      </div>
    </div>

    <input
      ref="fileInput"
      class="app-avatar-picker__input"
      type="file"
      :accept="accept"
      :disabled="disabled"
      @change="onFileChange"
    />
  </div>
</template>
