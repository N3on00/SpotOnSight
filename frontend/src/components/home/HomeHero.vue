<script setup>
defineProps({
  username: { type: String, default: '' },
})
</script>

<template>
  <section class="card border-0 shadow-sm hero-card" data-aos="fade-down">
    <div class="card-body p-4 p-lg-5">
      <div>
        <p class="eyebrow">SpotOnSight</p>
        <h1 class="display-6 fw-bold mb-2">Welcome back{{ username ? `, ${username}` : '' }}</h1>
        <p class="lead text-secondary mb-0">Discover, save, and share unique places with your network.</p>
      </div>
    </div>
  </section>
</template>
