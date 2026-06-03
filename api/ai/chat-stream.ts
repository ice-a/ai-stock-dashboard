import { streamServerChat } from '../../src/server/aiService.ts'
import type { ChatMessage } from '../../src/api/ai.ts'

interface ApiRequest {
  method?: string
  body?: unknown
}

interface ApiResponse {
  writeHead(statusCode: number, headers?: Record<string, string>): void
  write(chunk: unknown): void
  end(chunk?: unknown): void
}

function readBody(body: unknown): { messages?: ChatMessage[]; model?: string; temperature?: number; maxTokens?: number } {
  if (!body) return {}
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return {}
    }
  }
  return body as { messages?: ChatMessage[]; model?: string; temperature?: number; maxTokens?: number }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method && req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }
  const body = readBody(req.body)
  if (!Array.isArray(body.messages)) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Missing messages' }))
    return
  }

  try {
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
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: (e as Error).message }))
  }
}
