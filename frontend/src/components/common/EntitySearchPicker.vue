<script setup>
import { computed, reactive, ref, watch } from 'vue'
import ActionButton from './ActionButton.vue'
import AppTextField from './AppTextField.vue'
import UserProfileCard from './UserProfileCard.vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  provider: {
    type: Object,
    required: true,
  },
  label: { type: String, default: 'Search' },
  placeholder: { type: String, default: 'Search...' },
  scopes: {
    type: Array,
    default: () => [
      { value: 'all', label: 'All' },
    ],
  },
  defaultScope: { type: String, default: '' },
  searchButtonLabel: { type: String, default: 'Search' },
  searchingLabel: { type: String, default: 'Searching...' },
  idleHint: { type: String, default: 'Type a query and search.' },
  emptyResultsText: { type: String, default: 'No results found.' },
  searchResultsLabel: { type: String, default: 'Search results' },
  disabled: { type: Boolean, default: false },
  multiple: { type: Boolean, default: true },
  maxSelected: { type: Number, default: 25 },
  limit: { type: Number, default: 20 },
  quickItems: {
    type: Array,
    default: () => [],
  },
  quickItemsLabel: { type: String, default: '' },
  quickItemsEmptyText: { type: String, default: '' },
  itemId: {
    type: Function,
    default: (item) => String(item?.id || '').trim(),
  },
  itemTitle: {
    type: Function,
    default: (item) => String(item?.display_name || item?.username || item?.id || 'Unknown'),
  },
  itemSubtitle: {
    type: Function,
    default: (item) => {
      const username = String(item?.username || '').trim()
      if (username) return `@${username}`
      return String(item?.email || '').trim()
    },
  },
  itemAvatar: {
    type: Function,
    default: () => '',
  },
  itemDetails: {
    type: Function,
    default: () => [],
  },
  resolveByIds: {
    type: Function,
    default: null,
  },
})

const emit = defineEmits(['update:modelValue'])

const query = ref('')
const busy = ref(false)
const searched = ref(false)
const errorText = ref('')
const results = ref([])
const selectedMeta = reactive({})

const activeScope = ref(
  props.defaultScope
  || String(props.scopes?.[0]?.value || 'all'),
)

const showScope = computed(() => Array.isArray(props.scopes) && props.scopes.length > 1)

const quickRows = computed(() => {
  if (!Array.isArray(props.quickItems)) return []
  return props.quickItems.filter((item) => item && typeof item === 'object')
})

const showQuickGroup = computed(() => {
  return Boolean(props.quickItemsLabel || quickRows.value.length || props.quickItemsEmptyText)
})

const selectedIds = computed(() => {
  if (!Array.isArray(props.modelValue)) return []
  return props.modelValue
    .map((id) => String(id || '').trim())
    .filter(Boolean)
})

const selectedRows = computed(() => {
  return selectedIds.value.map((id) => {
    const meta = selectedMeta[id]
    if (meta) return meta
    return placeholderMeta(id)
  })
})

function placeholderMeta(id) {
  return {
    id,
    title: 'Loading user...',
    subtitle: '',
    avatar: '',
    details: [],
    resolved: false,
  }
}

function detailsOf(item) {
  const raw = props.itemDetails(item)
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
  }

  const text = String(raw || '').trim()
  return text ? [text] : []
}

function syncSelectedMeta(ids) {
  const selected = new Set(ids)

  for (const id of Object.keys(selectedMeta)) {
    if (!selected.has(id)) {
      delete selectedMeta[id]
    }
  }

  for (const id of selected) {
    if (!selectedMeta[id]) {
      selectedMeta[id] = placeholderMeta(id)
    }
  }
}

let resolveRun = 0

async function hydrateSelectedMeta(ids) {
  if (typeof props.resolveByIds !== 'function') return

  const unresolvedIds = ids
    .filter((id) => !selectedMeta[id] || selectedMeta[id].resolved !== true)

  if (!unresolvedIds.length) return

  const pendingIds = [...new Set(unresolvedIds)]
  const runId = ++resolveRun

  try {
    const items = await props.resolveByIds(pendingIds)
    if (runId !== resolveRun) return

    const resolvedIds = new Set()
    for (const item of Array.isArray(items) ? items : []) {
      const id = itemId(item)
      if (id) {
        resolvedIds.add(id)
      }
      trackMeta(item)
    }

    for (const id of pendingIds) {
      if (resolvedIds.has(id)) continue
      selectedMeta[id] = {
        id,
        title: 'Unknown user',
        subtitle: '',
        avatar: '',
        details: [`ID: ${id}`],
        resolved: true,
      }
    }
  } catch {
  }
}

watch(
  () => selectedIds.value,
  (ids) => {
    syncSelectedMeta(ids)
    void hydrateSelectedMeta(ids)
  },
  { immediate: true },
)

watch(
  () => props.resolveByIds,
  () => {
    void hydrateSelectedMeta(selectedIds.value)
  },
)

watch(
  () => quickRows.value,
  (items) => {
    for (const item of items) {
      trackMeta(item)
    }
  },
  { immediate: true, deep: true },
)

function itemId(item) {
  return String(props.itemId(item) || '').trim()
}

function trackMeta(item) {
  const id = itemId(item)
  if (!id) return
  selectedMeta[id] = {
    id,
    title: String(props.itemTitle(item) || id),
    subtitle: String(props.itemSubtitle(item) || ''),
    avatar: String(props.itemAvatar(item) || ''),
    details: detailsOf(item),
    resolved: true,
  }
}

