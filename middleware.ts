const PUBLIC_PATHS = new Set([
  '/login',
  '/favicon.svg',
  '/icon-source.svg',
  '/manifest.webmanifest',
])

function shouldBypass(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  if (pathname.startsWith('/api/auth/')) return true
  if (pathname === '/api/config') return true
  if (pathname.startsWith('/assets/')) return true
  if (pathname.startsWith('/pwa-')) return true
  if (pathname.endsWith('.png') || pathname.endsWith('.ico') || pathname.endsWith('.svg')) return true
  return false
}

const encoder = new TextEncoder()
const AUTH_COOKIE_DEFAULT = 'ai_dashboard_auth'

function getAuthCookieName(): string {
  return process.env.SITE_AUTH_COOKIE_NAME?.trim() || AUTH_COOKIE_DEFAULT
}

function getSitePassword(): string {
  return process.env.SITE_PASSWORD?.trim() || process.env.APP_PASSWORD?.trim() || ''
}

function isAuthEnabled(): boolean {
  return Boolean(getSitePassword())
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

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=')
    if (rawKey === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

async function verifySessionToken(token: string | null | undefined): Promise<boolean> {
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

export default async function middleware(request: Request): Promise<Response | void> {
  if (!isAuthEnabled()) return

  const url = new URL(request.url)
  if (shouldBypass(url.pathname)) return

  const token = readCookie(request.headers.get('cookie'), getAuthCookieName())
  if (await verifySessionToken(token)) {
    if (url.pathname === '/login') {
      return Response.redirect(new URL('/', url), 302)
    }
    return
  }

  if (url.pathname.startsWith('/api/')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loginUrl = new URL('/login', url)
  loginUrl.searchParams.set('next', `${url.pathname}${url.search}`)
  return Response.redirect(loginUrl, 302)
}

export const config = {
  matcher: ['/((?!_next/|__next/).*)'],
}
