<script setup>
import { computed, ref } from 'vue'
import ActionButton from '../common/ActionButton.vue'
import AppTextField from '../common/AppTextField.vue'
import { toImageSource } from '../../models/imageMapper'

const props = defineProps({
  searchResults: { type: Array, default: () => [] },
  searchBusy: { type: Boolean, default: false },
  followers: { type: Array, default: () => [] },
  following: { type: Array, default: () => [] },
  incomingRequests: { type: Array, default: () => [] },
  blockedUsers: { type: Array, default: () => [] },
  onSearch: { type: Function, required: true },
  onRefresh: { type: Function, required: true },
  onFollow: { type: Function, required: true },
  onUnfollow: { type: Function, required: true },
  onApproveRequest: { type: Function, required: true },
  onRejectRequest: { type: Function, required: true },
  onRemoveFollower: { type: Function, required: true },
  onBlock: { type: Function, required: true },
  onUnblock: { type: Function, required: true },
  onOpenProfile: { type: Function, required: true },
})

const searchText = ref('')
const activeTab = ref('requests')

const tabUsers = computed(() => {
  if (activeTab.value === 'followers') return props.followers
  if (activeTab.value === 'following') return props.following
  if (activeTab.value === 'blocked') return props.blockedUsers
  return props.incomingRequests
})

const followingIds = computed(() => {
  const out = new Set()
  for (const entry of Array.isArray(props.following) ? props.following : []) {
    const id = userId(entry)
    if (id) out.add(id)
  }
  return out
})

function displayName(user) {
  const source = user?.follower || user
  return String(source?.display_name || source?.username || 'Unknown user')
}

function username(user) {
  const source = user?.follower || user
  const value = String(source?.username || '').trim()
  return value ? `@${value}` : 'no username'
}

function userId(user) {
  const source = user?.follower || user
  return String(source?.id || '')
}

function avatarSource(user) {
  const source = user?.follower || user
  const raw = String(source?.avatar_image || '').trim()
  if (!raw) return ''
  return toImageSource(raw)
}

function submitSearch() {
  props.onSearch(searchText.value)
}

function isFollowingUser(user) {
  const id = userId(user)
  if (!id) return false
  return followingIds.value.has(id)
}
</script>

<template>
  <section class="card border-0 shadow-sm" data-aos="fade-up" data-aos-delay="70">
    <div class="card-body d-grid gap-3 p-4">
      <div class="social-search-row">
        <AppTextField
          bare
          class-name="form-control"
          v-model="searchText"
          placeholder="Search users by username"
          aria-label="Search users by username"
          @enter="submitSearch"
        />
        <ActionButton
          label="Search"
          icon="bi-search"
          :busy="searchBusy"
          busy-label="Searching..."
          class-name="btn btn-primary"
          @click="submitSearch"
        />
        <ActionButton label="Refresh" icon="bi-arrow-repeat" class-name="btn btn-outline-secondary" @click="onRefresh" />
      </div>

      <div class="social-search-results" v-if="searchResults.length">
        <article class="social-user-row" v-for="user in searchResults" :key="`search-${user.id}`">
          <div class="social-user-main">
            <div class="social-user-avatar" v-if="avatarSource(user)">
              <img :src="avatarSource(user)" alt="avatar" loading="lazy" />
            </div>
            <div class="social-user-avatar social-user-avatar--empty" v-else>
              <i class="bi bi-person"></i>
            </div>
            <div>
            <div class="fw-semibold">{{ displayName(user) }}</div>
            <div class="small text-secondary">{{ username(user) }}</div>
            </div>
          </div>
          <div class="social-user-row__actions">
            <ActionButton class-name="btn btn-sm btn-outline-secondary" label="Profile" @click="onOpenProfile(userId(user))" />
            <ActionButton
              v-if="!isFollowingUser(user)"
              class-name="btn btn-sm btn-primary"
              label="Follow"
              @click="onFollow(userId(user))"
            />
            <ActionButton
              v-else
              class-name="btn btn-sm btn-outline-primary"
              label="Unfollow"
              @click="onUnfollow(userId(user))"
            />
            <ActionButton class-name="btn btn-sm btn-outline-danger" label="Block" @click="onBlock(userId(user))" />
          </div>
        </article>
      </div>

      <div class="social-tabs btn-group" role="group" aria-label="Social tabs">
        <ActionButton
          :class-name="activeTab === 'requests' ? 'btn btn-primary' : 'btn btn-outline-primary'"
          :label="`Requests (${incomingRequests.length})`"
          @click="activeTab = 'requests'"
        />
        <ActionButton
          :class-name="activeTab === 'followers' ? 'btn btn-primary' : 'btn btn-outline-primary'"
          :label="`Followers (${followers.length})`"
          @click="activeTab = 'followers'"
        />
        <ActionButton
          :class-name="activeTab === 'following' ? 'btn btn-primary' : 'btn btn-outline-primary'"
          :label="`Following (${following.length})`"
          @click="activeTab = 'following'"
        />
        <ActionButton
          :class-name="activeTab === 'blocked' ? 'btn btn-primary' : 'btn btn-outline-primary'"
          :label="`Blocked (${blockedUsers.length})`"
          @click="activeTab = 'blocked'"
        />
      </div>

      <div class="social-user-list" v-if="tabUsers.length">
        <article class="social-user-row" v-for="user in tabUsers" :key="`${activeTab}-${userId(user)}`">
          <div class="social-user-main">
            <div class="social-user-avatar" v-if="avatarSource(user)">
              <img :src="avatarSource(user)" alt="avatar" loading="lazy" />
            </div>
            <div class="social-user-avatar social-user-avatar--empty" v-else>
              <i class="bi bi-person"></i>
            </div>
            <div>
            <div class="fw-semibold">{{ displayName(user) }}</div>
            <div class="small text-secondary">{{ username(user) }}</div>
            </div>
          </div>
          <div class="social-user-row__actions">
            <ActionButton class-name="btn btn-sm btn-outline-secondary" label="Profile" @click="onOpenProfile(userId(user))" />
            <ActionButton v-if="activeTab === 'requests'" class-name="btn btn-sm btn-primary" label="Approve" @click="onApproveRequest(userId(user))" />
            <ActionButton v-if="activeTab === 'requests'" class-name="btn btn-sm btn-outline-danger" label="Reject" @click="onRejectRequest(userId(user))" />
            <ActionButton v-if="activeTab === 'followers'" class-name="btn btn-sm btn-outline-primary" label="Remove" @click="onRemoveFollower(userId(user))" />
            <ActionButton v-if="activeTab === 'followers' || activeTab === 'following'" class-name="btn btn-sm btn-outline-danger" label="Block" @click="onBlock(userId(user))" />
            <ActionButton v-if="activeTab === 'blocked'" class-name="btn btn-sm btn-outline-success" label="Unblock" @click="onUnblock(userId(user))" />
          </div>
        </article>
      </div>
      <div class="text-secondary small" v-else>
        No users in this list.
      </div>
    </div>
  </section>
</template>
