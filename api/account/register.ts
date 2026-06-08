import { readJsonBody, sendError, type ApiRequest, type ApiResponse } from './_utils'

interface RegisterBody {
  user: string
  sign?: string
  seckey?: string
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const account = await import('../../src/server/userAuth')
    const auth = await import('../../src/server/auth')
    const rateLimit = await import('../../src/server/rateLimit')

    if (req.method && req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }
    if (!account.isUserAuthEnabled()) {
      res.status(503).json({ error: 'MongoDB account storage is not configured.' })
      return
    }

    const ip = rateLimit.getRequestIp(req.headers)
    const attempt = rateLimit.checkLoginAttempt(`account-register:${ip}`)
    if (!attempt.ok) {
      res.setHeader('Retry-After', String(attempt.retryAfter))
      res.status(429).json({ error: 'Too many attempts' })
      return
    }

    const body = await readJsonBody<RegisterBody>(req)
    const result = await account.loginOrRegisterUser(String(body.user || ''), String(body.sign || body.seckey || ''))
    if (!result) {
      await new Promise(resolve => setTimeout(resolve, 350))
      res.status(401).json({ error: 'Invalid user or sign' })
      return
    }
    rateLimit.clearLoginAttempts(`account-register:${ip}`)

    const token = await account.createUserSessionToken(result.doc.user)
    res.setHeader('Set-Cookie', account.buildUserSessionCookie(token, auth.isSecureRequest(req.headers)))
    res.status(200).json({ ok: true, user: result.doc.user, created: result.created })
  } catch (e) {
    sendError(res, e)
  }
}
