import { apiRequest, ensureCSRF, clearCSRF } from './apiClient'

const BASE_URL = process.env.NEXT_PUBLIC_FRAPPE_URL || ''

export interface FrappeUser {
  name: string
  full_name: string
  email: string
  user_image?: string
  roles: string[]
}

export async function login(username: string, password: string): Promise<FrappeUser> {
  clearCSRF()
  const response = await fetch(`${BASE_URL}/api/method/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ usr: username, pwd: password }),
    credentials: 'include',
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Invalid credentials')
  }
  clearCSRF()
  await ensureCSRF(true)
  return getCurrentUserProfile()
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/api/method/logout', { method: 'POST' })
  } catch {
    /* ignore */
  }
  clearCSRF()
}

export async function getLoggedUser(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/method/frappe.auth.get_logged_user`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    const user = data?.message
    if (!user || user === 'Guest') return null
    return user
  } catch {
    return null
  }
}

export async function getCurrentUserProfile(): Promise<FrappeUser> {
  const username = await getLoggedUser()
  if (!username) throw new Error('Not logged in')

  const res = await fetch(
    `${BASE_URL}/api/resource/User/${encodeURIComponent(username)}?fields=["name","full_name","email","user_image"]`,
    { credentials: 'include', headers: { Accept: 'application/json' } }
  )
  if (!res.ok) throw new Error('Failed to fetch user profile')
  const userData = await res.json()
  const user = userData.data

  let roles: string[] = []
  try {
    const rolesRes = await fetch(
      `${BASE_URL}/api/resource/Has Role?filters=[["parent","=","${username}"]]&fields=["role"]&limit_page_length=0`,
      { credentials: 'include', headers: { Accept: 'application/json' } }
    )
    if (rolesRes.ok) {
      const rolesData = await rolesRes.json()
      roles = (rolesData.data || []).map((r: { role: string }) => r.role)
    }
  } catch {
    /* ignore */
  }

  return {
    name: user.name,
    full_name: user.full_name || username,
    email: user.email || username,
    user_image: user.user_image || undefined,
    roles,
  }
}
