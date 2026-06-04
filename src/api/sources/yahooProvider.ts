import type { Quote, KLineData, KLinePoint } from '../../types'
import { getFallbackQuote } from '../../data/fallbackQuotes'
import { parseLongportSymbol, toYahooSymbol } from '../symbolMap'
import type { ProviderMeta, ProviderResult, QuoteProvider } from './types'

const YAHOO_META: ProviderMeta = {
  id: 'yahoo',
  name: 'Yahoo Finance',
  region: 'global',
  needsAuth: false,
}

async function fetchYahooChart(symbol: string, range = '1d', interval = '1d', signal?: AbortSignal): Promise<any> {
  const params = new URLSearchParams({
    symbol: toYahooSymbol(symbol),
    range,
    interval,
  })
  const response = await fetch(`/api/market/yahoo?${params.toString()}`, { signal })
  const json = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(json?.error || `Yahoo ${response.status}`)
  }
  return json
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
      change: price != null && prevClose != null && prevClose !== 0 ? (price - prevClose) / prevClose : null,
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
        ? (typeof meta.regularMarketTime === 'number'
            ? meta.regularMarketTime
            : Math.floor(new Date(meta.regularMarketTime).getTime() / 1000))
        : null,
      updatedAt: Date.now(),
      source: 'yahoo',
    }
  } catch {
    return emptyQuote(symbol, 'yahoo')
  }
}

export const yahooProvider: QuoteProvider = {
  meta: YAHOO_META,

  async fetchQuote(symbol: string, options: { signal?: AbortSignal } = {}): Promise<ProviderResult<Quote>> {
    const t0 = performance.now()
    try {
      const json = await fetchYahooChart(symbol, '1d', '1d', options.signal)
      const quote = yahooChartToQuote(symbol, json)
      return { ok: quote.price != null, data: quote, duration: performance.now() - t0, source: 'yahoo' }
    } catch (e) {
      return { ok: false, data: emptyQuote(symbol, 'yahoo'), error: (e as Error).message, duration: performance.now() - t0, source: 'yahoo' }
    }
  },

  async fetchQuotes(symbols: string[], options: { signal?: AbortSignal } = {}): Promise<ProviderResult<Quote[]>> {
    const t0 = performance.now()
    try {
      const results = await Promise.all(symbols.map(s => fetchYahooChart(s, '1d', '1d', options.signal)))
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
      const json = await fetchYahooChart(symbol, range, interval, options.signal)
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
