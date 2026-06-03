// 股票搜索 API — 东方财富搜索建议

export interface SearchResult {
  symbol: string   // 长桥格式: 00700.HK / 600519.SH
  code: string     // 原始代码
  name: string
  market: string   // 港股 / A股 / 美股
  type: string     // 股票 / ETF / 指数
}

const EM_SEARCH_URL = 'https://searchapi.eastmoney.com/api/suggest/get'

// 东方财富市场代码 → 我们的 market 名称
function mapMarket(mktId: number | string, code: string): { market: string; symbol: string } {
  const id = Number(mktId)
  if (id === 116 || id === 128) return { market: '港股', symbol: `${code}.HK` }
  if (id === 105 || id === 106) return { market: '美股', symbol: `${code}.US` }
  // A股: 1=沪, 0=深
  if (id === 1) return { market: 'A股', symbol: `${code}.SH` }
  if (id === 0) return { market: 'A股', symbol: `${code}.SZ` }
  return { market: '未知', symbol: code }
}

export async function searchStocks(keyword: string): Promise<SearchResult[]> {
  if (!keyword.trim()) return []

  try {
    const url = `${EM_SEARCH_URL}?input=${encodeURIComponent(keyword)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=10`
    const r = await fetch(url)
    if (!r.ok) return []
    const json = await r.json() as {
      QuotationCodeTable?: {
        Data?: Array<{
          Code: string
          Name: string
          MktNum: number | string
          SecurityTypeName: string
          ID: string
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
