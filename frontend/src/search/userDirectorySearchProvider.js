import { normalizeUser } from '../models/userMapper'
import { BaseSearchProvider } from './baseSearchProvider'

function normalizeUserList(items) {
  if (!Array.isArray(items)) return []

  const out = []
  const seen = new Set()

  for (const item of items) {
    const user = normalizeUser(item)
    const id = String(user.id || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(user)
  }

  return out
}

function byDisplayName(a, b) {
  const left = String(a?.display_name || a?.username || '').toLowerCase()
  const right = String(b?.display_name || b?.username || '').toLowerCase()
  return left.localeCompare(right)
}

function matchesUser(user, query) {
  const q = String(query || '').toLowerCase()
  if (!q) return true

  const haystack = [
    user?.display_name,
    user?.username,
    user?.email,
    user?.id,
  ]
    .map((value) => String(value || '').toLowerCase())
    .join(' ')

  return haystack.includes(q)
}

export class UserDirectorySearchProvider extends BaseSearchProvider {
  constructor({
    searchAllUsers,
    loadFriendUsers,
    defaultLimit = 20,
    returnFriendMatchesWithoutQuery = true,
    includeFriendMatches = true,
    excludeFriendsFromGlobal = false,
  } = {}) {
    super({ minQueryLength: 0, defaultLimit })

    this.searchAllUsers = searchAllUsers
    this.loadFriendUsers = loadFriendUsers
    this.returnFriendMatchesWithoutQuery = returnFriendMatchesWithoutQuery
    this.includeFriendMatches = includeFriendMatches
    this.excludeFriendsFromGlobal = excludeFriendsFromGlobal
    this._friendCache = null
  }

  resetFriendCache() {
    this._friendCache = null
  }

  async _friends() {
    if (!this._friendCache) {
      const data = await this.loadFriendUsers()
      this._friendCache = normalizeUserList(data).sort(byDisplayName)
    }
    return this._friendCache
  }

  async execute(query, context = {}) {
    const limit = this.normalizeLimit(context.limit)

    const friends = await this._friends()
    const friendMatches = friends.filter((user) => matchesUser(user, query))

    if (!query) {
      if (!this.returnFriendMatchesWithoutQuery) {
        return []
      }
      return friendMatches.slice(0, limit)
    }

    const users = await this.searchAllUsers(query, Math.max(limit, 30))
    let globalMatches = normalizeUserList(users)

    if (this.excludeFriendsFromGlobal) {
      const friendIds = new Set(
        friends
          .map((user) => String(user?.id || '').trim())
          .filter(Boolean),
      )

      globalMatches = globalMatches.filter((user) => {
        const id = String(user?.id || '').trim()
        if (!id) return false
        return !friendIds.has(id)
      })
    }

    if (!this.includeFriendMatches) {
      return globalMatches.slice(0, limit)
    }

    return normalizeUserList([...friendMatches, ...globalMatches]).slice(0, limit)
  }
}
