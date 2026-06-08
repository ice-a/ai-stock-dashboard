// 东方财富 Provider
import type { Quote, KLineData, KLinePoint } from '../../types'
import { parseLongportSymbol } from '../symbolMap'
import { eastmoney } from '../eastmoney'
import { getFallbackQuote } from '../../data/fallbackQuotes'
import type { QuoteProvider, ProviderMeta, ProviderResult } from './types'

const EM_META: ProviderMeta = {
  id: 'eastmoney',
  name: '东方财富',
  region: 'CN/US/HK/JP/KR/TW/EU',
  needsAuth: false,
}

function rangeToCount(range?: string): number {
  switch (range) {
    case '1mo': return 45
    case '3mo': return 90
    case '6mo': return 180
    case '1y': return 365
    case '2y': return 730
    default: return 365
  }
}

function emptyQuote(symbol: string, source: Quote['source']): Quote {
  const fb = getFallbackQuote(symbol)
  return {
    symbol,
    yahooSymbol: symbol,
    name: fb?.name || parseLongportSymbol(symbol)?.code,
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
    source,
  }
}

function emToQuote(symbol: string, raw: any): Quote {
  if (!raw) return emptyQuote(symbol, 'eastmoney')
  const p = parseLongportSymbol(symbol)
  const isAShare = p?.market === 'sh' || p?.market === 'sz'
  // 东方财富：A 股价格字段为分，港/美股为千分之一；f170 为百分比 * 100。
  const priceDivisor = isAShare ? 100 : 1000
  const price = raw.f43 != null ? raw.f43 / priceDivisor : null
  const prevClose = raw.f60 != null ? raw.f60 / priceDivisor : null
  const changePct = raw.f170 != null ? raw.f170 / 10000 : null
  const changeAbs = raw.f169 != null ? raw.f169 / priceDivisor : null
  const dayHigh = raw.f44 != null ? raw.f44 / priceDivisor : null
  const dayLow = raw.f45 != null ? raw.f45 / priceDivisor : null
  const dayOpen = raw.f46 != null ? raw.f46 / priceDivisor : null
  const volume = raw.f47 ?? null
  const turnover = raw.f48 ?? null
  return {
    symbol,
    yahooSymbol: symbol,
    name: raw.f58,
    price,
    prevClose,
    change: changePct ?? (price != null && prevClose != null && prevClose !== 0 ? (price - prevClose) / prevClose : null),
    changeAbs,
    dayHigh,
    dayLow,
    dayOpen,
    volume: volume,
    // 成交额（万元）
    currency: undefined,
    marketState: 'REGULAR',
    marketCap: raw.f117 ?? null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    shortName: raw.f58,
    longName: raw.f58,
    regularMarketTime: null,
    updatedAt: Date.now(),
    source: 'eastmoney',
    // 额外字段存到 name 后面：
    ...({ turnover, pe: raw.f162, pb: raw.f167, turnoverRate: raw.f168 } as any),
  }
}

export const eastmoneyProvider: QuoteProvider = {
  meta: EM_META,

  async fetchQuote(symbol: string, options: { signal?: AbortSignal } = {}): Promise<ProviderResult<Quote>> {
    const t0 = performance.now()
    try {
      const map = await eastmoney.fetchQuote([symbol], options.signal)
      const raw = map.get(symbol) || null
      return { ok: raw != null && raw.f43 != null, data: emToQuote(symbol, raw), duration: performance.now() - t0, source: 'eastmoney' }
    } catch (e) {
      return { ok: false, data: emptyQuote(symbol, 'eastmoney'), error: (e as Error).message, duration: performance.now() - t0, source: 'eastmoney' }
    }
  },

  async fetchQuotes(symbols: string[], options: { signal?: AbortSignal } = {}): Promise<ProviderResult<Quote[]>> {
    const t0 = performance.now()
    try {
      const map = await eastmoney.fetchQuote(symbols, options.signal)
      const out = symbols.map(s => emToQuote(s, map.get(s) || null))
      return { ok: out.some(q => q.price != null), data: out, duration: performance.now() - t0, source: 'eastmoney' }
    } catch (e) {
      return { ok: false, data: symbols.map(s => emptyQuote(s, 'eastmoney')), error: (e as Error).message, duration: performance.now() - t0, source: 'eastmoney' }
    }
  },

  async fetchKLine(symbol: string, options: { range?: string; interval?: string; signal?: AbortSignal } = {}): Promise<ProviderResult<KLineData | null>> {
    const t0 = performance.now()
    try {
      const interval = options.interval || '1d'
      const klt = interval === '1d' ? 101 : interval === '1wk' ? 102 : interval === '1mo' ? 103 : 101
      const count = rangeToCount(options.range)
      let rows = await eastmoney.fetchKLine(symbol, { klt, count, fqt: 1, signal: options.signal })
      if (rows.length === 0) {
        rows = await eastmoney.fetchKLine(symbol, { klt, count, fqt: 0, signal: options.signal })
      }
      if (rows.length === 0) {
        return { ok: false, data: null, error: 'no data', duration: performance.now() - t0, source: 'eastmoney' }
      }
      const points: KLinePoint[] = rows.map(r => {
        const ts = r.time.includes('-') ? Math.floor(new Date(r.time).getTime() / 1000) : parseInt(r.time)
        return {
          time: ts,
          open: r.open,
          high: r.high,
          low: r.low,
          close: r.close,
          volume: r.volume,
        }
      })
      const last = points[points.length - 1]
      return {
        ok: true,
        data: {
          symbol,
          range: options.range || '1y',
          interval,
          points,
          meta: {
            regularMarketPrice: last.close,
            previousClose: points.length > 1 ? points[points.length - 2].close : last.open,
          },
        },
        duration: performance.now() - t0,
        source: 'eastmoney',
      }
    } catch (e) {
      return { ok: false, data: null, error: (e as Error).message, duration: performance.now() - t0, source: 'eastmoney' }
    }
  },
}
