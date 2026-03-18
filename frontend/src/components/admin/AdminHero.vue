<script setup>
const props = defineProps({
  reportsCount: { type: Number, default: 0 },
  flaggedUsersCount: { type: Number, default: 0 },
  hiddenSpotsCount: { type: Number, default: 0 },
})
</script>

<template>
  <section class="card border-0 shadow-sm overflow-hidden admin-hero" data-aos="fade-up">
    <div class="card-body p-4 p-lg-5">
      <div class="d-flex flex-column flex-lg-row gap-4 align-items-lg-end justify-content-between">
        <div>
          <span class="badge text-bg-warning-subtle text-warning-emphasis mb-3">Admin moderation</span>
          <h1 class="display-6 mb-2">Review reports, apply strikes, and protect the feed.</h1>
          <p class="text-secondary mb-0">Admins bypass normal spot visibility filters and can issue warnings, posting timeouts, or bans.</p>
        </div>
        <div class="admin-hero__stats">
          <div class="admin-hero__stat">
            <strong>{{ reportsCount }}</strong>
            <span>open reports</span>
          </div>
          <div class="admin-hero__stat">
            <strong>{{ flaggedUsersCount }}</strong>
            <span>watched users</span>
          </div>
          <div class="admin-hero__stat">
            <strong>{{ hiddenSpotsCount }}</strong>
            <span>hidden spots</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.admin-hero {
  background:
    radial-gradient(circle at top left, rgba(255, 193, 7, 0.18), transparent 40%),
    linear-gradient(135deg, rgba(12, 23, 48, 0.98), rgba(36, 55, 84, 0.96));
  color: #f7f4ea;
}

.admin-hero__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
  min-width: min(100%, 26rem);
}

.admin-hero__stat {
  display: flex;
  flex-direction: column;
  padding: 0.9rem 1rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.08);
}

.admin-hero__stat strong {
  font-size: 1.7rem;
  line-height: 1;
}

.admin-hero__stat span {
  color: rgba(247, 244, 234, 0.78);
  font-size: 0.9rem;
  margin-top: 0.35rem;
}

@media (max-width: 767px) {
  .admin-hero__stats {
    grid-template-columns: 1fr;
  }
}
</style>
