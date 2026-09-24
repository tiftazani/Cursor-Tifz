/**
 * Normalize the API path the server sees. Cloudflare Workers route /api/* straight
 * to the worker, so the Netlify function prefix is only here for old bookmarks.
 */
const FUNCTION_PREFIXES = ['/.netlify/functions/api', '/api'] as const

/**
 * Normalize the API path the server sees. Cloudflare Workers route /api/* straight
 * to the worker, so the Netlify function prefix is only here for old bookmarks.
 */
export function normalizeApiPath(pathname: string): string {
  let path = pathname || '/'
  for (const prefix of FUNCTION_PREFIXES) {
    if (path === prefix) {
      path = '/api'
      break
    }
    if (path.startsWith(`${prefix}/`)) {
      path = `/api/${path.slice(prefix.length + 1)}`
      break
    }
  }
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return path
}

export function isPingPath(path: string): boolean {
  return path === '/api/ping' || path === '/kunci-status'
}

export function isSessionPath(path: string): boolean {
  return path === '/api/session' || path === '/api/me'
}
