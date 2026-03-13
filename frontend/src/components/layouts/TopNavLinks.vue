<script setup>
import ActionButton from '../common/ActionButton.vue'

defineProps({
  entries: { type: Array, default: () => [] },
  navIconOnly: { type: Boolean, default: false },
  isActive: { type: Function, required: true },
  onOpen: { type: Function, required: true },
})
</script>

<template>
  <div class="app-top-nav__links app-top-nav__links--primary" :class="{ 'app-top-nav__links--icon-only': navIconOnly }">
    <ActionButton
      v-for="entry in entries"
      :key="`app-nav-${entry.key}`"
      :class-name="isActive(entry) ? 'btn btn-primary app-top-nav__link app-top-nav__link--active' : 'btn btn-outline-secondary app-top-nav__link'"
      :icon="entry.icon"
      :label="navIconOnly ? '' : entry.label"
      :icon-only="navIconOnly"
      :aria-label="entry.label"
      @click="onOpen(entry)"
    />
  </div>
</template>
