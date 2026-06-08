import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHmac } from 'node:crypto'
import { promisify } from 'node:util'
import type { Collection } from 'mongodb'
import { getMongoDb, isMongoEnabled } from './mongo'
import { parseCookie } from './auth'
import { readPositiveIntegerEnv, readUserAuthCookieName, readUserAuthSecret } from './env'

const scrypt = promisify(scryptCallback)
const USERS_COLLECTION = 'users'

export interface UserConfigDocument {
  version?: number
  [key: string]: unknown
}

export interface UserDocument {
  user: string
  seckeyHash: string
  config: UserConfigDocument | null
  configUpdatedAt: Date | null
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date | null
}

let indexReady: Promise<void> | null = null

export function isUserAuthEnabled(): boolean {
  return isMongoEnabled()
}

function collection(): Promise<Collection<UserDocument>> {
  return getMongoDb().then(db => db.collection<UserDocument>(USERS_COLLECTION))
}

async function ensureIndexes(): Promise<void> {
  if (!indexReady) {
    indexReady = collection()
      .then(col => col.createIndex({ user: 1 }, { unique: true }))
      .then(() => undefined)
  }
  await indexReady
}

export function normalizeUser(input: string): string {
  return input.trim().toLowerCase()
}

export function validateUser(input: string): string | null {
  const user = normalizeUser(input)
  if (user.length < 2 || user.length > 40) return 'user 长度需为 2-40 个字符。'
  if (!/^[a-z0-9_.-]+$/.test(user)) return 'user 仅支持字母、数字、下划线、点和短横线。'
  return null
}

export function validateSign(input: string): string | null {
  const value = input.trim()
  if (value.length < 4 || value.length > 128) return 'sign 长度需为 4-128 个字符。'
  return null
}

function randomHex(bytes = 16): string {
  return randomBytes(bytes).toString('hex')
}

async function hashSign(sign: string, salt = randomHex(16)): Promise<string> {
  const key = (await scrypt(sign, salt, 64)) as Buffer
  return `scrypt:${salt}:${key.toString('hex')}`
}

async function verifySign(sign: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split(':')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const expected = await hashSign(sign, salt)
  const expectedHash = Buffer.from(expected.split(':')[2] || '', 'hex')
  const actualHash = Buffer.from(hash, 'hex')
  if (expectedHash.length !== actualHash.length) return false
  return timingSafeEqual(expectedHash, actualHash)
}

function hmacHex(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('hex')
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

function getSessionSecret(): string {
  const secret = readUserAuthSecret()
  if (!secret) throw new Error('USER_AUTH_SECRET, SITE_AUTH_SECRET or MONGODB_URI is required for user sessions.')
  return secret
}

export function getUserAuthCookieName(): string {
  return readUserAuthCookieName()
}

export function getUserAuthMaxAgeSeconds(): number {
  return readPositiveIntegerEnv('USER_AUTH_MAX_AGE_SECONDS', 30 * 24 * 60 * 60)
}

export async function createUserSessionToken(user: string): Promise<string> {
  const expiresAt = Date.now() + getUserAuthMaxAgeSeconds() * 1000
  const payload = Buffer.from(JSON.stringify({ user: normalizeUser(user), exp: expiresAt, nonce: randomHex(12) })).toString('base64url')
  const signature = hmacHex(getSessionSecret(), payload)
  return `${payload}.${signature}`
}

export async function verifyUserSessionToken(token: string | null | undefined): Promise<string | null> {
  if (!isUserAuthEnabled()) return null
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, signature] = parts
  const expected = hmacHex(getSessionSecret(), payload)
  if (!constantTimeEqual(signature, expected)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { user?: string; exp?: number }
    if (!parsed.user || !parsed.exp || parsed.exp < Date.now()) return null
    return normalizeUser(parsed.user)
  } catch {
    return null
  }
}

export function getUserFromCookie(header: string | null | undefined): Promise<string | null> {
  return verifyUserSessionToken(parseCookie(header)[getUserAuthCookieName()] || null)
}

export function buildUserSessionCookie(token: string, secure: boolean): string {
  const parts = [
    `${getUserAuthCookieName()}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${getUserAuthMaxAgeSeconds()}`,
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function buildExpiredUserSessionCookie(secure: boolean): string {
  const parts = [
    `${getUserAuthCookieName()}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export async function registerUser(userInput: string, signInput: string): Promise<UserDocument> {
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

export async function loginUser(userInput: string, signInput: string): Promise<UserDocument | null> {
  const user = normalizeUser(userInput)
  if (validateUser(user) || validateSign(signInput)) return null
  await ensureIndexes()
  const col = await collection()
  const doc = await col.findOne({ user })
  if (!doc) return null
  if (!(await verifySign(signInput.trim(), doc.seckeyHash))) return null
  const now = new Date()
  await col.updateOne({ user }, { $set: { lastLoginAt: now, updatedAt: now } })
  return { ...doc, lastLoginAt: now, updatedAt: now }
}

export async function loginOrRegisterUser(userInput: string, signInput: string): Promise<{ doc: UserDocument; created: boolean } | null> {
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

export async function getUserConfig(user: string): Promise<{ config: UserConfigDocument | null; updatedAt: Date | null }> {
  await ensureIndexes()
  const doc = await (await collection()).findOne({ user: normalizeUser(user) }, { projection: { config: 1, configUpdatedAt: 1 } })
  return { config: doc?.config ?? null, updatedAt: doc?.configUpdatedAt ?? null }
}

export async function saveUserConfig(user: string, config: UserConfigDocument): Promise<Date> {
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
