// 长桥 CN Provider - 使用长桥中国区接口
import type { Quote, KLineData, KLinePoint } from '../../types'
import { toLongportSymbol, parseLongportSymbol } from '../symbolMap'
import { getFallbackQuote } from '../../data/fallbackQuotes'
import type { QuoteProvider, ProviderMeta, ProviderResult } from './types'

const LP_CN_META: ProviderMeta = {
  id: 'longport-cn',
  name: '长桥 Longbridge CN',
  region: 'cn',
  needsAuth: true,
}

// 长桥 CN API 配置
const LP_CN_CONFIG = {
  baseUrl: 'https://openapi.longportapp.com',
  // 使用环境变量或默认值
  getHeaders() {
    const appKey = localStorage.getItem('lp_cn_app_key') || ''
    const appSecret = localStorage.getItem('lp_cn_app_secret') || ''
    const accessToken = localStorage.getItem('lp_cn_access_token') || ''
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'X-LB-App-Key': appKey,
      'X-LB-App-Secret': appSecret,
    }
  }
}

let configured = false
let statusLoaded = false

function lpQuoteToQuote(symbol: string, raw: any): Quote {
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
  
  const price = parseFloat(raw.last_done || raw.lastDone)
  const prevClose = parseFloat(raw.prev_close || raw.prevClose)
  
  return {
    symbol,
    yahooSymbol: toLongportSymbol(symbol),
    name: raw.symbol_name || raw.symbolName || parseLongportSymbol(symbol)?.code,
    price: isNaN(price) ? null : price,
    prevClose: isNaN(prevClose) ? null : prevClose,
    change: !isNaN(price) && !isNaN(prevClose) && prevClose !== 0 ? (price - prevClose) / prevClose : null,
    changeAbs: !isNaN(price) && !isNaN(prevClose) ? price - prevClose : null,
    dayHigh: isNaN(parseFloat(raw.high)) ? null : parseFloat(raw.high),
    dayLow: isNaN(parseFloat(raw.low)) ? null : parseFloat(raw.low),
    dayOpen: isNaN(parseFloat(raw.open)) ? null : parseFloat(raw.open),
    volume: raw.volume ?? null,
    currency: undefined,
    marketState: raw.trade_status === 1 ? 'REGULAR' : 'CLOSED',
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

function klinePointFromRaw(raw: any): KLinePoint {
  return {
    time: raw.timestamp ? Math.floor(raw.timestamp / 1000) : 0,
    open: parseFloat(raw.open) || 0,
    high: parseFloat(raw.high) || 0,
    low: parseFloat(raw.low) || 0,
    close: parseFloat(raw.close) || 0,
    volume: raw.volume || 0,
  }
}

export const longportCnProvider: QuoteProvider = {
  meta: LP_CN_META,
  
  isConfigured() {
    return configured
  },

  async refreshConfigured(signal?: AbortSignal) {
    if (statusLoaded) return
    
    // 检查是否有配置
    const appKey = localStorage.getItem('lp_cn_app_key')
    const appSecret = localStorage.getItem('lp_cn_app_secret')
    const accessToken = localStorage.getItem('lp_cn_access_token')
    
    configured = !!(appKey && appSecret && accessToken)
    statusLoaded = true
  },

  async fetchQuote(symbol: string, options: { signal?: AbortSignal } = {}): Promise<ProviderResult<Quote>> {
    const t0 = performance.now()
    
    try {
      if (!configured) {
        throw new Error('LongPort CN not configured')
      }
      
      const longportSymbol = toLongportSymbol(symbol)
      const url = `${LP_CN_CONFIG.baseUrl}/quote/v1/quote?symbol=${encodeURIComponent(longportSymbol)}`
      
      const response = await fetch(url, {
        headers: LP_CN_CONFIG.getHeaders(),
        signal: options.signal,
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const json = await response.json()
      const data = json.data?.[0] || json.data
      
      if (!data) {
        throw new Error('No data returned')
      }
      
      const quote = lpQuoteToQuote(symbol, data)
      
      return {
        ok: true,
        data: quote,
        duration: performance.now() - t0,
        source: 'longport-cn',
      }
    } catch (e) {
      return {
        ok: false,
        error: (e as Error).message,
        duration: performance.now() - t0,
        source: 'longport-cn',
      }
    }
  },

  async fetchQuotes(symbols: string[], options: { signal?: AbortSignal } = {}): Promise<ProviderResult<Quote[]>> {
    const t0 = performance.now()
    
    try {
      if (!configured) {
        throw new Error('LongPort CN not configured')
      }
      
      const longportSymbols = symbols.map(toLongportSymbol).join(',')
      const url = `${LP_CN_CONFIG.baseUrl}/quote/v1/quote?symbol=${encodeURIComponent(longportSymbols)}`
      
      const response = await fetch(url, {
        headers: LP_CN_CONFIG.getHeaders(),
        signal: options.signal,
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const json = await response.json()
      const data = json.data || []
      
      const quotes = symbols.map((symbol, i) => {
        const raw = data[i] || null
        return lpQuoteToQuote(symbol, raw)
      })
      
      return {
        ok: true,
        data: quotes,
        duration: performance.now() - t0,
        source: 'longport-cn',
      }
    } catch (e) {
      return {
        ok: false,
        error: (e as Error).message,
        duration: performance.now() - t0,
        source: 'longport-cn',
      }
    }
  },

  async fetchKLine(symbol: string, options: { range?: string; interval?: string; signal?: AbortSignal } = {}): Promise<ProviderResult<KLineData>> {
    const t0 = performance.now()
    
    try {
      if (!configured) {
        throw new Error('LongPort CN not configured')
      }
      
      const longportSymbol = toLongportSymbol(symbol)
      
      // 转换时间周期
      let period = 'day'
      let count = 200
      
      if (options.interval === '1wk' || options.range === '1y') {
        period = 'week'
        count = 52
      } else if (options.interval === '1mo' || options.range === '5y') {
        period = 'month'
        count = 60
      }
      
      const url = `${LP_CN_CONFIG.baseUrl}/quote/v1/candlesticks?symbol=${encodeURIComponent(longportSymbol)}&period=${period}&count=${count}`
      
      const response = await fetch(url, {
        headers: LP_CN_CONFIG.getHeaders(),
        signal: options.signal,
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const json = await response.json()
      const data = json.data?.candlesticks || json.data || []
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No K-line data')
      }
      
      const points = data.map(klinePointFromRaw).filter(p => p.time > 0)
      
      return {
        ok: true,
        data: {
          symbol,
          range: options.range || '1y',
          interval: options.interval || '1d',
          points,
          meta: {
            currency: undefined,
            exchangeName: undefined,
          },
        },
        duration: performance.now() - t0,
        source: 'longport-cn',
      }
    } catch (e) {
      return {
        ok: false,
        error: (e as Error).message,
        duration: performance.now() - t0,
        source: 'longport-cn',
      }
    }
  },
}
