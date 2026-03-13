<script setup>
defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, required: true },
  issues: { type: Array, default: () => [] },
  issuePrefix: { type: String, required: true },
})
</script>

<template>
  <div class="auth-issues" v-if="show && issues.length > 0">
    <div class="auth-issues__title">{{ title }}</div>
    <ul>
      <li v-for="issue in issues" :key="`${issuePrefix}-${issue}`">{{ issue }}</li>
    </ul>
  </div>
</template>
