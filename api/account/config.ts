import { readHeader, readJsonBody, sendError, type ApiRequest, type ApiResponse } from './_utils'

interface SaveConfigBody {
  config: Record<string, unknown>
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const account = await import('../../src/server/userAuth')
    if (!account.isUserAuthEnabled()) {
      res.status(503).json({ error: 'MongoDB account storage is not configured.' })
      return
    }

    const user = await account.getUserFromCookie(readHeader(req, 'cookie'))
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    if (!req.method || req.method === 'GET') {
      const { config, updatedAt } = await account.getUserConfig(user)
      res.status(200).json({ ok: true, user, config, updatedAt: updatedAt?.toISOString() || null })
      return
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const body = await readJsonBody<SaveConfigBody>(req)
      if (!body.config || typeof body.config !== 'object' || Array.isArray(body.config)) {
        res.status(400).json({ error: 'Missing config' })
        return
      }
      const updatedAt = await account.saveUserConfig(user, body.config)
      res.status(200).json({ ok: true, user, updatedAt: updatedAt.toISOString() })
      return
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    sendError(res, e)
  }
}
