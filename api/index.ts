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

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatBody {
  messages?: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
}

interface AttemptState {
  count: number
  resetAt: number
}

const AUTH_COOKIE_DEFAULT = 'ai_dashboard_auth'
const OPENAI_DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const loginAttempts = new Map<string, AttemptState>()
let cryptoModulePromise: Promise<typeof import('node:crypto')> | null = null

function loadNodeCrypto(): Promise<typeof import('node:crypto')> {
  cryptoModulePromise ||= import('node:crypto')
  return cryptoModulePromise
}

function readEnv(name: string): string {
  return process.env[name]?.trim() || ''
}

function readNumberEnv(name: string, fallback: number): number {
  const raw = readEnv(name)
  if (!raw) return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

function readOptionalNumberEnv(name: string): number | null {
  const raw = readEnv(name)
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const value = Math.floor(readNumberEnv(name, fallback))
  return value > 0 ? value : fallback
}

function readSitePassword(): string {
  return readEnv('SITE_PASSWORD') || readEnv('APP_PASSWORD')
}

function readAuthCookieName(): string {
  return readEnv('SITE_AUTH_COOKIE_NAME') || AUTH_COOKIE_DEFAULT
}

function readAuthSecret(): string {
  return readEnv('SITE_AUTH_SECRET') || readSitePassword()
}

function readAiConfig() {
  return {
    apiKey: readEnv('AI_API_KEY') || readEnv('OPENAI_API_KEY'),
    baseUrl: readEnv('AI_BASE_URL') || readEnv('OPENAI_BASE_URL') || OPENAI_DEFAULT_BASE_URL,
    model: readEnv('AI_MODEL') || readEnv('OPENAI_MODEL'),
    temperature: readNumberEnv('AI_TEMPERATURE', 0.7),
    maxTokens: readNumberEnv('AI_MAX_TOKENS', 2000),
  }
}

function getRuntimeConfig() {
  const ai = readAiConfig()
  return {
    auth: {
      enabled: Boolean(readSitePassword()),
    },
    ai: {
      serverManaged: Boolean(ai.apiKey),
      baseUrl: ai.baseUrl || OPENAI_DEFAULT_BASE_URL,
      model: ai.model,
      temperature: ai.temperature,
      maxTokens: ai.maxTokens,
    },
    refresh: {
      listInterval: readOptionalNumberEnv('APP_LIST_REFRESH_SECONDS'),
      detailInterval: readOptionalNumberEnv('APP_DETAIL_REFRESH_SECONDS'),
    },
  }
}

function isAuthEnabled(): boolean {
  return Boolean(readSitePassword())
}

function getAuthMaxAgeSeconds(): number {
  return readPositiveIntegerEnv('SITE_AUTH_MAX_AGE_SECONDS', 7 * 24 * 60 * 60)
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const { createHmac } = await loadNodeCrypto()
  return createHmac('sha256', secret).update(message).digest('hex')
}

async function sha256Hex(message: string): Promise<string> {
  const { createHash } = await loadNodeCrypto()
  return createHash('sha256').update(message).digest('hex')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function randomHex(bytes = 16): Promise<string> {
  const { randomBytes } = await loadNodeCrypto()
  return randomBytes(bytes).toString('hex')
}

async function verifyPassword(input: string): Promise<boolean> {
  const password = readSitePassword()
  if (!password) return true
  return constantTimeEqual(await sha256Hex(input.trim()), await sha256Hex(password))
}

async function createSessionToken(): Promise<string> {
  const expiresAt = Date.now() + getAuthMaxAgeSeconds() * 1000
  const payload = `${expiresAt}.${await randomHex()}`
  const signature = await hmacHex(readAuthSecret(), payload)
  return `${payload}.${signature}`
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

function getAuthTokenFromCookie(header: string | null | undefined): string | null {
  return parseCookie(header)[readAuthCookieName()] || null
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
  const expected = await hmacHex(readAuthSecret(), `${expiresRaw}.${nonce}`)
  return constantTimeEqual(signature, expected)
}

function buildSessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${readAuthCookieName()}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${getAuthMaxAgeSeconds()}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

function buildExpiredSessionCookie(secure: boolean): string {
  const parts = [
    `${readAuthCookieName()}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

function isSecureRequest(headers: { [key: string]: string | string[] | undefined }): boolean {
  const proto = readHeader({ headers }, 'x-forwarded-proto')
  const host = readHeader({ headers }, 'host')
  if (proto) return proto === 'https'
  return !/^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/.test(host)
}

function getRequestIp(headers: { [key: string]: string | string[] | undefined }): string {
  const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For']
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return value?.split(',')[0]?.trim() || 'local'
}

function checkLoginAttempt(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const windowMs = 5 * 60 * 1000
  const maxAttempts = readPositiveIntegerEnv('SITE_AUTH_MAX_ATTEMPTS', 10)
  const current = loginAttempts.get(key)

  if (!current || current.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfter: 0 }
  }

  current.count += 1
  if (current.count > maxAttempts) {
    return { ok: false, retryAfter: Math.ceil((current.resetAt - now) / 1000) }
  }
  return { ok: true, retryAfter: 0 }
}

function clearLoginAttempts(key: string): void {
  loginAttempts.delete(key)
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
    const enabled = isAuthEnabled()
    const authenticated = await verifySessionToken(getAuthTokenFromCookie(readHeader(req, 'cookie')))
    sendJson(res, 200, { enabled, authenticated })
    return true
  }

  if (path === 'auth/logout') {
    res.setHeader('Set-Cookie', buildExpiredSessionCookie(isSecureRequest(req.headers)))
    sendJson(res, 200, { ok: true })
    return true
  }

  if (path === 'auth/login') {
    if (!methodAllowed(req, res, 'POST')) return true
    try {
      if (!isAuthEnabled()) {
        sendJson(res, 200, { ok: true, disabled: true })
        return true
      }

      const ip = getRequestIp(req.headers)
      const attempt = checkLoginAttempt(ip)
      if (!attempt.ok) {
        res.setHeader('Retry-After', String(attempt.retryAfter))
        sendJson(res, 429, { error: 'Too many attempts' })
        return true
      }

      const body = await readJsonBody<{ password: string }>(req)
      if (!(await verifyPassword(String(body.password || '')))) {
        await new Promise(resolve => setTimeout(resolve, 350))
        sendJson(res, 401, { error: 'Invalid password' })
        return true
      }

      clearLoginAttempts(ip)
      const token = await createSessionToken()
      res.setHeader('Set-Cookie', buildSessionCookie(token, isSecureRequest(req.headers)))
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
  try {
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
  } catch (e) {
    sendJson(res, statusFromError(e), { error: 'API service error', message: messageFromError(e) })
  }
}
