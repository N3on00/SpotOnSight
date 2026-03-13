const SAFE_LINK_PREFIX = /^(https?:\/\/|mailto:|tel:|\/|#)/i

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

function normalizeHref(value) {
  const raw = String(value || '').trim().replace(/^<|>$/g, '')
  if (!raw) return ''
  if (SAFE_LINK_PREFIX.test(raw)) return raw
  return ''
}

function isExternalHref(href) {
  return /^(https?:\/\/|mailto:|tel:)/i.test(String(href || ''))
}

function applyInlineMarkdown(value) {
  const codeTokens = []
  let output = escapeHtml(value)

  output = output.replace(/`([^`\n]+)`/g, (_, codeText) => {
    const index = codeTokens.push(`<code>${codeText}</code>`) - 1
    return `\u0000md_code_${index}\u0000`
  })

  output = output.replace(/\[([^\]\n]+)\]\(([^)\n]+)\)/g, (_, label, rawHref) => {
    const hrefToken = String(rawHref || '').trim().split(/\s+/)[0]
    const href = normalizeHref(hrefToken)
    if (!href) return label

    const attrs = isExternalHref(href)
      ? ' target="_blank" rel="noreferrer noopener"'
      : ''

    return `<a href="${escapeHtmlAttribute(href)}"${attrs}>${label}</a>`
  })

  output = output
    .replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>')
    .replace(/(^|[\s(>])\*([^*\n]+)\*(?=$|[\s)<.,!?:;])/g, '$1<em>$2</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')

  output = output.replace(/\u0000md_code_(\d+)\u0000/g, (_, tokenIndex) => {
    const index = Number(tokenIndex)
    return Number.isInteger(index) ? (codeTokens[index] || '') : ''
  })

  return output
}

export function renderMarkdownToHtml(value) {
  const source = String(value || '').replace(/\r\n/g, '\n').trim()
  if (!source) return ''

  const lines = source.split('\n')
  const html = []
  const paragraph = []
  let listType = ''

  const flushParagraph = () => {
    if (!paragraph.length) return
    const content = paragraph.map((line) => applyInlineMarkdown(line)).join('<br />')
    html.push(`<p>${content}</p>`)
    paragraph.length = 0
  }

  const closeList = () => {
    if (!listType) return
    html.push(`</${listType}>`)
    listType = ''
  }

  for (const rawLine of lines) {
    const line = String(rawLine || '').trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      closeList()
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      closeList()
      const level = Math.min(4, Math.max(1, headingMatch[1].length))
      html.push(`<h${level}>${applyInlineMarkdown(headingMatch[2])}</h${level}>`)
      continue
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/)
    if (quoteMatch) {
      flushParagraph()
      closeList()
      html.push(`<blockquote><p>${applyInlineMarkdown(quoteMatch[1] || '')}</p></blockquote>`)
      continue
    }

    const unorderedMatch = trimmed.match(/^[-*+]\s+(.+)$/)
    if (unorderedMatch) {
      flushParagraph()
      if (listType !== 'ul') {
        closeList()
        html.push('<ul>')
        listType = 'ul'
      }
      html.push(`<li>${applyInlineMarkdown(unorderedMatch[1])}</li>`)
      continue
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      flushParagraph()
      if (listType !== 'ol') {
        closeList()
        html.push('<ol>')
        listType = 'ol'
      }
      html.push(`<li>${applyInlineMarkdown(orderedMatch[1])}</li>`)
      continue
    }

    closeList()
    paragraph.push(trimmed)
  }

  flushParagraph()
  closeList()

  return html.join('')
}

export function markdownToPlainText(value) {
  const source = String(value || '')
  if (!source.trim()) return ''

  return source
    .replace(/\r\n/g, '\n')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[\s(>])\*([^*\n]+)\*(?=$|[\s)<.,!?:;])/g, '$1$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}
