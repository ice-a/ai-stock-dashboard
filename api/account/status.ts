import { readHeader, type ApiRequest, type ApiResponse } from './_utils'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  try {
    const account = await import('../../src/server/userAuth')
    const enabled = account.isUserAuthEnabled()
    const user = enabled ? await account.getUserFromCookie(readHeader(req, 'cookie')) : null
    res.status(200).json({ enabled, authenticated: Boolean(user), user })
  } catch (e) {
    res.status(200).json({
      enabled: true,
      authenticated: false,
      user: null,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
