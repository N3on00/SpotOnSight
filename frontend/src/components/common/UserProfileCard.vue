<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, default: 'Unknown user' },
  subtitle: { type: String, default: '' },
  avatar: { type: String, default: '' },
  details: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false },
})

const normalizedDetails = computed(() => {
  if (!Array.isArray(props.details)) return []
  return props.details
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
})
</script>

<template>
  <article class="user-profile-card" :class="{ 'user-profile-card--compact': compact }">
    <div class="user-profile-card__main">
      <div class="user-profile-card__avatar" v-if="avatar">
        <img :src="avatar" alt="user avatar" loading="lazy" />
      </div>
      <div class="user-profile-card__avatar user-profile-card__avatar--empty" v-else>
        <i class="bi bi-person"></i>
      </div>

      <div class="user-profile-card__identity">
        <div class="fw-semibold">{{ title }}</div>
        <div class="small text-secondary" v-if="subtitle">{{ subtitle }}</div>
        <div class="user-profile-card__details" v-if="normalizedDetails.length">
          <span v-for="detail in normalizedDetails" :key="detail">{{ detail }}</span>
        </div>
      </div>
    </div>

    <div class="user-profile-card__actions" v-if="$slots.actions">
      <slot name="actions" />
    </div>
  </article>
</template>
