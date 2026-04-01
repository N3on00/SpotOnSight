import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

import { APP_CTX_KEY } from '../core/injection'
import AppTopNav from '../components/layouts/AppTopNav.vue'
import { ROUTE_NAMES } from '../router/routeSpec'

const pushMock = vi.hoisted(() => vi.fn())
const responsiveState = vi.hoisted(() => ({
  isMobile: false,
  isMobileBottomNav: false,
  compactBySpace: true,
}))
const routeState = vi.hoisted(() => ({
  name: '',
  fullPath: '/',
}))

vi.mock('vue-router', () => ({
  useRoute: () => routeState,
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('../components/layouts/composables/useResponsiveTopNav', () => ({
  useResponsiveTopNav: () => ({
    isMobile: ref(responsiveState.isMobile),
    isMobileBottomNav: ref(responsiveState.isMobileBottomNav),
    compactBySpace: ref(responsiveState.compactBySpace),
    navRoot: ref(null),
    panelRoot: ref(null),
    primaryLinksRoot: ref(null),
  }),
}))

function createApp() {
  return {
    state: {
      session: {
        user: {
          id: 'user-1',
          username: 'taylor',
          display_name: 'Taylor',
          email: 'taylor@example.com',
          avatar_image: '',
          is_admin: false,
        },
      },
      social: {
        incomingRequests: [],
      },
      notificationLog: [],
    },
    ui: {
      isAuthenticated: () => true,
    },
    action: () => ({
      logout: vi.fn(),
    }),
    service: () => ({
      push: vi.fn(),
      clearLog: vi.fn(),
    }),
  }
}

function mountTopNav() {
  return mount(AppTopNav, {
    global: {
      provide: {
        [APP_CTX_KEY]: createApp(),
      },
    },
  })
}

function setResponsiveMode({ isMobile = false, isMobileBottomNav = false, compactBySpace = true } = {}) {
  responsiveState.isMobile = isMobile
  responsiveState.isMobileBottomNav = isMobileBottomNav
  responsiveState.compactBySpace = compactBySpace
}

describe('AppTopNav', () => {
  it('keeps the user trigger expanded on user-menu routes in compact mode', () => {
    setResponsiveMode({ compactBySpace: true })
    routeState.name = ROUTE_NAMES.SETTINGS
    routeState.fullPath = '/settings'

    const wrapper = mountTopNav()
    const userButton = wrapper.find('button[aria-label="Open user menu"]')

    expect(userButton.classes()).toContain('btn-primary')
    expect(wrapper.text()).toContain('@taylor')
  })

  it('keeps the user trigger collapsed on primary routes in compact mode', () => {
    setResponsiveMode({ compactBySpace: true })
    routeState.name = ROUTE_NAMES.HOME
    routeState.fullPath = '/home'

    const wrapper = mountTopNav()
    const userNameSpan = wrapper.find('.app-top-nav__user-name')

    expect(userNameSpan.exists()).toBe(true)
    expect(userNameSpan.classes()).not.toContain('app-top-nav__user-name--visible')
  })

  it('shows text only for the active page tab in mobile bottom-nav mode', () => {
    setResponsiveMode({ isMobile: true, isMobileBottomNav: true, compactBySpace: true })
    routeState.name = ROUTE_NAMES.MAP
    routeState.fullPath = '/map'

    const wrapper = mountTopNav()
    const navButtons = wrapper.findAll('.app-top-nav__links .app-top-nav__link')
    const visibleLabels = wrapper.findAll('.app-top-nav__link-label--visible')

    expect(navButtons).toHaveLength(3)
    expect(visibleLabels).toHaveLength(1)
    expect(visibleLabels[0].text()).toBe('Map')
  })

  it('keeps notification and user controls icon-only in mobile bottom-nav mode', () => {
    setResponsiveMode({ isMobile: true, isMobileBottomNav: true, compactBySpace: true })
    routeState.name = ROUTE_NAMES.HOME
    routeState.fullPath = '/home'

    const wrapper = mountTopNav()
    const notificationButton = wrapper.find('button[aria-label="Open notification log"]')
    const userButton = wrapper.find('button[aria-label="Open user menu"]')

    expect(notificationButton.find('.action-button__label').exists()).toBe(false)
    expect(userButton.find('.app-top-nav__user-name--visible').exists()).toBe(false)
  })
})
