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

  try {
    const { getLongbridgeCandlesticks } = await import('./_service.js')
    const period = readQueryString(req.query?.period) || 'day'
    const count = Number(readQueryString(req.query?.count)) || 200
    res.status(200).json({ data: await getLongbridgeCandlesticks(symbol, period, count) })
  } catch (e) {
    res.status(502).json({ error: (e as Error).message })
  }
}
