// 新浪财经 Provider
// 实时报价: https://hq.sinajs.cn/list=gb_aapl,hk00700,sh600176
// 需要 Referer 头绕过 CORS，无需认证
// 支持市场：A 股(sh/sz)、港股(hk)、美股(gb_)

import type { Quote } from '../../types'
import { parseLongportSymbol } from '../symbolMap'
import { getFallbackQuote } from '../../data/fallbackQuotes'
import { APP_API_ROUTES } from '../../config/endpoints'
import type { QuoteProvider, ProviderMeta, ProviderResult } from './types'

const SINA_META: ProviderMeta = {
  id: 'sina',
  name: '新浪财经',
  region: 'CN/US/HK',
  needsAuth: false,
}

// 新浪不支持的市场
const UNSUPPORTED_MARKETS = new Set(['jp', 'kr', 'tw', 'eu', 'uk', 'in', 'au', 'my'])

// 长桥符号 → 新浪代码
function toSinaCode(symbol: string): string | null {
  const p = parseLongportSymbol(symbol)
  if (!p) return null
  if (UNSUPPORTED_MARKETS.has(p.market)) return null
  switch (p.market) {
    case 'us':
      return 'gb_' + p.code.toLowerCase()
    case 'sh':
    case 'sz':
      return p.market + p.code
    case 'hk':
      return 'hk' + p.code.padStart(5, '0')
    default:
      return null
  }
}

// 新浪代码 → 长桥符号（反向查找）
const sinaCodeCache = new Map<string, string>()

function cacheSinaCode(longportSymbol: string, sinaCode: string) {
  sinaCodeCache.set(sinaCode, longportSymbol)
}

function longportFromSinaCode(sinaCode: string): string {
  return sinaCodeCache.get(sinaCode) || sinaCode
}

interface SinaRaw {
  name: string
  open: number
  prevClose: number
  price: number
  high: number
  low: number
  volume: number
  turnover: number
}

function parseSinaLine(text: string): { sinaCode: string; raw: SinaRaw } | null {
  // 格式: var hq_str_gb_aapl="Apple Inc.,150.25,149.80,151.00,...";
  const match = text.match(/var hq_str_(\w+)="([^"]*)"/)
  if (!match) return null
  const sinaCode = match[1]
  const fields = match[2].split(',')
  if (fields.length < 8) return null
  if (sinaCode.startsWith('gb_')) {
    const price = parseFloat(fields[1]) || 0
    const changeAbs = parseFloat(fields[4]) || 0
    const prevClose = parseFloat(fields[26]) || (price && changeAbs ? price - changeAbs : 0)
    return {
      sinaCode,
      raw: {
        name: fields[0] || '',
        open: parseFloat(fields[5]) || 0,
        prevClose,
        price,
        high: parseFloat(fields[6]) || 0,
        low: parseFloat(fields[7]) || 0,
        volume: parseFloat(fields[10]) || 0,
        turnover: parseFloat(fields[31]) || 0,
      },
    }
  }
  return {
    sinaCode,
    raw: {
      name: fields[0] || '',
      open: parseFloat(fields[1]) || 0,
      prevClose: parseFloat(fields[2]) || 0,
      price: parseFloat(fields[3]) || 0,
      high: parseFloat(fields[4]) || 0,
      low: parseFloat(fields[5]) || 0,
      volume: parseFloat(fields[6]) || 0,
      turnover: parseFloat(fields[7]) || 0,
    },
  }
}

function sinaToQuote(symbol: string, raw: SinaRaw | null): Quote {
  if (!raw || raw.price <= 0) {
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
      source: 'sina',
    }
  }
  const price = raw.price
  const prevClose = raw.prevClose
  return {
    symbol,
    yahooSymbol: symbol,
    name: raw.name || parseLongportSymbol(symbol)?.code,
    price,
    prevClose: prevClose || null,
    change: price != null && prevClose != null && prevClose !== 0 ? (price - prevClose) / prevClose : null,
    changeAbs: price != null && prevClose != null ? price - prevClose : null,
    dayHigh: raw.high || null,
    dayLow: raw.low || null,
    dayOpen: raw.open || null,
    volume: raw.volume || null,
    currency: undefined,
    marketState: 'REGULAR',
    marketCap: null,
    fiftyTwoWeekHigh: null,
    fiftyTwoWeekLow: null,
    shortName: raw.name,
    longName: raw.name,
    regularMarketTime: null,
    updatedAt: Date.now(),
    source: 'sina',
  }
}

