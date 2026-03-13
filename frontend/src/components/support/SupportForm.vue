<script setup>
import { computed, reactive, watch } from 'vue'
import ActionButton from '../common/ActionButton.vue'
import AppCheckbox from '../common/AppCheckbox.vue'
import AppTextField from '../common/AppTextField.vue'

const props = defineProps({
  user: { type: Object, default: null },
  currentPath: { type: String, default: '' },
  busy: { type: Boolean, default: false },
  onSubmit: { type: Function, required: true },
})

const form = reactive({
  category: 'bug',
  subject: '',
  message: '',
  contactEmail: '',
  allowContact: true,
  page: '',
})

const categoryOptions = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature request' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'question', label: 'Question' },
  { value: 'other', label: 'Other' },
]

const canSubmit = computed(() => {
  if (props.busy) return false
  if (String(form.subject || '').trim().length < 3) return false
  if (String(form.message || '').trim().length < 10) return false
  return true
})

watch(
  () => [props.user?.email, props.currentPath],
  () => {
    form.contactEmail = String(props.user?.email || '').trim()
    form.page = String(props.currentPath || '').trim()
  },
  { immediate: true },
)

async function submit() {
  if (!canSubmit.value) return

  const payload = {
    category: String(form.category || 'other'),
    subject: String(form.subject || '').trim(),
    message: String(form.message || '').trim(),
    contactEmail: String(form.contactEmail || '').trim(),
    allowContact: Boolean(form.allowContact),
    page: String(form.page || '').trim(),
  }

  const created = await props.onSubmit(payload)
  if (!created) return

  form.category = 'bug'
  form.subject = ''
  form.message = ''
  form.allowContact = true
}
</script>

<template>
  <section class="card border-0 shadow-sm" data-aos="fade-up" data-aos-delay="80">
    <div class="card-body d-grid gap-3 p-4">
      <div>
        <h3 class="h5 mb-1">Create support ticket</h3>
        <p class="text-secondary mb-0">Provide clear details so we can reproduce and prioritize correctly.</p>
      </div>

      <div class="row g-2">
        <div class="col-12 col-md-4">
          <label class="form-label">Type</label>
          <select class="form-select" v-model="form.category" :disabled="busy">
            <option v-for="entry in categoryOptions" :key="entry.value" :value="entry.value">{{ entry.label }}</option>
          </select>
        </div>
        <div class="col-12 col-md-8">
          <AppTextField
            label="Subject"
            v-model="form.subject"
            maxlength="140"
            :disabled="busy"
            placeholder="Short summary"
          />
        </div>
      </div>

      <AppTextField
        as="textarea"
        label="Description"
        rows="6"
        maxlength="6000"
        v-model="form.message"
        :disabled="busy"
        placeholder="Steps to reproduce, expected behavior, and actual behavior"
      />

      <div class="row g-2">
        <div class="col-12 col-md-6">
          <AppTextField
            label="Contact email (optional)"
            type="email"
            v-model="form.contactEmail"
            :disabled="busy"
            placeholder="name@example.com"
          />
        </div>
        <div class="col-12 col-md-6">
          <AppTextField
            label="Page context (optional)"
            v-model="form.page"
            :disabled="busy"
            placeholder="/map"
            maxlength="240"
          />
        </div>
      </div>

      <AppCheckbox
        wrapper-class="app-checkbox"
        v-model="form.allowContact"
        :disabled="busy"
        label="I allow follow-up contact regarding this ticket."
      />

      <ActionButton
        class-name="btn btn-primary"
        icon="bi-send"
        label="Submit ticket"
        :busy="busy"
        busy-label="Submitting..."
        :disabled="!canSubmit"
        @click="submit"
      />
    </div>
  </section>
</template>
