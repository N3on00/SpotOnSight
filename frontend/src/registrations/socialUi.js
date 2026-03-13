import { createScreenModule } from '../core/screenRegistry'
import { UI_ACTIONS, UI_COMPONENT_IDS, UI_SCREENS } from '../core/uiElements'
import SocialHero from '../components/social/SocialHero.vue'
import SocialHub from '../components/social/SocialHub.vue'
import SocialMeetups from '../components/social/SocialMeetups.vue'
import { reloadDashboardData } from './uiShared'
import { buildSocialHubProps } from './social/socialHubProps'
import { loadMeetupInvitesSafe, loadMeetupsSafe } from './social/meetupsControllerAccess'
import { buildSocialMeetupsProps } from './social/socialMeetupsProps'

const socialScreen = createScreenModule(UI_SCREENS.SOCIAL)

socialScreen.action(UI_ACTIONS.SOCIAL_REFRESH, async ({ app }) => {
  app.state.social.searchResults = []
  await reloadDashboardData(app)
  app.state.social.meetups = await loadMeetupsSafe(app, 'upcoming')
  app.state.social.meetupInvites = await loadMeetupInvitesSafe(app)
})

socialScreen.header({
  id: UI_COMPONENT_IDS.SOCIAL_HERO,
  order: 10,
  component: SocialHero,
})

socialScreen.main({
  id: UI_COMPONENT_IDS.SOCIAL_HUB,
  order: 10,
  component: SocialHub,
  buildProps: buildSocialHubProps,
})

socialScreen.main({
  id: UI_COMPONENT_IDS.SOCIAL_MEETUPS,
  order: 20,
  component: SocialMeetups,
  buildProps: buildSocialMeetupsProps,
})

socialScreen.lifecycle({
  onEnter: async ({ app }) => {
    await app.ui.runAction(UI_ACTIONS.SOCIAL_REFRESH)
  },
  errorTitle: 'Social load failed',
  errorMessage: 'Could not initialize social page.',
})
