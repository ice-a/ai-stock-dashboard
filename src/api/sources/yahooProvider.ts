// Yahoo Finance Provider
// 通过 allorigins CORS 代理访问 Yahoo Finance v8 API
// 无需认证，覆盖全球主要市场
import type { Quote, KLineData, KLinePoint } from '../../types'
import { parseLongportSymbol, toYahooSymbol } from '../symbolMap'
import { getFallbackQuote } from '../../data/fallbackQuotes'
import type { QuoteProvider, ProviderMeta, ProviderResult } from './types'

const YAHOO_META: ProviderMeta = {
  id: 'yahoo',
  name: 'Yahoo Finance',
  region: 'global',
  needsAuth: false,
}

// CORS 代理列表（按优先级）
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
]

function yahooQuoteUrl(symbol: string): string {
  const ysym = toYahooSymbol(symbol)
  return `https://query1.finance.yahoo.com/v8/finance/chart/${ysym}?interval=1d&range=1d`
}

function yahooChartUrl(symbol: string, range: string = '1y', interval: string = '1d'): string {
  const ysym = toYahooSymbol(symbol)
  return `https://query1.finance.yahoo.com/v8/finance/chart/${ysym}?interval=${interval}&range=${range}`
}

async function fetchWithProxy(url: string, signal?: AbortSignal): Promise<any> {
  const errors: string[] = []
  for (const proxy of CORS_PROXIES) {
    try {
      const r = await fetch(proxy + encodeURIComponent(url), {
        signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
      })
      if (!r.ok) {
        errors.push(`${proxy}: HTTP ${r.status}`)
        continue
      }
      const json = await r.json()
      // allorigins 包装在 contents 里
      if (json.contents) {
        return JSON.parse(json.contents)
      }
      return json
    } catch (e) {
      errors.push(`${proxy}: ${(e as Error).message}`)
    }
  }
  throw new Error(`Yahoo fetch failed: ${errors.join('; ')}`)
}

function yahooChartToQuote(symbol: string, json: any): Quote {
  try {
    const result = json?.chart?.result?.[0]
    if (!result) return emptyQuote(symbol, 'yahoo')
    const meta = result.meta
    const price = meta.regularMarketPrice ?? null
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null
    return {
      symbol,
      yahooSymbol: toYahooSymbol(symbol),
      name: meta.shortName || meta.symbol || parseLongportSymbol(symbol)?.code,
      price,
      prevClose,
      change: price != null && prevClose != null && prevClose !== 0
        ? (price - prevClose) / prevClose
        : null,
      changeAbs: price != null && prevClose != null ? price - prevClose : null,
      dayHigh: null,
      dayLow: null,
      dayOpen: null,
      volume: meta.regularMarketVolume ?? null,
      currency: meta.currency || undefined,
      marketState: meta.tradingPeriods ? 'REGULAR' : 'CLOSED',
      marketCap: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      shortName: meta.shortName || undefined,
      longName: meta.longName || undefined,
      regularMarketTime: meta.regularMarketTime
        ? (typeof meta.regularMarketTime === 'number' ? meta.regularMarketTime : Math.floor(new Date(meta.regularMarketTime).getTime() / 1000))
        : null,
      updatedAt: Date.now(),
      source: 'yahoo',
    }
  } catch {
    return emptyQuote(symbol, 'yahoo')
  }
}

function emptyQuote(symbol: string, source: Quote['source']): Quote {
  const fb = getFallbackQuote(symbol)
  return {
    symbol,
    yahooSymbol: toYahooSymbol(symbol),
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

export const yahooProvider: QuoteProvider = {
  meta: YAHOO_META,

  async fetchQuote(symbol: string, options: { signal?: AbortSignal } = {}): Promise<ProviderResult<Quote>> {
    const t0 = performance.now()
    try {
      const json = await fetchWithProxy(yahooQuoteUrl(symbol), options.signal)
      const quote = yahooChartToQuote(symbol, json)
      return { ok: quote.price != null, data: quote, duration: performance.now() - t0, source: 'yahoo' }
    } catch (e) {
      return { ok: false, data: emptyQuote(symbol, 'yahoo'), error: (e as Error).message, duration: performance.now() - t0, source: 'yahoo' }
    }
  },

  async fetchQuotes(symbols: string[], options: { signal?: AbortSignal } = {}): Promise<ProviderResult<Quote[]>> {
    // Yahoo v8 不支持批量，逐个获取
    const t0 = performance.now()
    try {
      const results = await Promise.all(symbols.map(s => fetchWithProxy(yahooQuoteUrl(s), options.signal)))
      const out = symbols.map((s, i) => yahooChartToQuote(s, results[i]))
      return { ok: out.some(q => q.price != null), data: out, duration: performance.now() - t0, source: 'yahoo' }
    } catch (e) {
      return { ok: false, data: symbols.map(s => emptyQuote(s, 'yahoo')), error: (e as Error).message, duration: performance.now() - t0, source: 'yahoo' }
    }
  },

  async fetchKLine(symbol: string, options: { range?: string; interval?: string; signal?: AbortSignal } = {}): Promise<ProviderResult<KLineData | null>> {
    const t0 = performance.now()
    try {
      const interval = options.interval || '1d'
      const range = options.range || '1y'
      const json = await fetchWithProxy(yahooChartUrl(symbol, range, interval), options.signal)
      const result = json?.chart?.result?.[0]
      if (!result?.timestamp?.length) {
        return { ok: false, data: null, error: 'no data', duration: performance.now() - t0, source: 'yahoo' }
      }
      const timestamps: number[] = result.timestamp
      const quotes = result.indicators?.quote?.[0]
      if (!quotes) {
        return { ok: false, data: null, error: 'no quote data', duration: performance.now() - t0, source: 'yahoo' }
      }
      const points: KLinePoint[] = []
      for (let i = 0; i < timestamps.length; i++) {
        if (quotes.close[i] == null) continue
        points.push({
          time: timestamps[i],
          open: quotes.open[i],
          high: quotes.high[i],
          low: quotes.low[i],
          close: quotes.close[i],
          volume: quotes.volume[i] || 0,
        })
      }
      if (points.length === 0) {
        return { ok: false, data: null, error: 'no valid points', duration: performance.now() - t0, source: 'yahoo' }
      }
      const last = points[points.length - 1]
      return {
        ok: true,
        data: {
          symbol,
          range,
          interval,
          points,
          meta: {
            currency: result.meta?.currency,
            regularMarketPrice: last.close,
            previousClose: points.length > 1 ? points[points.length - 2].close : last.open,
          },
        },
        duration: performance.now() - t0,
        source: 'yahoo',
      }
    } catch (e) {
      return { ok: false, data: null, error: (e as Error).message, duration: performance.now() - t0, source: 'yahoo' }
    }
  },
}
