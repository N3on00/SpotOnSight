<script setup>
import { computed, watch } from 'vue'
import ActionButton from '../common/ActionButton.vue'
import SpotDetailsModal from '../map/SpotDetailsModal.vue'
import SpotMiniCard from '../common/SpotMiniCard.vue'
import { useOwnerProfiles } from '../../composables/useOwnerProfiles'
import { useSpotInteractions } from '../../composables/useSpotInteractions'
import { useSpotComments } from '../../composables/useSpotComments'

const props = defineProps({
  spots: { type: Array, default: () => [] },
  favorites: { type: Array, default: () => [] },
  onOpenProfile: { type: Function, required: true },
  onRefresh: { type: Function, required: true },
  onGoToSpot: { type: Function, required: true },
  onToggleFavorite: { type: Function, required: true },
  onLoadUserProfile: { type: Function, required: true },
  onNotify: { type: Function, required: true },
  onListComments: { type: Function, required: true },
  onCreateComment: { type: Function, required: true },
  onUpdateComment: { type: Function, required: true },
  onDeleteComment: { type: Function, required: true },
  currentUserId: { type: String, default: '' },
  refreshBusy: { type: Boolean, default: false },
})

const favoritesSet = computed(() => new Set((props.favorites || []).map((x) => String(x))))
const { ownerLabel, warmOwnerProfiles } = useOwnerProfiles((ownerId) => props.onLoadUserProfile(ownerId))
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

const listedSpots = computed(() => {
  return [...props.spots]
    .filter((spot) => spot && typeof spot === 'object')
    .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')))
})

watch(
  () => props.spots,
  (spots) => {
    void warmOwnerProfiles(spots)
  },
  { immediate: true, deep: true },
)

function isFavorite(spot) {
  const id = String(spot?.id || '')
  if (!id) return false
  return favoritesSet.value.has(id)
}

function openOwnerProfile(userId) {
  const ownerId = String(userId || '').trim()
  if (!ownerId) return
  props.onOpenProfile(ownerId)
}

function setCommentDraft(next) {
  commentDraft.value = String(next || '')
}
</script>

<template>
  <section class="card border-0 shadow-sm" data-aos="fade-up" data-aos-delay="60">
    <div class="card-body d-grid gap-3 p-4">
      <header class="discover-header">
        <div>
          <h3 class="h4 mb-1">Discover Spots</h3>
          <p class="text-secondary mb-0">Browse all spots in a compact list without opening the map.</p>
        </div>
        <ActionButton
          label="Refresh spots"
          icon="bi-arrow-repeat"
          :busy="refreshBusy"
          busy-label="Refreshing..."
          class-name="btn btn-outline-primary btn-sm"
          @click="onRefresh"
        />
      </header>

      <div class="spot-feed spot-feed--discover-compact" v-if="listedSpots.length">
        <SpotMiniCard
          v-for="spot in listedSpots"
          :key="spot.id || `${spot.title}-${spot.lat}-${spot.lon}`"
          :spot="spot"
          :description-max-length="88"
          :max-tags="0"
          :owner-label="ownerLabel(spot)"
          :is-favorite="isFavorite(spot)"
          :interactive="true"
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

      <div class="text-secondary" v-else>
        No spots yet. Open the map editor to create your first spot.
      </div>

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
