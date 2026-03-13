import { asText } from '../utils/sanitizers'

function stripDataUrlPrefix(value) {
  const text = asText(value)
  if (!text) return ''

  const match = text.match(/^data:[^,]+,(.*)$/)
  if (match && match[1]) {
    return match[1]
  }
  return text
}

export function toImageSource(value) {
  const text = asText(value)
  if (!text) return ''
  if (text.startsWith('data:')) return text
  return `data:image/*;base64,${text}`
}

export function estimateImageBytes(value) {
  const base64 = stripDataUrlPrefix(value)
  if (!base64) return 0

  const clean = base64.replace(/\s+/g, '')
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding)
}

export function firstImageSource(images) {
  if (!Array.isArray(images) || !images.length) return ''
  return toImageSource(images[0])
}
