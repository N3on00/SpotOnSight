import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

function applyMobileOverlayHeight(value = 0) {
  if (typeof document === 'undefined') return
  const px = Math.max(0, Math.ceil(Number(value) || 0))
  document.documentElement.style.setProperty('--app-mobile-nav-overlay-height', `${px}px`)
}

export function useResponsiveTopNav({ show, notificationsOpen, userMenuOpen, routePath }) {
  const isMobile = ref(false)
  const compactBySpace = ref(false)
  const navRoot = ref(null)
  const panelRoot = ref(null)
  const primaryLinksRoot = ref(null)

  function updateCompactMode() {
    if (isMobile.value) {
      compactBySpace.value = false
      return
    }

    const root = navRoot.value
    const primaryLinks = primaryLinksRoot.value
    if (!root || !primaryLinks) {
      compactBySpace.value = false
      return
    }

    const hasOverflow = primaryLinks.scrollWidth > primaryLinks.clientWidth + 4
    const clippedLabels = [...primaryLinks.querySelectorAll('.action-button__label')]
      .some((node) => Number(node?.scrollWidth || 0) > Number(node?.clientWidth || 0) + 1)

    compactBySpace.value = hasOverflow || clippedLabels
  }

  function syncNotificationAnchor() {
    if (typeof window === 'undefined') return

    if (!show.value || !isMobile.value || !navRoot.value) {
      applyMobileOverlayHeight(0)
      return
    }

    const navRect = navRoot.value.getBoundingClientRect()
    let top = navRect.top

    if ((notificationsOpen.value || userMenuOpen.value) && panelRoot.value) {
      const panelRect = panelRoot.value.getBoundingClientRect()
      top = Math.min(top, panelRect.top)
    }

    applyMobileOverlayHeight(window.innerHeight - top)
  }

  function scheduleNotificationAnchorSync() {
    nextTick(() => {
      updateCompactMode()
      syncNotificationAnchor()
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          updateCompactMode()
          syncNotificationAnchor()
        })
      }
    })
  }

  function updateViewportMode() {
    if (typeof window === 'undefined') return
    isMobile.value = window.matchMedia('(max-width: 900px)').matches
    updateCompactMode()
    syncNotificationAnchor()
  }

  watch(
    () => [show.value, isMobile.value, notificationsOpen.value, userMenuOpen.value, routePath.value],
    () => {
      scheduleNotificationAnchorSync()
    },
    { immediate: true },
  )

  onMounted(() => {
    updateViewportMode()
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateViewportMode)
      scheduleNotificationAnchorSync()
    }
  })

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', updateViewportMode)
    }
    applyMobileOverlayHeight(0)
  })

  return {
    isMobile,
    compactBySpace,
    navRoot,
    panelRoot,
    primaryLinksRoot,
  }
}
