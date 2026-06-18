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
const EASTMONEY_QUOTE_BASES = [
  'https://push2delay.eastmoney.com/api/qt/stock/get',
  'https://push2.eastmoney.com/api/qt/stock/get',
]
const EASTMONEY_KLINE_BASES = ['https://push2his.eastmoney.com/api/qt/stock/kline/get']
const EASTMONEY_SEARCH_URL = 'https://searchapi.eastmoney.com/api/suggest/get'
const EASTMONEY_NOTICE_URL = 'https://np-anotice-stock.eastmoney.com/api/security/ann'
const EASTMONEY_NEWS_URL = 'https://search-api-web.eastmoney.com/search/jsonp'
const EASTMONEY_QUOTE_REFERER = 'https://quote.eastmoney.com/'
const EASTMONEY_DATA_REFERER = 'https://data.eastmoney.com/'
const EASTMONEY_SEARCH_REFERER = 'https://so.eastmoney.com/'
const SINA_QUOTE_BASE_URL = 'https://hq.sinajs.cn'
const SINA_FINANCE_REFERER = 'https://finance.sina.com.cn'
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

function normalizeOpenAIBaseUrl(baseUrl: string): string {
  const url = baseUrl.trim().replace(/\/+$/, '')
  if (url.includes('/chat/completions')) return url.replace(/\/chat\/completions.*$/i, '')
  if (/\/v\d+\/?$/.test(url)) return url
  if (/\/api\//.test(url)) return url
  return `${url}/v1`
}

function getRuntimeConfig() {
  const ai = readAiConfig()
  const mongoUri = readEnv('MONGODB_URI')
  
  return {
    auth: {
      enabled: Boolean(readSitePassword()),
    },
    ai: {
      serverManaged: Boolean(ai.apiKey),
      configured: Boolean(ai.apiKey),
      baseUrl: ai.baseUrl || OPENAI_DEFAULT_BASE_URL,
      model: ai.model,
      temperature: ai.temperature,
      maxTokens: ai.maxTokens,
    },
    mongo: {
      configured: Boolean(mongoUri),
    },
    site: {
      hasPassword: Boolean(readSitePassword()),
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

function decodeBase64Url(value: string): string {
  let normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  while (normalized.length % 4) normalized += '='
  return Buffer.from(normalized, 'base64').toString('utf8')
}

function isAllowedAiProxyBase(url: URL): boolean {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return false
  return true
}

async function handleAiProxy(path: string, req: ApiRequest, res: ApiResponse): Promise<boolean> {
  if (!path.startsWith('ai-proxy/')) return false
  const rest = path.slice('ai-proxy/'.length)
  const [targetB64 = '', ...targetPathParts] = rest.split('/')
  if (!targetB64) {
    sendJson(res, 400, { error: 'Missing target' })
    return true
  }

  let targetBase: URL
  try {
    targetBase = new URL(decodeBase64Url(targetB64))
  } catch {
    sendJson(res, 400, { error: 'Invalid target' })
    return true
  }
  if (!isAllowedAiProxyBase(targetBase)) {
    sendJson(res, 400, { error: 'Invalid target URL' })
    return true
  }

  const targetUrl = new URL(targetBase.toString())
  const cleanPath = targetPathParts.map(encodeURIComponent).join('/')
  if (cleanPath) targetUrl.pathname = `${targetUrl.pathname.replace(/\/+$/, '')}/${cleanPath}`

  const originalUrl = new URL(req.url || '/api/ai-proxy', 'http://localhost')
  originalUrl.searchParams.forEach((value, key) => {
    if (key !== 'path') targetUrl.searchParams.append(key, value)
  })

  try {
    const headers: Record<string, string> = {
      'Content-Type': readHeader(req, 'content-type') || 'application/json',
      Accept: readHeader(req, 'accept') || 'application/json,text/plain,*/*',
    }
    const authorization = readHeader(req, 'authorization')
    if (authorization) headers.Authorization = authorization
    const rawBody = req.method && req.method !== 'GET' && req.method !== 'HEAD' ? await readRawBody(req) : ''
    const upstream = await fetch(targetUrl, {
      method: req.method || 'GET',
      headers,
      body: rawBody || undefined,
    })
    const contentType = upstream.headers.get('content-type') || 'application/json'
    const text = await upstream.text()
    res.writeHead(upstream.status, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    })
    res.end(text)
  } catch (e) {
    sendJson(res, statusFromError(e, 502), { error: messageFromError(e) })
  }
  return true
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

async function throwUpstreamError(prefix: string, response: Response): Promise<never> {
  const text = await response.text()
  throw Object.assign(new Error(`${prefix} ${response.status}: ${text.substring(0, 200)}`), { statusCode: response.status })
}

function getServerAiConfig() {
  const config = readAiConfig()
  if (!config.apiKey) throw Object.assign(new Error('AI_API_KEY or OPENAI_API_KEY is not configured.'), { statusCode: 503 })
  return config
}

async function listServerModels(): Promise<unknown[]> {
  const config = getServerAiConfig()
  const r = await fetch(`${normalizeOpenAIBaseUrl(config.baseUrl)}/models`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
  })
  if (!r.ok) await throwUpstreamError('Models', r)
  const json = await r.json() as { data?: unknown[]; model?: unknown }
  return json.data || (json.model ? [json.model] : [])
}

async function chatServer(messages: ChatMessage[], options: ChatBody = {}): Promise<unknown> {
  const config = getServerAiConfig()
  const model = options.model || config.model
  if (!model) throw Object.assign(new Error('AI_MODEL or OPENAI_MODEL is not configured.'), { statusCode: 503 })
  const r = await fetch(`${normalizeOpenAIBaseUrl(config.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? config.temperature,
      max_tokens: options.maxTokens ?? config.maxTokens,
      stream: false,
    }),
  })
  if (!r.ok) await throwUpstreamError('Chat', r)
  return r.json()
}

async function streamServerChat(messages: ChatMessage[], options: ChatBody = {}): Promise<Response> {
  const config = getServerAiConfig()
  const model = options.model || config.model
  if (!model) throw Object.assign(new Error('AI_MODEL or OPENAI_MODEL is not configured.'), { statusCode: 503 })
  const r = await fetch(`${normalizeOpenAIBaseUrl(config.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? config.temperature,
      max_tokens: options.maxTokens ?? config.maxTokens,
      stream: true,
    }),
  })
  if (!r.ok) await throwUpstreamError('Chat', r)
  return r
}

async function handleAi(path: string, req: ApiRequest, res: ApiResponse): Promise<boolean> {
  if (path === 'ai/models') {
    try {
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
    if (path === 'longbridge/status') {
      const appKey = readEnv('LONGPORT_APP_KEY') || readEnv('LONGBRIDGE_APP_KEY')
      const appSecret = readEnv('LONGPORT_APP_SECRET') || readEnv('LONGBRIDGE_APP_SECRET')
      const accessToken = readEnv('LONGPORT_ACCESS_TOKEN') || readEnv('LONGBRIDGE_ACCESS_TOKEN')
      const region = (readEnv('LONGPORT_REGION') || readEnv('LONGBRIDGE_REGION') || 'global').toLowerCase()
      const missing: string[] = []
      if (!appKey) missing.push('LONGPORT_APP_KEY')
      if (!accessToken) missing.push('LONGPORT_ACCESS_TOKEN')
      if (!appSecret && !accessToken.startsWith('Bearer ')) missing.push('LONGPORT_APP_SECRET')
      sendJson(res, 200, {
        configured: missing.length === 0,
        region,
        host: region === 'cn' ? 'https://openapi.longportapp.cn' : 'https://openapi.longportapp.com',
        quoteHost: region === 'cn' ? 'wss://openapi-quote.longportapp.cn' : 'wss://openapi-quote.longportapp.com',
        sdkLoaded: false,
        disabledReason: missing.length ? `LongPort credentials are not configured: ${missing.join(', ')}.` : '',
      })
      return true
    }
    if (path === 'longbridge/quotes') {
      sendJson(res, 503, { error: 'Longbridge quote service is disabled on this deployment.' })
      return true
    }
    if (path === 'longbridge/candlesticks') {
      sendJson(res, 503, { error: 'Longbridge candlestick service is disabled on this deployment.' })
      return true
    }
  } catch (e) {
    sendJson(res, statusFromError(e, 502), { error: messageFromError(e) })
    return true
  }
  return false
}

function readQueryString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

async function fetchText(url: string, headers: Record<string, string>): Promise<string> {
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

async function fetchFirstJson(urls: string[]): Promise<unknown> {
  const errors: string[] = []
  for (const url of urls) {
    try {
      const text = await fetchText(url, {
        Referer: EASTMONEY_QUOTE_REFERER,
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json,text/plain,*/*',
      })
      const jsonText = text.trim().replace(/^[^(]+\(/, '').replace(/\);?$/, '')
      return JSON.parse(jsonText)
    } catch (e) {
      errors.push(messageFromError(e))
    }
  }
  throw Object.assign(new Error(errors.join('; ') || 'EastMoney request failed'), { statusCode: 502 })
}

async function handleMarket(path: string, req: ApiRequest, res: ApiResponse): Promise<boolean> {
  if (path !== 'market') return false
  if (!methodAllowed(req, res, 'GET')) return true
  const source = readQueryString(req.query?.source)
  const mode = readQueryString(req.query?.mode)
  try {
    if (source === 'eastmoney') {
      if (mode === 'quote') {
        const secid = readQueryString(req.query?.secid)
        const fields = readQueryString(req.query?.fields)
        if (!secid || !fields) {
          sendJson(res, 400, { error: 'Missing secid or fields' })
          return true
        }
        const query = `secid=${encodeURIComponent(secid)}&fields=${encodeURIComponent(fields)}`
        sendJson(res, 200, await fetchFirstJson(EASTMONEY_QUOTE_BASES.map(base => `${base}?${query}`)))
        return true
      }

      if (mode === 'quotes') {
        const secids = readQueryString(req.query?.secids)
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .slice(0, 50)
        const fields = readQueryString(req.query?.fields)
        if (!secids.length || !fields) {
          sendJson(res, 400, { error: 'Missing secids or fields' })
          return true
        }

        const data = await Promise.all(secids.map(async (secid) => {
          const query = `secid=${encodeURIComponent(secid)}&fields=${encodeURIComponent(fields)}`
          try {
            const json = await fetchFirstJson(EASTMONEY_QUOTE_BASES.map(base => `${base}?${query}`)) as { data?: unknown }
            return { secid, data: json.data ?? null }
          } catch (e) {
            return { secid, data: null, error: messageFromError(e) }
          }
        }))
        sendJson(res, 200, { data })
        return true
      }

      if (mode === 'kline') {
        const secid = readQueryString(req.query?.secid)
        if (!secid) {
          sendJson(res, 400, { error: 'Missing secid' })
          return true
        }
        const params = new URLSearchParams({
          secid,
          fields1: readQueryString(req.query?.fields1) || 'f1,f2,f3,f4,f5,f6',
          fields2: readQueryString(req.query?.fields2) || 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
          klt: readQueryString(req.query?.klt) || '101',
          fqt: readQueryString(req.query?.fqt) || '1',
          beg: readQueryString(req.query?.beg) || '0',
          end: readQueryString(req.query?.end) || '20500101',
          lmt: readQueryString(req.query?.lmt) || '200',
        })
        sendJson(res, 200, await fetchFirstJson(EASTMONEY_KLINE_BASES.map(base => `${base}?${params.toString()}`)))
        return true
      }

      if (mode === 'search') {
        const input = readQueryString(req.query?.input).trim()
        if (!input) {
          sendJson(res, 200, {})
          return true
        }
        const params = new URLSearchParams({
          input,
          type: readQueryString(req.query?.type) || '14',
          token: readQueryString(req.query?.token) || 'D43BF722C8E33BDC906FB84D85E326E8',
          count: readQueryString(req.query?.count) || '10',
        })
        const text = await fetchText(`${EASTMONEY_SEARCH_URL}?${params.toString()}`, {
          Referer: EASTMONEY_QUOTE_REFERER,
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json,text/plain,*/*',
        })
        sendJson(res, 200, JSON.parse(text))
        return true
      }

      if (mode === 'announcements') {
        const stockList = readQueryString(req.query?.stock_list)
        if (!stockList) {
          sendJson(res, 400, { error: 'Missing stock_list' })
          return true
        }
        const params = new URLSearchParams({
          page_size: readQueryString(req.query?.page_size) || '10',
          page_index: readQueryString(req.query?.page_index) || '1',
          ann_type: readQueryString(req.query?.ann_type) || 'SHA,SZA',
          stock_list: stockList,
        })
        const text = await fetchText(`${EASTMONEY_NOTICE_URL}?${params.toString()}`, {
          Referer: EASTMONEY_DATA_REFERER,
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json,text/plain,*/*',
        })
        sendJson(res, 200, JSON.parse(text))
        return true
      }

      if (mode === 'news') {
        const param = readQueryString(req.query?.param)
        if (!param) {
          sendJson(res, 400, { error: 'Missing param' })
          return true
        }
        const cb = readQueryString(req.query?.cb) || `cb_${Date.now()}`
        const params = new URLSearchParams({ cb, param })
        const text = await fetchText(`${EASTMONEY_NEWS_URL}?${params.toString()}`, {
          Referer: EASTMONEY_SEARCH_REFERER,
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/javascript,text/plain,*/*',
        })
        const jsonStart = text.indexOf('(')
        const jsonEnd = text.lastIndexOf(')')
        if (jsonStart < 0 || jsonEnd < 0) throw new Error('Invalid EastMoney news response')
        sendJson(res, 200, JSON.parse(text.slice(jsonStart + 1, jsonEnd)))
        return true
      }
      sendJson(res, 400, { error: 'Invalid mode' })
      return true
    }

    if (source === 'sina') {
      const symbols = readQueryString(req.query?.symbols).split(',').map(s => s.trim()).filter(Boolean)
      if (!symbols.length) {
        sendJson(res, 400, { error: 'Missing symbols' })
        return true
      }
      const url = `${SINA_QUOTE_BASE_URL}/list=${symbols.map(encodeURIComponent).join(',')}`
      const upstream = await fetch(url, {
        headers: {
          Referer: SINA_FINANCE_REFERER,
          'User-Agent': 'Mozilla/5.0',
          Accept: '*/*',
        },
      })
      if (!upstream.ok) throw new Error(`Sina ${upstream.status}`)
      const bytes = Buffer.from(await upstream.arrayBuffer())
      sendJson(res, 200, { text: new TextDecoder('gb18030').decode(bytes) })
      return true
    }

    sendJson(res, 404, { error: 'Unknown market source' })
  } catch (e) {
    if (source === 'eastmoney') {
      const error = messageFromError(e)
      if (mode === 'quote') {
        sendJson(res, 200, { data: null, error })
        return true
      }
      if (mode === 'quotes') {
        sendJson(res, 200, { data: [], error })
        return true
      }
      if (mode === 'kline') {
        sendJson(res, 200, { data: { klines: [] }, error })
        return true
      }
      if (mode === 'search') {
        sendJson(res, 200, { QuotationCodeTable: { Data: [] }, error })
        return true
      }
      if (mode === 'announcements') {
        sendJson(res, 200, { data: { list: [] }, error })
        return true
      }
      if (mode === 'news') {
        sendJson(res, 200, { result: { cmsArticleWebOld: [] }, error })
        return true
      }
    }
    sendJson(res, statusFromError(e, 502), { error: messageFromError(e) })
  }
  return true
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const path = pathFromRequest(req)

    if (!path || path === 'config' || path === 'runtime-config') {
      sendJson(res, 200, getRuntimeConfig())
      return
    }

  if (await handleAiProxy(path, req, res)) return
  if (await handleMarket(path, req, res)) return
  if (await handleAuth(path, req, res)) return
  if (await handleAi(path, req, res)) return
  if (await handleLongbridge(path, req, res)) return

  sendJson(res, 404, { error: 'Not found' })
  } catch (e) {
    sendJson(res, statusFromError(e), { error: 'API service error', message: messageFromError(e) })
  }
}
