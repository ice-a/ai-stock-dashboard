// 个股详情数据：公告、新闻、ETF 线索
// 默认只加载可验证的数据源；AI 投资建议由用户手动触发。

import { parseLongportSymbol } from './symbolMap'
import type { StockNews, StockAnnouncement, ETFHolding, Market } from '../sectors/types'
import { APP_API_ROUTES } from '../config/endpoints'
import { useAIStore } from '../stores/ai'

// ─── 东方财富：公告 ───

const EM_NOTICE_URL = `${APP_API_ROUTES.market}?source=eastmoney&mode=announcements`

function detectMarketCode(symbol: string): string {
  const p = parseLongportSymbol(symbol)
  if (!p) return ''
  if (p.market === 'sh' || p.market === 'sz') return p.code
  return ''
}

export async function fetchAnnouncements(symbol: string, pageSize = 10): Promise<StockAnnouncement[]> {
  const code = detectMarketCode(symbol)
  if (!code) return [] // 港美股暂无免费 API

  try {
    const url = `${EM_NOTICE_URL}&page_size=${pageSize}&page_index=1&ann_type=SHA,SZA&stock_list=${code}`
    const r = await fetch(url)
    if (!r.ok) return []
    const json = await r.json() as {
      data?: {
        list?: Array<{
          art_code: string
          title: string
          notice_date: string
          columns?: Array<{ column_name: string }>
        }>
      }
    }
    return (json.data?.list || []).map(item => ({
      title: item.title,
      time: item.notice_date?.slice(0, 10) || '',
      url: `https://data.eastmoney.com/notices/detail/${code}/${item.art_code}.html`,
      type: item.columns?.[0]?.column_name || '',
      generatedByAI: false,
    }))
  } catch {
    return []
  }
}

// ─── 东方财富：新闻 ───

const EM_SEARCH_URL = `${APP_API_ROUTES.market}?source=eastmoney&mode=news`

function uniqueKeywords(values: Array<string | undefined>): string[] {
  return [...new Set(values.map(v => (v || '').trim()).filter(Boolean))]
}

