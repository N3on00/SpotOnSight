<script setup>
import { computed, ref, watch } from 'vue'
import { toImageSource } from '../../models/imageMapper'
import { markdownToPlainText } from '../../models/markdownMapper'
import ActionButton from '../common/ActionButton.vue'
import UserProfileCard from '../common/UserProfileCard.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  spot: { type: Object, default: null },
  onLoadUserProfile: { type: Function, default: null },
  onOpenOwnerProfile: { type: Function, default: null },
})

const ownerBusy = ref(false)
const ownerProfile = ref(null)
let ownerLoadRun = 0

watch(
  () => [props.open, props.spot?.id, props.spot?.owner_id, props.onLoadUserProfile],
  () => {
    void refreshOwnerProfile()
  },
  { immediate: true },
)

const ownerAvatar = computed(() => {
  const raw = String(ownerProfile.value?.avatar_image || '').trim()
  return raw ? toImageSource(raw) : ''
})

const ownerTitle = computed(() => {
  if (ownerBusy.value) return 'Loading creator...'
  const name = String(ownerProfile.value?.display_name || ownerProfile.value?.username || '').trim()
  return name || 'Unknown creator'
})

const ownerSubtitle = computed(() => {
  const username = String(ownerProfile.value?.username || '').trim()
  return username ? `@${username}` : ''
})

const ownerDetails = computed(() => {
  if (ownerBusy.value) return ['Fetching creator profile']
  const out = []
  const bio = markdownToPlainText(ownerProfile.value?.bio)
  if (bio) out.push(bio.length > 90 ? `${bio.slice(0, 87)}...` : bio)
  const createdAt = String(ownerProfile.value?.created_at || '').trim()
  if (createdAt) out.push(`Joined ${createdAt.slice(0, 10)}`)
  const ownerId = String(props.spot?.owner_id || '').trim()
  if (!out.length && ownerId) out.push(`ID: ${ownerId}`)
  return out
})

const ownerProfileLinkVisible = computed(() => {
  if (typeof props.onOpenOwnerProfile !== 'function') return false
  return Boolean(String(ownerProfile.value?.id || props.spot?.owner_id || '').trim())
})

async function refreshOwnerProfile() {
  ownerProfile.value = null
  ownerBusy.value = false
  const ownerId = String(props.spot?.owner_id || '').trim()
  if (!props.open || !ownerId || typeof props.onLoadUserProfile !== 'function') return

  const runId = ++ownerLoadRun
  ownerBusy.value = true
  try {
    const profile = await props.onLoadUserProfile(ownerId)
    if (runId !== ownerLoadRun) return
    ownerProfile.value = profile && typeof profile === 'object' ? profile : null
  } finally {
    if (runId === ownerLoadRun) ownerBusy.value = false
  }
}

function openOwnerProfile() {
  if (typeof props.onOpenOwnerProfile !== 'function') return
  const ownerId = String(ownerProfile.value?.id || props.spot?.owner_id || '').trim()
  if (!ownerId) return
  props.onOpenOwnerProfile(ownerId)
}
</script>

<template>
  <section class="spot-owner-box">
    <span class="small text-secondary">Created by</span>
    <UserProfileCard
      :title="ownerTitle"
      :subtitle="ownerSubtitle"
      :avatar="ownerAvatar"
      :details="ownerDetails"
      :compact="true"
    >
      <template #actions>
        <ActionButton
          v-if="ownerProfileLinkVisible"
          class-name="btn btn-sm btn-outline-secondary"
          icon="bi-person-badge"
          label="Profile"
          @click="openOwnerProfile"
        />
      </template>
    </UserProfileCard>
  </section>
</template>
