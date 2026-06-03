import type { ChatMessage, ChatResponse, ModelInfo } from '../api/ai'

export interface ServerChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

function readEnv(name: string): string {
  return process.env[name]?.trim() || ''
}

function normalizeBaseUrl(baseUrl: string): string {
  let u = baseUrl.trim().replace(/\/+$/, '')
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

export function hasServerAIConfig(): boolean {
  return Boolean(readEnv('AI_API_KEY') || readEnv('OPENAI_API_KEY'))
}

export async function listServerModels(signal?: AbortSignal): Promise<ModelInfo[]> {
  const config = getAiConfig()
  const r = await fetch(`${normalizeBaseUrl(config.baseUrl)}/models`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    signal,
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Models ${r.status}: ${text.substring(0, 200)}`)
  }
  const json = await r.json() as { data?: ModelInfo[]; model?: ModelInfo }
  return json.data || (json.model ? [json.model] : [])
}

export async function chatServer(messages: ChatMessage[], options: ServerChatOptions = {}, signal?: AbortSignal): Promise<ChatResponse> {
  const config = getAiConfig()
  const model = options.model || config.model
  if (!model) throw new Error('AI_MODEL or OPENAI_MODEL is not configured.')

  const r = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? Number(readEnv('AI_TEMPERATURE') || 0.7),
      max_tokens: options.maxTokens ?? Number(readEnv('AI_MAX_TOKENS') || 2000),
      stream: false,
    }),
    signal,
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Chat ${r.status}: ${text.substring(0, 200)}`)
  }
  return r.json()
}

export async function streamServerChat(messages: ChatMessage[], options: ServerChatOptions = {}, signal?: AbortSignal): Promise<Response> {
  const config = getAiConfig()
  const model = options.model || config.model
  if (!model) throw new Error('AI_MODEL or OPENAI_MODEL is not configured.')

  const r = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? Number(readEnv('AI_TEMPERATURE') || 0.7),
      max_tokens: options.maxTokens ?? Number(readEnv('AI_MAX_TOKENS') || 2000),
      stream: true,
    }),
    signal,
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Chat ${r.status}: ${text.substring(0, 200)}`)
  }
  return r
}
