interface ApiRequest {
  headers: Record<string, string | string[] | undefined>
}

interface ApiResponse {
  setHeader(name: string, value: string | string[]): void
  status(code: number): { json(payload: unknown): void }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const auth = await import('../../src/server/auth')
  res.setHeader('Set-Cookie', auth.buildExpiredSessionCookie(auth.isSecureRequest(req.headers)))
  res.status(200).json({ ok: true })
}
