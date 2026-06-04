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
  quoteHost: string
  sdkLoaded: boolean
  disabledReason: string
}

export function getLongbridgeStatus(): LongbridgeStatusDto
export function getLongbridgeQuotes(symbols: string[]): Promise<LongbridgeQuoteDto[]>
export function getLongbridgeCandlesticks(symbol: string, period?: string, count?: number): Promise<LongbridgeCandlestickDto[]>
export default function handler(req: unknown, res: { status(code: number): { json(payload: unknown): void } }): void
