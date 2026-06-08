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
    const { streamServerChat } = await import('../../src/server/aiService')
    const upstream = await streamServerChat(body.messages, body)

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
    const error = e as ApiError
    writeJson(res, error.statusCode || 502, { error: error.message })
  }
}
