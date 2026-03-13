<script setup>
import { computed } from 'vue'
import { useApp } from '../../core/injection'

const props = defineProps({
  screen: { type: String, required: true },
  slot: { type: String, required: true },
  screenCtx: { type: Object, default: () => ({}) },
})

const app = useApp()

const specs = computed(() => app.ui.getSlotComponents(props.screen, props.slot, props.screenCtx))
</script>

<template>
  <div class="slot-host">
    <component
      :is="spec.component"
      v-for="spec in specs"
      :key="spec.id"
      v-bind="spec.props"
    />
  </div>
</template>
