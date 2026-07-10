export const DRIVER_PORTAL_PATH = '/driver'

export function isDriverPortalPath(pathname?: string) {
  if (typeof window !== 'undefined') {
    if ((window as Window & { __ULTRAFREIGHT_PORTAL__?: string }).__ULTRAFREIGHT_PORTAL__ === 'driver') {
      return true
    }
  }
  const path = (pathname || (typeof window !== 'undefined' ? window.location.pathname : '')).replace(/\/$/, '')
  return path === DRIVER_PORTAL_PATH || path.endsWith('/driver')
}

export function getDriverPortalUrl(driver?: string, key?: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const params = new URLSearchParams()
  if (driver) params.set('driver', driver)
  if (key) params.set('key', key)
  const query = params.toString()
  return query ? `${origin}${DRIVER_PORTAL_PATH}?${query}` : `${origin}${DRIVER_PORTAL_PATH}`
}
