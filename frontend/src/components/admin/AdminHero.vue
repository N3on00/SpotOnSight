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
        <div class="admin-hero__visual" aria-hidden="true">
          <div class="admin-hero__shield">
            <i class="bi bi-shield-check"></i>
          </div>
          <div class="admin-hero__signal admin-hero__signal--one"></div>
          <div class="admin-hero__signal admin-hero__signal--two"></div>
          <div class="admin-hero__signal admin-hero__signal--three"></div>
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

.admin-hero .card-body {
  position: relative;
}

.admin-hero__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.85rem;
  min-width: min(100%, 26rem);
  position: relative;
  z-index: 1;
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

.admin-hero__visual {
  position: absolute;
  top: 1.3rem;
  right: 1.5rem;
  width: 11rem;
  height: 11rem;
  pointer-events: none;
  opacity: 0.95;
}

.admin-hero__shield {
  position: absolute;
  inset: 1.8rem;
  display: grid;
  place-items: center;
  border-radius: 2rem;
  background: linear-gradient(180deg, rgba(255, 215, 128, 0.3), rgba(255, 255, 255, 0.08));
  border: 1px solid rgba(255, 226, 158, 0.34);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(6px);
}

.admin-hero__shield i {
  font-size: 2.2rem;
  color: #ffe09a;
}

.admin-hero__signal {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(255, 226, 158, 0.22);
  border-radius: 2.6rem;
}

.admin-hero__signal--one {
  inset: 0.4rem;
}

.admin-hero__signal--two {
  inset: 1.2rem;
}

.admin-hero__signal--three {
  inset: 2rem;
}

[data-theme='dark'] .admin-hero {
  background:
    radial-gradient(circle at top left, rgba(255, 193, 7, 0.16), transparent 38%),
    linear-gradient(135deg, rgba(12, 21, 31, 0.98), rgba(24, 39, 56, 0.98));
}

[data-theme='dark'] .admin-hero__shield {
  background: linear-gradient(180deg, rgba(255, 194, 87, 0.18), rgba(88, 116, 150, 0.12));
  border-color: rgba(255, 226, 158, 0.26);
}

@media (max-width: 767px) {
  .admin-hero__stats {
    grid-template-columns: 1fr;
  }

  .admin-hero__visual {
    position: relative;
    top: auto;
    right: auto;
    width: 100%;
    height: 7rem;
    margin-top: 0.4rem;
  }
}
</style>
