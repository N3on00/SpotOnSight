import { describe, expect, it, vi } from 'vitest'

import { API_ENDPOINTS } from '../api/registry'
import { AuthService } from '../services/authService'
import { SocialService } from '../services/socialService'
import { SpotsService } from '../services/spotsService'
import { SupportService } from '../services/supportService'
import { UsersService } from '../services/usersService'

class TestAuthService extends AuthService {}
class TestSpotsService extends SpotsService {}
class TestSocialService extends SocialService {}
class TestUsersService extends UsersService {}
class TestSupportService extends SupportService {}

function createState({ token = 'session-token', userId = 'me-1', email = 'me@example.com' } = {}) {
  return {
    session: {
      token,
      user: {
        id: userId,
        email,
        username: 'me',
      },
    },
    spots: [],
    favorites: [],
  }
}

function createGatewayMock() {
  return {
    request: vi.fn(),
  }
}

function authResponse() {
  return {
    access_token: 'token-new',
    user: {
      id: 'user-1',
      username: 'alice',
      email: 'alice@example.com',
      display_name: 'Alice',
    },
  }
}

describe('AuthService API communication', () => {
  it('logs in with auth.login endpoint', async () => {
    const api = createGatewayMock()
    api.request.mockResolvedValueOnce(authResponse())

    const state = createState({ token: '' })
    const service = new TestAuthService(api, state)

    const ok = await service.login('alice', 'pw')

    expect(ok).toBe(true)
    expect(api.request).toHaveBeenCalledWith(API_ENDPOINTS.AUTH_LOGIN, {
      body: {
        username_or_email: 'alice',
        password: 'pw',
      },
    })
  })

  it('uses fallback auth.login payload variants when backend requires username', async () => {
    const api = createGatewayMock()
    const validationError = {
      status: 422,
      data: {
        detail: [{ loc: ['body', 'username'], msg: 'Field required' }],
      },
    }

    api.request
      .mockRejectedValueOnce(validationError)
      .mockRejectedValueOnce(validationError)
      .mockResolvedValueOnce(authResponse())

    const service = new TestAuthService(api, createState({ token: '' }))
    const ok = await service.login('alice', 'pw')

    expect(ok).toBe(true)
    expect(api.request).toHaveBeenNthCalledWith(1, API_ENDPOINTS.AUTH_LOGIN, {
      body: {
        username_or_email: 'alice',
        password: 'pw',
      },
    })
    expect(api.request).toHaveBeenNthCalledWith(2, API_ENDPOINTS.AUTH_LOGIN, {
      body: {
        username: 'alice',
        password: 'pw',
      },
    })
    expect(api.request).toHaveBeenNthCalledWith(3, API_ENDPOINTS.AUTH_LOGIN, {
      body: {
        username: 'alice',
        password: 'pw',
      },
      formEncoded: true,
    })
  })

  it('registers with auth.register endpoint', async () => {
    const api = createGatewayMock()
    api.request.mockResolvedValueOnce(authResponse())

    const service = new TestAuthService(api, createState({ token: '' }))
    const ok = await service.register({
      username: 'alice',
      email: 'alice@example.com',
      password: 'pw',
      displayName: 'Alice',
    })

    expect(ok).toBe(true)
    expect(api.request).toHaveBeenCalledWith(API_ENDPOINTS.AUTH_REGISTER, {
      body: {
        username: 'alice',
        email: 'alice@example.com',
        password: 'pw',
        display_name: 'Alice',
      },
    })
  })
})

describe('SpotsService API communication', () => {
  it('covers list/create/update/delete/byUser/favoritesOfUser endpoints', async () => {
    const api = createGatewayMock()
    api.request
      .mockResolvedValueOnce([{ id: 'spot-1', title: 'One' }])
      .mockResolvedValueOnce({ id: 'spot-2' })
      .mockResolvedValueOnce({ modified_count: 1 })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce([{ id: 'spot-3', title: 'By user' }])
      .mockResolvedValueOnce([{ spot_id: 'spot-1' }])
      .mockResolvedValueOnce([{ id: 'spot-1', title: 'Fav spot' }])

    const service = new TestSpotsService(api, createState())

    await service.list()
    await service.create({ title: 'New spot', lat: 1, lon: 2 })
    await service.update('spot-1', { title: 'Updated', lat: 1, lon: 2 })
    await service.delete('spot-1')
    await service.byUser('user-1')
    await service.favoritesOfUser('user-1')

    expect(api.request).toHaveBeenNthCalledWith(1, API_ENDPOINTS.SOCIAL_SPOTS_LIST)
    expect(api.request).toHaveBeenNthCalledWith(2, API_ENDPOINTS.SOCIAL_SPOTS_CREATE, {
      body: expect.objectContaining({ title: 'New spot' }),
    })
    expect(api.request).toHaveBeenNthCalledWith(3, API_ENDPOINTS.SOCIAL_SPOTS_UPDATE, {
      params: { spotId: 'spot-1' },
      body: expect.objectContaining({ title: 'Updated' }),
    })
    expect(api.request).toHaveBeenNthCalledWith(4, API_ENDPOINTS.SOCIAL_SPOTS_DELETE, {
      params: { spotId: 'spot-1' },
    })
    expect(api.request).toHaveBeenNthCalledWith(5, API_ENDPOINTS.SOCIAL_USERS_SPOTS, {
      params: { userId: 'user-1' },
    })
    expect(api.request).toHaveBeenNthCalledWith(6, API_ENDPOINTS.SOCIAL_USERS_FAVORITES, {
      params: { userId: 'user-1' },
    })
    expect(api.request).toHaveBeenNthCalledWith(7, API_ENDPOINTS.SOCIAL_SPOTS_LIST)
  })
})

