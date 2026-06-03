// 长桥 Provider
import type { Quote, KLineData, KLinePoint } from '../../types'
import { toLongportSymbol, parseLongportSymbol } from '../symbolMap'
import { lpGetQuote, lpGetCandlesticks, type LPQuote } from '../longport'
import { getFallbackQuote } from '../../data/fallbackQuotes'
import type { QuoteProvider, ProviderMeta, ProviderResult } from './types'

const LP_META: ProviderMeta = {
  id: 'longport',
  name: '长桥 Longbridge',
  region: 'global',
  needsAuth: true,
}

function lpQuoteToQuote(symbol: string, raw: LPQuote | null): Quote {
  if (!raw) {
    const fb = getFallbackQuote(symbol)
    return {
      symbol,
      yahooSymbol: toLongportSymbol(symbol),
      name: fb?.name,
      price: null,
      prevClose: null,
      change: fb ? fb.d1 / 100 : null,
      changeAbs: null,
      dayHigh: null,
      dayLow: null,
      dayOpen: null,
      volume: null,
      currency: undefined,
      marketState: 'CLOSED',
      marketCap: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      shortName: undefined,
      longName: undefined,
      regularMarketTime: null,
      updatedAt: Date.now(),
      source: 'longport',
    }
  }
  const price = parseFloat(raw.lastDone)
  const prevClose = parseFloat(raw.prevClose)
  return {
    symbol,
    yahooSymbol: toLongportSymbol(symbol),
    name: parseLongportSymbol(symbol)?.code,
    price: isNaN(price) ? null : price,
    prevClose: isNaN(prevClose) ? null : prevClose,
    change: !isNaN(price) && !isNaN(prevClose) && prevClose !== 0 ? (price - prevClose) / prevClose : null,
    changeAbs: !isNaN(price) && !isNaN(prevClose) ? price - prevClose : null,
    dayHigh: parseFloat(raw.high) || null,
    dayLow: parseFloat(raw.low) || null,
    dayOpen: parseFloat(raw.open) || null,
    volume: raw.volume ?? null,
    currency: undefined,
    marketState: raw.tradeStatus === 1 ? 'REGULAR' : 'CLOSED',
    marketCap: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    shortName: undefined,
    longName: undefined,
    regularMarketTime: raw.timestamp || null,
    updatedAt: Date.now(),
    source: 'longport',
  }
}

export const longportProvider: QuoteProvider = {
  meta: LP_META,
  isConfigured() {
    return true
  },

  async fetchQuote(symbol: string, options: { signal?: AbortSignal } = {}): Promise<ProviderResult<Quote>> {
    const t0 = performance.now()
    try {
      const arr = await lpGetQuote([symbol], null, options.signal)
      const raw = arr[0] || null
      return { ok: !!raw, data: lpQuoteToQuote(symbol, raw), duration: performance.now() - t0, source: 'longport' }
    } catch (e) {
      return { ok: false, data: lpQuoteToQuote(symbol, null), error: (e as Error).message, duration: performance.now() - t0, source: 'longport' }
    }
  },

  async fetchQuotes(symbols: string[], options: { signal?: AbortSignal } = {}): Promise<ProviderResult<Quote[]>> {
    const t0 = performance.now()
    try {
      const out: Quote[] = []
      for (let i = 0; i < symbols.length; i += 500) {
        const batch = symbols.slice(i, i + 500)
        const arr = await lpGetQuote(batch, null, options.signal)
        const map = new Map(arr.map(q => [q.symbol, q]))
        for (const sym of batch) {
          const lpSym = toLongportSymbol(sym)
          out.push(lpQuoteToQuote(sym, map.get(lpSym) || null))
        }
      }
      return { ok: out.some(q => q.source === 'longport' && q.price != null), data: out, duration: performance.now() - t0, source: 'longport' }
    } catch (e) {
      return { ok: false, data: symbols.map(s => lpQuoteToQuote(s, null)), error: (e as Error).message, duration: performance.now() - t0, source: 'longport' }
    }
  },

  async fetchKLine(symbol: string, options: { range?: string; interval?: string; signal?: AbortSignal } = {}): Promise<ProviderResult<KLineData | null>> {
    const t0 = performance.now()
    try {
      const interval = options.interval || '1d'
      const period = interval === '1d' ? 'day' : interval === '1wk' ? 'week' : interval === '1mo' ? 'month' : 'day'
      const rows = await lpGetCandlesticks(symbol, null, { period, count: 200, signal: options.signal })
      const points: KLinePoint[] = rows.map((r: any) => ({
        time: typeof r.timestamp === 'number'
          ? (r.timestamp > 1e12 ? Math.floor(r.timestamp / 1000) : r.timestamp)
          : Math.floor(new Date(r.timestamp).getTime() / 1000),
        open: parseFloat(r.open),
        high: parseFloat(r.high),
        low: parseFloat(r.low),
        close: parseFloat(r.close),
        volume: parseFloat(r.volume),
      })).filter(p => !isNaN(p.close))
      if (points.length === 0) {
        return { ok: false, data: null, error: 'no data', duration: performance.now() - t0, source: 'longport' }
      }
      const last = points[points.length - 1]
      return {
        ok: true,
        data: {
          symbol,
          range: options.range || '6mo',
          interval,
          points,
          meta: {
            currency: undefined,
            regularMarketPrice: last.close,
            previousClose: points.length > 1 ? points[points.length - 2].close : last.open,
          },
        },
        duration: performance.now() - t0,
        source: 'longport',
      }
    } catch (e) {
      return { ok: false, data: null, error: (e as Error).message, duration: performance.now() - t0, source: 'longport' }
    }
  },
}
