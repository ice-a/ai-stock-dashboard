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
  sdkLoaded: boolean
  disabledReason: string
}

const DISABLED_REASON =
  'Longbridge native SDK is disabled on Vercel because its Linux binding exceeds the 250 MB Serverless Function size limit.'

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
    sdkLoaded: false,
    disabledReason: DISABLED_REASON,
  }
}

function throwDisabled(): never {
  throw new Error(DISABLED_REASON)
}

export async function getLongbridgeQuotes(symbols: string[]): Promise<LongbridgeQuoteDto[]> {
  const cleanSymbols = symbols.map(s => s.trim().toUpperCase()).filter(Boolean)
  if (cleanSymbols.length === 0) return []
  throwDisabled()
}

export async function getLongbridgeCandlesticks(symbol: string, _period = 'day', _count = 200): Promise<LongbridgeCandlestickDto[]> {
  if (!symbol.trim()) return []
  throwDisabled()
}
