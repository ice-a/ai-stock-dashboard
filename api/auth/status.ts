interface ApiRequest {
  headers: Record<string, string | string[] | undefined>
}

interface ApiResponse {
  status(code: number): { json(payload: unknown): void }
}

function readHeader(req: ApiRequest, name: string): string {
  const value = req.headers[name] || req.headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] || '' : value || ''
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const auth = await import('../../src/server/auth')
  const enabled = auth.isAuthEnabled()
  const authenticated = await auth.verifySessionToken(auth.getAuthTokenFromCookie(readHeader(req, 'cookie')))
  res.status(200).json({ enabled, authenticated })
}
