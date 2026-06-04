interface ApiRequest {
  method?: string
  query?: Record<string, string | string[] | undefined>
}

interface ApiResponse {
  status(code: number): { json(payload: unknown): void }
}

function readQueryString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const symbol = readQueryString(req.query?.symbol).trim()
  if (!symbol) {
    res.status(400).json({ error: 'Missing symbol' })
    return
  }

  const interval = readQueryString(req.query?.interval) || '1d'
  const range = readQueryString(req.query?.range) || '1d'
  const params = new URLSearchParams({ interval, range })

  try {
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
  } catch (e) {
    res.status(502).json({ error: (e as Error).message })
  }
}
