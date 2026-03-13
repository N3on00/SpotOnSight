<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SlotScreenLayout from '../components/layouts/SlotScreenLayout.vue'
import { resolveScreenErrorHandler } from '../core/errorHandlerRegistry'
import { useApp } from '../core/injection'
import { getScreenLifecycle } from '../core/screenRegistry'
import { UI_LAYOUTS, UI_SLOTS } from '../core/uiElements'

const props = defineProps({
  screen: { type: String, required: true },
})

const app = useApp()
const router = useRouter()
const route = useRoute()

function layoutForScreen(screen) {
  const layout = UI_LAYOUTS[screen]
  if (layout) return layout
  return {
    screen,
    slots: [UI_SLOTS.MAIN],
    screenClass: 'container-xxl py-3 py-md-4',
  }
}

function snapshotRoute(src) {
  const routeLike = src && typeof src === 'object' ? src : {}
  return {
    fullPath: String(routeLike.fullPath || ''),
    name: routeLike.name,
    params: { ...(routeLike.params || {}) },
    query: { ...(routeLike.query || {}) },
    meta: { ...(routeLike.meta || {}) },
  }
}

const lifecycle = computed(() => getScreenLifecycle(props.screen) || null)
const layout = computed(() => layoutForScreen(props.screen))

const screenCtx = computed(() => {
  const hook = lifecycle.value?.buildScreenCtx
  const base = { app, router, route, screen: props.screen }
  if (typeof hook === 'function') {
    const built = hook(base)
    if (built && typeof built === 'object') return built
  }
  return {
    router,
    route,
    screen: props.screen,
  }
})

const previousRoute = ref(null)

function resolveHandlerId(scope) {
  if (scope === 'route') {
    return lifecycle.value?.routeErrorHandlerId || lifecycle.value?.errorHandlerId || 'screen.default'
  }
  return lifecycle.value?.errorHandlerId || 'screen.default'
}

function notifyLifecycleError({ title, message, error, scope = 'enter' }) {
  const handler = resolveScreenErrorHandler(resolveHandlerId(scope), app)
  handler.handle({
    title,
    message,
    error,
    route,
    screen: props.screen,
    scope,
  })
}

async function runLifecycleHook(hookName, errorTitle, errorMessage) {
  const hook = lifecycle.value?.[hookName]
  if (typeof hook !== 'function') return

  try {
    await hook({
      app,
      router,
      route,
      previousRoute: previousRoute.value,
      screen: props.screen,
    })
  } catch (error) {
    notifyLifecycleError({
      title: errorTitle,
      message: errorMessage,
      error,
      scope: 'enter',
    })
  }
}

onMounted(async () => {
  app.state.ui.activeScreen = props.screen
  previousRoute.value = snapshotRoute(route)

  await runLifecycleHook(
    'onEnter',
    lifecycle.value?.errorTitle,
    lifecycle.value?.errorMessage,
  )
})

watch(
  () => route.fullPath,
  async () => {
    const prev = previousRoute.value
    previousRoute.value = snapshotRoute(route)
    app.state.ui.activeScreen = props.screen

    const hook = lifecycle.value?.onRouteChange
    if (typeof hook !== 'function') return

    try {
      await hook({
        app,
        router,
        route,
        previousRoute: prev,
        screen: props.screen,
      })
    } catch (error) {
      notifyLifecycleError({
        title: lifecycle.value?.routeErrorTitle || lifecycle.value?.errorTitle,
        message: lifecycle.value?.routeErrorMessage || lifecycle.value?.errorMessage,
        error,
        scope: 'route',
      })
    }
  },
)
</script>

<template>
  <SlotScreenLayout
    :screen="layout.screen"
    :screen-ctx="screenCtx"
    :slots="layout.slots"
    :screen-class="layout.screenClass"
  />
</template>
