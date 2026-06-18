// 多源调度：按顺序尝试 东方财富 → 新浪 → 长桥 → 长桥CN → 静态 fallback
import type { Quote, KLineData } from '../types'
import { getFallbackQuote } from '../data/fallbackQuotes'
import { longportProvider } from './sources/longportProvider'
import { longportCnProvider } from './sources/longportCnProvider'
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
  'longport-cn': { id: 'longport-cn', name: '长桥 Longbridge CN', lastSuccess: null, lastError: null, attempts: 0, failures: 0, lastDuration: 0, configured: false },
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
  // 默认优先级：东方财富 → 长桥中国 → 新浪 → 长桥国际
  const defaultOrder = ['eastmoney', 'longport-cn', 'sina', 'longport']
  return (preferred || defaultOrder).filter(id => {
    const provider = providers.find(p => p.meta.id === id)
    return provider ? isProviderConfigured(provider) : false
  })
}

class SourceManager {
  private providers: QuoteProvider[] = [eastmoneyProvider, sinaProvider, longportProvider, longportCnProvider]

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

    const results = await Promise.allSettled(
      order.map(async (id) => {
        const provider = this.providers.find(p => p.meta.id === id)
        if (!provider?.fetchQuote) return null
        const result = await provider.fetchQuote(symbol, { signal: options.signal })
        recordHealth(result, id)
        if (result.ok && result.data && result.data.price != null) {
          return result.data
        }
        return null
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        return r.value
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

    const results = await Promise.allSettled(
      order.map(async (id) => {
        const provider = this.providers.find(p => p.meta.id === id)
        if (!provider?.fetchQuotes) return { id, data: [] as Quote[] }
        const result = await provider.fetchQuotes(symbols, { signal: options.signal })
        recordHealth(result, id)
        return { id, data: result.data || [] }
      })
    )

    const bySymbol = new Map<string, Quote>()
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      for (const q of r.value.data) {
        if (q.price == null) continue
        if (!bySymbol.has(q.symbol)) {
          bySymbol.set(q.symbol, q)
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

    const results = await Promise.allSettled(
      order.map(async (id) => {
        const provider = this.providers.find(p => p.meta.id === id)
        if (!provider?.fetchKLine) return null
        const result = await provider.fetchKLine(symbol, {
          range: options.range,
          interval: options.interval,
          signal: options.signal,
        })
        recordHealth(result, id)
        if (result.ok && result.data && result.data.points.length > 0) {
          return result.data
        }
        return null
      })
    )

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        return r.value
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
