<script setup>
import ActionButton from '../common/ActionButton.vue'

defineProps({
  onReload: { type: Function, required: true },
  reloadBusy: { type: Boolean, default: false },
})
</script>

<template>
  <section class="card border-0 shadow-sm map-header" data-aos="fade-down">
    <div class="card-body d-grid d-md-flex align-items-md-center gap-3 p-3 p-md-4">
      <div class="flex-grow-1">
        <h2 class="h3 mb-1">Explore Map</h2>
        <p class="text-secondary mb-0">Create, edit, favorite and share spots.</p>
      </div>
      <ActionButton
        label="Reload"
        icon="bi-arrow-clockwise"
        :busy="reloadBusy"
        busy-label="Reloading..."
        class-name="btn btn-primary"
        @click="onReload"
      />
    </div>
  </section>
</template>
