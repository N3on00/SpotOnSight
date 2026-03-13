<script setup>
import ActionButton from '../common/ActionButton.vue'

defineProps({
  supportEmail: { type: String, required: true },
  onHelp: { type: Function, required: true },
})
</script>

<template>
  <section class="card border-0 shadow-sm" data-aos="fade-up" data-aos-delay="100">
    <div class="card-body d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
      <div>
        <h3 class="h5 mb-1">Need help?</h3>
        <p class="text-secondary mb-1">Contact support if login or registration is blocked.</p>
        <p class="mb-0 fw-semibold"><i class="bi bi-envelope me-2"></i>{{ supportEmail }}</p>
      </div>
      <ActionButton class-name="btn btn-outline-secondary" icon="bi-life-preserver" label="Support" @click="onHelp" />
    </div>
  </section>
</template>
