<script setup>
import { computed, reactive, watch } from 'vue'
import ActionButton from '../common/ActionButton.vue'
import AppTextField from '../common/AppTextField.vue'
import UserDirectorySearchPicker from '../common/UserDirectorySearchPicker.vue'
import { estimateImageBytes, toImageSource } from '../../models/imageMapper'
import { readFileAsBase64 } from '../../utils/fileBase64'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_IMAGE_COUNT = 12

const props = defineProps({
  open: { type: Boolean, default: false },
  mode: { type: String, default: 'create' },
  draft: { type: Object, default: null },
  onCancel: { type: Function, required: true },
  onSubmit: { type: Function, required: true },
  onPickLocation: { type: Function, required: true },
  onSearchUsers: { type: Function, required: true },
  onLoadFriendUsers: { type: Function, required: true },
  onLoadUserProfile: { type: Function, required: true },
  onNotify: { type: Function, required: true },
  busy: { type: Boolean, default: false },
})

const form = reactive({
  id: '',
  title: '',
  description: '',
  tagsText: '',
  inviteUserIds: [],
  lat: 0,
  lon: 0,
  images: [],
  visibility: 'public',
})

const heading = computed(() => (props.mode === 'edit' ? 'Edit spot' : 'Create spot'))

watch(
  () => props.draft,
  (draft) => {
    const d = draft || {}
    form.id = String(d.id || '')
    form.title = String(d.title || '')
    form.description = String(d.description || '')
    form.tagsText = Array.isArray(d.tags) ? d.tags.join(', ') : ''
    form.inviteUserIds = Array.isArray(d.invite_user_ids) ? [...d.invite_user_ids] : []
    form.lat = Number(d.lat || 0)
    form.lon = Number(d.lon || 0)
    form.images = Array.isArray(d.images) ? [...d.images] : []
    form.visibility = String(d.visibility || 'public')
  },
  { immediate: true, deep: true },
)

function parseTags(text) {
  return String(text || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

async function onFilesSelected(event) {
  const files = Array.from(event.target?.files || [])
  if (!files.length) return

  const next = [...form.images]
  const failed = []
  const tooLarge = []
  const tooMany = []
  let total = next.reduce((sum, img) => sum + estimateImageBytes(img), 0)

  for (const f of files) {
    if (next.length >= MAX_IMAGE_COUNT) {
      tooMany.push(f.name)
      continue
    }
    if (f.size > MAX_IMAGE_BYTES || total + f.size > MAX_TOTAL_IMAGE_BYTES) {
      tooLarge.push(f.name)
      continue
    }
    try {
      const b64 = await readFileAsBase64(f)
      next.push(b64)
      total += f.size
    } catch {
      failed.push(f.name)
    }
  }

  form.images = next
  if (event.target) {
    event.target.value = ''
  }

  if (failed.length) {
    props.onNotify({
      level: 'warning',
      title: 'Image Error',
      message: `${failed.length} image(s) could not be loaded.`,
      details: failed.join('\n'),
    })
  }

  if (tooLarge.length) {
    props.onNotify({
      level: 'warning',
      title: 'Image Too Large',
      message: 'Some images were skipped due to file size limits.',
      details: tooLarge.join('\n'),
    })
  }

  if (tooMany.length) {
    props.onNotify({
      level: 'warning',
      title: 'Image Limit Reached',
      message: `Maximum of ${MAX_IMAGE_COUNT} images per spot.`,
      details: tooMany.join('\n'),
    })
  }
}

function removeImage(index) {
  form.images = form.images.filter((_, i) => i !== index)
}

function submit() {
  if (!form.title.trim()) {
    props.onNotify({ level: 'warning', title: 'Missing title', message: 'Please enter a title.' })
    return
  }

  const inviteUserIds = form.visibility === 'invite_only'
    ? [...form.inviteUserIds]
    : []

  props.onSubmit({
    id: form.id || '',
    title: form.title.trim(),
    description: form.description.trim(),
    tags: parseTags(form.tagsText),
    invite_user_ids: inviteUserIds,
    lat: Number(form.lat),
    lon: Number(form.lon),
    images: [...form.images],
    visibility: String(form.visibility || 'public'),
  })
}
</script>

<template>
  <Teleport to="body">
    <div class="modal" v-if="open">
      <div class="modal__backdrop" @click="onCancel" />
      <div class="modal__content card border-0 shadow-lg">
        <header class="modal__header">
          <h3 class="h4 mb-0">{{ heading }}</h3>
          <ActionButton
            class-name="btn btn-outline-secondary btn-sm"
            icon="bi-x-lg"
            :icon-only="true"
            aria-label="Close editor"
            :disabled="busy"
            @click="onCancel"
          />
        </header>

      <AppTextField label="Title" v-model="form.title" maxlength="80" :disabled="busy" />

      <AppTextField
        as="textarea"
        label="Description"
        v-model="form.description"
        maxlength="2000"
        rows="3"
        :disabled="busy"
      />

      <AppTextField
        label="Tags (comma-separated)"
        v-model="form.tagsText"
        placeholder="Nature, Quiet"
        :disabled="busy"
      />

      <label>
        <span>Visibility</span>
        <select class="form-select" v-model="form.visibility" :disabled="busy">
          <option value="public">Public</option>
          <option value="following">Followers only</option>
          <option value="invite_only">Invite only</option>
          <option value="personal">Personal</option>
        </select>
      </label>

      <div class="d-grid gap-1" v-if="form.visibility === 'invite_only'">
        <span class="small text-secondary">Invited users</span>
        <UserDirectorySearchPicker
          v-model="form.inviteUserIds"
          :search-all-users="onSearchUsers"
          :load-friend-users="onLoadFriendUsers"
          :load-user-profile="onLoadUserProfile"
          :disabled="busy"
          label="Invite users"
        />
      </div>

      <div class="location-row">
        <div>
          <div class="text-secondary small">Location</div>
          <strong>{{ Number(form.lat).toFixed(6) }}, {{ Number(form.lon).toFixed(6) }}</strong>
        </div>
        <ActionButton
          label="Pick on map"
          icon="bi-geo-alt"
          class-name="btn btn-outline-primary"
          :disabled="busy"
          @click="onPickLocation({ ...form, tags: parseTags(form.tagsText), invite_user_ids: form.visibility === 'invite_only' ? [...form.inviteUserIds] : [] })"
        />
      </div>

      <label>
        <span>Images ({{ form.images.length }} / {{ MAX_IMAGE_COUNT }})</span>
        <input
          class="form-control"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          :disabled="busy"
          @change="onFilesSelected"
        />
      </label>

      <div class="image-strip" v-if="form.images.length">
        <article class="spot-editor-image" v-for="(img, i) in form.images" :key="`${i}-${img.length}`">
          <img :src="toImageSource(img)" alt="spot" loading="lazy" />
          <ActionButton
            class-name="btn btn-sm btn-danger spot-editor-image__remove"
            icon="bi-trash"
            :icon-only="true"
            aria-label="Remove image"
            @click="removeImage(i)"
          />
        </article>
      </div>

        <footer class="modal__footer">
          <ActionButton
            label="Cancel"
            class-name="btn btn-outline-secondary"
            :disabled="busy"
            @click="onCancel"
          />
          <ActionButton
            label="Save"
            class-name="btn btn-primary"
            :busy="busy"
            busy-label="Saving..."
            @click="submit"
          />
        </footer>

      </div>
    </div>
  </Teleport>
</template>
