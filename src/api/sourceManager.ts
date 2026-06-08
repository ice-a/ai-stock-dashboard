// 多源调度：按顺序尝试 东方财富 → 新浪 → 长桥 → 静态 fallback
import type { Quote, KLineData } from '../types'
import { getFallbackQuote } from '../data/fallbackQuotes'
import { longportProvider } from './sources/longportProvider'
import { eastmoneyProvider } from './sources/eastmoneyProvider'
import { sinaProvider } from './sources/sinaProvider'
import type { QuoteProvider, ProviderResult } from './sources/types'

export type SourceHealth = {
  id: string
  name: string
  lastSuccess: number | null
  lastError: string | null
  attempts: number
  failures: number
  lastDuration: number
  configured: boolean
}

const health: Record<string, SourceHealth> = {
  longport: { id: 'longport', name: '长桥 Longbridge', lastSuccess: null, lastError: null, attempts: 0, failures: 0, lastDuration: 0, configured: false },
  sina: { id: 'sina', name: '新浪财经', lastSuccess: null, lastError: null, attempts: 0, failures: 0, lastDuration: 0, configured: true },
  eastmoney: { id: 'eastmoney', name: '东方财富', lastSuccess: null, lastError: null, attempts: 0, failures: 0, lastDuration: 0, configured: true },
  static: { id: 'static', name: '静态快照', lastSuccess: Date.now(), lastError: null, attempts: 0, failures: 0, lastDuration: 0, configured: true },
}

function recordSuccess(id: string, duration: number) {
  const h = health[id]
  if (!h) return
  h.lastSuccess = Date.now()
  h.lastDuration = duration
  h.lastError = null
  h.attempts++
}

function recordFailure(id: string, err: string) {
  const h = health[id]
  if (!h) return
  h.lastError = err
  h.attempts++
  h.failures++
}

function staticFallback(symbol: string): Quote {
  const fb = getFallbackQuote(symbol)
  return {
    symbol,
    yahooSymbol: symbol,
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
    source: 'fallback',
  }
}

function isProviderConfigured(p: QuoteProvider): boolean {
  return p.isConfigured ? p.isConfigured() : true
}

function resolveOrder(providers: QuoteProvider[], preferred?: string[]): string[] {
  return (preferred || ['eastmoney', 'sina', 'longport']).filter(id => {
    const provider = providers.find(p => p.meta.id === id)
    return provider ? isProviderConfigured(provider) : false
  })
}

class SourceManager {
  private providers: QuoteProvider[] = [eastmoneyProvider, sinaProvider, longportProvider]

  list(): SourceHealth[] {
    return Object.values(health)
  }

  async refreshConfigured(signal?: AbortSignal) {
    await Promise.all(this.providers.map(async (provider) => {
      try {
        await provider.refreshConfigured?.(signal)
        const h = health[provider.meta.id]
        if (h) {
          h.configured = isProviderConfigured(provider)
          if (h.configured && h.lastError?.includes('credentials are not configured')) h.lastError = null
        }
      } catch (e) {
        const h = health[provider.meta.id]
        if (h) {
          h.configured = false
          h.lastError = (e as Error).message
        }
      }
    }))
  }

  async fetchQuote(
    symbol: string,
    options: { signal?: AbortSignal; preferred?: string[] } = {}
  ): Promise<Quote> {
    await this.refreshConfigured(options.signal)
    const order = resolveOrder(this.providers, options.preferred)
    if (order.length === 0) return staticFallback(symbol)

    for (const id of order) {
      const provider = this.providers.find(p => p.meta.id === id)
      if (!provider?.fetchQuote) continue
      const result = await provider.fetchQuote(symbol, { signal: options.signal })
      recordHealth(result, id)
      if (result.ok && result.data && result.data.price != null) {
        return result.data
      }
    }
    return staticFallback(symbol)
  }

  async fetchQuotes(
    symbols: string[],
    options: { signal?: AbortSignal; preferred?: string[] } = {}
  ): Promise<Quote[]> {
    await this.refreshConfigured(options.signal)
    const order = resolveOrder(this.providers, options.preferred)
    if (order.length === 0) return symbols.map(staticFallback)

    const bySymbol = new Map<string, Quote>()
    const missing = new Set(symbols)

    for (const id of order) {
      const provider = this.providers.find(p => p.meta.id === id)
      if (!provider?.fetchQuotes) continue
      const pendingSymbols = symbols.filter(symbol => missing.has(symbol))
      if (pendingSymbols.length === 0) break
      const result = await provider.fetchQuotes(pendingSymbols, { signal: options.signal })
      recordHealth(result, id)
      if (result.data) {
        for (const q of result.data) {
          if (q.price == null) continue
          bySymbol.set(q.symbol, q)
          missing.delete(q.symbol)
        }
      }
    }

    return symbols.map(symbol => bySymbol.get(symbol) || staticFallback(symbol))
  }

  async fetchKLine(
    symbol: string,
    options: { range?: string; interval?: string; signal?: AbortSignal; preferred?: string[] } = {}
  ): Promise<KLineData | null> {
    await this.refreshConfigured(options.signal)
    const order = resolveOrder(this.providers, options.preferred)
    for (const id of order) {
      const provider = this.providers.find(p => p.meta.id === id)
      if (!provider?.fetchKLine) continue
      const result = await provider.fetchKLine(symbol, {
        range: options.range,
        interval: options.interval,
        signal: options.signal,
      })
      recordHealth(result, id)
      if (result.ok && result.data && result.data.points.length > 0) {
        return result.data
      }
    }
    return null
  }
}

function recordHealth(result: ProviderResult<any>, id: string) {
  if (result.ok) recordSuccess(id, result.duration)
  else recordFailure(id, result.error || 'unknown')
}

export const sourceManager = new SourceManager()
export { health as sourceHealth }
