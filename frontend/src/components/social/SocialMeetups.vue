<script setup>
import { computed, ref, watch } from 'vue'
import { useOwnerProfiles } from '../../composables/useOwnerProfiles'
import ActionButton from '../common/ActionButton.vue'
import AppTextField from '../common/AppTextField.vue'
import ReportContentModal from '../common/ReportContentModal.vue'

const props = defineProps({
  meetups: { type: Array, default: () => [] },
  invites: { type: Array, default: () => [] },
  people: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
  currentUserId: { type: String, default: '' },
  onLoadUserProfile: { type: Function, required: true },
  onReportMeetup: { type: Function, default: null },
  onReportComment: { type: Function, default: null },
  onRefresh: { type: Function, required: true },
  onCreateMeetup: { type: Function, required: true },
  onDeleteMeetup: { type: Function, required: true },
  onRespond: { type: Function, required: true },
  onLoadComments: { type: Function, required: true },
  onCreateComment: { type: Function, required: true },
})

const draft = ref({
  title: '',
  starts_at: '',
  description: '',
  invite_user_ids: [],
})
const detailMeetupId = ref('')
const commentsByMeetup = ref({})
const commentDraft = ref('')
const reportTarget = ref(null)
const reportBusy = ref(false)
const { ownerLabel, warmOwnerProfiles } = useOwnerProfiles((userId) => props.onLoadUserProfile(userId))

const sortedMeetups = computed(() => {
  return [...(Array.isArray(props.meetups) ? props.meetups : [])]
    .sort((a, b) => String(a?.starts_at || '').localeCompare(String(b?.starts_at || '')))
})

const peopleById = computed(() => {
  const out = new Map()
  for (const person of Array.isArray(props.people) ? props.people : []) {
    const id = String(person?.id || '').trim()
    if (id) out.set(id, person)
  }
  return out
})

const inviteStatusByMeetup = computed(() => {
  const out = new Map()
  for (const invite of Array.isArray(props.invites) ? props.invites : []) {
    const meetupId = String(invite?.meetup_id || '').trim()
    if (!meetupId) continue
    out.set(meetupId, invite)
  }
  return out
})

watch(
  () => [props.meetups, commentsByMeetup.value],
  ([meetups, commentsById]) => {
    const commentRows = Object.values(commentsById || {}).flat()
    void warmOwnerProfiles([
      ...(Array.isArray(meetups) ? meetups.map((meetup) => ({ owner_id: meetup?.host_user_id })) : []),
      ...commentRows.map((comment) => ({ owner_id: comment?.user_id })),
    ])
  },
  { immediate: true, deep: true },
)

function toggleInvite(userId) {
  const id = String(userId || '').trim()
  if (!id) return
  const set = new Set(draft.value.invite_user_ids)
  if (set.has(id)) {
    set.delete(id)
  } else {
    set.add(id)
  }
  draft.value.invite_user_ids = [...set]
}

function isInvited(userId) {
  return draft.value.invite_user_ids.includes(String(userId || '').trim())
}

async function createMeetup() {
  const payload = {
    title: String(draft.value.title || '').trim(),
    starts_at: String(draft.value.starts_at || '').trim(),
    description: String(draft.value.description || '').trim(),
    invite_user_ids: [...draft.value.invite_user_ids],
  }
  const created = await props.onCreateMeetup(payload)
  if (!created) return
  draft.value = {
    title: '',
    starts_at: '',
    description: '',
    invite_user_ids: [],
  }
}

function inviteStatus(meetupId) {
  return inviteStatusByMeetup.value.get(String(meetupId || '').trim()) || null
}

function canManageMeetup(meetup) {
  return String(meetup?.host_user_id || '').trim() === String(props.currentUserId || '').trim()
}

function meetupHostLabel(meetup) {
  return ownerLabel(meetup?.host_user_id)
}

function commentAuthorLabel(comment) {
  return ownerLabel(comment?.user_id)
}

