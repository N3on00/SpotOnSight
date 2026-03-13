<script setup>
import { ref, watch } from 'vue'
import ActionButton from '../common/ActionButton.vue'
import AppTextField from '../common/AppTextField.vue'
import SpotCommentThread from './SpotCommentThread.vue'
import SpotImageCarousel from './SpotImageCarousel.vue'
import SpotOwnerSummary from './SpotOwnerSummary.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  spot: { type: Object, default: null },
  isFavorite: { type: Boolean, default: false },
  favoriteBusy: { type: Boolean, default: false },
  canFavorite: { type: Boolean, default: true },
  canEdit: { type: Boolean, default: true },
  canDelete: { type: Boolean, default: true },
  canShare: { type: Boolean, default: true },
  onClose: { type: Function, required: true },
  onEdit: { type: Function, default: null },
  onDelete: { type: Function, default: null },
  onToggleFavorite: { type: Function, required: true },
  onShare: { type: Function, default: null },
  onGoToSpot: { type: Function, default: null },
  onNotify: { type: Function, required: true },
  onLoadUserProfile: { type: Function, default: null },
  onOpenOwnerProfile: { type: Function, default: null },
  currentUserId: { type: String, default: '' },
  comments: { type: Array, default: () => [] },
  commentsLoading: { type: Boolean, default: false },
  commentsBusy: { type: Boolean, default: false },
  commentDraft: { type: String, default: '' },
  onCommentDraftChange: { type: Function, default: null },
  onCreateComment: { type: Function, default: null },
  onUpdateComment: { type: Function, default: null },
  onDeleteComment: { type: Function, default: null },
})

const shareText = ref('')

watch(
  () => props.spot,
  () => {
    shareText.value = ''
  },
)

async function submitShare() {
  if (!props.canShare || typeof props.onShare !== 'function') return
  const ok = await props.onShare(shareText.value)
  if (ok) {
    shareText.value = ''
  }
}

function editSpot() {
  if (typeof props.onEdit === 'function') {
    props.onEdit()
  }
}

function deleteSpot() {
  if (typeof props.onDelete === 'function') {
    props.onDelete()
  }
}

function toggleFavorite() {
  if (!props.canFavorite) return
  props.onToggleFavorite()
}

function goToSpot() {
  if (typeof props.onGoToSpot !== 'function') return
  props.onGoToSpot(props.spot)
}

</script>

<template>
  <Teleport to="body">
    <div class="modal" v-if="open && spot">
      <div class="modal__backdrop" @click="props.onClose" />
      <div class="modal__content card border-0 shadow-lg">
        <header class="modal__header">
          <h3 class="h4 mb-0">{{ spot.title }}</h3>
          <ActionButton
            class-name="btn btn-outline-secondary btn-sm"
            icon="bi-x-lg"
            :icon-only="true"
            aria-label="Close details"
            @click="props.onClose"
          />
        </header>

      <p class="text-secondary mb-0">{{ spot.description || 'No description' }}</p>
      <p class="text-secondary mb-0">
        <i class="bi bi-geo-alt me-1"></i>{{ Number(spot.lat).toFixed(6) }}, {{ Number(spot.lon).toFixed(6) }}
      </p>
      <p class="text-secondary mb-0">
        <i class="bi bi-shield-lock me-1"></i>{{ String(spot.visibility || 'public').replace('_', ' ') }}
      </p>

      <SpotOwnerSummary
        :open="open"
        :spot="spot"
        :on-load-user-profile="onLoadUserProfile"
        :on-open-owner-profile="onOpenOwnerProfile"
      />

      <div class="tag-row">
        <span v-for="t in spot.tags" :key="t" class="tag">{{ t }}</span>
      </div>

      <SpotImageCarousel :spot="spot" :on-notify="onNotify" />

      <div class="share-box" v-if="canShare">
        <AppTextField
          bare
          class-name="form-control"
          v-model="shareText"
          maxlength="300"
          placeholder="Share message (optional)"
          aria-label="Share message"
        />
        <ActionButton class-name="btn btn-outline-primary" icon="bi-send" label="Share" @click="submitShare" />
      </div>

      <SpotCommentThread
        :comments="comments"
        :comments-loading="commentsLoading"
        :comments-busy="commentsBusy"
        :comment-draft="commentDraft"
        :current-user-id="currentUserId"
        :on-comment-draft-change="onCommentDraftChange"
        :on-create-comment="onCreateComment"
        :on-update-comment="onUpdateComment"
        :on-delete-comment="onDeleteComment"
      />

      <footer class="modal__footer">
        <div class="d-flex flex-wrap gap-2">
          <ActionButton
            v-if="typeof props.onGoToSpot === 'function'"
            class-name="btn btn-outline-primary"
            icon="bi-signpost-2"
            label="Go to"
            @click="goToSpot"
          />
          <ActionButton
            class-name="btn btn-outline-warning"
            :icon="isFavorite ? 'bi-heartbreak' : 'bi-heart'"
            :label="isFavorite ? 'Unlike' : 'Like'"
            :disabled="favoriteBusy || !canFavorite"
            @click="toggleFavorite"
          />
        </div>

        <div class="d-flex flex-wrap justify-content-end gap-2">
          <ActionButton class-name="btn btn-outline-secondary" label="Edit" v-if="canEdit" @click="editSpot" />
          <ActionButton class-name="btn btn-danger" label="Delete" v-if="canDelete" @click="deleteSpot" />
        </div>
      </footer>

      </div>
    </div>
  </Teleport>
</template>
