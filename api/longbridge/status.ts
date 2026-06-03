interface JsonResponse {
  status(code: number): { json(payload: unknown): void }
}

const DISABLED_REASON =
  'Longbridge native SDK is disabled on Vercel because its Linux binding exceeds the 250 MB Serverless Function size limit.'

function readEnv(name: string): string {
  return process.env[name]?.trim() || ''
}

export default function handler(_req: unknown, res: JsonResponse) {
  const appKey = readEnv('LONGBRIDGE_APP_KEY') || readEnv('LONGPORT_APP_KEY')
  const appSecret = readEnv('LONGBRIDGE_APP_SECRET') || readEnv('LONGPORT_APP_SECRET')
  const accessToken = readEnv('LONGBRIDGE_ACCESS_TOKEN') || readEnv('LONGPORT_ACCESS_TOKEN')
  res.status(200).json({
    configured: Boolean(appKey && appSecret && accessToken),
    host: readEnv('LONGBRIDGE_HTTP_URL') || 'https://openapi.longbridge.com',
    sdkLoaded: false,
    disabledReason: DISABLED_REASON,
  })
}
