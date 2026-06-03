import { chatServer } from '../../src/server/aiService.ts'
import type { ChatMessage } from '../../src/api/ai.ts'

interface ApiRequest {
  method?: string
  body?: unknown
}

interface ApiResponse {
  status(code: number): { json(payload: unknown): void }
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
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const body = readBody(req.body)
  if (!Array.isArray(body.messages)) {
    res.status(400).json({ error: 'Missing messages' })
    return
  }

  try {
    const data = await chatServer(body.messages, body)
    res.status(200).json(data)
  } catch (e) {
    res.status(502).json({ error: (e as Error).message })
  }
}
