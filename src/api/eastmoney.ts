// 东方财富 数据源
// 全市场 CORS 友好、无需认证
// 实时报价: /api/qt/stock/get?secid=116.00700&fields=...
// K 线:     /api/qt/stock/kline/get?secid=1.600176&klt=101

import { APP_API_ROUTES } from '../config/endpoints'
import { parseLongportSymbol } from './symbolMap'

// 东方财富发送 CORS 头 (access-control-allow-origin: *)，浏览器可直连
const EM_PROXY = `${APP_API_ROUTES.market}?source=eastmoney`

// 报价字段
const QUOTE_FIELDS = 'f43,f44,f45,f46,f47,f48,f50,f57,f58,f60,f107,f162,f167,f168,f169,f170,f117'
const resolvedSecidCache = new Map<string, string>()

interface EMQuoteData {
  f43?: number  // 最新价（整数，需 /100）
  f44?: number  // 最高
  f45?: number  // 最低
  f46?: number  // 今开
  f47?: number  // 成交量（手）
  f48?: number  // 成交额（元）
  f50?: number  // 量比
  f57?: string  // 代码
  f58?: string  // 名称
  f60?: number  // 昨收
  f107?: number // 市场
  f162?: number // 市盈
  f167?: number // 市净
  f168?: number // 换手率
  f169?: number // 涨跌额
  f170?: number // 涨跌幅
  f117?: number // 总市值
}

function normalizeUSEastmoneyCode(code: string): string {
  return code.toUpperCase().replace(/[.-]/g, '_')
}

function eastmoneySecidCandidates(symbol: string): string[] {
  const p = parseLongportSymbol(symbol)
  if (!p) return []
  if (p.market !== 'us') return [p.eastmoneySecid]

  const cached = resolvedSecidCache.get(symbol)
  if (cached) return [cached]

  const codes = [...new Set([p.code.toUpperCase(), normalizeUSEastmoneyCode(p.code)])]
  const prefixes = ['105', '106', '107']
  return codes.flatMap(code => prefixes.map(prefix => `${prefix}.${code}`))
}

async function emFetchQuote(symbols: string[], signal?: AbortSignal): Promise<Map<string, EMQuoteData>> {
  const out = new Map<string, EMQuoteData>()
  // 使用 stock/get 端点逐个获取（比 ulist.np 更可靠）
  const tasks = symbols.map(async (sym) => {
    const candidates = eastmoneySecidCandidates(sym)
    if (!candidates.length) return
    for (const secid of candidates) {
      const params = new URLSearchParams({
        mode: 'quote',
        secid,
        fields: QUOTE_FIELDS,
      })
      const url = `${EM_PROXY}&${params.toString()}`
      try {
        const r = await fetch(url, { signal })
        if (!r.ok) continue
        const json = await r.json() as { data?: EMQuoteData }
        if (json.data && json.data.f43 != null) {
          resolvedSecidCache.set(sym, secid)
          out.set(sym, json.data)
          return
        }
      } catch {
        // Try the next candidate. EastMoney has different US prefixes for NASDAQ, NYSE and ETF symbols.
      }
    }
  })
  await Promise.all(tasks)
  return out
}

interface KLineRow {
  time: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  turnover: number
  amplitude: number
  changePct: number
  change: number
  turnoverRate: number
}

async function emFetchKLine(symbol: string, options: { klt?: number; count?: number; fqt?: number; signal?: AbortSignal } = {}): Promise<KLineRow[]> {
  const candidates = eastmoneySecidCandidates(symbol)
  if (!candidates.length) return []
  const klt = options.klt ?? 101  // 101=日, 102=周, 103=月, 5/15/30/60=分钟
  const fqt = options.fqt ?? 1    // 0=不复权, 1=前复权, 2=后复权
  const count = Math.min(options.count || 200, 1000)

  for (const secid of candidates) {
    const params = new URLSearchParams({
      mode: 'kline',
      secid,
      fields1: 'f1,f2,f3,f4,f5,f6',
      fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
      klt: String(klt),
      fqt: String(fqt),
      beg: '0',
      end: '20500101',
      lmt: String(count),
    })
    const url = `${EM_PROXY}&${params.toString()}`
    try {
      const r = await fetch(url, { signal: options.signal })
      if (!r.ok) continue
      const json = (await r.json()) as { data?: { klines?: string[] } }
      if (!json.data?.klines?.length) continue
      resolvedSecidCache.set(symbol, secid)
      return json.data.klines.slice(-count).map(line => {
        const parts = line.split(',')
        return {
          time: parts[0],
          open: parseFloat(parts[1]),
          close: parseFloat(parts[2]),
          high: parseFloat(parts[3]),
          low: parseFloat(parts[4]),
          volume: parseFloat(parts[5]),
          turnover: parseFloat(parts[6]),
          amplitude: parseFloat(parts[7]),
          changePct: parseFloat(parts[8]),
          change: parseFloat(parts[9]),
          turnoverRate: parseFloat(parts[10] || '0'),
        }
      })
    } catch {
      // Try the next candidate.
    }
  }
  return []
}

export const eastmoney = {
  fetchQuote: emFetchQuote,
  fetchKLine: emFetchKLine,
  fields: { QUOTE_FIELDS },
}
