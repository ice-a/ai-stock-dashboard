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

interface ApiError extends Error {
  statusCode?: number
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
    const { chatServer } = await import('../../src/server/aiService')
    res.status(200).json(await chatServer(body.messages, body))
  } catch (e) {
    const error = e as ApiError
    res.status(error.statusCode || 502).json({ error: error.message })
  }
}
