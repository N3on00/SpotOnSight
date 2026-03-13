<script setup>
import { computed, ref, watch } from 'vue'
import { toImageSource } from '../../models/imageMapper'
import { useOwnerProfiles } from '../../composables/useOwnerProfiles'
import SpotDetailsModal from '../map/SpotDetailsModal.vue'
import SpotMiniCard from '../common/SpotMiniCard.vue'
import ActionButton from '../common/ActionButton.vue'
import AppMarkdownBlock from '../common/AppMarkdownBlock.vue'
import AppLink from '../common/AppLink.vue'
import { useSpotComments } from '../../composables/useSpotComments'
import { useSpotInteractions } from '../../composables/useSpotInteractions'

const props = defineProps({
  profile: { type: Object, default: null },
  createdSpots: { type: Array, default: () => [] },
  favoriteSpots: { type: Array, default: () => [] },
  favorites: { type: Array, default: () => [] },
  isOwnProfile: { type: Boolean, default: false },
  isFollowingProfile: { type: Boolean, default: false },
  followBusy: { type: Boolean, default: false },
  onFollowProfile: { type: Function, required: true },
  onUnfollowProfile: { type: Function, required: true },
  onGoToSpot: { type: Function, required: true },
  onToggleFavorite: { type: Function, required: true },
  onLoadUserProfile: { type: Function, required: true },
  onOpenProfile: { type: Function, required: true },
  onNotify: { type: Function, required: true },
  onEditProfile: { type: Function, default: null },
  onListComments: { type: Function, required: true },
  onCreateComment: { type: Function, required: true },
  onUpdateComment: { type: Function, required: true },
  onDeleteComment: { type: Function, required: true },
  currentUserId: { type: String, default: '' },
})

const activeTab = ref('created')
const { ownerLabel, warmOwnerProfiles } = useOwnerProfiles((ownerId) => props.onLoadUserProfile(ownerId))
const favoritesSet = computed(() => new Set((props.favorites || []).map((id) => String(id))))
const currentUserId = computed(() => String(props.currentUserId || '').trim())
const {
  detailsOpen,
  selectedSpot,
  openSpotDetails,
  closeSpotDetails,
  toggleFavoriteForSpot,
  goToSpot,
} = useSpotInteractions({
  isFavorite: (spot) => isFavorite(spot),
  onToggleFavorite: (spotId, currentlyFavorite) => props.onToggleFavorite(spotId, currentlyFavorite),
  onGoToSpot: (spot) => props.onGoToSpot(spot),
})
const {
  comments,
  commentsLoading,
  commentsBusy,
  commentDraft,
  createComment,
  updateComment,
  deleteComment,
} = useSpotComments({
  selectedSpot,
  detailsOpen,
  currentUserId,
  listComments: (spotId) => props.onListComments(spotId),
  createComment: (spotId, message) => props.onCreateComment(spotId, message),
  updateComment: (commentId, message) => props.onUpdateComment(commentId, message),
  deleteComment: (commentId) => props.onDeleteComment(commentId),
})

const activeSpots = computed(() => {
  if (activeTab.value === 'favorites') {
    return props.favoriteSpots
  }
  return props.createdSpots
})

watch(
  () => [props.createdSpots, props.favoriteSpots],
  ([createdSpots, favoriteSpots]) => {
    void warmOwnerProfiles([...(createdSpots || []), ...(favoriteSpots || [])])
  },
  { immediate: true, deep: true },
)

function avatarSource() {
  const raw = String(props.profile?.avatar_image || '').trim()
  if (!raw) return ''
  return toImageSource(raw)
}

function displayName() {
  return String(props.profile?.display_name || props.profile?.username || 'Unknown user')
}

function socialEntries() {
  const source = props.profile?.social_accounts
  if (!source || typeof source !== 'object') return []
  return Object.entries(source)
    .map(([k, v]) => [String(k || '').trim(), String(v || '').trim()])
    .filter(([k, v]) => k && v)
}

function socialLabel(key, value) {
  const normalizedKey = String(key || '').trim().toLowerCase()
  if (normalizedKey === 'website' || normalizedKey.startsWith('website_')) {
    return String(value || '').trim()
  }
  return String(key || '').trim()
}

function isFavorite(spot) {
  const id = String(spot?.id || '').trim()
  if (!id) return false
  return favoritesSet.value.has(id)
}

function openOwnerProfile(userId) {
  const ownerId = String(userId || '').trim()
  if (!ownerId) return
  props.onOpenProfile(ownerId)
}

async function followProfile() {
  await props.onFollowProfile()
}

async function unfollowProfile() {
  await props.onUnfollowProfile()
}

function editOwnProfile() {
  if (typeof props.onEditProfile !== 'function') return
  props.onEditProfile()
}

