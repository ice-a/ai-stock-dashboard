import type { Collection, Db, MongoClient as MongoClientType } from 'mongodb'

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

interface AttemptState {
  count: number
  resetAt: number
}

interface UserConfigDocument {
  version?: number
  [key: string]: unknown
}

interface UserDocument {
  user: string
  seckeyHash: string
  config: UserConfigDocument | null
  configUpdatedAt: Date | null
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date | null
}

type MongoCache = {
  client: MongoClientType | null
  promise: Promise<MongoClientType> | null
  indexReady: Promise<void> | null
}

const USERS_COLLECTION = 'users'
const USER_AUTH_COOKIE_DEFAULT = 'ai_dashboard_user'
const loginAttempts = new Map<string, AttemptState>()
const globalCache = globalThis as typeof globalThis & {
  __aiStockAccountMongo?: MongoCache
}

const mongoCache: MongoCache = globalCache.__aiStockAccountMongo || {
  client: null,
  promise: null,
  indexReady: null,
}

globalCache.__aiStockAccountMongo = mongoCache

let cryptoModulePromise: Promise<typeof import('node:crypto')> | null = null

function loadNodeCrypto(): Promise<typeof import('node:crypto')> {
  cryptoModulePromise ||= import('node:crypto')
  return cryptoModulePromise
}

function readEnv(name: string): string {
  return process.env[name]?.trim() || ''
}

function readMongoUri(): string {
  return readEnv('MONGODB_URI') || readEnv('MONGO_URI') || readEnv('MONGODB_URL')
}

function readMongoDbName(): string {
  return readEnv('MONGODB_DB_NAME') || 'ai_stock_dashboard'
}

function readSitePassword(): string {
  return readEnv('SITE_PASSWORD') || readEnv('APP_PASSWORD')
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = readEnv(name)
  if (!raw) return fallback
  const value = Math.floor(Number(raw))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function readUserAuthCookieName(): string {
  return readEnv('USER_AUTH_COOKIE_NAME') || USER_AUTH_COOKIE_DEFAULT
}

function readUserAuthSecret(): string {
  return readEnv('USER_AUTH_SECRET') || readEnv('SITE_AUTH_SECRET') || readSitePassword() || readMongoUri()
}

function getUserAuthMaxAgeSeconds(): number {
  return readPositiveIntegerEnv('USER_AUTH_MAX_AGE_SECONDS', 30 * 24 * 60 * 60)
}

function isUserAuthEnabled(): boolean {
  return Boolean(readMongoUri())
}

async function getMongoClient(): Promise<MongoClientType> {
  const uri = readMongoUri()
  if (!uri) {
    throw Object.assign(new Error('MONGODB_URI is not configured.'), { statusCode: 503 })
  }

  if (mongoCache.client) return mongoCache.client

  if (!mongoCache.promise) {
    mongoCache.promise = import('mongodb')
      .then(({ MongoClient }) => new MongoClient(uri, {
        maxPoolSize: 5,
        minPoolSize: 0,
        serverSelectionTimeoutMS: readPositiveIntegerEnv('MONGODB_SERVER_SELECTION_TIMEOUT_MS', 5000),
      }).connect())
      .catch(e => {
        mongoCache.promise = null
        throw e
      })
  }

  mongoCache.client = await mongoCache.promise
  return mongoCache.client
}

async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient()
  return client.db(readMongoDbName())
}

async function collection(): Promise<Collection<UserDocument>> {
  return (await getMongoDb()).collection<UserDocument>(USERS_COLLECTION)
}

