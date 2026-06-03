interface ApiResponse {
  status(code: number): { json(payload: unknown): void }
}

interface ModelInfo {
  id: string
  object?: string
  created?: number
  owned_by?: string
}

function readEnv(name: string): string {
  return process.env[name]?.trim() || ''
}

function normalizeBaseUrl(baseUrl: string): string {
  const u = baseUrl.trim().replace(/\/+$/, '')
  if (u.includes('/chat/completions')) return u
  if (/\/v\d+\/?$/.test(u)) return u
  if (/\/api\//.test(u)) return u
  return u + '/v1'
}

function getAiConfig() {
  const apiKey = readEnv('AI_API_KEY') || readEnv('OPENAI_API_KEY')
  const baseUrl = readEnv('AI_BASE_URL') || readEnv('OPENAI_BASE_URL') || 'https://api.openai.com/v1'
  if (!apiKey) throw new Error('AI_API_KEY or OPENAI_API_KEY is not configured.')
  return { apiKey, baseUrl }
}

export default async function handler(_req: unknown, res: ApiResponse) {
  try {
    const config = getAiConfig()
    const r = await fetch(`${normalizeBaseUrl(config.baseUrl)}/models`, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    })
    if (!r.ok) {
      const text = await r.text()
      throw new Error(`Models ${r.status}: ${text.substring(0, 200)}`)
    }
    const json = await r.json() as { data?: ModelInfo[]; model?: ModelInfo }
    res.status(200).json({ data: json.data || (json.model ? [json.model] : []) })
  } catch (e) {
    res.status(502).json({ error: (e as Error).message })
  }
}
