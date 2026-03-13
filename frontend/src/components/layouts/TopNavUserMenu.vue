<script setup>
import ActionButton from '../common/ActionButton.vue'
import UserProfileCard from '../common/UserProfileCard.vue'

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  avatar: { type: String, default: '' },
  details: { type: Array, default: () => [] },
  onProfile: { type: Function, required: true },
  onSettings: { type: Function, required: true },
  onSupport: { type: Function, required: true },
  onLogout: { type: Function, required: true },
})
</script>

<template>
  <section class="card border-0 shadow-sm app-top-nav__panel-card">
    <UserProfileCard
      :title="title"
      :subtitle="subtitle"
      :avatar="avatar"
      :details="details"
      compact
    >
      <template #actions>
        <ActionButton class-name="btn btn-sm btn-outline-secondary" icon="bi-person" label="My profile" @click="onProfile" />
        <ActionButton class-name="btn btn-sm btn-outline-secondary" icon="bi-gear" label="Settings" @click="onSettings" />
        <ActionButton class-name="btn btn-sm btn-outline-secondary" icon="bi-life-preserver" label="Support" @click="onSupport" />
        <ActionButton class-name="btn btn-sm btn-outline-danger" icon="bi-box-arrow-right" label="Logout" @click="onLogout" />
      </template>
    </UserProfileCard>
  </section>
</template>
