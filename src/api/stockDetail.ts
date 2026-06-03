// 个股详情数据：公告、新闻、ETF 持仓
// A 股：东方财富 API（免费、CORS 友好）
// 港美股：AI 生成摘要

import { parseLongportSymbol } from './symbolMap'
import type { StockNews, StockAnnouncement, ETFHolding, Market } from '../sectors/types'
import { useAIStore } from '../stores/ai'

// ─── 东方财富：公告 ───

const EM_NOTICE_URL = 'https://np-anotice-stock.eastmoney.com/api/security/ann'

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
    const url = `${EM_NOTICE_URL}?page_size=${pageSize}&page_index=1&ann_type=SHA,SZA&stock_list=${code}`
    const r = await fetch(url, {
      headers: { 'Referer': 'https://data.eastmoney.com/' },
    })
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
    }))
  } catch {
    return []
  }
}

// ─── 东方财富：新闻 ───

const EM_SEARCH_URL = 'https://search-api-web.eastmoney.com/search/jsonp'

export async function fetchNews(symbol: string, pageSize = 10): Promise<StockNews[]> {
  const code = detectMarketCode(symbol)
  if (!code) return []

  try {
    const param = JSON.stringify({
      uid: '',
      keyword: code,
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
    const cbName = `cb_${Date.now()}`
    const url = `${EM_SEARCH_URL}?cb=${cbName}&param=${encodeURIComponent(param)}`

    const r = await fetch(url, {
      headers: { 'Referer': 'https://so.eastmoney.com/' },
    })
    if (!r.ok) return []
    const text = await r.text()
    // 解析 JSONP
    const jsonStart = text.indexOf('(')
    const jsonEnd = text.lastIndexOf(')')
    if (jsonStart < 0 || jsonEnd < 0) return []
    const json = JSON.parse(text.slice(jsonStart + 1, jsonEnd)) as {
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
    return (json.result?.cmsArticleWebOld || []).map(item => ({
      title: item.title.replace(/<[^>]+>/g, ''),
      source: item.mediaName || '东方财富',
      time: item.date?.slice(0, 10) || '',
      url: item.url,
      summary: item.content?.replace(/<[^>]+>/g, '').slice(0, 120) || '',
    }))
  } catch {
    return []
  }
}

// ─── AI 生成：港美股新闻/公告/ETF ───

const STOCK_DETAIL_PROMPT = `你是一位专业的股票分析师。请为以下股票生成综合分析报告。

股票代码: {symbol}
股票名称: {name}
所属市场: {market}

请严格按以下 JSON 格式返回（不要有其他文字）:
{
  "news": [
    { "title": "新闻标题", "source": "来源", "time": "2026-06-01", "summary": "摘要（50字内）" }
  ],
  "announcements": [
    { "title": "公告标题", "time": "2026-06-01", "type": "公告类型" }
  ],
  "etfs": [
    { "etfSymbol": "ETF代码", "etfName": "ETF名称", "weight": 5.2, "market": "美股" }
  ],
  "advice": {
    "rating": "买入/持有/观望/减持",
    "targetPrice": 150.0,
    "currentPrice": 120.0,
    "timeframe": "3-6个月",
    "confidence": "高/中/低",
    "summary": "一句话核心结论",
    "reasons": ["理由1", "理由2", "理由3"],
    "risks": ["风险1", "风险2"],
    "klineAnalysis": "基于近期K线形态的技术面分析（如均线、MACD、成交量等）",
    "catalysts": ["近期催化剂1", "催化剂2"]
  }
}

注意:
1. news: 最近 3-5 条重要新闻
2. announcements: 最近 3-5 条重要公告（如无则留空数组）
3. etfs: 持有该股票的 3-5 只主要 ETF（包含持仓占比）
4. advice: 综合投资建议，包含目标价、评级、理由、风险、技术面分析`

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

interface AIGeneratedDetail {
  news: StockNews[]
  announcements: StockAnnouncement[]
  etfs: ETFHolding[]
  advice: AIAdvice | null
}

export async function fetchStockDetailAI(
  symbol: string,
  name: string,
  market: Market,
): Promise<AIGeneratedDetail> {
  const ai = useAIStore()
  if (!ai.hasCredentials) {
    return { news: [], announcements: [], etfs: [], advice: null }
  }

  const prompt = STOCK_DETAIL_PROMPT
    .replace('{symbol}', symbol)
    .replace('{name}', name)
    .replace('{market}', market)

  try {
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
        maxTokens: 3000,
      },
    )

    const text = resp.choices?.[0]?.message?.content || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { news: [], announcements: [], etfs: [], advice: null }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      news: Array.isArray(parsed.news) ? parsed.news : [],
      announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
      etfs: Array.isArray(parsed.etfs) ? parsed.etfs : [],
      advice: parsed.advice || null,
    }
  } catch {
    return { news: [], announcements: [], etfs: [], advice: null }
  }
}

// ─── 独立：AI 投资建议（含 K 线数据） ───

export async function fetchStockAdviceAI(
  symbol: string,
  name: string,
  market: Market,
  klinePoints: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>,
): Promise<AIAdvice | null> {
  const ai = useAIStore()
  if (!ai.hasCredentials) return null

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

  try {
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
        maxTokens: 2000,
      },
    )

    const text = resp.choices?.[0]?.message?.content || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0]) as AIAdvice
  } catch {
    return null
  }
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

  if (isAShare) {
    // A 股：东方财富 API + AI 分析
    const [news, announcements, aiDetail] = await Promise.all([
      fetchNews(symbol),
      fetchAnnouncements(symbol),
      fetchStockDetailAI(symbol, name, market),
    ])
    return {
      news: news.length ? news : aiDetail.news,
      announcements: announcements.length ? announcements : aiDetail.announcements,
      etfs: aiDetail.etfs,
      advice: aiDetail.advice,
    }
  }

  // 港美股：全部 AI 生成
  return fetchStockDetailAI(symbol, name, market)
}
