import { asText as sanitizeText } from '../utils/sanitizers'

function asTextOr(value, fallback = '') {
  const text = sanitizeText(value)
  return text || fallback
}

export function normalizeUser(raw) {
  const item = raw && typeof raw === 'object' ? raw : {}
  const socialSource = item.social_accounts && typeof item.social_accounts === 'object'
    ? item.social_accounts
    : item.socialAccounts && typeof item.socialAccounts === 'object'
      ? item.socialAccounts
      : {}

  const socialAccounts = Object.fromEntries(
    Object.entries(socialSource)
      .map(([k, v]) => [asTextOr(k), asTextOr(v)])
      .filter(([k, v]) => k && v),
  )

  return {
    id: asTextOr(item.id || item._id),
    username: asTextOr(item.username),
    email: asTextOr(item.email),
    display_name: asTextOr(item.display_name || item.displayName || item.username),
    bio: asTextOr(item.bio),
    avatar_image: asTextOr(item.avatar_image || item.avatarImage),
    social_accounts: socialAccounts,
    follow_requires_approval: Boolean(item.follow_requires_approval ?? item.followRequiresApproval),
    created_at: asTextOr(item.created_at || item.createdAt),
  }
}
