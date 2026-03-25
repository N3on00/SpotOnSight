import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

import { APP_CTX_KEY } from '../core/injection'
import AppTopNav from '../components/layouts/AppTopNav.vue'
import { ROUTE_NAMES } from '../router/routeSpec'

const pushMock = vi.hoisted(() => vi.fn())
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
    isMobile: ref(false),
    compactBySpace: ref(true),
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
    controller: () => ({
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

describe('AppTopNav', () => {
  it('keeps the user trigger expanded on user-menu routes in compact mode', () => {
    routeState.name = ROUTE_NAMES.SETTINGS
    routeState.fullPath = '/settings'

    const wrapper = mountTopNav()
    const userButton = wrapper.find('button[aria-label="Open user menu"]')

    expect(userButton.classes()).toContain('btn-primary')
    expect(wrapper.text()).toContain('@taylor')
  })

  it('keeps the user trigger collapsed on primary routes in compact mode', () => {
    routeState.name = ROUTE_NAMES.HOME
    routeState.fullPath = '/home'

    const wrapper = mountTopNav()
    const userNameSpan = wrapper.find('.app-top-nav__user-name')

    expect(userNameSpan.exists()).toBe(true)
    expect(userNameSpan.classes()).not.toContain('app-top-nav__user-name--visible')
  })
})
