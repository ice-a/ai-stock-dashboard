// 腾讯自选股 API 客户端

export interface WestockResult {
  success: boolean
  output?: string
  error?: string
}

// 执行腾讯自选股命令
async function execWestock(command: string, args: string[]): Promise<string> {
  const response = await fetch('/api/westock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, args }),
  })

  const data: WestockResult = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Command failed')
  }

  return data.output || ''
}

// 搜索股票
export async function westockSearch(keyword: string): Promise<Array<{
  symbol: string
  name: string
  market: string
}>> {
  const output = await execWestock('search', [keyword])
  
  // 解析输出格式
  const lines = output.split('\n').filter(line => line.includes('|'))
  if (lines.length < 2) return []

  const results: Array<{ symbol: string; name: string; market: string }> = []
  
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('|').map(c => c.trim()).filter(Boolean)
    if (cols.length >= 2) {
      const symbol = cols[0]
      const name = cols[1]
      let market = '未知'
      
      if (symbol.startsWith('sh') || symbol.startsWith('sz')) market = 'A股'
      else if (symbol.startsWith('hk')) market = '港股'
      else if (symbol.startsWith('us')) market = '美股'
      
      results.push({ symbol, name, market })
    }
  }

  return results
}

// 查询实时行情
export async function westockQuote(symbol: string): Promise<{
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  high: number
  low: number
  open: number
  prevClose: number
} | null> {
  const output = await execWestock('quote', [symbol])
  
  // 解析输出格式
  const lines = output.split('\n').filter(line => line.includes('|'))
  if (lines.length < 2) return null

  const cols = lines[1].split('|').map(c => c.trim()).filter(Boolean)
  if (cols.length < 8) return null

  return {
    symbol: cols[0] || symbol,
    name: cols[1] || '',
    price: parseFloat(cols[2]) || 0,
    change: parseFloat(cols[3]) || 0,
    changePercent: parseFloat(cols[4]) || 0,
    volume: parseFloat(cols[5]) || 0,
    high: parseFloat(cols[6]) || 0,
    low: parseFloat(cols[7]) || 0,
    open: parseFloat(cols[8]) || 0,
    prevClose: parseFloat(cols[9]) || 0,
  }
}

// 查询 K 线
export async function westockKline(
  symbol: string,
  options: {
    period?: 'day' | 'week' | 'month'
    limit?: number
    fq?: 'qfq' | 'hfq' | 'bfq'
  } = {}
): Promise<Array<{
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  amount: number
}>> {
  const args = [symbol]
  if (options.period) args.push('--period', options.period)
  if (options.limit) args.push('--limit', String(options.limit))
  if (options.fq) args.push('--fq', options.fq)

  const output = await execWestock('kline', args)
  
  // 解析输出格式
  const lines = output.split('\n').filter(line => line.includes('|'))
  if (lines.length < 2) return []

  const results: Array<{
    date: string
    open: number
    close: number
    high: number
    low: number
    volume: number
    amount: number
  }> = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('|').map(c => c.trim()).filter(Boolean)
    if (cols.length >= 6) {
      results.push({
        date: cols[0],
        open: parseFloat(cols[1]) || 0,
        close: parseFloat(cols[2]) || 0,
        high: parseFloat(cols[3]) || 0,
        low: parseFloat(cols[4]) || 0,
        volume: parseFloat(cols[5]) || 0,
        amount: parseFloat(cols[6]) || 0,
      })
    }
  }

  return results
}

// 查询资金流向
export async function westockFundFlow(symbol: string): Promise<{
  mainNetFlow: number
  hugeNetFlow: number
  bigNetFlow: number
  midNetFlow: number
  smallNetFlow: number
} | null> {
  const output = await execWestock('asfund', [symbol])
  
  // 解析输出格式
  const lines = output.split('\n').filter(line => line.includes('|'))
  if (lines.length < 2) return null

  const cols = lines[1].split('|').map(c => c.trim()).filter(Boolean)
  if (cols.length < 5) return null

  return {
    mainNetFlow: parseFloat(cols[1]) || 0,
    hugeNetFlow: parseFloat(cols[2]) || 0,
    bigNetFlow: parseFloat(cols[3]) || 0,
    midNetFlow: parseFloat(cols[4]) || 0,
    smallNetFlow: parseFloat(cols[5]) || 0,
  }
}

// 查询技术指标
export async function westockTechnical(symbol: string): Promise<{
  ma5: number
  ma10: number
  ma20: number
  ma60: number
  macd: number
  dif: number
  dea: number
  k: number
  d: number
  j: number
  rsi6: number
  rsi12: number
  rsi24: number
} | null> {
  const output = await execWestock('technical', [symbol])
  
  // 解析输出格式
  const lines = output.split('\n').filter(line => line.includes('|'))
  if (lines.length < 2) return null

  const cols = lines[1].split('|').map(c => c.trim()).filter(Boolean)
  if (cols.length < 13) return null

  return {
    ma5: parseFloat(cols[1]) || 0,
    ma10: parseFloat(cols[2]) || 0,
    ma20: parseFloat(cols[3]) || 0,
    ma60: parseFloat(cols[4]) || 0,
    macd: parseFloat(cols[5]) || 0,
    dif: parseFloat(cols[6]) || 0,
    dea: parseFloat(cols[7]) || 0,
    k: parseFloat(cols[8]) || 0,
    d: parseFloat(cols[9]) || 0,
    j: parseFloat(cols[10]) || 0,
    rsi6: parseFloat(cols[11]) || 0,
    rsi12: parseFloat(cols[12]) || 0,
    rsi24: parseFloat(cols[13]) || 0,
  }
}

// 查询财务报表
export async function westockFinance(
  symbol: string,
  options: {
    type?: 'lrb' | 'zcfz' | 'xjll'
    num?: number
  } = {}
): Promise<string> {
  const args = [symbol]
  if (options.type) args.push('--type', options.type)
  if (options.num) args.push('--num', String(options.num))

  return execWestock('finance', args)
}

// 查询公司简况
export async function westockProfile(symbol: string): Promise<string> {
  return execWestock('profile', [symbol])
}

// 查询股东结构
export async function westockShareholder(symbol: string): Promise<string> {
  return execWestock('shareholder', [symbol])
}

// 查询分红数据
export async function westockDividend(
  symbol: string,
  options: { years?: number; all?: boolean } = {}
): Promise<string> {
  const args = [symbol]
  if (options.years) args.push('--years', String(options.years))
  if (options.all) args.push('--all')

  return execWestock('dividend', args)
}
