export const AUTH_COOKIE_DEFAULT = 'ai_dashboard_auth'

const encoder = new TextEncoder()

export function getAuthCookieName(): string {
  return process.env.SITE_AUTH_COOKIE_NAME?.trim() || AUTH_COOKIE_DEFAULT
}

export function getSitePassword(): string {
  return process.env.SITE_PASSWORD?.trim() || process.env.APP_PASSWORD?.trim() || ''
}

export function isAuthEnabled(): boolean {
  return Boolean(getSitePassword())
}

export function getAuthMaxAgeSeconds(): number {
  const raw = Number(process.env.SITE_AUTH_MAX_AGE_SECONDS)
  if (Number.isFinite(raw) && raw > 0) return Math.floor(raw)
  return 7 * 24 * 60 * 60
}

function getAuthSecret(): string {
  return process.env.SITE_AUTH_SECRET?.trim() || getSitePassword()
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(message))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function randomHex(bytes = 16): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return [...arr].map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPassword(input: string): Promise<boolean> {
  const password = getSitePassword()
  if (!password) return true
  const [a, b] = await Promise.all([sha256Hex(input), sha256Hex(password)])
  return constantTimeEqual(a, b)
}

export async function createSessionToken(): Promise<string> {
  const expiresAt = Date.now() + getAuthMaxAgeSeconds() * 1000
  const payload = `${expiresAt}.${randomHex()}`
  const signature = await hmacHex(getAuthSecret(), payload)
  return `${payload}.${signature}`
}

export async function verifySessionToken(token: string | null | undefined): Promise<boolean> {
  if (!isAuthEnabled()) return true
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [expiresRaw, nonce, signature] = parts
  const expiresAt = Number(expiresRaw)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false
  if (!nonce || nonce.length < 16) return false
  const expected = await hmacHex(getAuthSecret(), `${expiresRaw}.${nonce}`)
  return constantTimeEqual(signature, expected)
}

export function parseCookie(header: string | null | undefined): Record<string, string> {
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

export function getAuthTokenFromCookie(header: string | null | undefined): string | null {
  return parseCookie(header)[getAuthCookieName()] || null
}

export function buildSessionCookie(token: string, secure: boolean): string {
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

export function buildExpiredSessionCookie(secure: boolean): string {
  const parts = [
    `${getAuthCookieName()}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function isSecureRequest(headers: { [key: string]: string | string[] | undefined } | Headers): boolean {
  const getHeader = (name: string) => {
    if (headers instanceof Headers) return headers.get(name) || ''
    const value = headers[name] || headers[name.toLowerCase()]
    return Array.isArray(value) ? value[0] || '' : value || ''
  }
  const proto = getHeader('x-forwarded-proto')
  const host = getHeader('host')
  if (proto) return proto === 'https'
  return !/^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/.test(host)
}