async function openDetails(meetup) {
  const meetupId = String(meetup?.id || '').trim()
  if (!meetupId) return
  detailMeetupId.value = meetupId
  const rows = await props.onLoadComments(meetupId)
  commentsByMeetup.value = {
    ...commentsByMeetup.value,
    [meetupId]: Array.isArray(rows) ? rows : [],
  }
}

function closeDetails() {
  detailMeetupId.value = ''
  commentDraft.value = ''
}

function detailMeetup() {
  return sortedMeetups.value.find((entry) => String(entry?.id || '') === String(detailMeetupId.value || '')) || null
}

async function submitComment() {
  const meetupId = String(detailMeetupId.value || '').trim()
  const message = String(commentDraft.value || '').trim()
  if (!meetupId || !message) return
  const created = await props.onCreateComment(meetupId, message)
  if (!created) return
  commentDraft.value = ''
  const next = commentsByMeetup.value[meetupId] || []
  commentsByMeetup.value = {
    ...commentsByMeetup.value,
    [meetupId]: [created, ...next],
  }
}

function openMeetupReport(meetup) {
  if (canManageMeetup(meetup) || typeof props.onReportMeetup !== 'function') return
  reportTarget.value = {
    kind: 'meetup',
    row: meetup,
    title: 'Report meetup',
    label: 'this meetup',
    description: String(meetup?.title || '').trim() || 'Meetup details',
  }
}

function openCommentReport(comment) {
  if (String(comment?.user_id || '').trim() === String(props.currentUserId || '').trim() || typeof props.onReportComment !== 'function') return
  reportTarget.value = {
    kind: 'comment',
    row: comment,
    title: 'Report meetup comment',
    label: 'this meetup comment',
    description: String(comment?.message || '').trim(),
  }
}

function closeReportDialog() {
  reportTarget.value = null
}

async function submitReport(payload) {
  if (!reportTarget.value) return false
  reportBusy.value = true
  try {
    if (reportTarget.value.kind === 'meetup') {
      return await props.onReportMeetup(reportTarget.value.row, payload.reason, payload.details)
    }
    return await props.onReportComment(reportTarget.value.row, payload.reason, payload.details)
  } finally {
    reportBusy.value = false
  }
}
</script>

