import {
  buildSessionCookie,
  createSessionToken,
  isAuthEnabled,
  isSecureRequest,
  verifyPassword,
} from '../../src/server/auth.ts'
import { checkLoginAttempt, clearLoginAttempts, getRequestIp } from '../../src/server/rateLimit.ts'

interface ApiRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

interface ApiResponse {
  setHeader(name: string, value: string | string[]): void
  status(code: number): { json(payload: unknown): void }
}

async function readPassword(body: unknown): Promise<string> {
  if (!body) return ''
  if (typeof body === 'string') {
    try {
      const json = JSON.parse(body) as { password?: string }
      return String(json.password || '')
    } catch {
      return ''
    }
  }
  if (typeof body === 'object' && 'password' in body) {
    return String((body as { password?: unknown }).password || '')
  }
  return ''
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!isAuthEnabled()) {
    res.status(200).json({ ok: true, disabled: true })
    return
  }

  const ip = getRequestIp(req.headers)
  const attempt = checkLoginAttempt(ip)
  if (!attempt.ok) {
    res.setHeader('Retry-After', String(attempt.retryAfter))
    res.status(429).json({ error: 'Too many attempts' })
    return
  }

  const password = await readPassword(req.body)
  if (!(await verifyPassword(password))) {
    await new Promise(resolve => setTimeout(resolve, 350))
    res.status(401).json({ error: 'Invalid password' })
    return
  }

  clearLoginAttempts(ip)
  const token = await createSessionToken()
  res.setHeader('Set-Cookie', buildSessionCookie(token, isSecureRequest(req.headers)))
  res.status(200).json({ ok: true })
}
