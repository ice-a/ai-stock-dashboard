import { getAuthCookieName, isAuthEnabled, verifySessionToken } from './src/server/auth.ts'

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

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=')
    if (rawKey === name) return decodeURIComponent(rest.join('='))
  }
  return null
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
