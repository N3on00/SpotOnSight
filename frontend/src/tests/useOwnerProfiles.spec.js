import { describe, expect, it, vi } from 'vitest'
import { useOwnerProfiles } from '../composables/useOwnerProfiles'

describe('useOwnerProfiles', () => {
  it('loads unique owner profiles and exposes owner labels', async () => {
    const loadUserProfile = vi.fn(async (ownerId) => ({
      id: ownerId,
      username: `user-${ownerId}`,
      display_name: `Display ${ownerId}`,
      email: `${ownerId}@example.test`,
    }))

    const {
      ownerLabel,
      ownerSearchText,
      warmOwnerProfiles,
    } = useOwnerProfiles(loadUserProfile)

    await warmOwnerProfiles([
      { owner_id: 'user-1' },
      { owner_id: 'user-2' },
      { owner_id: 'user-1' },
    ])

    expect(loadUserProfile).toHaveBeenCalledTimes(2)
    expect(ownerLabel({ owner_id: 'user-1' })).toBe('@user-user-1')
    expect(ownerSearchText({ owner_id: 'user-2' })).toContain('user-2@example.test')
  })

  it('falls back to owner id when no profile exists yet', () => {
    const { ownerLabel } = useOwnerProfiles(async () => null)
    expect(ownerLabel({ owner_id: '' })).toBe('unknown creator')
    expect(ownerLabel({ owner_id: 'abc123' })).toBe('id: abc123')
  })

  it('swallows loader errors and keeps owner fallback labels', async () => {
    const { ownerLabel, warmOwnerProfiles } = useOwnerProfiles(async () => {
      throw new Error('profile load failed')
    })

    await expect(warmOwnerProfiles([{ owner_id: 'u-1' }])).resolves.toBeUndefined()
    expect(ownerLabel({ owner_id: 'u-1' })).toBe('id: u-1')
  })
})
