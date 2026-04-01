import { UI_ACTIONS, UI_COMPONENT_IDS, UI_SCREENS } from '../core/uiElements'
import SocialHero from '../components/social/SocialHero.vue'
import SocialHub from '../components/social/SocialHub.vue'
import SocialMeetups from '../components/social/SocialMeetups.vue'
import { setSocialMeetupState } from '../state/appMutations'
import { reloadDashboardData } from './uiShared'
import { buildSocialHubProps } from './social/socialHubProps'
import { loadMeetupInvitesSafe, loadMeetupsSafe } from './social/meetupsAccess'
import { buildSocialMeetupsProps } from './social/socialMeetupsProps'

const registeredRegistries = new WeakSet()

const SOCIAL_SCREEN_DEFINITION = {
  screen: UI_SCREENS.SOCIAL,
  actions: [
    {
      id: UI_ACTIONS.SOCIAL_REFRESH,
      handler: async ({ app }) => {
        await reloadDashboardData(app)
        setSocialMeetupState(app.state, {
          searchResults: [],
          meetups: await loadMeetupsSafe(app, 'upcoming'),
          meetupInvites: await loadMeetupInvitesSafe(app),
        })
      },
    },
  ],
  headers: [
    {
      id: UI_COMPONENT_IDS.SOCIAL_HERO,
      order: 10,
      component: SocialHero,
    },
  ],
  main: [
    {
      id: UI_COMPONENT_IDS.SOCIAL_HUB,
      order: 10,
      component: SocialHub,
      buildProps: buildSocialHubProps,
    },
    {
      id: UI_COMPONENT_IDS.SOCIAL_MEETUPS,
      order: 20,
      component: SocialMeetups,
      buildProps: buildSocialMeetupsProps,
    },
  ],
  lifecycle: {
    onEnter: async ({ app }) => {
      await app.ui.runAction(UI_ACTIONS.SOCIAL_REFRESH)
    },
    errorTitle: 'Social load failed',
    errorMessage: 'Could not initialize social page.',
  },
}

export function registerSocialUi(registry) {
  if (registeredRegistries.has(registry)) return
  registeredRegistries.add(registry)
  registry.registerScreenDefinition(SOCIAL_SCREEN_DEFINITION)
}
