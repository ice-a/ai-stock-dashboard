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

  const symbol = readQueryString(req.query?.symbol).trim()
  if (!symbol) {
    res.status(400).json({ error: 'Missing symbol' })
    return
  }

  res.status(502).json({ error: DISABLED_REASON })
}