function stripHtml(text: string | undefined): string {
  return (text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

export async function fetchNews(symbol: string, name?: string, pageSize = 10): Promise<StockNews[]> {
  const parsed = parseLongportSymbol(symbol)
  const keywords = uniqueKeywords([detectMarketCode(symbol), parsed?.code, name, symbol])
  if (!keywords.length) return []

  try {
    const seen = new Set<string>()
    const out: StockNews[] = []

    for (const keyword of keywords) {
      const param = JSON.stringify({
        uid: '',
        keyword,
        type: ['cmsArticleWebOld'],
        client: 'web',
        client_type: 'web',
        client_version: 'curr',
        param: {
          cmsArticleWebOld: {
            searchScope: 'default',
            sort: 'default',
            pageIndex: 1,
            pageSize,
            preTag: '',
            postTag: '',
          },
        },
      })
      const cbName = `cb_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const url = `${EM_SEARCH_URL}&cb=${cbName}&param=${encodeURIComponent(param)}`

      const r = await fetch(url)
      if (!r.ok) continue
      const json = await r.json() as {
        result?: {
          cmsArticleWebOld?: Array<{
            title: string
            date: string
            url: string
            mediaName?: string
            content?: string
          }>
        }
      }

      for (const item of json.result?.cmsArticleWebOld || []) {
        const title = stripHtml(item.title)
        const url = item.url || ''
        const key = url || title
        if (!title || seen.has(key)) continue
        seen.add(key)
        out.push({
          title,
          source: item.mediaName || '东方财富',
          time: item.date?.slice(0, 10) || '',
          url,
          summary: stripHtml(item.content).slice(0, 120),
          generatedByAI: false,
        })
        if (out.length >= pageSize) return out
      }
    }
    return out
  } catch {
    return []
  }
}

export interface AIAdvice {
  rating: string
  targetPrice: number | null
  currentPrice: number | null
  timeframe: string
  confidence: string
  summary: string
  reasons: string[]
  risks: string[]
  klineAnalysis: string
  catalysts: string[]
}

// ─── 独立：AI 投资建议（含 K 线数据） ───

function extractJsonObject(text: string): string | null {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  const start = cleaned.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return cleaned.slice(start, i + 1)
    }
  }
  return null
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean).slice(0, 6)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function normalizeAdvice(value: Partial<AIAdvice>, currentPrice: number | null): AIAdvice {
  return {
    rating: value.rating || '观望',
    targetPrice: typeof value.targetPrice === 'number' ? value.targetPrice : null,
    currentPrice: typeof value.currentPrice === 'number' ? value.currentPrice : currentPrice,
    timeframe: value.timeframe || '3-6个月',
    confidence: value.confidence || '中',
    summary: value.summary || 'AI 未返回核心结论。',
    reasons: asStringArray(value.reasons),
    risks: asStringArray(value.risks),
    klineAnalysis: value.klineAnalysis || '',
    catalysts: asStringArray(value.catalysts),
  }
}

export async function fetchStockAdviceAI(
  symbol: string,
  name: string,
  market: Market,
  klinePoints: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>,
): Promise<AIAdvice | null> {
  const ai = useAIStore()
  if (!ai.isConfigured) {
    throw new Error('请先在设置页配置 AI Base URL、API Key 和模型。')
  }

  // 构建 K 线摘要
  let klineSummary = ''
  if (klinePoints.length > 0) {
    const recent = klinePoints.slice(-30)
    const closes = recent.map(p => p.close)
    const volumes = recent.map(p => p.volume)
    const latest = recent[recent.length - 1]
    const first = recent[0]
    const avg = closes.reduce((a, b) => a + b, 0) / closes.length
    const max = Math.max(...closes)
    const min = Math.min(...closes)
    const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length
    const change30d = ((latest.close - first.close) / first.close * 100).toFixed(2)

    klineSummary = `近30日K线数据:
- 最新收盘: ${latest.close}, 开盘: ${latest.open}, 最高: ${latest.high}, 最低: ${latest.low}
- 30日涨跌幅: ${change30d}%
- 30日均价: ${avg.toFixed(2)}, 最高: ${max}, 最低: ${min}
- 最新成交量: ${latest.volume}, 平均成交量: ${avgVol.toFixed(0)}`
  }

  const prompt = `你是一位专业的股票分析师。请基于以下信息为该股票生成投资建议。

股票代码: ${symbol}
股票名称: ${name}
所属市场: ${market}

${klineSummary}

请严格按以下 JSON 格式返回（不要有其他文字）:
{
  "rating": "买入/持有/观望/减持",
  "targetPrice": 150.0,
  "currentPrice": ${klinePoints.length ? klinePoints[klinePoints.length - 1].close : 0},
  "timeframe": "3-6个月",
  "confidence": "高/中/低",
  "summary": "一句话核心结论",
  "reasons": ["理由1", "理由2", "理由3"],
  "risks": ["风险1", "风险2"],
  "klineAnalysis": "基于近期K线形态的技术面分析（如均线、MACD、成交量等）",
  "catalysts": ["近期催化剂1", "催化剂2"]
}`

  const { chat } = await import('./ai')
  const resp = await chat(
    [
      { role: 'system', content: '你是专业的股票分析师，只输出 JSON，不要有其他文字。' },
      { role: 'user', content: prompt },
    ],
    {
      baseUrl: ai.baseUrl,
      apiKey: ai.apiKey,
      model: ai.model,
      temperature: 0.3,
      maxTokens: 1600,
    },
  )

  const text = resp.choices?.[0]?.message?.content || ''
  const jsonText = extractJsonObject(text)
  if (!jsonText) throw new Error('AI 返回格式错误：没有找到 JSON 对象。请稍后重试或切换模型。')
  try {
    return normalizeAdvice(JSON.parse(jsonText) as Partial<AIAdvice>, klinePoints.at(-1)?.close ?? null)
  } catch {
    throw new Error('AI 返回格式错误：JSON 解析失败。请稍后重试或切换模型。')
  }
}

function relatedEtfs(symbol: string, name: string, market: Market): ETFHolding[] {
  const parsed = parseLongportSymbol(symbol)
  const blob = `${symbol} ${name}`.toLowerCase()
  const out: ETFHolding[] = []

  if (market === 'A股' || parsed?.market === 'sh' || parsed?.market === 'sz') {
    out.push(
      { etfSymbol: '510300.SH', etfName: '沪深300ETF', market: 'A股' },
      { etfSymbol: '512480.SH', etfName: '半导体ETF', market: 'A股' },
      { etfSymbol: '515050.SH', etfName: '5G通信ETF', market: 'A股' },
    )
  } else if (market === '港股' || parsed?.market === 'hk') {
    out.push(
      { etfSymbol: '02800.HK', etfName: '盈富基金', market: '港股' },
      { etfSymbol: '03033.HK', etfName: '南方恒生科技', market: '港股' },
      { etfSymbol: '03067.HK', etfName: '安硕恒生科技', market: '港股' },
    )
  } else {
    out.push(
      { etfSymbol: 'SPY.US', etfName: 'SPDR S&P 500 ETF', market: '美股' },
      { etfSymbol: 'QQQ.US', etfName: 'Invesco QQQ Trust', market: '美股' },
      { etfSymbol: 'VTI.US', etfName: 'Vanguard Total Stock Market ETF', market: '美股' },
    )
  }

  if (/(nvda|amd|avgo|tsm|asml|半导体|芯片|台积电|英伟达|中芯|寒武纪)/i.test(blob)) {
    out.unshift({ etfSymbol: 'SOXX.US', etfName: 'iShares Semiconductor ETF', market: '美股' })
  }
  if (/(新能源|tesla|tsla|比亚迪|宁德|隆基|光伏|电池)/i.test(blob)) {
    out.unshift({ etfSymbol: 'ICLN.US', etfName: 'iShares Global Clean Energy ETF', market: '美股' })
  }
  return out.slice(0, 4)
}

// ─── 统一入口 ───

export interface StockFullDetail {
  news: StockNews[]
  announcements: StockAnnouncement[]
  etfs: ETFHolding[]
  advice: AIAdvice | null
}

export async function fetchStockFullDetail(
  symbol: string,
  name: string,
  market: Market,
): Promise<StockFullDetail> {
  const parsed = parseLongportSymbol(symbol)
  const isAShare = parsed?.market === 'sh' || parsed?.market === 'sz'
  const [news, announcements] = await Promise.all([
    fetchNews(symbol, name),
    isAShare ? fetchAnnouncements(symbol) : Promise.resolve([]),
  ])

  return {
    news,
    announcements,
    etfs: relatedEtfs(symbol, name, market),
    advice: null,
  }
}
