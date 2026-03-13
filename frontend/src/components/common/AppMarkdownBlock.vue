<script setup>
import { computed } from 'vue'
import { renderMarkdownToHtml } from '../../models/markdownMapper'

const props = defineProps({
  content: { type: String, default: '' },
  emptyText: { type: String, default: '' },
  className: { type: String, default: '' },
})

const hasContent = computed(() => String(props.content || '').trim().length > 0)
const renderedHtml = computed(() => renderMarkdownToHtml(props.content))

function blockClass() {
  const raw = String(props.className || '').trim()
  return raw ? `app-markdown-block ${raw}` : 'app-markdown-block'
}
</script>

<template>
  <p v-if="!hasContent && emptyText" :class="`${blockClass()} app-markdown-block--empty`">{{ emptyText }}</p>
  <div v-else-if="hasContent" :class="blockClass()" v-html="renderedHtml"></div>
</template>
