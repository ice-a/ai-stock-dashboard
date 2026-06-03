import Longbridge from 'longbridge'

export interface LongbridgeQuoteDto {
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

export interface LongbridgeCandlestickDto {
  close: string
  open: string
  low: string
  high: string
  volume: number
  turnover: string
  timestamp: number | null
}

export interface LongbridgeStatusDto {
  configured: boolean
  host: string
}

let quoteContext: ReturnType<typeof Longbridge.QuoteContext.new> | null = null
let contextKey = ''

function readEnv(name: string): string {
  return process.env[name]?.trim() || ''
}

function getCredentials() {
  const appKey = readEnv('LONGBRIDGE_APP_KEY') || readEnv('LONGPORT_APP_KEY')
  const appSecret = readEnv('LONGBRIDGE_APP_SECRET') || readEnv('LONGPORT_APP_SECRET')
  const accessToken = readEnv('LONGBRIDGE_ACCESS_TOKEN') || readEnv('LONGPORT_ACCESS_TOKEN')
  return { appKey, appSecret, accessToken }
}

export function getLongbridgeStatus(): LongbridgeStatusDto {
  const creds = getCredentials()
  return {
    configured: Boolean(creds.appKey && creds.appSecret && creds.accessToken),
    host: readEnv('LONGBRIDGE_HTTP_URL') || 'https://openapi.longbridge.com',
  }
}

function getQuoteContext(): ReturnType<typeof Longbridge.QuoteContext.new> {
  const creds = getCredentials()
  if (!creds.appKey || !creds.appSecret || !creds.accessToken) {
    throw new Error('Longbridge is not configured. Set LONGBRIDGE_APP_KEY, LONGBRIDGE_APP_SECRET and LONGBRIDGE_ACCESS_TOKEN.')
  }

  const key = `${creds.appKey}:${creds.accessToken.slice(0, 16)}:${readEnv('LONGBRIDGE_HTTP_URL')}`
  if (quoteContext && contextKey === key) return quoteContext

  const config = Longbridge.Config.fromApikey(creds.appKey, creds.appSecret, creds.accessToken, {
    httpUrl: readEnv('LONGBRIDGE_HTTP_URL') || undefined,
    language: 0,
    enableOvernight: true,
    enablePrintQuotePackages: false,
  } as any)
  quoteContext = Longbridge.QuoteContext.new(config)
  contextKey = key
  return quoteContext
}

function decimalToString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object' && 'toString' in value && typeof value.toString === 'function') {
    return value.toString()
  }
  return String(value)
}

function dateToSeconds(value: unknown): number | null {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000)
  if (typeof value === 'number') return value > 1e12 ? Math.floor(value / 1000) : value
  if (typeof value === 'string') {
    const ts = Date.parse(value)
    return Number.isNaN(ts) ? null : Math.floor(ts / 1000)
  }
  return null
}

function quoteToDto(q: any): LongbridgeQuoteDto {
  return {
    symbol: q.symbol,
    lastDone: decimalToString(q.lastDone),
    prevClose: decimalToString(q.prevClose),
    open: decimalToString(q.open),
    high: decimalToString(q.high),
    low: decimalToString(q.low),
    volume: q.volume,
    turnover: decimalToString(q.turnover),
    timestamp: dateToSeconds(q.timestamp),
    tradeStatus: Number(q.tradeStatus),
  }
}

function candlestickToDto(k: any): LongbridgeCandlestickDto {
  return {
    close: decimalToString(k.close),
    open: decimalToString(k.open),
    low: decimalToString(k.low),
    high: decimalToString(k.high),
    volume: k.volume,
    turnover: decimalToString(k.turnover),
    timestamp: dateToSeconds(k.timestamp),
  }
}

function mapPeriod(period: string | null | undefined): number {
  if (period === 'week') return 15
  if (period === 'month') return 16
  if (period === 'min') return 1
  return 14
}

export async function getLongbridgeQuotes(symbols: string[]): Promise<LongbridgeQuoteDto[]> {
  const cleanSymbols = symbols.map(s => s.trim().toUpperCase()).filter(Boolean)
  if (cleanSymbols.length === 0) return []
  const ctx = getQuoteContext()
  const rows = await ctx.quote(cleanSymbols)
  return rows.map(quoteToDto)
}

export async function getLongbridgeCandlesticks(symbol: string, period = 'day', count = 200): Promise<LongbridgeCandlestickDto[]> {
  const cleanSymbol = symbol.trim().toUpperCase()
  if (!cleanSymbol) return []
  const ctx = getQuoteContext()
  const rows = await ctx.candlesticks(
    cleanSymbol,
    mapPeriod(period) as any,
    Math.min(Math.max(Number(count) || 200, 1), 1000),
    0 as any,
    1 as any,
  )
  return rows.map(candlestickToDto)
}
