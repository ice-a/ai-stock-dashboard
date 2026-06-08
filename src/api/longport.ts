import { APP_API_ROUTES } from '../config/endpoints'
import { toLongportSymbol } from './symbolMap'

export interface LongPortCreds {
  appKey: string
  appSecret: string
  accessToken: string
}

export interface LPQuote {
  symbol: string
  lastDone: string
  prevClose: string
  open: string
  high: string
  low: string
  volume: number
  turnover: string
  timestamp: number | null
  tradeStatus: number
}

const CREDS_KEY = 'ai-dashboard:longport'

function withSignal(signal?: AbortSignal): RequestInit {
  return signal ? { signal } : {}
}

async function readJson<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => null)
  if (!response.ok) {
    const message = json?.error || `${response.status} ${response.statusText}`
    throw new Error(`Longbridge ${message}`)
  }
  return json as T
}

export async function lpGetQuote(symbols: string[], _creds?: LongPortCreds | null, signal?: AbortSignal): Promise<LPQuote[]> {
  const symbolList = symbols.map(toLongportSymbol).join(',')
  const response = await fetch(`${APP_API_ROUTES.longbridgeQuotes}?symbols=${encodeURIComponent(symbolList)}`, withSignal(signal))
  const json = await readJson<{ data: LPQuote[] }>(response)
  return json.data || []
}

export async function lpGetCandlesticks(
  symbol: string,
  _creds?: LongPortCreds | null,
  options: { period?: 'day' | 'week' | 'month' | 'min'; count?: number; signal?: AbortSignal } = {},
): Promise<any[]> {
  const params = new URLSearchParams({
    symbol: toLongportSymbol(symbol),
    period: options.period || 'day',
    count: String(options.count || 200),
  })
  const response = await fetch(`${APP_API_ROUTES.longbridgeCandlesticks}?${params.toString()}`, withSignal(options.signal))
  const json = await readJson<{ data: any[] }>(response)
  return json.data || []
}

export async function fetchLongbridgeStatus(signal?: AbortSignal): Promise<{
  configured: boolean
  host: string
  quoteHost?: string
  region?: string
  disabledReason?: string
}> {
  const response = await fetch(APP_API_ROUTES.longbridgeStatus, withSignal(signal))
  return readJson<{
    configured: boolean
    host: string
    quoteHost?: string
    region?: string
    disabledReason?: string
  }>(response)
}

export const isLongPortConfigured = (creds: Partial<LongPortCreds> | null | undefined): boolean => {
  return !!(creds?.appKey && creds?.appSecret && creds?.accessToken)
}

export function loadLongPortCreds(): LongPortCreds | null {
  try {
    const raw = localStorage.getItem(CREDS_KEY)
    if (raw) {
      const c = JSON.parse(raw) as LongPortCreds
      if (c.appKey && c.appSecret && c.accessToken) return c
    }
  } catch { /* ignore */ }
  return null
}

export function saveLongPortCreds(appKey: string, appSecret: string, accessToken: string): void {
  localStorage.setItem(CREDS_KEY, JSON.stringify({ appKey, appSecret, accessToken }))
}

export function clearLongPortCreds(): void {
  localStorage.removeItem(CREDS_KEY)
}

export function hasLongPortCreds(): boolean {
  return !!loadLongPortCreds()
}
