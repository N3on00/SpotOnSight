export function normalizeWebsiteList(values) {
  const source = Array.isArray(values) ? values : []
  const out = []
  const seen = new Set()

  for (const value of source) {
    const url = String(value || '').trim()
    if (!url) continue
    const key = url.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(url)
  }

  return out
}

export function websitesFromSocialAccounts(source) {
  if (!source || typeof source !== 'object') return ['']

  const websiteEntries = Object.entries(source)
    .filter(([key, value]) => {
      const normalizedKey = String(key || '').trim().toLowerCase()
      const normalizedValue = String(value || '').trim()
      if (!normalizedValue) return false
      return normalizedKey === 'website' || normalizedKey.startsWith('website_')
    })
    .sort(([leftKey], [rightKey]) => {
      const left = String(leftKey || '').trim().toLowerCase()
      const right = String(rightKey || '').trim().toLowerCase()

      if (left === 'website') return -1
      if (right === 'website') return 1

      const leftNum = Number(left.replace('website_', '')) || 0
      const rightNum = Number(right.replace('website_', '')) || 0
      return leftNum - rightNum
    })
    .map(([, value]) => String(value || '').trim())

  const normalized = normalizeWebsiteList(websiteEntries)
  return normalized.length ? normalized : ['']
}

export function createPasswordChecks(form) {
  const current = String(form.currentPassword || '')
  const next = String(form.newPassword || '')
  const confirm = String(form.confirmNewPassword || '')
  const changing = next.length > 0 || confirm.length > 0 || current.length > 0

  return {
    changing,
    currentProvided: current.length > 0,
    len: next.length >= 8,
    lower: /[a-z]/.test(next),
    upper: /[A-Z]/.test(next),
    digit: /\d/.test(next),
    special: /[^A-Za-z0-9]/.test(next),
    match: next.length > 0 && confirm.length > 0 && next === confirm,
  }
}

export function createSocialAccountsPayload(form) {
  const websites = normalizeWebsiteList(form.websites)
  const socialAccounts = {
    instagram: String(form.instagram || '').trim(),
    github: String(form.github || '').trim(),
  }

  if (websites[0]) {
    socialAccounts.website = websites[0]
  }
  for (let index = 1; index < websites.length; index += 1) {
    socialAccounts[`website_${index + 1}`] = websites[index]
  }

  return socialAccounts
}
