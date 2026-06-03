interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ApiRequest {
  method?: string
  body?: unknown
}

interface ApiResponse {
  status(code: number): { json(payload: unknown): void }
}

interface ChatBody {
  messages?: ChatMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
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
  const model = readEnv('AI_MODEL') || readEnv('OPENAI_MODEL')
  if (!apiKey) throw new Error('AI_API_KEY or OPENAI_API_KEY is not configured.')
  return { apiKey, baseUrl, model }
}

function readBody(body: unknown): ChatBody {
  if (!body) return {}
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return {}
    }
  }
  return body as ChatBody
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = readBody(req.body)
  if (!Array.isArray(body.messages)) {
    res.status(400).json({ error: 'Missing messages' })
    return
  }

  try {
    const config = getAiConfig()
    const model = body.model || config.model
    if (!model) throw new Error('AI_MODEL or OPENAI_MODEL is not configured.')

    const r = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: body.messages,
        temperature: body.temperature ?? Number(readEnv('AI_TEMPERATURE') || 0.7),
        max_tokens: body.maxTokens ?? Number(readEnv('AI_MAX_TOKENS') || 2000),
        stream: false,
      }),
    })
    if (!r.ok) {
      const text = await r.text()
      throw new Error(`Chat ${r.status}: ${text.substring(0, 200)}`)
    }
    res.status(200).json(await r.json())
  } catch (e) {
    res.status(502).json({ error: (e as Error).message })
  }
}
