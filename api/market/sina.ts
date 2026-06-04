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

  const symbols = readQueryString(req.query?.symbols)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (symbols.length === 0) {
    res.status(400).json({ error: 'Missing symbols' })
    return
  }

  try {
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
  } catch (e) {
    res.status(502).json({ error: (e as Error).message })
  }
}
