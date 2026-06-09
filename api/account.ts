import { isSecureRequest } from '../src/server/auth'
import { checkLoginAttempt, clearLoginAttempts, getRequestIp } from '../src/server/rateLimit'
import {
  buildExpiredUserSessionCookie,
  buildUserSessionCookie,
  createUserSessionToken,
  getUserConfig,
  getUserFromCookie,
  isUserAuthEnabled,
  loginOrRegisterUser,
  saveUserConfig,
} from '../src/server/userAuth'

interface ApiRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | string[] | undefined>
  body?: unknown
  url?: string
  on?(event: 'data' | 'end' | 'error', callback: (...args: any[]) => void): void
}

interface ApiResponse {
  setHeader(name: string, value: string | string[]): void
  status(code: number): { json(payload: unknown): void }
}

function readHeader(req: ApiRequest, name: string): string {
  const value = req.headers[name] || req.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] || '' : value || ''
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

async function readJsonBody<T extends object>(req: ApiRequest): Promise<Partial<T>> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body as Partial<T>
  const raw = await readRawBody(req)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Partial<T>
  } catch {
    return {}
  }
}

function sendJson(res: ApiResponse, status: number, payload: unknown): void {
  res.status(status).json(payload)
}

function methodAllowed(req: ApiRequest, res: ApiResponse, method: string): boolean {
  if (!req.method || req.method === method) return true
  sendJson(res, 405, { error: 'Method not allowed' })
  return false
}

function statusFromError(e: unknown, fallback = 500): number {
  const status = (e as Error & { statusCode?: number }).statusCode
  return status || fallback
}

function messageFromError(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function pathFromRequest(req: ApiRequest): string {
  const raw = req.query?.path
  const value = Array.isArray(raw) ? raw.join('/') : raw || ''
  if (value) return value.replace(/^\/+/, '')

  const url = new URL(req.url || '/api/account', 'http://localhost')
  return url.pathname.replace(/^\/api\/account\/?/, '').replace(/^\/+/, '')
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const path = pathFromRequest(req)

    if (!path || path === 'status') {
      const enabled = isUserAuthEnabled()
      const user = enabled ? await getUserFromCookie(readHeader(req, 'cookie')) : null
      sendJson(res, 200, { enabled, authenticated: Boolean(user), user })
      return
    }

    if (path === 'logout') {
      res.setHeader('Set-Cookie', buildExpiredUserSessionCookie(isSecureRequest(req.headers)))
      sendJson(res, 200, { ok: true })
      return
    }

    if (path === 'login' || path === 'register') {
      if (!methodAllowed(req, res, 'POST')) return
      if (!isUserAuthEnabled()) {
        sendJson(res, 503, { error: 'MongoDB account storage is not configured.' })
        return
      }

      const key = path === 'register' ? 'account-register' : 'account'
      const ip = getRequestIp(req.headers)
      const attempt = checkLoginAttempt(`${key}:${ip}`)
      if (!attempt.ok) {
        res.setHeader('Retry-After', String(attempt.retryAfter))
        sendJson(res, 429, { error: 'Too many attempts' })
        return
      }

      const body = await readJsonBody<{ user: string; sign?: string; seckey?: string }>(req)
      const result = await loginOrRegisterUser(String(body.user || ''), String(body.sign || body.seckey || ''))
      if (!result) {
        await new Promise(resolve => setTimeout(resolve, 350))
        sendJson(res, 401, { error: 'Invalid user or sign' })
        return
      }

      clearLoginAttempts(`${key}:${ip}`)
      const token = await createUserSessionToken(result.doc.user)
      res.setHeader('Set-Cookie', buildUserSessionCookie(token, isSecureRequest(req.headers)))
      sendJson(res, 200, { ok: true, user: result.doc.user, created: result.created })
      return
    }

    if (path === 'config') {
      if (!isUserAuthEnabled()) {
        sendJson(res, 503, { error: 'MongoDB account storage is not configured.' })
        return
      }
      const user = await getUserFromCookie(readHeader(req, 'cookie'))
      if (!user) {
        sendJson(res, 401, { error: 'Unauthorized' })
        return
      }

      if (!req.method || req.method === 'GET') {
        const { config, updatedAt } = await getUserConfig(user)
        sendJson(res, 200, { ok: true, user, config, updatedAt: updatedAt?.toISOString() || null })
        return
      }

      if (req.method === 'PUT' || req.method === 'POST') {
        const body = await readJsonBody<{ config: Record<string, unknown> }>(req)
        if (!body.config || typeof body.config !== 'object' || Array.isArray(body.config)) {
          sendJson(res, 400, { error: 'Missing config' })
          return
        }
        const updatedAt = await saveUserConfig(user, body.config)
        sendJson(res, 200, { ok: true, user, updatedAt: updatedAt.toISOString() })
        return
      }

      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }

    sendJson(res, 404, { error: 'Not found' })
  } catch (e) {
    sendJson(res, statusFromError(e), { error: 'Account service error', message: messageFromError(e) })
  }
}