describe('SocialService API communication', () => {
  it('covers favorite/share/follow/block mutation endpoints', async () => {
    const api = createGatewayMock()
    api.request
      .mockResolvedValueOnce([{ spot_id: 'spot-1' }])
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})

    const service = new TestSocialService(api, createState())

    await service.loadFavorites()
    await service.favoriteSpot('spot-1')
    await service.unfavoriteSpot('spot-1')
    await service.shareSpot('spot-1', 'hello')
    await service.followUser('user-2')
    await service.unfollowUser('user-2')
    await service.removeFollower('user-2')
    await service.approveFollowRequest('user-2')
    await service.rejectFollowRequest('user-2')
    await service.blockUser('user-2')
    await service.unblockUser('user-2')

    expect(api.request).toHaveBeenNthCalledWith(1, API_ENDPOINTS.SOCIAL_FAVORITES_LIST)
    expect(api.request).toHaveBeenNthCalledWith(2, API_ENDPOINTS.SOCIAL_FAVORITES_CREATE, {
      params: { spotId: 'spot-1' },
      body: {},
    })
    expect(api.request).toHaveBeenNthCalledWith(3, API_ENDPOINTS.SOCIAL_FAVORITES_DELETE, {
      params: { spotId: 'spot-1' },
    })
    expect(api.request).toHaveBeenNthCalledWith(4, API_ENDPOINTS.SOCIAL_SHARE_SPOT, {
      params: { spotId: 'spot-1' },
      body: { message: 'hello' },
    })
    expect(api.request).toHaveBeenNthCalledWith(5, API_ENDPOINTS.SOCIAL_FOLLOW_USER, {
      params: { userId: 'user-2' },
      body: {},
    })
    expect(api.request).toHaveBeenNthCalledWith(6, API_ENDPOINTS.SOCIAL_UNFOLLOW_USER, {
      params: { userId: 'user-2' },
    })
    expect(api.request).toHaveBeenNthCalledWith(7, API_ENDPOINTS.SOCIAL_REMOVE_FOLLOWER, {
      params: { userId: 'user-2' },
    })
    expect(api.request).toHaveBeenNthCalledWith(8, API_ENDPOINTS.SOCIAL_FOLLOW_REQUEST_APPROVE, {
      params: { userId: 'user-2' },
      body: {},
    })
    expect(api.request).toHaveBeenNthCalledWith(9, API_ENDPOINTS.SOCIAL_FOLLOW_REQUEST_REJECT, {
      params: { userId: 'user-2' },
      body: {},
    })
    expect(api.request).toHaveBeenNthCalledWith(10, API_ENDPOINTS.SOCIAL_BLOCK_USER, {
      params: { userId: 'user-2' },
      body: {},
    })
    expect(api.request).toHaveBeenNthCalledWith(11, API_ENDPOINTS.SOCIAL_UNBLOCK_USER, {
      params: { userId: 'user-2' },
    })
  })

  it('covers incoming requests + blocked/followers/following list endpoints', async () => {
    const api = createGatewayMock()
    api.request
      .mockResolvedValueOnce([
        { follower_id: 'user-2', created_at: '2026-01-01T10:00:00Z' },
      ])
      .mockResolvedValueOnce({ id: 'user-2', username: 'follower' })
      .mockResolvedValueOnce([{ user_id: 'user-3' }])
      .mockResolvedValueOnce({ id: 'user-3', username: 'blocked' })
      .mockResolvedValueOnce([{ user_id: 'user-4' }])
      .mockResolvedValueOnce({ id: 'user-4', username: 'fan' })
      .mockResolvedValueOnce([{ user_id: 'user-5' }])
      .mockResolvedValueOnce({ id: 'user-5', username: 'following' })

    const service = new TestSocialService(api, createState())

    const incoming = await service.incomingFollowRequests()
    const blocked = await service.blockedUsers()
    const followers = await service.followersOf('me-1')
    const following = await service.followingOf('me-1')

    expect(incoming).toHaveLength(1)
    expect(blocked).toHaveLength(1)
    expect(followers).toHaveLength(1)
    expect(following).toHaveLength(1)

    expect(api.request).toHaveBeenNthCalledWith(1, API_ENDPOINTS.SOCIAL_FOLLOW_REQUESTS_LIST)
    expect(api.request).toHaveBeenNthCalledWith(2, API_ENDPOINTS.SOCIAL_USERS_PROFILE, {
      params: { userId: 'user-2' },
    })
    expect(api.request).toHaveBeenNthCalledWith(3, API_ENDPOINTS.SOCIAL_BLOCKED_LIST)
    expect(api.request).toHaveBeenNthCalledWith(4, API_ENDPOINTS.SOCIAL_USERS_PROFILE, {
      params: { userId: 'user-3' },
    })
    expect(api.request).toHaveBeenNthCalledWith(5, API_ENDPOINTS.SOCIAL_FOLLOWERS_LIST, {
      params: { userId: 'me-1' },
    })
    expect(api.request).toHaveBeenNthCalledWith(6, API_ENDPOINTS.SOCIAL_USERS_PROFILE, {
      params: { userId: 'user-4' },
    })
    expect(api.request).toHaveBeenNthCalledWith(7, API_ENDPOINTS.SOCIAL_FOLLOWING_LIST, {
      params: { userId: 'me-1' },
    })
    expect(api.request).toHaveBeenNthCalledWith(8, API_ENDPOINTS.SOCIAL_USERS_PROFILE, {
      params: { userId: 'user-5' },
    })
  })
})

