import { EXTERNAL_ENDPOINTS } from '../config/endpoints'

export interface AIServiceConfig {
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
}

export interface LongportCredentials {
  appKey: string
  appSecret: string
  accessToken: string
}

export type LongportEnvName =
  | 'APP_KEY'
  | 'APP_SECRET'
  | 'ACCESS_TOKEN'
  | 'REGION'
  | 'HTTP_URL'
  | 'QUOTE_WS_URL'

export function readEnv(name: string): string {
  return process.env[name]?.trim() || ''
}

export function readNumberEnv(name: string, fallback: number): number {
  const raw = readEnv(name)
  if (!raw) return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

export function readOptionalNumberEnv(name: string): number | null {
  const raw = readEnv(name)
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export function readPositiveIntegerEnv(name: string, fallback: number): number {
  const value = Math.floor(readNumberEnv(name, fallback))
  return value > 0 ? value : fallback
}

export function readSitePassword(): string {
  return readEnv('SITE_PASSWORD') || readEnv('APP_PASSWORD')
}

export function readAuthCookieName(): string {
  return readEnv('SITE_AUTH_COOKIE_NAME') || 'ai_dashboard_auth'
}

export function readAuthSecret(): string {
  return readEnv('SITE_AUTH_SECRET') || readSitePassword()
}

export function readMongoUri(): string {
  return readEnv('MONGODB_URI')
}

export function readMongoDbName(): string {
  return readEnv('MONGODB_DB_NAME') || 'ai_stock_dashboard'
}

export function readUserAuthCookieName(): string {
  return readEnv('USER_AUTH_COOKIE_NAME') || 'ai_dashboard_user'
}

export function readUserAuthSecret(): string {
  return readEnv('USER_AUTH_SECRET') || readAuthSecret() || readMongoUri()
}

export function readAiConfig(): AIServiceConfig {
  return {
    apiKey: readEnv('AI_API_KEY') || readEnv('OPENAI_API_KEY'),
    baseUrl: readEnv('AI_BASE_URL') || readEnv('OPENAI_BASE_URL') || EXTERNAL_ENDPOINTS.openai.baseUrl,
    model: readEnv('AI_MODEL') || readEnv('OPENAI_MODEL'),
    temperature: readNumberEnv('AI_TEMPERATURE', 0.7),
    maxTokens: readNumberEnv('AI_MAX_TOKENS', 2000),
  }
}

export function hasServerAiConfig(): boolean {
  return Boolean(readAiConfig().apiKey)
}

function hasLongportEnvGroup(prefix: 'LONGPORT' | 'LONGBRIDGE'): boolean {
  return Boolean(readEnv(`${prefix}_APP_KEY`) || readEnv(`${prefix}_APP_SECRET`) || readEnv(`${prefix}_ACCESS_TOKEN`))
}

export function readLongportEnv(name: LongportEnvName): string {
  return readEnv(`LONGPORT_${name}`) || readEnv(`LONGBRIDGE_${name}`)
}

export function readLongportCredentials(): LongportCredentials {
  const prefix = hasLongportEnvGroup('LONGPORT') ? 'LONGPORT' : 'LONGBRIDGE'
  return {
    appKey: readEnv(`${prefix}_APP_KEY`),
    appSecret: readEnv(`${prefix}_APP_SECRET`),
    accessToken: readEnv(`${prefix}_ACCESS_TOKEN`),
  }
}
