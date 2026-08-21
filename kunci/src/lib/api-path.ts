const FUNCTION_PREFIX = '/.netlify/functions/api'

export function normalizeApiPath(pathname: string): string {
  let path = pathname || '/'
  if (path === FUNCTION_PREFIX) path = '/api'
  else if (path.startsWith(`${FUNCTION_PREFIX}/`)) path = `/api/${path.slice(FUNCTION_PREFIX.length + 1)}`
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return path
}

export function isPingPath(path: string): boolean {
  return path === '/api/ping' || path === '/kunci-status'
}

export function isSessionPath(path: string): boolean {
  return path === '/api/session' || path === '/api/me'
}
