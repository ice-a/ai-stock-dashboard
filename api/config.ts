interface ApiResponse {
  status(code: number): { json(payload: unknown): void }
}

function readEnv(name: string): string {
  return process.env[name]?.trim() || ''
}

function readNumber(name: string, fallback: number): number {
  const value = Number(readEnv(name))
  return Number.isFinite(value) ? value : fallback
}

function readOptionalNumber(name: string): number | null {
  const value = Number(readEnv(name))
  return Number.isFinite(value) ? value : null
}

export default function handler(_req: unknown, res: ApiResponse) {
  const aiApiKey = readEnv('AI_API_KEY') || readEnv('OPENAI_API_KEY')
  res.status(200).json({
    auth: {
      enabled: Boolean(readEnv('SITE_PASSWORD') || readEnv('APP_PASSWORD')),
    },
    ai: {
      serverManaged: Boolean(aiApiKey),
      baseUrl: readEnv('AI_BASE_URL') || readEnv('OPENAI_BASE_URL') || 'https://api.openai.com/v1',
      model: readEnv('AI_MODEL') || readEnv('OPENAI_MODEL') || '',
      temperature: readNumber('AI_TEMPERATURE', 0.7),
      maxTokens: readNumber('AI_MAX_TOKENS', 2000),
    },
    refresh: {
      listInterval: readOptionalNumber('APP_LIST_REFRESH_SECONDS'),
      detailInterval: readOptionalNumber('APP_DETAIL_REFRESH_SECONDS'),
    },
  })
}
