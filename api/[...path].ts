import { getRuntimeConfig } from '../src/server/runtimeConfig'
import type { ChatMessage } from '../src/api/ai'

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
  writeHead(statusCode: number, headers?: Record<string, string>): void
  write(chunk: unknown): void
  end(chunk?: unknown): void
}

interface ChatBody {
  messages?: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
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

function writeJson(res: ApiResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
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

  const url = new URL(req.url || '/api', 'http://localhost')
  return url.pathname.replace(/^\/api\/?/, '').replace(/^\/+/, '')
}

async function handleAuth(path: string, req: ApiRequest, res: ApiResponse): Promise<boolean> {
  if (path === 'auth/status') {
    const auth = await import('../src/server/auth')
    const enabled = auth.isAuthEnabled()
    const authenticated = await auth.verifySessionToken(auth.getAuthTokenFromCookie(readHeader(req, 'cookie')))
    sendJson(res, 200, { enabled, authenticated })
    return true
  }

  if (path === 'auth/logout') {
    const auth = await import('../src/server/auth')
    res.setHeader('Set-Cookie', auth.buildExpiredSessionCookie(auth.isSecureRequest(req.headers)))
    sendJson(res, 200, { ok: true })
    return true
  }

  if (path === 'auth/login') {
    if (!methodAllowed(req, res, 'POST')) return true
    try {
      const auth = await import('../src/server/auth')
      const rateLimit = await import('../src/server/rateLimit')
      if (!auth.isAuthEnabled()) {
        sendJson(res, 200, { ok: true, disabled: true })
        return true
      }

      const ip = rateLimit.getRequestIp(req.headers)
      const attempt = rateLimit.checkLoginAttempt(ip)
      if (!attempt.ok) {
        res.setHeader('Retry-After', String(attempt.retryAfter))
        sendJson(res, 429, { error: 'Too many attempts' })
        return true
      }

      const body = await readJsonBody<{ password: string }>(req)
      if (!(await auth.verifyPassword(String(body.password || '')))) {
        await new Promise(resolve => setTimeout(resolve, 350))
        sendJson(res, 401, { error: 'Invalid password' })
        return true
      }

      rateLimit.clearLoginAttempts(ip)
      const token = await auth.createSessionToken()
      res.setHeader('Set-Cookie', auth.buildSessionCookie(token, auth.isSecureRequest(req.headers)))
      sendJson(res, 200, { ok: true })
    } catch (e) {
      sendJson(res, 500, { error: 'Auth service error', message: messageFromError(e) })
    }
    return true
  }

  return false
}

async function handleAccount(path: string, req: ApiRequest, res: ApiResponse): Promise<boolean> {
  if (!path.startsWith('account/')) return false

  try {
    const account = await import('../src/server/userAuth')
    const auth = await import('../src/server/auth')
    const rateLimit = await import('../src/server/rateLimit')

    if (path === 'account/status') {
      const enabled = account.isUserAuthEnabled()
      const user = enabled ? await account.getUserFromCookie(readHeader(req, 'cookie')) : null
      sendJson(res, 200, { enabled, authenticated: Boolean(user), user })
      return true
    }

    if (path === 'account/logout') {
      res.setHeader('Set-Cookie', account.buildExpiredUserSessionCookie(auth.isSecureRequest(req.headers)))
      sendJson(res, 200, { ok: true })
      return true
    }

    if (path === 'account/login' || path === 'account/register') {
      if (!methodAllowed(req, res, 'POST')) return true
      if (!account.isUserAuthEnabled()) {
        sendJson(res, 503, { error: 'MongoDB account storage is not configured.' })
        return true
      }
      const key = path === 'account/register' ? 'account-register' : 'account'
      const ip = rateLimit.getRequestIp(req.headers)
      const attempt = rateLimit.checkLoginAttempt(`${key}:${ip}`)
      if (!attempt.ok) {
        res.setHeader('Retry-After', String(attempt.retryAfter))
        sendJson(res, 429, { error: 'Too many attempts' })
        return true
      }

      const body = await readJsonBody<{ user: string; sign?: string; seckey?: string }>(req)
      const result = await account.loginOrRegisterUser(String(body.user || ''), String(body.sign || body.seckey || ''))
      if (!result) {
        await new Promise(resolve => setTimeout(resolve, 350))
        sendJson(res, 401, { error: 'Invalid user or sign' })
        return true
      }
      rateLimit.clearLoginAttempts(`${key}:${ip}`)
      const token = await account.createUserSessionToken(result.doc.user)
      res.setHeader('Set-Cookie', account.buildUserSessionCookie(token, auth.isSecureRequest(req.headers)))
      sendJson(res, 200, { ok: true, user: result.doc.user, created: result.created })
      return true
    }

    if (path === 'account/config') {
      if (!account.isUserAuthEnabled()) {
        sendJson(res, 503, { error: 'MongoDB account storage is not configured.' })
        return true
      }
      const user = await account.getUserFromCookie(readHeader(req, 'cookie'))
      if (!user) {
        sendJson(res, 401, { error: 'Unauthorized' })
        return true
      }
      if (!req.method || req.method === 'GET') {
        const { config, updatedAt } = await account.getUserConfig(user)
        sendJson(res, 200, { ok: true, user, config, updatedAt: updatedAt?.toISOString() || null })
        return true
      }
      if (req.method === 'PUT' || req.method === 'POST') {
        const body = await readJsonBody<{ config: Record<string, unknown> }>(req)
        if (!body.config || typeof body.config !== 'object' || Array.isArray(body.config)) {
          sendJson(res, 400, { error: 'Missing config' })
          return true
        }
        const updatedAt = await account.saveUserConfig(user, body.config)
        sendJson(res, 200, { ok: true, user, updatedAt: updatedAt.toISOString() })
        return true
      }
      sendJson(res, 405, { error: 'Method not allowed' })
      return true
    }
  } catch (e) {
    sendJson(res, statusFromError(e), { error: 'Account service error', message: messageFromError(e) })
    return true
  }

  return false
}

async function handleAi(path: string, req: ApiRequest, res: ApiResponse): Promise<boolean> {
  if (path === 'ai/models') {
    try {
      const { listServerModels } = await import('../src/server/aiService')
      sendJson(res, 200, { data: await listServerModels() })
    } catch (e) {
      sendJson(res, statusFromError(e, 502), { error: messageFromError(e) })
    }
    return true
  }

  if (path === 'ai/chat') {
    if (!methodAllowed(req, res, 'POST')) return true
    const body = await readJsonBody<ChatBody>(req)
    if (!Array.isArray(body.messages)) {
      sendJson(res, 400, { error: 'Missing messages' })
      return true
    }
    try {
      const { chatServer } = await import('../src/server/aiService')
      sendJson(res, 200, await chatServer(body.messages, body))
    } catch (e) {
      sendJson(res, statusFromError(e, 502), { error: messageFromError(e) })
    }
    return true
  }

  if (path === 'ai/chat-stream') {
    if (req.method && req.method !== 'POST') {
      writeJson(res, 405, { error: 'Method not allowed' })
      return true
    }
    const body = await readJsonBody<ChatBody>(req)
    if (!Array.isArray(body.messages)) {
      writeJson(res, 400, { error: 'Missing messages' })
      return true
    }
    try {
      const { streamServerChat } = await import('../src/server/aiService')
      const upstream = await streamServerChat(body.messages, body)
      res.writeHead(200, {
        'Content-Type': upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      })
      if (!upstream.body) {
        res.end()
        return true
      }
      const reader = upstream.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(decoder.decode(value, { stream: true }))
      }
      res.end()
    } catch (e) {
      writeJson(res, statusFromError(e, 502), { error: messageFromError(e) })
    }
    return true
  }

