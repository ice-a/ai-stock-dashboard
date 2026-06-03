interface ApiRequest {
  method?: string
  query?: Record<string, string | string[] | undefined>
}

interface ApiResponse {
  status(code: number): { json(payload: unknown): void }
}

const DISABLED_REASON =
  'Longbridge native SDK is disabled on Vercel because its Linux binding exceeds the 250 MB Serverless Function size limit.'

function readQueryString(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const rawSymbols = readQueryString(req.query?.symbols || req.query?.symbol)
  const symbols = rawSymbols.split(',').map(s => s.trim()).filter(Boolean)
  if (symbols.length === 0) {
    res.status(400).json({ error: 'Missing symbols' })
    return
  }

  res.status(502).json({ error: DISABLED_REASON })
}