async function runSearch() {
  if (props.disabled || busy.value) return

  busy.value = true
  searched.value = true
  errorText.value = ''

  try {
    const out = await props.provider.search(query.value, {
      scope: activeScope.value,
      limit: props.limit,
    })

    results.value = Array.isArray(out) ? out : []
    for (const item of results.value) {
      trackMeta(item)
    }
  } catch (error) {
    results.value = []
    errorText.value = String(error?.message || error || 'Search failed')
  } finally {
    busy.value = false
  }
}

function emitIds(ids) {
  const unique = []
  const seen = new Set()

  for (const id of ids) {
    const sid = String(id || '').trim()
    if (!sid || seen.has(sid)) continue
    seen.add(sid)
    unique.push(sid)
    if (unique.length >= props.maxSelected) break
  }

  emit('update:modelValue', unique)
}

function selectItem(item) {
  const id = itemId(item)
  if (!id) return
  trackMeta(item)

  if (!props.multiple) {
    emitIds([id])
    return
  }

  if (selectedIds.value.includes(id)) return
  emitIds([...selectedIds.value, id])
}

function removeSelected(id) {
  emitIds(selectedIds.value.filter((entry) => entry !== id))
}

function isSelected(item) {
  const id = itemId(item)
  if (!id) return false
  return selectedIds.value.includes(id)
}
</script>

<template>
  <section class="entity-search card border-0 shadow-sm">
    <div class="card-body d-grid gap-3 p-3">
      <div class="entity-search__controls">
        <label class="form-label mb-0">{{ label }}</label>
        <div class="entity-search__row" :class="{ 'entity-search__row--with-scope': showScope }">
          <select
            v-if="showScope"
            class="form-select entity-search__scope"
            v-model="activeScope"
            :disabled="disabled || busy"
          >
            <option v-for="scope in scopes" :key="scope.value" :value="scope.value">{{ scope.label }}</option>
          </select>
          <AppTextField
            bare
            class-name="form-control"
            v-model="query"
            :placeholder="placeholder"
            aria-label="Search query"
            :disabled="disabled || busy"
            @enter="runSearch"
          />
          <ActionButton
            class-name="btn btn-outline-primary"
            :label="searchButtonLabel"
            :busy="busy"
            :busy-label="searchingLabel"
            :disabled="disabled || busy"
            @click="runSearch"
          />
        </div>
      </div>

      <div class="entity-search__selected" v-if="selectedRows.length">
        <span class="small text-secondary">Selected</span>
        <div class="entity-search__selected-list">
          <UserProfileCard
            v-for="entry in selectedRows"
            :key="`sel-${entry.id}`"
            :title="entry.title"
            :subtitle="entry.subtitle"
            :avatar="entry.avatar"
            :details="entry.details"
            :compact="true"
          >
            <template #actions>
              <ActionButton
                class-name="btn btn-sm btn-outline-danger"
                icon="bi-x-lg"
                label="Remove"
                @click="removeSelected(entry.id)"
              />
            </template>
          </UserProfileCard>
        </div>
      </div>

      <div class="entity-search__group" v-if="showQuickGroup">
        <span class="small text-secondary">{{ quickItemsLabel || 'Items' }}</span>

        <div class="entity-search__results" v-if="quickRows.length">
          <UserProfileCard
            v-for="item in quickRows"
            :key="`quick-${itemId(item)}`"
            :title="itemTitle(item)"
            :subtitle="itemSubtitle(item)"
            :avatar="itemAvatar(item)"
            :details="detailsOf(item)"
          >
            <template #actions>
              <ActionButton
                :class-name="isSelected(item) ? 'btn btn-sm btn-outline-secondary' : 'btn btn-sm btn-primary'"
                :label="isSelected(item) ? 'Selected' : 'Add'"
                :disabled="isSelected(item)"
                @click="selectItem(item)"
              />
            </template>
          </UserProfileCard>
        </div>

        <div class="entity-search__hint text-secondary small" v-else-if="quickItemsEmptyText">
          {{ quickItemsEmptyText }}
        </div>
      </div>

      <div class="small text-danger" v-if="errorText">{{ errorText }}</div>

      <div class="entity-search__hint text-secondary small" v-if="!searched && !results.length && !busy && !errorText">
        {{ idleHint }}
      </div>

      <div class="entity-search__group" v-if="results.length">
        <span class="small text-secondary">{{ searchResultsLabel }}</span>

        <div class="entity-search__results">
          <UserProfileCard
            v-for="item in results"
            :key="itemId(item)"
            :title="itemTitle(item)"
            :subtitle="itemSubtitle(item)"
            :avatar="itemAvatar(item)"
            :details="detailsOf(item)"
          >
            <template #actions>
              <ActionButton
                :class-name="isSelected(item) ? 'btn btn-sm btn-outline-secondary' : 'btn btn-sm btn-primary'"
                :label="isSelected(item) ? 'Selected' : 'Add'"
                :disabled="isSelected(item)"
                @click="selectItem(item)"
              />
            </template>
          </UserProfileCard>
        </div>
      </div>

      <div class="entity-search__hint text-secondary small" v-else-if="searched && !busy && !errorText">
        {{ emptyResultsText }}
      </div>
    </div>
  </section>
</template>