async function ensureIndexes(): Promise<void> {
  if (!mongoCache.indexReady) {
    mongoCache.indexReady = collection()
      .then(col => col.createIndex({ user: 1 }, { unique: true }))
      .then(() => undefined)
      .catch(e => {
        mongoCache.indexReady = null
        throw e
      })
  }
  await mongoCache.indexReady
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

function parseCookie(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (!key) continue
    try {
      out[key] = decodeURIComponent(value)
    } catch {
      out[key] = value
    }
  }
  return out
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

function normalizeUser(input: string): string {
  return input.trim().toLowerCase()
}

function validateUser(input: string): string | null {
  const user = normalizeUser(input)
  if (user.length < 2 || user.length > 40) return 'user 长度需为 2-40 个字符。'
  if (!/^[a-z0-9_.-]+$/.test(user)) return 'user 仅支持字母、数字、下划线、点和短横线。'
  return null
}

function validateSign(input: string): string | null {
  const value = input.trim()
  if (value.length < 4 || value.length > 128) return 'sign 长度需为 4-128 个字符。'
  return null
}

async function randomHex(bytes = 16): Promise<string> {
  const { randomBytes } = await loadNodeCrypto()
  return randomBytes(bytes).toString('hex')
}

async function scryptKey(sign: string, salt: string): Promise<Buffer> {
  const { scrypt } = await loadNodeCrypto()
  return new Promise((resolve, reject) => {
    scrypt(sign, salt, 64, (err, key) => {
      if (err) reject(err)
      else resolve(key)
    })
  })
}

async function hashSign(sign: string, salt?: string): Promise<string> {
  const nextSalt = salt || await randomHex(16)
  const key = await scryptKey(sign, nextSalt)
  return `scrypt:${nextSalt}:${key.toString('hex')}`
}

async function verifySign(sign: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split(':')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = await hashSign(sign, salt)
  const expectedHash = Buffer.from(expected.split(':')[2] || '', 'hex')
  const actualHash = Buffer.from(hash, 'hex')
  if (expectedHash.length !== actualHash.length) return false
  const { timingSafeEqual } = await loadNodeCrypto()
  return timingSafeEqual(expectedHash, actualHash)
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const { createHmac } = await loadNodeCrypto()
  return createHmac('sha256', secret).update(message).digest('hex')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function encodeBase64Url(text: string): string {
  return Buffer.from(text, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function decodeBase64Url(value: string): string {
  let normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  while (normalized.length % 4) normalized += '='
  return Buffer.from(normalized, 'base64').toString('utf8')
}

function getSessionSecret(): string {
  const secret = readUserAuthSecret()
  if (!secret) throw Object.assign(new Error('USER_AUTH_SECRET, SITE_AUTH_SECRET or MONGODB_URI is required for user sessions.'), { statusCode: 503 })
  return secret
}

async function createUserSessionToken(user: string): Promise<string> {
  const expiresAt = Date.now() + getUserAuthMaxAgeSeconds() * 1000
  const payload = encodeBase64Url(JSON.stringify({ user: normalizeUser(user), exp: expiresAt, nonce: await randomHex(12) }))
  const signature = await hmacHex(getSessionSecret(), payload)
  return `${payload}.${signature}`
}

async function verifyUserSessionToken(token: string | null | undefined): Promise<string | null> {
  if (!isUserAuthEnabled()) return null
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, signature] = parts
  const expected = await hmacHex(getSessionSecret(), payload)
  if (!constantTimeEqual(signature, expected)) return null
  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as { user?: string; exp?: number }
    if (!parsed.user || !parsed.exp || parsed.exp < Date.now()) return null
    return normalizeUser(parsed.user)
  } catch {
    return null
  }
}

function getUserFromCookie(header: string | null | undefined): Promise<string | null> {
  return verifyUserSessionToken(parseCookie(header)[readUserAuthCookieName()] || null)
}

function buildUserSessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${readUserAuthCookieName()}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${getUserAuthMaxAgeSeconds()}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

function buildExpiredUserSessionCookie(secure: boolean): string {
  const parts = [
    `${readUserAuthCookieName()}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

async function registerUser(userInput: string, signInput: string): Promise<UserDocument> {
  const user = normalizeUser(userInput)
  const userError = validateUser(user)
  if (userError) throw Object.assign(new Error(userError), { statusCode: 400 })
  const sign = signInput.trim()
  const signError = validateSign(sign)
  if (signError) throw Object.assign(new Error(signError), { statusCode: 400 })

  await ensureIndexes()
  const col = await collection()
  const now = new Date()
  const doc: UserDocument = {
    user,
    seckeyHash: await hashSign(sign),
    config: null,
    configUpdatedAt: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  }

  try {
    await col.insertOne(doc)
  } catch (e) {
    const maybe = e as { code?: number }
    if (maybe.code === 11000) {
      throw Object.assign(new Error('该 user 已存在。'), { statusCode: 409 })
    }
    throw e
  }
  return doc
}

async function loginOrRegisterUser(userInput: string, signInput: string): Promise<{ doc: UserDocument; created: boolean } | null> {
  const user = normalizeUser(userInput)
  const userError = validateUser(user)
  if (userError) throw Object.assign(new Error(userError), { statusCode: 400 })
  const sign = signInput.trim()
  const signError = validateSign(sign)
  if (signError) throw Object.assign(new Error(signError), { statusCode: 400 })

  await ensureIndexes()
  const col = await collection()
  const existing = await col.findOne({ user })
  if (!existing) {
    return { doc: await registerUser(user, sign), created: true }
  }

  if (!(await verifySign(sign, existing.seckeyHash))) return null
  const now = new Date()
  await col.updateOne({ user }, { $set: { lastLoginAt: now, updatedAt: now } })
  return { doc: { ...existing, lastLoginAt: now, updatedAt: now }, created: false }
}

async function getUserConfig(user: string): Promise<{ config: UserConfigDocument | null; updatedAt: Date | null }> {
  await ensureIndexes()
  const doc = await (await collection()).findOne({ user: normalizeUser(user) }, { projection: { config: 1, configUpdatedAt: 1 } })
  return { config: doc?.config ?? null, updatedAt: doc?.configUpdatedAt ?? null }
}

async function saveUserConfig(user: string, config: UserConfigDocument): Promise<Date> {
  await ensureIndexes()
  const jsonSize = Buffer.byteLength(JSON.stringify(config), 'utf8')
  if (jsonSize > 1_000_000) {
    throw Object.assign(new Error('配置过大，请先精简后再保存。'), { statusCode: 413 })
  }

  const now = new Date()
  const result = await (await collection()).updateOne(
    { user: normalizeUser(user) },
    { $set: { config, configUpdatedAt: now, updatedAt: now } },
  )
  if (result.matchedCount === 0) throw Object.assign(new Error('用户不存在或登录已失效。'), { statusCode: 404 })
  return now
}

function accountUnavailable(res: ApiResponse): void {
  sendJson(res, 503, { error: 'MongoDB account storage is not configured.', configured: false })
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const path = pathFromRequest(req)

    if (!path || path === 'status') {
      const enabled = isUserAuthEnabled()
      const user = enabled ? await getUserFromCookie(readHeader(req, 'cookie')) : null
      sendJson(res, 200, { enabled, configured: enabled, authenticated: Boolean(user), user })
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
        accountUnavailable(res)
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
        accountUnavailable(res)
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
