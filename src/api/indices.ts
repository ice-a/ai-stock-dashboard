// 全球主要指数行情
// 东方财富指数 API

import { APP_API_ROUTES } from '../config/endpoints'

export interface MarketIndex {
  code: string
  name: string
  price: number
  change: number
  changePct: number
  region: string
  icon: string
}

// 东方财富指数 secid 映射
const INDEX_LIST: Array<{ secid: string; code: string; name: string; region: string; icon: string }> = [
  { secid: '100.NDX', code: 'NDX', name: '纳斯达克', region: '美股', icon: '🇺🇸' },
  { secid: '100.DJIA', code: 'DJIA', name: '道琼斯', region: '美股', icon: '🇺🇸' },
  { secid: '100.SPX', code: 'SPX', name: '标普500', region: '美股', icon: '🇺🇸' },
  { secid: '100.HSTECH', code: 'HSTECH', name: '恒生科技', region: '港股', icon: '🇭🇰' },
  { secid: '100.HSI', code: 'HSI', name: '恒生指数', region: '港股', icon: '🇭🇰' },
  { secid: '1.000001', code: '000001', name: '上证指数', region: 'A股', icon: '🇨🇳' },
  { secid: '0.399006', code: '399006', name: '创业板指', region: 'A股', icon: '🇨🇳' },
  { secid: '0.399001', code: '399001', name: '深证成指', region: 'A股', icon: '🇨🇳' },
  { secid: '100.N225', code: 'N225', name: '日经225', region: '日本', icon: '🇯🇵' },
]

export async function fetchIndices(): Promise<MarketIndex[]> {
  try {
    const params = new URLSearchParams({
      source: 'eastmoney',
      mode: 'quotes',
      secids: INDEX_LIST.map(idx => idx.secid).join(','),
      fields: 'f43,f169,f170,f58',
    })
    const r = await fetch(`${APP_API_ROUTES.market}?${params.toString()}`)
    if (!r.ok) return []
    const json = await r.json() as {
      data?: Array<{
        secid?: string
        data?: { f43?: number; f169?: number; f170?: number; f58?: string } | null
      }>
    }
    const bySecid = new Map((json.data || []).map(item => [item.secid, item.data]))

    return INDEX_LIST.map((idx) => {
      const d = bySecid.get(idx.secid)
      if (!d || d.f43 == null) return null

      // A 股指数返回"分"需 /100，海外指数返回实际价格
      const isAShare = idx.secid.startsWith('0.') || idx.secid.startsWith('1.')
      const divisor = isAShare ? 100 : 1
      const price = d.f43 / divisor
      const change = (d.f169 ?? 0) / divisor
      const changePct = (d.f170 ?? 0) / divisor

      return {
        code: idx.code,
        name: d.f58 || idx.name,
        price,
        change,
        changePct,
        region: idx.region,
        icon: idx.icon,
      }
    }).filter((r): r is MarketIndex => r !== null)
  } catch {
    return []
  }
}
