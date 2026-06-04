interface ApiRequest {
  method?: string
  query?: Record<string, string | string[] | undefined>
}

interface ApiResponse {
  status(code: number): { json(payload: unknown): void }
}

const EM_QUOTE_BASES = [
  'https://push2delay.eastmoney.com/api/qt/stock/get',
  'https://push2.eastmoney.com/api/qt/stock/get',
]

const EM_KLINE_BASES = [
  'https://push2his.eastmoney.com/api/qt/stock/kline/get',
]

function readQueryString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

async function fetchText(url: string, headers: Record<string, string>): Promise<string> {
  const r = await fetch(url, { headers })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

async function fetchFirstJson(urls: string[]): Promise<unknown> {
  const errors: string[] = []
  for (const url of urls) {
    try {
      const text = await fetchText(url, {
        Referer: 'https://quote.eastmoney.com/',
        'User-Agent': 'Mozilla/5.0',
        Accept: 'application/json,text/plain,*/*',
      })
      const jsonText = text.trim().replace(/^[^(]+\(/, '').replace(/\);?$/, '')
      return JSON.parse(jsonText)
    } catch (e) {
      errors.push((e as Error).message)
    }
  }
  throw new Error(errors.join('; ') || 'EastMoney request failed')
}

async function handleEastmoney(req: ApiRequest, res: ApiResponse): Promise<void> {
  const mode = readQueryString(req.query?.mode)
  if (mode === 'quote') {
    const secid = readQueryString(req.query?.secid)
    const fields = readQueryString(req.query?.fields)
    if (!secid || !fields) {
      res.status(400).json({ error: 'Missing secid or fields' })
      return
    }
    const query = `secid=${encodeURIComponent(secid)}&fields=${encodeURIComponent(fields)}`
    const data = await fetchFirstJson(EM_QUOTE_BASES.map(base => `${base}?${query}`))
    res.status(200).json(data)
    return
  }

  if (mode === 'kline') {
    const secid = readQueryString(req.query?.secid)
    if (!secid) {
      res.status(400).json({ error: 'Missing secid' })
      return
    }
    const params = new URLSearchParams({
      secid,
      fields1: readQueryString(req.query?.fields1) || 'f1,f2,f3,f4,f5,f6',
      fields2: readQueryString(req.query?.fields2) || 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
      klt: readQueryString(req.query?.klt) || '101',
      fqt: readQueryString(req.query?.fqt) || '1',
      beg: readQueryString(req.query?.beg) || '0',
      end: readQueryString(req.query?.end) || '20500101',
      lmt: readQueryString(req.query?.lmt) || '200',
    })
    const data = await fetchFirstJson(EM_KLINE_BASES.map(base => `${base}?${params.toString()}`))
    res.status(200).json(data)
    return
  }

  res.status(400).json({ error: 'Invalid mode' })
}

async function handleSina(req: ApiRequest, res: ApiResponse): Promise<void> {
  const symbols = readQueryString(req.query?.symbols)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (symbols.length === 0) {
    res.status(400).json({ error: 'Missing symbols' })
    return
  }

  const url = `https://hq.sinajs.cn/list=${symbols.map(encodeURIComponent).join(',')}`
  const r = await fetch(url, {
    headers: {
      Referer: 'https://finance.sina.com.cn',
      'User-Agent': 'Mozilla/5.0',
      Accept: '*/*',
    },
  })
  if (!r.ok) throw new Error(`Sina ${r.status}`)

  const bytes = Buffer.from(await r.arrayBuffer())
  res.status(200).json({ text: bytes.toString('binary') })
}

async function handleYahoo(req: ApiRequest, res: ApiResponse): Promise<void> {
  const symbol = readQueryString(req.query?.symbol).trim()
  if (!symbol) {
    res.status(400).json({ error: 'Missing symbol' })
    return
  }

  const interval = readQueryString(req.query?.interval) || '1d'
  const range = readQueryString(req.query?.range) || '1d'
  const params = new URLSearchParams({ interval, range })
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params.toString()}`
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  const contentType = r.headers.get('content-type') || ''
  const text = await r.text()
  if (!r.ok || !contentType.includes('json')) {
    throw new Error(`Yahoo ${r.status}: ${text.substring(0, 120)}`)
  }
  res.status(200).json(JSON.parse(text))
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const source = readQueryString(req.query?.source)

  try {
    if (source === 'eastmoney') {
      await handleEastmoney(req, res)
      return
    }
    if (source === 'sina') {
      await handleSina(req, res)
      return
    }
    if (source === 'yahoo') {
      await handleYahoo(req, res)
      return
    }
    res.status(404).json({ error: 'Unknown market source' })
  } catch (e) {
    res.status(502).json({ error: (e as Error).message })
  }
}
