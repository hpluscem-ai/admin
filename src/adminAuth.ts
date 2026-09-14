import type { AdminLoginCredentials } from './pages/LoginPage'

export type AdminUser = { id: string; email: string; name: string }

export class AdminApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string) {
    super('Administrator request failed')
    this.status = status
    this.code = code
  }
}

export async function requestAdmin(path: string, credentials?: AdminLoginCredentials): Promise<unknown> {
  const response = await fetch(`/api/v1/admin/${path}`, {
    method: credentials ? 'POST' : 'GET',
    credentials: 'include',
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
    ...(credentials ? {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: credentials.email.trim(), password: credentials.password }),
    } : {}),
  })
  const data: unknown = await response.json()
  if (response.status !== 200) {
    throw new AdminApiError(response.status,
      typeof data === 'object' && data !== null && 'code' in data && typeof data.code === 'string'
        ? data.code : '')
  }
  return data
}

export async function getCurrentAdmin(): Promise<AdminUser> {
  const data = await requestAdmin('auth/me')
  if (typeof data !== 'object' || data === null) throw new Error('Invalid administrator response')
  const { id, email, name } = data as Record<string, unknown>
  if (typeof id !== 'string' || !id.trim() || typeof email !== 'string' || !email.trim() ||
    typeof name !== 'string' || !name.trim()) throw new Error('Invalid administrator response')
  return { id, email, name }
}

export async function loginAdmin(credentials: AdminLoginCredentials): Promise<AdminUser> {
  const data = await requestAdmin('auth/web/login', credentials)
  if (typeof data !== 'object' || data === null || !('expiresAt' in data) ||
    typeof data.expiresAt !== 'string' || !Number.isFinite(Date.parse(data.expiresAt))) {
    throw new Error('Invalid administrator login response')
  }
  return getCurrentAdmin()
}

export function isInvalidAdminSession(error: unknown): boolean {
  return error instanceof AdminApiError && error.status === 401 && error.code === 'INVALID_ADMIN_SESSION'
}
