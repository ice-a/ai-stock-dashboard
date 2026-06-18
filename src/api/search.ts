// 股票搜索 API — 腾讯自选股优先，东方财富备用
import { APP_API_ROUTES } from '../config/endpoints'

export interface SearchResult {
  symbol: string   // 长桥格式: 00700.HK / 600519.SH
  code: string     // 原始代码
  name: string
  market: string   // 港股 / A股 / 美股
  type: string     // 股票 / ETF / 指数
}

// 腾讯自选股代码格式转换
function convertWestockSymbol(westockSymbol: string): { symbol: string; market: string } {
  const s = westockSymbol.toLowerCase()
  if (s.startsWith('sh')) return { symbol: `${s.slice(2)}.SH`, market: 'A股' }
  if (s.startsWith('sz')) return { symbol: `${s.slice(2)}.SZ`, market: 'A股' }
  if (s.startsWith('bj')) return { symbol: `${s.slice(2)}.BJ`, market: 'A股' }
  if (s.startsWith('hk')) return { symbol: `${s.slice(2)}.HK`, market: '港股' }
  if (s.startsWith('us')) return { symbol: `${s.slice(2)}.US`, market: '美股' }
  return { symbol: westockSymbol, market: '未知' }
}

// 使用腾讯自选股搜索
async function searchByWestock(keyword: string): Promise<SearchResult[]> {
  try {
    const response = await fetch('/api/westock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'search', args: [keyword] }),
    })
    
    const data = await response.json()
    if (!data.success || !data.output) return []
    
    // 解析腾讯自选股输出
    const lines = data.output.split('\n').filter((line: string) => line.includes('|'))
    if (lines.length < 2) return []
    
    const results: SearchResult[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('|').map((c: string) => c.trim()).filter(Boolean)
      if (cols.length >= 2) {
        const westockSymbol = cols[0]
        const name = cols[1]
        const { symbol, market } = convertWestockSymbol(westockSymbol)
        results.push({
          symbol,
          code: westockSymbol,
          name,
          market,
          type: '股票',
        })
      }
    }
    
    return results
  } catch {
    return []
  }
}

// 东方财富市场代码转换
function mapMarket(mktId: number | string, code: string): { market: string; symbol: string } {
  const id = Number(mktId)
  if (id === 116 || id === 128) return { market: '港股', symbol: `${code}.HK` }
  if (id === 105 || id === 106) return { market: '美股', symbol: `${code}.US` }
  if (id === 1) return { market: 'A股', symbol: `${code}.SH` }
  if (id === 0) return { market: 'A股', symbol: `${code}.SZ` }
  return { market: '未知', symbol: code }
}

// 东方财富搜索（备用）
async function searchByEastmoney(keyword: string): Promise<SearchResult[]> {
  try {
    const url = `${APP_API_ROUTES.market}?source=eastmoney&mode=search&input=${encodeURIComponent(keyword)}&type=14&count=10`
    const r = await fetch(url)
    if (!r.ok) return []
    const json = await r.json() as {
      QuotationCodeTable?: {
        Data?: Array<{
          Code: string
          Name: string
          MktNum: number | string
          SecurityTypeName: string
        }>
      }
    }

    const data = json.QuotationCodeTable?.Data || []
    return data
      .filter(item => ['股票', 'ETF'].includes(item.SecurityTypeName))
      .map(item => {
        const { market, symbol } = mapMarket(item.MktNum, item.Code)
        return {
          symbol,
          code: item.Code,
          name: item.Name,
          market,
          type: item.SecurityTypeName,
        }
      })
  } catch {
    return []
  }
}

// 主搜索函数：腾讯自选股优先，东方财富备用
export async function searchStocks(keyword: string): Promise<SearchResult[]> {
  if (!keyword.trim()) return []
  
  // 先尝试腾讯自选股
  const westockResults = await searchByWestock(keyword)
  if (westockResults.length > 0) return westockResults
  
  // 备用：东方财富
  return searchByEastmoney(keyword)
}