async function sinaFetchBatch(sinaCodes: string[], signal?: AbortSignal): Promise<string> {
  const url = `${APP_API_ROUTES.market}?source=sina&symbols=${encodeURIComponent(sinaCodes.join(','))}`
  const r = await fetch(url, { signal })
  if (!r.ok) throw new Error(`Sina ${r.status}`)
  const json = await r.json() as { text?: string; error?: string }
  if (!json.text) throw new Error(json.error || 'empty response')
  return json.text
}

export const sinaProvider: QuoteProvider = {
  meta: SINA_META,
  isConfigured() {
    return true
  },

  async fetchQuote(symbol: string, options: { signal?: AbortSignal } = {}): Promise<ProviderResult<Quote>> {
    const t0 = performance.now()
    const sinaCode = toSinaCode(symbol)
    if (!sinaCode) {
      return { ok: false, data: sinaToQuote(symbol, null), error: 'unsupported market', duration: 0, source: 'sina' }
    }
    cacheSinaCode(symbol, sinaCode)
    try {
      const text = await sinaFetchBatch([sinaCode], options.signal)
      const parsed = parseSinaLine(text)
      const ok = parsed != null && parsed.raw.price > 0
      return { ok, data: sinaToQuote(symbol, ok ? parsed.raw : null), duration: performance.now() - t0, source: 'sina' }
    } catch (e) {
      return { ok: false, data: sinaToQuote(symbol, null), error: (e as Error).message, duration: performance.now() - t0, source: 'sina' }
    }
  },

  async fetchQuotes(symbols: string[], options: { signal?: AbortSignal } = {}): Promise<ProviderResult<Quote[]>> {
    const t0 = performance.now()
    const codeMap = new Map<string, string>() // sinaCode → symbol
    const validSymbols: string[] = []
    const sinaCodes: string[] = []

    for (const sym of symbols) {
      const sc = toSinaCode(sym)
      if (sc) {
        codeMap.set(sc, sym)
        validSymbols.push(sym)
        sinaCodes.push(sc)
        cacheSinaCode(sym, sc)
      }
    }

    if (sinaCodes.length === 0) {
      return { ok: false, data: symbols.map(s => sinaToQuote(s, null)), error: 'no supported symbols', duration: 0, source: 'sina' }
    }

    try {
      // 新浪单次最多 ~800 个代码
      const out: Quote[] = []
      const unsupported = symbols.filter(s => !toSinaCode(s))
      for (const s of unsupported) {
        out.push(sinaToQuote(s, null))
      }

      for (let i = 0; i < sinaCodes.length; i += 800) {
        const batch = sinaCodes.slice(i, i + 800)
        const text = await sinaFetchBatch(batch, options.signal)
        const lines = text.split('\n').filter(l => l.trim())
        const parsedMap = new Map<string, SinaRaw>()
        for (const line of lines) {
          const p = parseSinaLine(line)
          if (p) parsedMap.set(p.sinaCode, p.raw)
        }
        for (const sc of batch) {
          const sym = codeMap.get(sc)!
          const raw = parsedMap.get(sc) || null
          out.push(sinaToQuote(sym, raw))
        }
      }

      return { ok: out.some(q => q.price != null), data: out, duration: performance.now() - t0, source: 'sina' }
    } catch (e) {
      return { ok: false, data: symbols.map(s => sinaToQuote(s, null)), error: (e as Error).message, duration: performance.now() - t0, source: 'sina' }
    }
  },

  // K 线暂不实现
  async fetchKLine(): Promise<ProviderResult<null>> {
    return { ok: false, data: null, error: 'not implemented', duration: 0, source: 'sina' }
  },
}
