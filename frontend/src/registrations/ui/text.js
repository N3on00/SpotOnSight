import { toUserErrorMessage } from '../../services/apiErrors'

export function resolve(value, ...args) {
  return typeof value === 'function' ? value(...args) : value
}

export function toDetails(value) {
  if (value == null) return ''
  const text = String(value).trim()
  if (!text) return ''
  return toUserErrorMessage(text, text)
}

export function resolveText(value, fallback, ...args) {
  const text = toDetails(resolve(value, ...args))
  if (text) return text
  return toDetails(fallback)
}

function splitDetailLines(value) {
  const text = toDetails(value)
  if (!text) return []

  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function mergeUniqueDetails(...values) {
  const merged = []
  const seen = new Set()

  for (const value of values) {
    const lines = splitDetailLines(value)
    for (const line of lines) {
      const key = line.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(line)
    }
  }

  return merged.join('\n')
}
