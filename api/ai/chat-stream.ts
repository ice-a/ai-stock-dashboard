interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ApiRequest {
  method?: string
  body?: unknown
}

interface ApiResponse {
  writeHead(statusCode: number, headers?: Record<string, string>): void
  write(chunk: unknown): void
  end(chunk?: unknown): void
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

function writeJson(res: ApiResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    writeJson(res, 405, { error: 'Method not allowed' })
    return
  }

  const body = readBody(req.body)
  if (!Array.isArray(body.messages)) {
    writeJson(res, 400, { error: 'Missing messages' })
    return
  }

  try {
    const config = getAiConfig()
    const model = body.model || config.model
    if (!model) throw new Error('AI_MODEL or OPENAI_MODEL is not configured.')

    const upstream = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
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
        stream: true,
      }),
    })
    if (!upstream.ok) {
      const text = await upstream.text()
      throw new Error(`Chat ${upstream.status}: ${text.substring(0, 200)}`)
    }

    res.writeHead(200, {
      'Content-Type': upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    })
    if (!upstream.body) {
      res.end()
      return
    }

    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(decoder.decode(value, { stream: true }))
    }
    res.end()
  } catch (e) {
    writeJson(res, 502, { error: (e as Error).message })
  }
}
