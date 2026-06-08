interface ApiRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  on?(event: 'data' | 'end' | 'error', callback: (...args: any[]) => void): void
}

interface ApiResponse {
  setHeader(name: string, value: string | string[]): void
  status(code: number): { json(payload: unknown): void }
}

async function readRawBody(req: ApiRequest): Promise<string> {
  if (typeof req.body === 'string') return req.body
  if (req.body && Buffer.isBuffer(req.body)) return req.body.toString('utf8')
  if (!req.on) return ''

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on?.('data', chunk => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on?.('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on?.('error', reject)
  })
}

async function readPassword(req: ApiRequest): Promise<string> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return 'password' in req.body ? String((req.body as { password?: unknown }).password || '') : ''
  }

  const raw = await readRawBody(req)
  if (!raw) return ''
  try {
    const json = JSON.parse(raw) as { password?: string }
    return String(json.password || '')
  } catch {
    return ''
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const auth = await import('../../src/server/auth')
    const rateLimit = await import('../../src/server/rateLimit')

    if (req.method && req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    if (!auth.isAuthEnabled()) {
      res.status(200).json({ ok: true, disabled: true })
      return
    }

    const ip = rateLimit.getRequestIp(req.headers)
    const attempt = rateLimit.checkLoginAttempt(ip)
    if (!attempt.ok) {
      res.setHeader('Retry-After', String(attempt.retryAfter))
      res.status(429).json({ error: 'Too many attempts' })
      return
    }

    if (!(await auth.verifyPassword(await readPassword(req)))) {
      await new Promise(resolve => setTimeout(resolve, 350))
      res.status(401).json({ error: 'Invalid password' })
      return
    }

    rateLimit.clearLoginAttempts(ip)
    const token = await auth.createSessionToken()
    res.setHeader('Set-Cookie', auth.buildSessionCookie(token, auth.isSecureRequest(req.headers)))
    res.status(200).json({ ok: true })
  } catch (e) {
    res.status(500).json({
      error: 'Auth service error',
      message: e instanceof Error ? e.message : String(e),
    })
  }
}
