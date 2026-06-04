// 多源调度：按顺序尝试 长桥 → 新浪 → 东方财富 → Yahoo Finance → 静态 fallback
import type { Quote, KLineData } from '../types'
import { getFallbackQuote } from '../data/fallbackQuotes'
import { longportProvider } from './sources/longportProvider'
import { eastmoneyProvider } from './sources/eastmoneyProvider'
import { sinaProvider } from './sources/sinaProvider'
import { yahooProvider } from './sources/yahooProvider'
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
  longport: { id: 'longport', name: '长桥 Longbridge', lastSuccess: null, lastError: null, attempts: 0, failures: 0, lastDuration: 0, configured: true },
  sina: { id: 'sina', name: '新浪财经', lastSuccess: null, lastError: null, attempts: 0, failures: 0, lastDuration: 0, configured: true },
  eastmoney: { id: 'eastmoney', name: '东方财富', lastSuccess: null, lastError: null, attempts: 0, failures: 0, lastDuration: 0, configured: true },
  yahoo: { id: 'yahoo', name: 'Yahoo Finance', lastSuccess: null, lastError: null, attempts: 0, failures: 0, lastDuration: 0, configured: true },
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
  return (preferred || ['longport', 'sina', 'eastmoney', 'yahoo']).filter(id => {
    const provider = providers.find(p => p.meta.id === id)
    return provider ? isProviderConfigured(provider) : false
  })
}

class SourceManager {
  private providers: QuoteProvider[] = [longportProvider, sinaProvider, eastmoneyProvider, yahooProvider]

  list(): SourceHealth[] {
    return Object.values(health)
  }

  refreshConfigured() {
    // No-op: all remaining providers are always configured
  }

  async fetchQuote(
    symbol: string,
    options: { signal?: AbortSignal; preferred?: string[] } = {}
  ): Promise<Quote> {
    this.refreshConfigured()
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
    this.refreshConfigured()
    const order = resolveOrder(this.providers, options.preferred)
    if (order.length === 0) return symbols.map(staticFallback)

    for (const id of order) {
      const provider = this.providers.find(p => p.meta.id === id)
      if (!provider?.fetchQuotes) continue
      const result = await provider.fetchQuotes(symbols, { signal: options.signal })
      recordHealth(result, id)
      if (result.ok && result.data && result.data.some(q => q.price != null)) {
        return result.data
      }
    }
    return symbols.map(staticFallback)
  }

  async fetchKLine(
    symbol: string,
    options: { range?: string; interval?: string; signal?: AbortSignal; preferred?: string[] } = {}
  ): Promise<KLineData | null> {
    this.refreshConfigured()
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
