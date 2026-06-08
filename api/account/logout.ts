import { type ApiRequest, type ApiResponse } from './_utils'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const account = await import('../../src/server/userAuth')
  const auth = await import('../../src/server/auth')
  res.setHeader('Set-Cookie', account.buildExpiredUserSessionCookie(auth.isSecureRequest(req.headers)))
  res.status(200).json({ ok: true })
}
