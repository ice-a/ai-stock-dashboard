interface ApiRequest {
  headers: Record<string, string | string[] | undefined>
}

interface ApiResponse {
  setHeader(name: string, value: string | string[]): void
  status(code: number): { json(payload: unknown): void }
}

const AUTH_COOKIE_DEFAULT = 'ai_dashboard_auth'

function readEnv(name: string): string {
  return process.env[name]?.trim() || ''
}

function getAuthCookieName(): string {
  return readEnv('SITE_AUTH_COOKIE_NAME') || AUTH_COOKIE_DEFAULT
}

function isSecureRequest(headers: { [key: string]: string | string[] | undefined }): boolean {
  const value = headers['x-forwarded-proto'] || headers['X-Forwarded-Proto']
  const proto = Array.isArray(value) ? value[0] : value
  if (proto) return proto === 'https'

  const hostValue = headers.host || headers.Host
  const host = Array.isArray(hostValue) ? hostValue[0] : hostValue || ''
  return !/^localhost(:\d+)?$|^127\.0\.0\.1(:\d+)?$/.test(host)
}

function buildExpiredSessionCookie(secure: boolean): string {
  const parts = [
    `${getAuthCookieName()}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export default function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Set-Cookie', buildExpiredSessionCookie(isSecureRequest(req.headers)))
  res.status(200).json({ ok: true })
}
