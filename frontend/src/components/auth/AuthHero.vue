<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
})
</script>

<template>
  <section class="card border-0 shadow-sm hero-card" data-aos="fade-down">
    <div class="card-body p-4 p-md-5">
      <div class="d-flex align-items-center gap-3 mb-3">
        <div class="brand rounded-4"><i class="bi bi-compass-fill"></i></div>
        <span class="badge-soft px-3 py-2">SpotOnSight</span>
      </div>
      <h1 class="display-6 fw-bold mb-2">{{ title }}</h1>
      <p class="lead text-secondary mb-0">{{ subtitle }}</p>
    </div>
  </section>
</template>
