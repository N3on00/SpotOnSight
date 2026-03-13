<script setup>
import SlotHost from '../core/SlotHost.vue'
import { UI_SLOTS } from '../../core/uiElements'

defineProps({
  screen: { type: String, required: true },
  slots: { type: Array, default: () => [UI_SLOTS.HEADER, UI_SLOTS.MAIN, UI_SLOTS.FOOTER] },
  screenCtx: { type: Object, default: () => ({}) },
  screenClass: { type: String, default: '' },
})
</script>

<template>
  <main :class="['screen', screenClass]">
    <SlotHost
      v-for="slot in slots"
      :key="`${screen}-${slot}`"
      :screen="screen"
      :slot="slot"
      :screen-ctx="screenCtx"
    />
  </main>
</template>
