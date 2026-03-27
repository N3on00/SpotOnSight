<script setup>
import ActionButton from '../common/ActionButton.vue'

const props = defineProps({
  entries: { type: Array, default: () => [] },
  navIconOnly: { type: Boolean, default: false },
  mobileBottomNav: { type: Boolean, default: false },
  isActive: { type: Function, required: true },
  onOpen: { type: Function, required: true },
})

function showEntryLabel(entry) {
  if (props.mobileBottomNav) return props.isActive(entry)
  return !props.navIconOnly || props.isActive(entry)
}

function entryClassName(entry) {
  const active = props.isActive(entry)
  const base = active
    ? 'btn btn-primary app-top-nav__link app-top-nav__link--active'
    : 'btn btn-outline-secondary app-top-nav__link'

  const classes = [base]

  if (props.mobileBottomNav) {
    classes.push('app-top-nav__link--mobile')
  }

  if (props.navIconOnly && !active) {
    classes.push('app-top-nav__link--collapsed')
  }

  return classes.join(' ')
}

function entryContentClass(entry) {
  return (props.navIconOnly || props.mobileBottomNav) && !props.isActive(entry)
    ? 'app-top-nav__link-content app-top-nav__link-content--collapsed'
    : 'app-top-nav__link-content'
}

function entryLabelClass(entry) {
  return showEntryLabel(entry)
    ? 'action-button__label app-top-nav__link-label app-top-nav__link-label--visible'
    : 'action-button__label app-top-nav__link-label'
}
</script>

<template>
  <div
    class="app-top-nav__links app-top-nav__links--primary"
    :class="{
      'app-top-nav__links--icon-only': navIconOnly,
      'app-top-nav__links--mobile': mobileBottomNav,
    }"
  >
    <ActionButton
      v-for="entry in entries"
      :key="`app-nav-${entry.key}`"
      :class-name="entryClassName(entry)"
      :aria-label="entry.label"
      :data-active="isActive(entry) ? 'true' : 'false'"
      @click="onOpen(entry)"
    >
      <span :class="entryContentClass(entry)">
        <i class="bi action-button__icon app-top-nav__link-icon" :class="entry.icon"></i>
        <span :class="entryLabelClass(entry)">{{ entry.label }}</span>
      </span>
    </ActionButton>
  </div>
</template>