describe('UsersService API communication', () => {
  it('covers me/profile/search/update endpoints', async () => {
    const api = createGatewayMock()
    api.request
      .mockResolvedValueOnce({ id: 'me-1', username: 'me' })
      .mockResolvedValueOnce({ id: 'user-2', username: 'u2' })
      .mockResolvedValueOnce([{ id: 'user-3', username: 'search-hit' }])
      .mockResolvedValueOnce({ id: 'me-1', username: 'me-updated' })

    const service = new TestUsersService(api, createState())

    await service.me()
    await service.profile('user-2')
    await service.searchByUsername('search-hit', 10)
    await service.updateMe({ displayName: 'Me Updated' })

    expect(api.request).toHaveBeenNthCalledWith(1, API_ENDPOINTS.SOCIAL_ME_GET)
    expect(api.request).toHaveBeenNthCalledWith(2, API_ENDPOINTS.SOCIAL_USERS_PROFILE, {
      params: { userId: 'user-2' },
    })
    expect(api.request).toHaveBeenNthCalledWith(3, API_ENDPOINTS.SOCIAL_USERS_SEARCH, {
      query: { q: 'search-hit', limit: 10 },
    })
    expect(api.request).toHaveBeenNthCalledWith(4, API_ENDPOINTS.SOCIAL_ME_UPDATE, {
      body: expect.objectContaining({ display_name: 'Me Updated' }),
    })
  })

  it('covers friend directory endpoints', async () => {
    const api = createGatewayMock()
    api.request
      .mockResolvedValueOnce([{ user_id: 'user-2' }])
      .mockResolvedValueOnce([{ user_id: 'user-3' }])
      .mockResolvedValueOnce({ id: 'user-2', username: 'friendA' })
      .mockResolvedValueOnce({ id: 'user-3', username: 'friendB' })

    const service = new TestUsersService(api, createState({ userId: 'me-1' }))
    const friends = await service.friendDirectory()

    expect(friends).toHaveLength(2)
    expect(api.request).toHaveBeenNthCalledWith(1, API_ENDPOINTS.SOCIAL_FOLLOWERS_LIST, {
      params: { userId: 'me-1' },
    })
    expect(api.request).toHaveBeenNthCalledWith(2, API_ENDPOINTS.SOCIAL_FOLLOWING_LIST, {
      params: { userId: 'me-1' },
    })
    expect(api.request).toHaveBeenNthCalledWith(3, API_ENDPOINTS.SOCIAL_USERS_PROFILE, {
      params: { userId: 'user-2' },
    })
    expect(api.request).toHaveBeenNthCalledWith(4, API_ENDPOINTS.SOCIAL_USERS_PROFILE, {
      params: { userId: 'user-3' },
    })
  })
})

describe('SupportService API communication', () => {
  it('submits ticket through support endpoint', async () => {
    const api = createGatewayMock()
    api.request.mockResolvedValueOnce({
      id: 'ticket-1',
      user_id: 'me-1',
      category: 'bug',
      subject: 'Need help',
      message: 'Bug details',
      page: '/map',
      contact_email: 'me@example.com',
      allow_contact: true,
      status: 'open',
      created_at: '2026-01-01T12:00:00Z',
    })

    const service = new TestSupportService(api, createState())

    const ticket = await service.createTicket({
      category: 'bug',
      subject: 'Need help',
      message: 'Bug details',
      page: '/map',
      allowContact: true,
    })

    expect(ticket?.id).toBe('ticket-1')
    expect(api.request).toHaveBeenCalledWith(API_ENDPOINTS.SOCIAL_SUPPORT_TICKETS_CREATE, {
      body: expect.objectContaining({
        category: 'bug',
        subject: 'Need help',
        message: 'Bug details',
      }),
    })
  })
})
