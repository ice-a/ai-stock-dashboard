import type { VercelRequest, VercelResponse } from '@vercel/node'

// 东方财富搜索 API
const EASTMONEY_SEARCH_URL = 'https://searchapi.eastmoney.com/api/suggest/get'
const EASTMONEY_QUOTE_URL = 'https://push2.eastmoney.com/api/qt/stock/get'
const EASTMONEY_KLINE_URL = 'https://push2his.eastmoney.com/api/qt/stock/kline/get'

// 东方财富市场代码转换
function emSecid(symbol: string): string {
  const s = symbol.toUpperCase()
  if (s.endsWith('.SH')) return `1.${s.replace('.SH', '')}`
  if (s.endsWith('.SZ')) return `0.${s.replace('.SZ', '')}`
  if (s.endsWith('.HK')) return `116.${s.replace('.HK', '')}`
  if (s.endsWith('.US')) return `105.${s.replace('.US', '')}`
  return symbol
}

// 搜索股票
async function searchStocks(keyword: string): Promise<any[]> {
  try {
    const url = `${EASTMONEY_SEARCH_URL}?input=${encodeURIComponent(keyword)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=10`
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://quote.eastmoney.com/',
        'User-Agent': 'Mozilla/5.0',
      },
    })
    
    if (!response.ok) return []
    
    const json = await response.json() as any
    const data = json?.QuotationCodeTable?.Data || []
    
    return data
      .filter((item: any) => ['股票', 'ETF'].includes(item.SecurityTypeName))
      .map((item: any) => {
        const code = item.Code
        const mktNum = Number(item.MktNum)
        let symbol = code
        let market = '未知'
        
        if (mktNum === 1) { symbol = `${code}.SH`; market = 'A股' }
        else if (mktNum === 0) { symbol = `${code}.SZ`; market = 'A股' }
        else if (mktNum === 116 || mktNum === 128) { symbol = `${code}.HK`; market = '港股' }
        else if (mktNum === 105 || mktNum === 106) { symbol = `${code}.US`; market = '美股' }
        
        return {
          symbol,
          name: item.Name,
          market,
          type: item.SecurityTypeName,
        }
      })
  } catch {
    return []
  }
}

// 获取 K 线数据
async function fetchKline(symbol: string, limit: number = 30): Promise<any[]> {
  try {
    const secid = emSecid(symbol)
    const url = `${EASTMONEY_KLINE_URL}?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=101&fqt=1&lmt=${limit}&end=20500101`
    
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://quote.eastmoney.com/',
        'User-Agent': 'Mozilla/5.0',
      },
    })
    
    if (!response.ok) return []
    
    const json = await response.json() as any
    const klines = json?.data?.klines || []
    
    return klines.map((line: string) => {
      const parts = line.split(',')
      return {
        date: parts[0],
        open: parseFloat(parts[1]),
        close: parseFloat(parts[2]),
        high: parseFloat(parts[3]),
        low: parseFloat(parts[4]),
        volume: parseFloat(parts[5]),
        amount: parseFloat(parts[6]),
      }
    })
  } catch {
    return []
  }
}

// 获取实时行情
async function fetchQuote(symbol: string): Promise<any> {
  try {
    const secid = emSecid(symbol)
    const url = `${EASTMONEY_QUOTE_URL}?secid=${secid}&fields=f43,f44,f45,f46,f47,f48,f50,f51,f52,f57,f58,f60,f170,f171`
    
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://quote.eastmoney.com/',
        'User-Agent': 'Mozilla/5.0',
      },
    })
    
    if (!response.ok) return null
    
    const json = await response.json() as any
    const data = json?.data
    
    if (!data) return null
    
    return {
      symbol,
      code: data.f57,
      name: data.f58,
      price: (data.f43 || 0) / 100,
      open: (data.f46 || 0) / 100,
      high: (data.f44 || 0) / 100,
      low: (data.f45 || 0) / 100,
      prevClose: (data.f60 || 0) / 100,
      volume: data.f47 || 0,
      amount: data.f48 || 0,
      change: (data.f170 || 0) / 100,
      changePercent: (data.f171 || 0) / 100,
    }
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const { command, args = [] } = req.body || {}

  if (!command) {
    return res.status(400).json({ success: false, error: 'Command is required' })
  }

  try {
    switch (command) {
      case 'search': {
        const keyword = args[0]
        if (!keyword) {
          return res.status(400).json({ success: false, error: 'Keyword is required' })
        }
        
        const results = await searchStocks(keyword)
        
        // 转换为 Markdown 表格格式
        let output = '| code | name | type |\n| --- | --- | --- |\n'
        for (const item of results) {
          const code = item.symbol.replace('.SH', '').replace('.SZ', '').replace('.HK', '').replace('.US', '')
          const prefix = item.market === 'A股' ? (item.symbol.endsWith('.SH') ? 'sh' : 'sz') : 
                         item.market === '港股' ? 'hk' : 'us'
          output += `| ${prefix}${code} | ${item.name} | ${item.type === 'ETF' ? 'JJ' : 'GP'} |\n`
        }
        
        return res.status(200).json({ success: true, output })
      }

      case 'kline': {
        const symbol = args[0]
        if (!symbol) {
          return res.status(400).json({ success: false, error: 'Symbol is required' })
        }
        
        // 转换符号格式
        let emSymbol = symbol
        if (symbol.startsWith('sh')) emSymbol = `${symbol.slice(2)}.SH`
        else if (symbol.startsWith('sz')) emSymbol = `${symbol.slice(2)}.SZ`
        else if (symbol.startsWith('hk')) emSymbol = `${symbol.slice(2)}.HK`
        else if (symbol.startsWith('us')) emSymbol = `${symbol.slice(2)}.US`
        
        const klines = await fetchKline(emSymbol, 30)
        
        // 转换为 Markdown 表格格式
        let output = '| date | open | last | high | low | volume | amount | exchange |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n'
        for (const k of klines) {
          output += `| ${k.date} | ${k.open} | ${k.close} | ${k.high} | ${k.low} | ${k.volume} | ${k.amount} | 0 |\n`
        }
        
        return res.status(200).json({ success: true, output })
      }

      case 'quote': {
        const symbol = args[0]
        if (!symbol) {
          return res.status(400).json({ success: false, error: 'Symbol is required' })
        }
        
        // 转换符号格式
        let emSymbol = symbol
        if (symbol.startsWith('sh')) emSymbol = `${symbol.slice(2)}.SH`
        else if (symbol.startsWith('sz')) emSymbol = `${symbol.slice(2)}.SZ`
        else if (symbol.startsWith('hk')) emSymbol = `${symbol.slice(2)}.HK`
        else if (symbol.startsWith('us')) emSymbol = `${symbol.slice(2)}.US`
        
        const quote = await fetchQuote(emSymbol)
        
        if (!quote) {
          return res.status(200).json({ success: true, output: '' })
        }
        
        // 转换为 Markdown 表格格式
        let output = '| code | name | last | change | changePct | volume | high | low | open | prevClose |\n'
        output += '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n'
        output += `| ${quote.code} | ${quote.name} | ${quote.price} | ${quote.change} | ${quote.changePercent} | ${quote.volume} | ${quote.high} | ${quote.low} | ${quote.open} | ${quote.prevClose} |\n`
        
        return res.status(200).json({ success: true, output })
      }

      default:
        return res.status(400).json({ success: false, error: `Command "${command}" not supported in this environment` })
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Command execution failed',
    })
  }
}
