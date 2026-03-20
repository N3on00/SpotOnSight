<script setup>
import { computed, ref, watch } from 'vue'
import ActionButton from './ActionButton.vue'
import AppTextField from './AppTextField.vue'

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or scam' },
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'explicit_content', label: 'Explicit content' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Other issue' },
]

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: 'Report content' },
  targetLabel: { type: String, default: 'this content' },
  targetDescription: { type: String, default: '' },
  submitLabel: { type: String, default: 'Send report' },
  busy: { type: Boolean, default: false },
  onClose: { type: Function, required: true },
  onSubmit: { type: Function, required: true },
})

const reason = ref('other')
const details = ref('')
const validationMessage = ref('')

const targetText = computed(() => String(props.targetLabel || 'this content').trim() || 'this content')
const targetDescriptionText = computed(() => String(props.targetDescription || '').trim())

watch(
  () => props.open,
  (next) => {
    if (!next) return
    reason.value = 'other'
    details.value = ''
    validationMessage.value = ''
  },
)

async function submitReport() {
  const trimmedDetails = String(details.value || '').trim()
  if (!trimmedDetails) {
    validationMessage.value = 'Please add a short explanation so moderators know what to review.'
    return
  }
  validationMessage.value = ''
  const ok = await props.onSubmit({ reason: reason.value, details: trimmedDetails })
  if (ok) {
    props.onClose()
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="modal" v-if="open">
      <div class="modal__backdrop" @click="onClose" />
      <div class="modal__content card border-0 shadow-lg report-modal">
        <header class="modal__header">
          <div>
            <p class="report-modal__eyebrow mb-1">Safety report</p>
            <h3 class="h5 mb-1">{{ title }}</h3>
            <p class="text-secondary mb-0">Tell moderators what is wrong with {{ targetText }}.</p>
          </div>
          <ActionButton
            class-name="btn btn-outline-secondary btn-sm"
            icon="bi-x-lg"
            :icon-only="true"
            aria-label="Close report dialog"
            @click="onClose"
          />
        </header>

        <div class="report-modal__target">
          <strong class="d-block">Reporting {{ targetText }}</strong>
          <p class="small text-secondary mb-0" v-if="targetDescriptionText">{{ targetDescriptionText }}</p>
        </div>

        <section class="report-modal__section">
          <h4 class="h6 mb-2">Reason</h4>
          <div class="report-modal__reason-grid">
            <button
              v-for="option in REPORT_REASONS"
              :key="option.value"
              type="button"
              class="report-modal__reason"
              :class="{ 'report-modal__reason--active': reason === option.value }"
              @click="reason = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </section>

        <section class="report-modal__section">
          <h4 class="h6 mb-2">Details</h4>
          <AppTextField
            bare
            class-name="form-control report-modal__details"
            as="textarea"
            v-model="details"
            maxlength="3000"
            rows="5"
            placeholder="What happened? Add any context that will help moderators review this faster."
            aria-label="Report details"
          />
          <div class="small text-danger" v-if="validationMessage">{{ validationMessage }}</div>
        </section>

        <footer class="modal__footer">
          <p class="small text-secondary mb-0">Reports are reviewed by moderators and are not shared publicly.</p>
          <div class="d-flex flex-wrap gap-2 justify-content-end">
            <ActionButton class-name="btn btn-outline-secondary" label="Cancel" @click="onClose" />
            <ActionButton class-name="btn btn-danger" icon="bi-flag" :label="submitLabel" :busy="busy" busy-label="Sending..." @click="submitReport" />
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.report-modal {
  width: min(640px, calc(100vw - 1rem));
}

.report-modal__eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
  font-weight: 700;
  color: rgba(179, 60, 47, 0.86);
}

.report-modal__target,
.report-modal__section {
  display: grid;
  gap: 0.55rem;
}

.report-modal__target {
  border: 1px solid rgba(179, 60, 47, 0.18);
  border-radius: 1rem;
  background: color-mix(in oklab, var(--app-surface-soft) 82%, rgba(179, 60, 47, 0.08) 18%);
  padding: 0.9rem 1rem;
}

.report-modal__reason-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.6rem;
}

.report-modal__reason {
  border: 1px solid rgba(179, 60, 47, 0.18);
  border-radius: 0.9rem;
  background: var(--app-surface-soft);
  color: var(--app-text);
  min-height: 3rem;
  padding: 0.75rem 0.85rem;
  text-align: left;
  font-weight: 600;
  transition: border-color 140ms ease, background 140ms ease, transform 140ms ease;
}

.report-modal__reason:hover,
.report-modal__reason:focus-visible,
.report-modal__reason--active {
  border-color: rgba(179, 60, 47, 0.54);
  background: color-mix(in oklab, var(--app-surface-soft) 72%, rgba(179, 60, 47, 0.14) 28%);
  transform: translateY(-1px);
}

.report-modal__details {
  min-height: 9rem;
}

[data-theme='dark'] .report-modal__eyebrow {
  color: #ffbaab;
}

[data-theme='dark'] .report-modal__target {
  border-color: rgba(255, 154, 133, 0.24);
  background: color-mix(in oklab, var(--app-surface-soft) 86%, rgba(179, 60, 47, 0.24) 14%);
}

[data-theme='dark'] .report-modal__reason {
  border-color: rgba(255, 154, 133, 0.22);
}

[data-theme='dark'] .report-modal__reason:hover,
[data-theme='dark'] .report-modal__reason:focus-visible,
[data-theme='dark'] .report-modal__reason--active {
  border-color: rgba(255, 154, 133, 0.56);
  background: color-mix(in oklab, var(--app-surface-soft) 80%, rgba(179, 60, 47, 0.28) 20%);
}

@media (max-width: 767px) {
  .report-modal__reason-grid {
    grid-template-columns: 1fr;
  }

  .modal__footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