  return false
}

async function handleLongbridge(path: string, req: ApiRequest, res: ApiResponse): Promise<boolean> {
  if (!path.startsWith('longbridge/')) return false
  try {
    const service = await import('../src/server/longbridgeService')
    if (path === 'longbridge/status') {
      sendJson(res, 200, await service.getLongbridgeStatusChecked())
      return true
    }
    if (path === 'longbridge/quotes') {
      if (!methodAllowed(req, res, 'GET')) return true
      const rawSymbols = req.query?.symbols || req.query?.symbol || ''
      const symbols = (Array.isArray(rawSymbols) ? rawSymbols[0] || '' : rawSymbols).split(',').map(s => s.trim()).filter(Boolean)
      if (!symbols.length) {
        sendJson(res, 400, { error: 'Missing symbols' })
        return true
      }
      sendJson(res, 200, { data: await service.getLongbridgeQuotes(symbols) })
      return true
    }
    if (path === 'longbridge/candlesticks') {
      if (!methodAllowed(req, res, 'GET')) return true
      const symbol = String(req.query?.symbol || '').trim()
      if (!symbol) {
        sendJson(res, 400, { error: 'Missing symbol' })
        return true
      }
      sendJson(res, 200, {
        data: await service.getLongbridgeCandlesticks(
          symbol,
          String(req.query?.period || 'day'),
          Number(req.query?.count) || 200,
        ),
      })
      return true
    }
  } catch (e) {
    sendJson(res, statusFromError(e, 502), { error: messageFromError(e) })
    return true
  }
  return false
}

