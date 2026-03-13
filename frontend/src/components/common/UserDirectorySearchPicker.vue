<script setup>
import { ref, watch } from 'vue'
import { toImageSource } from '../../models/imageMapper'
import { UserDirectorySearchProvider } from '../../search/userDirectorySearchProvider'
import EntitySearchPicker from './EntitySearchPicker.vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  searchAllUsers: { type: Function, required: true },
  loadFriendUsers: { type: Function, required: true },
  loadUserProfile: { type: Function, default: null },
  disabled: { type: Boolean, default: false },
  maxSelected: { type: Number, default: 40 },
  limit: { type: Number, default: 20 },
  label: { type: String, default: 'Invite users' },
})

const emit = defineEmits(['update:modelValue'])

const providerRef = ref(
  new UserDirectorySearchProvider({
    searchAllUsers: props.searchAllUsers,
    loadFriendUsers: props.loadFriendUsers,
    defaultLimit: props.limit,
    returnFriendMatchesWithoutQuery: false,
    includeFriendMatches: false,
    excludeFriendsFromGlobal: true,
  }),
)

watch(
  () => [props.searchAllUsers, props.loadFriendUsers, props.loadUserProfile, props.limit],
  () => {
    providerRef.value = new UserDirectorySearchProvider({
      searchAllUsers: props.searchAllUsers,
      loadFriendUsers: props.loadFriendUsers,
      defaultLimit: props.limit,
      returnFriendMatchesWithoutQuery: false,
      includeFriendMatches: false,
      excludeFriendsFromGlobal: true,
    })

    friendDirectoryPromise = null
    profileCache.clear()
  },
)

const scopes = [{ value: 'all', label: 'Users' }]
const profileCache = new Map()
let friendDirectoryPromise = null

function avatarOf(user) {
  const raw = String(user?.avatar_image || '').trim()
  if (!raw) return ''
  return toImageSource(raw)
}

function subtitleOf(user) {
  const username = String(user?.username || '').trim()
  if (username) {
    return `@${username}`
  }
  const email = String(user?.email || '').trim()
  return email || String(user?.id || '')
}

function titleOf(user) {
  return String(user?.display_name || user?.username || user?.id || 'Unknown user')
}

function detailsOf(user) {
  const details = []

  const email = String(user?.email || '').trim()
  if (email) {
    details.push(email)
  }

  if (Boolean(user?.follow_requires_approval)) {
    details.push('Follow by request')
  }

  if (!details.length) {
    const id = String(user?.id || '').trim()
    if (id) {
      details.push(`ID: ${id}`)
    }
  }

  return details
}

async function friendDirectory() {
  if (!friendDirectoryPromise) {
    friendDirectoryPromise = Promise
      .resolve(props.loadFriendUsers())
      .then((items) => (Array.isArray(items) ? items : []))
      .catch(() => [])
  }

  return friendDirectoryPromise
}

async function resolveByIds(ids) {
  const normalized = [...new Set(
    (Array.isArray(ids) ? ids : [])
      .map((id) => String(id || '').trim())
      .filter(Boolean),
  )]

  if (!normalized.length) return []

  const byId = new Map()
  const friends = await friendDirectory()

  for (const friend of friends) {
    const id = String(friend?.id || '').trim()
    if (!id || byId.has(id)) continue
    byId.set(id, friend)
  }

  const missing = []
  for (const id of normalized) {
    if (!byId.has(id)) {
      missing.push(id)
    }
  }

  if (missing.length && typeof props.loadUserProfile === 'function') {
    const loaded = await Promise.all(
      missing.map(async (id) => {
        if (profileCache.has(id)) {
          return profileCache.get(id)
        }

        const user = await Promise
          .resolve(props.loadUserProfile(id))
          .catch(() => null)

        profileCache.set(id, user || null)
        return user
      }),
    )

    for (const user of loaded) {
      const id = String(user?.id || '').trim()
      if (!id || byId.has(id)) continue
      byId.set(id, user)
    }
  }

  return normalized
    .map((id) => byId.get(id))
    .filter(Boolean)
}

function onUpdate(value) {
  emit('update:modelValue', Array.isArray(value) ? value : [])
}
</script>

<template>
  <EntitySearchPicker
    :model-value="modelValue"
    :provider="providerRef"
    :label="label"
    placeholder="Search users to invite"
    :scopes="scopes"
    search-button-label="Find"
    searching-label="Searching..."
    idle-hint="Search users to invite. Selected users are shown above."
    empty-results-text="No matching users found in search."
    search-results-label="Search results"
    :item-title="titleOf"
    :item-subtitle="subtitleOf"
    :item-avatar="avatarOf"
    :item-details="detailsOf"
    :resolve-by-ids="resolveByIds"
    :disabled="disabled"
    :multiple="true"
    :max-selected="maxSelected"
    :limit="limit"
    @update:modelValue="onUpdate"
  />
</template>
