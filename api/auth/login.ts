import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

interface ApiRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  on?(event: 'data' | 'end' | 'error', callback: (...args: any[]) => void): void
}

interface ApiResponse {
  setHeader(name: string, value: string | string[]): void
  status(code: number): { json(payload: unknown): void }
}

interface AttemptState {
  count: number
  resetAt: number
}

const AUTH_COOKIE_DEFAULT = 'ai_dashboard_auth'
const attempts = new Map<string, AttemptState>()

function readEnv(name: string): string {
  return process.env[name]?.trim() || ''
}

function getAuthCookieName(): string {
  return readEnv('SITE_AUTH_COOKIE_NAME') || AUTH_COOKIE_DEFAULT
}

function getSitePassword(): string {
  return readEnv('SITE_PASSWORD') || readEnv('APP_PASSWORD')
}

function isAuthEnabled(): boolean {
  return Boolean(getSitePassword())
}

function getAuthMaxAgeSeconds(): number {
  const raw = Number(readEnv('SITE_AUTH_MAX_AGE_SECONDS'))
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw)
  return 7 * 24 * 60 * 60
}

function getAuthSecret(): string {
  return readEnv('SITE_AUTH_SECRET') || getSitePassword()
}

function sha256Hex(message: string): string {
  return createHash('sha256').update(message).digest('hex')
}

function hmacHex(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('hex')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function verifyPassword(input: string): boolean {
  const password = getSitePassword()
  if (!password) return true
  return constantTimeEqual(sha256Hex(input.trim()), sha256Hex(password))
}

function createSessionToken(): string {
  const expiresAt = Date.now() + getAuthMaxAgeSeconds() * 1000
  const payload = `${expiresAt}.${randomBytes(16).toString('hex')}`
  return `${payload}.${hmacHex(getAuthSecret(), payload)}`
}

function isSecureRequest(headers: { [key: string]: string | string[] | undefined }): boolean {
  const value = headers['x-forwarded-proto'] || headers['X-Forwarded-Proto']
  const proto = Array.isArray(value) ? value[0] : value
  if (proto) return proto === 'https'

  const hostValue = headers.host || headers.Host
  const host = Array.isArray(hostValue) ? hostValue[0] : hostValue || ''
  return !/^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/.test(host)
}

function buildSessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${getAuthCookieName()}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${getAuthMaxAgeSeconds()}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

function getRequestIp(headers: { [key: string]: string | string[] | undefined }): string {
  const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For']
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return value?.split(',')[0]?.trim() || 'local'
}

function checkLoginAttempt(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const windowMs = 5 * 60 * 1000
  const maxAttempts = Number(readEnv('SITE_AUTH_MAX_ATTEMPTS') || 10)
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

async function readRawBody(req: ApiRequest): Promise<string> {
  if (typeof req.body === 'string') return req.body
  if (req.body && Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  if (!req.on) return ''

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on?.('data', chunk => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on?.('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on?.('error', reject)
  })
}

async function readPassword(req: ApiRequest): Promise<string> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return 'password' in req.body ? String((req.body as { password?: unknown }).password || '') : ''
  }

  const raw = await readRawBody(req)
  if (!raw) return ''
  try {
    const json = JSON.parse(raw) as { password?: string }
    return String(json.password || '')
  } catch {
    return ''
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
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

    if (!verifyPassword(await readPassword(req))) {
      await new Promise(resolve => setTimeout(resolve, 350))
      res.status(401).json({ error: 'Invalid password' })
      return
    }

    attempts.delete(ip)
    const token = createSessionToken()
    res.setHeader('Set-Cookie', buildSessionCookie(token, isSecureRequest(req.headers)))
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({
      error: 'Auth service error',
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
