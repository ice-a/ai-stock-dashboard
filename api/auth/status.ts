import { createHmac, timingSafeEqual } from 'node:crypto'

interface ApiRequest {
  headers: Record<string, string | string[] | undefined>
}

interface ApiResponse {
  status(code: number): { json(payload: unknown): void }
}

const AUTH_COOKIE_DEFAULT = 'ai_dashboard_auth'

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

function getAuthSecret(): string {
  return readEnv('SITE_AUTH_SECRET') || getSitePassword()
}

function hmacHex(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('hex')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function readHeader(req: ApiRequest, name: string): string {
  const value = req.headers[name] || req.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] || '' : value || ''
}

function parseCookie(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (key) out[key] = decodeURIComponent(value)
  }
  return out
}

function verifySessionToken(token: string | null | undefined): boolean {
  if (!isAuthEnabled()) return true
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [expiresRaw, nonce, signature] = parts
  const expiresAt = Number(expiresRaw)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false
  if (!nonce || nonce.length < 16) return false
  const expected = hmacHex(getAuthSecret(), `${expiresRaw}.${nonce}`)
  return constantTimeEqual(signature, expected)
}

export default function handler(req: ApiRequest, res: ApiResponse) {
  const enabled = isAuthEnabled()
  const cookies = parseCookie(readHeader(req, 'cookie'))
  const authenticated = verifySessionToken(cookies[getAuthCookieName()] || null)
  res.status(200).json({ enabled, authenticated })
}