function setCommentDraft(next) {
  commentDraft.value = String(next || '')
}
</script>

<template>
  <section class="card border-0 shadow-sm" data-aos="fade-up" data-aos-delay="80">
    <div class="card-body d-grid gap-3 p-4">
      <div class="profile-head" v-if="profile">
        <div class="profile-avatar" v-if="avatarSource()">
          <img :src="avatarSource()" alt="profile avatar" loading="lazy" />
        </div>
        <div class="profile-avatar profile-avatar--empty" v-else>
          <i class="bi bi-person"></i>
        </div>
        <div>
          <h2 class="h4 mb-1">{{ displayName() }}</h2>
          <div class="text-secondary small mb-2">@{{ profile.username || 'unknown' }}</div>
          <AppMarkdownBlock
            class-name="profile-bio mb-2"
            :content="profile.bio"
            empty-text="No biography provided."
          />
          <div class="profile-social-links" v-if="socialEntries().length">
            <AppLink
              v-for="([key, value]) in socialEntries()"
              :key="`social-${key}`"
              :href="value"
              target="_blank"
              rel="noreferrer noopener"
            >
              <span class="profile-social-link__text">{{ socialLabel(key, value) }}</span>
            </AppLink>
          </div>
          <div class="d-flex flex-wrap gap-2 mt-2" v-if="isOwnProfile">
            <ActionButton
              class-name="btn btn-outline-primary"
              icon="bi-pencil-square"
              label="Edit profile"
              @click="editOwnProfile"
            />
          </div>
          <div class="d-flex flex-wrap gap-2 mt-2" v-if="!isOwnProfile">
            <ActionButton
              v-if="isFollowingProfile"
              class-name="btn btn-outline-danger"
              icon="bi-person-dash"
              label="Unfollow"
              :busy="followBusy"
              busy-label="Saving..."
              @click="unfollowProfile"
            />
            <ActionButton
              v-else
              class-name="btn btn-primary"
              icon="bi-person-plus"
              label="Follow"
              :busy="followBusy"
              busy-label="Saving..."
              @click="followProfile"
            />
          </div>
        </div>
      </div>

      <div class="social-tabs btn-group" role="group" aria-label="Profile spot tabs">
        <ActionButton
          :class-name="activeTab === 'created' ? 'btn btn-primary' : 'btn btn-outline-primary'"
          :label="`Created (${createdSpots.length})`"
          @click="activeTab = 'created'"
        />
        <ActionButton
          :class-name="activeTab === 'favorites' ? 'btn btn-primary' : 'btn btn-outline-primary'"
          :label="`Favorites (${favoriteSpots.length})`"
          @click="activeTab = 'favorites'"
        />
      </div>

      <div class="spot-feed" v-if="activeSpots.length">
        <SpotMiniCard
          v-for="spot in activeSpots"
          :key="`profile-spot-${spot.id}`"
          :spot="spot"
          :owner-label="ownerLabel(spot)"
          :is-favorite="isFavorite(spot)"
          :interactive="true"
          :show-visibility-badge="true"
          @open="openSpotDetails"
        >
          <template #top-actions>
            <div class="spot-card-mini__quick-actions">
              <ActionButton
                :class-name="isFavorite(spot) ? 'btn btn-sm btn-warning' : 'btn btn-sm btn-outline-warning'"
                :icon="isFavorite(spot) ? 'bi-heart-fill' : 'bi-heart'"
                :icon-only="true"
                :aria-label="isFavorite(spot) ? 'Unlike spot' : 'Like spot'"
                @click.stop="toggleFavoriteForSpot(spot)"
              />
              <ActionButton
                class-name="btn btn-sm btn-outline-secondary"
                label="Details"
                @click.stop="openSpotDetails(spot)"
              />
            </div>
          </template>
        </SpotMiniCard>
      </div>
      <div class="text-secondary small" v-else>No spots in this section.</div>

      <SpotDetailsModal
        :open="detailsOpen"
        :spot="selectedSpot"
        :is-favorite="isFavorite(selectedSpot)"
        :can-edit="false"
        :can-delete="false"
        :can-share="false"
        :on-close="closeSpotDetails"
        :on-toggle-favorite="() => toggleFavoriteForSpot(selectedSpot)"
        :on-go-to-spot="goToSpot"
        :on-notify="onNotify"
        :on-load-user-profile="onLoadUserProfile"
        :on-open-owner-profile="openOwnerProfile"
        :current-user-id="currentUserId"
        :comments="comments"
        :comments-loading="commentsLoading"
        :comments-busy="commentsBusy"
        :comment-draft="commentDraft"
        :on-comment-draft-change="setCommentDraft"
        :on-create-comment="createComment"
        :on-update-comment="updateComment"
        :on-delete-comment="deleteComment"
      />
    </div>
  </section>
</template>
