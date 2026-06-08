import { readPositiveIntegerEnv } from './env'

interface AttemptState {
  count: number
  resetAt: number
}

const attempts = new Map<string, AttemptState>()

export function checkLoginAttempt(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const windowMs = 5 * 60 * 1000
  const maxAttempts = readPositiveIntegerEnv('SITE_AUTH_MAX_ATTEMPTS', 10)
  const current = attempts.get(key)

  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  current.count += 1
  if (current.count > maxAttempts) {
    return { ok: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfter: 0 }
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key)
}

export function getRequestIp(headers: { [key: string]: string | string[] | undefined }): string {
  const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For']
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return value?.split(',')[0]?.trim() || 'local'
}