function normalizeBarkServerUrl(value: unknown): string {
  const raw = String(value || '').trim().replace(/\/+$/, '')
  if (!raw) return 'https://api.day.app'
  const url = new URL(raw)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw Object.assign(new Error('Bark server must be http(s).'), { statusCode: 400 })
  return url.toString().replace(/\/+$/, '')
}

async function handleNotifications(path: string, req: ApiRequest, res: ApiResponse): Promise<boolean> {
  if (path !== 'notifications/send') return false
  if (!methodAllowed(req, res, 'POST')) return true

  try {
    const body = await readJsonBody<{
      provider: string
      title: string
      body: string
      url?: string
      bark?: {
        serverUrl?: string
        deviceKey?: string
        group?: string
        level?: string
        sound?: string
      }
    }>(req)

    if (body.provider !== 'bark') {
      sendJson(res, 400, { error: 'Unsupported notification provider' })
      return true
    }
    const deviceKey = String(body.bark?.deviceKey || '').trim()
    if (!deviceKey) {
      sendJson(res, 400, { error: 'Missing Bark device key' })
      return true
    }

    const target = `${normalizeBarkServerUrl(body.bark?.serverUrl)}/push`
    const payload: Record<string, unknown> = {
      device_key: deviceKey,
      title: String(body.title || 'AI Stock Dashboard').slice(0, 120),
      body: String(body.body || '').slice(0, 4000),
      group: String(body.bark?.group || 'AI Stock Dashboard').slice(0, 80),
      level: body.bark?.level || 'active',
    }
    if (body.bark?.sound) payload.sound = body.bark.sound
    if (body.url) payload.url = body.url

    const upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })
    const text = await upstream.text()
    if (!upstream.ok) {
      sendJson(res, upstream.status, { error: 'Bark request failed', message: text.slice(0, 300) })
      return true
    }
    sendJson(res, 200, { ok: true })
  } catch (e) {
    sendJson(res, statusFromError(e), { error: 'Notification service error', message: messageFromError(e) })
  }
  return true
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const path = pathFromRequest(req)

  if (!path || path === 'config') {
    sendJson(res, 200, getRuntimeConfig())
    return
  }

  if (path === 'market') {
    const market = await import('../src/server/marketApi')
    await market.default(req, res)
    return
  }

  if (await handleAuth(path, req, res)) return
  if (await handleAccount(path, req, res)) return
  if (await handleAi(path, req, res)) return
  if (await handleLongbridge(path, req, res)) return
  if (await handleNotifications(path, req, res)) return

  sendJson(res, 404, { error: 'Not found' })
}
