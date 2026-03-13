export const UI_SCREENS = Object.freeze({
  AUTH: 'auth',
  HOME: 'home',
  MAP: 'map',
  PROFILE: 'profile',
  SETTINGS: 'settings',
  SOCIAL: 'social',
  SUPPORT: 'support',
})

export const UI_SLOTS = Object.freeze({
  HEADER: 'header',
  MAIN: 'main',
  FOOTER: 'footer',
})

export const UI_ACTIONS = Object.freeze({
  AUTH_HELP: 'auth.help',
  HOME_REFRESH: 'home.refresh',
  MAP_RELOAD: 'map.reload',
  PROFILE_REFRESH: 'profile.refresh',
  SETTINGS_LOAD: 'settings.load',
  SOCIAL_REFRESH: 'social.refresh',
})

export const UI_COMPONENT_IDS = Object.freeze({
  AUTH_HERO: 'auth.hero',
  AUTH_FORMS: 'auth.forms',
  AUTH_SUPPORT: 'auth.support',
  HOME_HERO: 'home.hero',
  HOME_MAP_WIDGET: 'home.map-widget',
  HOME_DISCOVER: 'home.discover',
  MAP_HEADER: 'map.header',
  MAP_WORKSPACE: 'map.workspace',
  PROFILE_HERO: 'profile.hero',
  PROFILE_SUMMARY: 'profile.summary',
  SETTINGS_HERO: 'settings.hero',
  SETTINGS_FORM: 'settings.form',
  SOCIAL_HERO: 'social.hero',
  SOCIAL_HUB: 'social.hub',
  SOCIAL_MEETUPS: 'social.meetups',
  SUPPORT_HERO: 'support.hero',
  SUPPORT_FORM: 'support.form',
})

const AUTH_SLOTS = Object.freeze([UI_SLOTS.HEADER, UI_SLOTS.MAIN, UI_SLOTS.FOOTER])
const DEFAULT_SLOTS = Object.freeze([UI_SLOTS.HEADER, UI_SLOTS.MAIN])

export const UI_LAYOUTS = Object.freeze({
  [UI_SCREENS.AUTH]: Object.freeze({
    screen: UI_SCREENS.AUTH,
    slots: AUTH_SLOTS,
    screenClass: 'screen--auth container-xxl py-3 py-md-4',
  }),
  [UI_SCREENS.HOME]: Object.freeze({
    screen: UI_SCREENS.HOME,
    slots: DEFAULT_SLOTS,
    screenClass: 'container-xxl py-3 py-md-4',
  }),
  [UI_SCREENS.MAP]: Object.freeze({
    screen: UI_SCREENS.MAP,
    slots: DEFAULT_SLOTS,
    screenClass: 'screen--map container-fluid py-3 py-md-4 px-lg-4',
  }),
  [UI_SCREENS.PROFILE]: Object.freeze({
    screen: UI_SCREENS.PROFILE,
    slots: DEFAULT_SLOTS,
    screenClass: 'container-xxl py-3 py-md-4',
  }),
  [UI_SCREENS.SETTINGS]: Object.freeze({
    screen: UI_SCREENS.SETTINGS,
    slots: DEFAULT_SLOTS,
    screenClass: 'container-xxl py-3 py-md-4',
  }),
  [UI_SCREENS.SOCIAL]: Object.freeze({
    screen: UI_SCREENS.SOCIAL,
    slots: DEFAULT_SLOTS,
    screenClass: 'container-xxl py-3 py-md-4',
  }),
  [UI_SCREENS.SUPPORT]: Object.freeze({
    screen: UI_SCREENS.SUPPORT,
    slots: DEFAULT_SLOTS,
    screenClass: 'container-xxl py-3 py-md-4',
  }),
})
