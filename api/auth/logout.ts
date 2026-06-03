import { buildExpiredSessionCookie, isSecureRequest } from '../../src/server/auth.ts'

interface ApiRequest {
  headers: Record<string, string | string[] | undefined>
}

interface ApiResponse {
  setHeader(name: string, value: string | string[]): void
  status(code: number): { json(payload: unknown): void }
}

export default function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Set-Cookie', buildExpiredSessionCookie(isSecureRequest(req.headers)))
  res.status(200).json({ ok: true })
}