<template>
  <section class="card border-0 shadow-sm" data-aos="fade-up" data-aos-delay="85">
    <div class="card-body d-grid gap-3 p-4">
      <header class="d-flex justify-content-between align-items-center gap-2">
        <div>
          <h3 class="h6 mb-1">Meetups</h3>
          <p class="small text-secondary mb-0">Plan meetup time, invite people, track responses, and discuss details.</p>
        </div>
        <ActionButton class-name="btn btn-outline-secondary" icon="bi-arrow-repeat" label="Refresh" :busy="busy" @click="onRefresh" />
      </header>

      <section class="meetup-create-box">
        <h4 class="h6 mb-2">Create Meetup</h4>
        <div class="d-grid gap-2">
          <AppTextField bare class-name="form-control" v-model="draft.title" maxlength="120" placeholder="Title" aria-label="Meetup title" />
          <AppTextField bare class-name="form-control" type="datetime-local" v-model="draft.starts_at" aria-label="Meetup time" />
          <AppTextField bare class-name="form-control" v-model="draft.description" maxlength="3000" placeholder="Description" aria-label="Meetup description" />
        </div>
        <div class="meetup-invite-grid mt-2" v-if="people.length">
          <ActionButton
            v-for="person in people"
            :key="`invite-${person.id}`"
            :class-name="isInvited(person.id) ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-primary'"
            :label="person.display_name || person.username || person.id"
            @click="toggleInvite(person.id)"
          />
        </div>
        <div class="mt-2">
          <ActionButton class-name="btn btn-primary" icon="bi-calendar-plus" label="Create meetup" @click="createMeetup" />
        </div>
      </section>

      <section class="meetup-list-box">
        <h4 class="h6 mb-2">Upcoming</h4>
        <article class="meetup-row" v-for="meetup in sortedMeetups" :key="`meetup-${meetup.id}`">
          <div>
            <div class="fw-semibold">{{ meetup.title }}</div>
            <div class="small text-secondary"><i class="bi bi-person-circle me-1"></i>{{ meetupHostLabel(meetup) }}</div>
            <div class="small text-secondary">{{ meetup.starts_at }}</div>
            <div class="small text-secondary">{{ meetup.description || 'No description' }}</div>
            <div class="small text-secondary" v-if="inviteStatus(meetup.id)">
              Your response: {{ inviteStatus(meetup.id).status }}
            </div>
          </div>
          <div class="d-flex flex-wrap gap-2 justify-content-end">
            <ActionButton class-name="btn btn-sm btn-outline-secondary" label="Details" @click="openDetails(meetup)" />
            <ActionButton
              v-if="!canManageMeetup(meetup) && typeof onReportMeetup === 'function'"
              class-name="btn btn-sm btn-outline-danger"
              icon="bi-flag"
              label="Report"
              @click="openMeetupReport(meetup)"
            />
            <ActionButton
              v-if="!canManageMeetup(meetup)"
              class-name="btn btn-sm btn-outline-success"
              label="Accept"
              @click="onRespond(meetup.id, 'accepted', '')"
            />
            <ActionButton
              v-if="!canManageMeetup(meetup)"
              class-name="btn btn-sm btn-outline-danger"
              label="Decline"
              @click="onRespond(meetup.id, 'declined', '')"
            />
            <ActionButton
              v-if="canManageMeetup(meetup)"
              class-name="btn btn-sm btn-outline-danger"
              label="Delete"
              @click="onDeleteMeetup(meetup.id)"
            />
          </div>
        </article>
        <div class="small text-secondary" v-if="!sortedMeetups.length">No meetups yet.</div>
      </section>
    </div>
  </section>

  <Teleport to="body">
    <div class="modal" v-if="detailMeetup()">
      <div class="modal__backdrop" @click="closeDetails" />
      <div class="modal__content card border-0 shadow-lg">
        <header class="modal__header">
          <h3 class="h5 mb-0">{{ detailMeetup().title }}</h3>
          <ActionButton class-name="btn btn-outline-secondary btn-sm" icon="bi-x-lg" :icon-only="true" aria-label="Close meetup details" @click="closeDetails" />
        </header>
        <p class="mb-0">{{ detailMeetup().description || 'No description' }}</p>
        <p class="small text-secondary mb-0">Starts: {{ detailMeetup().starts_at }}</p>

        <section class="comments-box">
          <h4 class="h6 mb-0">Meetup Comments</h4>
          <div class="comments-create">
            <AppTextField bare class-name="form-control" v-model="commentDraft" maxlength="2000" placeholder="Write a comment" aria-label="Meetup comment" />
            <ActionButton class-name="btn btn-outline-primary" icon="bi-chat" label="Post" @click="submitComment" />
          </div>
          <div class="comments-list">
            <article class="comment-row" v-for="comment in (commentsByMeetup[detailMeetupId] || [])" :key="`meetup-comment-${comment.id}`">
              <div class="d-flex flex-wrap justify-content-between gap-2 align-items-start">
                <div class="small text-secondary">{{ peopleById.get(comment.user_id)?.display_name || commentAuthorLabel(comment) }}</div>
                <ActionButton
                  v-if="String(comment?.user_id || '').trim() !== String(currentUserId || '').trim() && typeof onReportComment === 'function'"
                  class-name="btn btn-sm btn-outline-danger"
                  icon="bi-flag"
                  label="Report"
                  @click="openCommentReport(comment)"
                />
              </div>
              <p class="mb-0">{{ comment.message }}</p>
            </article>
          </div>
        </section>

        <ReportContentModal
          :open="Boolean(reportTarget)"
          :title="reportTarget?.title || 'Report content'"
          :target-label="reportTarget?.label || 'this content'"
          :target-description="reportTarget?.description || ''"
          :busy="reportBusy"
          :on-close="closeReportDialog"
          :on-submit="submitReport"
        />
      </div>
    </div>
  </Teleport>
</template>
