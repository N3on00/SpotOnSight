import { ref, watch } from 'vue'

function normalizeComment(item) {
  const row = item && typeof item === 'object' ? item : {}
  return {
    id: String(row.id || row._id || '').trim(),
    spot_id: String(row.spot_id || '').trim(),
    user_id: String(row.user_id || '').trim(),
    message: String(row.message || '').trim(),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
    optimistic: Boolean(row.optimistic),
  }
}

export function useSpotComments({ selectedSpot, detailsOpen, currentUserId, listComments, createComment, updateComment, deleteComment }) {
  const comments = ref([])
  const commentsLoading = ref(false)
  const commentsBusy = ref(false)
  const commentDraft = ref('')

  async function loadComments() {
    const spotId = String(selectedSpot.value?.id || '').trim()
    if (!detailsOpen.value || !spotId) {
      comments.value = []
      return
    }

    commentsLoading.value = true
    try {
      const rows = await listComments(spotId)
      comments.value = (Array.isArray(rows) ? rows : []).map((entry) => normalizeComment(entry))
    } finally {
      commentsLoading.value = false
    }
  }

  watch(
    () => [detailsOpen.value, selectedSpot.value?.id],
    () => {
      void loadComments()
    },
    { immediate: true },
  )

  async function create(messageInput = '') {
    const message = String(messageInput || commentDraft.value || '').trim()
    const spotId = String(selectedSpot.value?.id || '').trim()
    if (!spotId || !message || commentsBusy.value) return false

    commentsBusy.value = true
    const tempId = `temp-${Date.now()}`
    const optimistic = normalizeComment({
      id: tempId,
      spot_id: spotId,
      user_id: currentUserId.value,
      message,
      created_at: new Date().toISOString(),
      optimistic: true,
    })
    comments.value = [optimistic, ...comments.value]
    commentDraft.value = ''

    try {
      const created = await createComment(spotId, message)
      const normalized = created ? normalizeComment(created) : null
      if (normalized?.id) {
        comments.value = comments.value.map((entry) => (entry.id === tempId ? normalized : entry))
      } else {
        comments.value = comments.value.filter((entry) => entry.id !== tempId)
      }
      return Boolean(normalized?.id)
    } finally {
      commentsBusy.value = false
    }
  }

  async function update(commentId, message) {
    const id = String(commentId || '').trim()
    const nextMessage = String(message || '').trim()
    if (!id || !nextMessage || commentsBusy.value) return false

    const before = comments.value
    commentsBusy.value = true
    comments.value = comments.value.map((entry) => (entry.id === id ? { ...entry, message: nextMessage } : entry))

    try {
      const updated = await updateComment(id, nextMessage)
      const normalized = updated ? normalizeComment(updated) : null
      if (!normalized?.id) {
        comments.value = before
        return false
      }
      comments.value = comments.value.map((entry) => (entry.id === id ? normalized : entry))
      return true
    } finally {
      commentsBusy.value = false
    }
  }

  async function remove(commentId) {
    const id = String(commentId || '').trim()
    if (!id || commentsBusy.value) return false

    const before = comments.value
    commentsBusy.value = true
    comments.value = comments.value.filter((entry) => entry.id !== id)

    try {
      const ok = await deleteComment(id)
      if (!ok) {
        comments.value = before
      }
      return Boolean(ok)
    } finally {
      commentsBusy.value = false
    }
  }

  return {
    comments,
    commentsLoading,
    commentsBusy,
    commentDraft,
    loadComments,
    createComment: create,
    updateComment: update,
    deleteComment: remove,
  }
}
