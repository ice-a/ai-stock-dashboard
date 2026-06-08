import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { readAuthCookieName, readAuthSecret, readPositiveIntegerEnv, readSitePassword } from './env'

export const AUTH_COOKIE_DEFAULT = 'ai_dashboard_auth'

export function getAuthCookieName(): string {
  return readAuthCookieName()
}

export function getSitePassword(): string {
  return readSitePassword()
}

export function isAuthEnabled(): boolean {
  return Boolean(getSitePassword())
}

export function getAuthMaxAgeSeconds(): number {
  return readPositiveIntegerEnv('SITE_AUTH_MAX_AGE_SECONDS', 7 * 24 * 60 * 60)
}

function getAuthSecret(): string {
  return readAuthSecret()
}

function hmacHex(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('hex')
}

function sha256Hex(message: string): string {
  return createHash('sha256').update(message).digest('hex')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function randomHex(bytes = 16): string {
  return randomBytes(bytes).toString('hex')
}

export async function verifyPassword(input: string): Promise<boolean> {
  const password = getSitePassword()
  if (!password) return true
  return constantTimeEqual(sha256Hex(input.trim()), sha256Hex(password))
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
