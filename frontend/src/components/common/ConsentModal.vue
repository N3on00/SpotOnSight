<script setup>
import { ref, computed, onMounted } from 'vue'
import { getConsentState, setLocationConsent, setCookieConsent } from '../../services/consentService'

const props = defineProps({
  show: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'consent-update'])

const consent = ref(getConsentState())
const locationChecked = ref(false)

const showLocationPrompt = computed(() => {
  return props.show && !consent.value.locationConsent && !locationChecked.value
})

function handleLocationAllow() {
  const state = setLocationConsent(true)
  consent.value = state
  locationChecked.value = true
  emit('consent-update', state)
  emit('close', 'location')
}

function handleLocationDeny() {
  setLocationConsent(false)
  locationChecked.value = true
  emit('close', 'location-denied')
}

function handleCookieAccept() {
  const state = setCookieConsent(true)
  consent.value = state
  emit('consent-update', state)
}

function handleCookieDecline() {
  setCookieConsent(false)
}

onMounted(() => {
  consent.value = getConsentState()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showLocationPrompt" class="consent-overlay">
        <div class="consent-modal">
          <div class="consent-header">
            <h2>Location Access</h2>
          </div>
          <div class="consent-body">
            <p>
              SpotOnSight uses your location to show nearby spots and features.
              Your location is only used while using the app and is never shared with third parties.
            </p>
            <p class="consent-note">
              You can change this setting anytime in the app settings.
            </p>
          </div>
          <div class="consent-actions">
            <button class="btn btn-secondary" type="button" @click="handleLocationDeny">
              Not now
            </button>
            <button class="btn btn-primary" type="button" @click="handleLocationAllow">
              Enable location
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.consent-overlay {
  position: fixed;
  inset: 0;
  background: rgba(7, 31, 38, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.consent-modal {
  background: #102a34;
  border: 1px solid #1f7c72;
  border-radius: 12px;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.consent-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(127, 224, 210, 0.2);
}

.consent-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #f6fffd;
  font-weight: 600;
}

.consent-body {
  padding: 1.5rem;
}

.consent-body p {
  margin: 0 0 1rem;
  color: #dffcf6;
  line-height: 1.6;
  font-size: 0.95rem;
}

.consent-body .consent-note {
  font-size: 0.85rem;
  color: #7ee0d2;
  margin-bottom: 0;
}

.consent-actions {
  padding: 1rem 1.5rem 1.5rem;
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-secondary {
  background: transparent;
  color: #7ee0d2;
  border: 1px solid #7ee0d2;
}

.btn-secondary:hover {
  background: rgba(126, 224, 210, 0.1);
}

.btn-primary {
  background: linear-gradient(135deg, #1f7c72, #7ee0d2);
  color: #071f26;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #7ee0d2, #1f7c72);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>