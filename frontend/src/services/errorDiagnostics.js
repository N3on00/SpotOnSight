function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value || '')
  }
}

function asText(value) {
  return String(value || '').trim()
}

function extractErrorData(error) {
  if (!error || typeof error !== 'object') return null
  return {
    name: asText(error.name),
    message: asText(error.message),
    status: Number(error.status) || 0,
    method: asText(error.method),
    path: asText(error.path),
    url: asText(error.url),
    requestBody: error.requestBody ?? null,
    responseData: error.data ?? null,
    stack: asText(error.stack),
  }
}

export function buildSupportDebugTicket({
  title = '',
  message = '',
  details = '',
  error = null,
  scope = 'action',
  screen = '',
  route = '',
} = {}) {
  const errorData = extractErrorData(error)
  const context = {
    scope: asText(scope),
    screen: asText(screen),
    route: asText(route || globalThis?.location?.pathname || ''),
    href: asText(globalThis?.location?.href),
    userAgent: asText(globalThis?.navigator?.userAgent),
    language: asText(globalThis?.navigator?.language),
    timestamp: new Date().toISOString(),
    error: errorData,
  }

  return {
    category: 'bug',
    subject: `Client error: ${asText(title) || 'Unknown failure'}`.slice(0, 140),
    message: [
      asText(message) || 'An operation failed in the client.',
      asText(details),
      errorData?.message ? `Error: ${errorData.message}` : '',
    ].filter(Boolean).join('\n\n').slice(0, 6000),
    technicalDetails: safeStringify(context),
    page: asText(globalThis?.location?.pathname),
    allowContact: false,
  }
}
