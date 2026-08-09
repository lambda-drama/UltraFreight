/**
 * Core API client for Frappe session auth + CSRF.
 */
let csrfFetchInFlight: Promise<string | null> | null = null

function readCsrfFromMeta(): string | null {
  if (typeof document === 'undefined') return null
  const el = document.querySelector('meta[name="csrf-token"]')
  const c = el?.getAttribute('content')
  return c && c.trim() ? c.trim() : null
}

export async function ensureCSRF(forceRefresh = false): Promise<string | null> {
  const win = typeof window !== 'undefined' ? (window as Record<string, unknown>) : null

  if (!forceRefresh) {
    if (win?.csrf_token && typeof win.csrf_token === 'string') return win.csrf_token as string
    const meta = readCsrfFromMeta()
    if (meta && win) {
      win.csrf_token = meta
      return meta
    }
  }

  if (csrfFetchInFlight) return csrfFetchInFlight

  csrfFetchInFlight = (async () => {
    try {
      const res = await fetch('/api/method/frappe.sessions.get_csrf_token', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      const token = data?.message || null
      if (token && win) win.csrf_token = token
      return token
    } catch {
      return null
    } finally {
      csrfFetchInFlight = null
    }
  })()

  return csrfFetchInFlight
}

export function clearCSRF() {
  const win = typeof window !== 'undefined' ? (window as Record<string, unknown>) : null
  if (win) delete win.csrf_token
}

function getCSRF(): string | null {
  const win = typeof window !== 'undefined' ? (window as Record<string, unknown>) : null
  return (win?.csrf_token as string) || null
}

function injectCsrfIntoJsonBody(body: BodyInit | null | undefined, csrf: string | null) {
  if (!csrf || body === undefined || body === null || typeof body !== 'string') return body
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return JSON.stringify({ ...parsed, csrf_token: csrf })
    }
  } catch {
    /* ignore */
  }
  return body
}

function parseError(resData: Record<string, unknown>): string {
  if (resData._server_messages) {
    try {
      const msgs = JSON.parse(resData._server_messages as string)
      if (Array.isArray(msgs) && msgs.length > 0) {
        const first = JSON.parse(msgs[0])
        return first.message || msgs[0]
      }
    } catch {
      return String(resData._server_messages)
    }
  }
  return String(resData.message || resData.exc_type || 'Request failed')
}

export async function apiRequest<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method?.toUpperCase() || 'GET') as string

  const run = async (isCsrfRetry: boolean) => {
    if (method !== 'GET') await ensureCSRF(isCsrfRetry)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    }
    const csrf = method !== 'GET' ? getCSRF() : null
    if (csrf) headers['X-Frappe-CSRF-Token'] = csrf
    const body = method !== 'GET' ? injectCsrfIntoJsonBody(options.body ?? null, csrf) : options.body
    const response = await fetch(path, { ...options, headers, body: body ?? options.body, credentials: 'include' })
    const resData = (await response.json().catch(() => ({}))) as Record<string, unknown>
    return { response, resData }
  }

  let { response, resData } = await run(false)
  if (!response.ok && method !== 'GET' && (response.status === 403 || response.status === 400)) {
    clearCSRF()
    ;({ response, resData } = await run(true))
  }
  if (!response.ok) throw new Error(parseError(resData))
  if (resData.data !== undefined) return resData.data as T
  if (resData.message !== undefined) return resData.message as T
  return resData as T
}
