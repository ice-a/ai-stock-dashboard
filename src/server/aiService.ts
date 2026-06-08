import type { ChatMessage, ChatResponse, ModelInfo } from '../api/ai'
import { normalizeOpenAIBaseUrl } from '../config/endpoints'
import { hasServerAiConfig, readAiConfig } from './env'

export interface ServerChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

interface UpstreamError extends Error {
  statusCode?: number
}

async function throwUpstreamError(prefix: string, response: Response): Promise<never> {
  const text = await response.text()
  const error = new Error(`${prefix} ${response.status}: ${text.substring(0, 200)}`) as UpstreamError
  error.statusCode = response.status
  throw error
}

function getAiConfig() {
  const { apiKey, baseUrl, model, temperature, maxTokens } = readAiConfig()
  if (!apiKey) throw new Error('AI_API_KEY or OPENAI_API_KEY is not configured.')
  return { apiKey, baseUrl, model, temperature, maxTokens }
}

export function hasServerAIConfig(): boolean {
  return hasServerAiConfig()
}

export async function listServerModels(signal?: AbortSignal): Promise<ModelInfo[]> {
  const config = getAiConfig()
  const r = await fetch(`${normalizeOpenAIBaseUrl(config.baseUrl)}/models`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    signal,
  })
  if (!r.ok) {
    await throwUpstreamError('Models', r)
  }
  const json = await r.json() as { data?: ModelInfo[]; model?: ModelInfo }
  return json.data || (json.model ? [json.model] : [])
}

export async function chatServer(messages: ChatMessage[], options: ServerChatOptions = {}, signal?: AbortSignal): Promise<ChatResponse> {
  const config = getAiConfig()
  const model = options.model || config.model
  if (!model) throw new Error('AI_MODEL or OPENAI_MODEL is not configured.')

  const r = await fetch(`${normalizeOpenAIBaseUrl(config.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? config.temperature,
      max_tokens: options.maxTokens ?? config.maxTokens,
      stream: false,
    }),
    signal,
  })
  if (!r.ok) {
    await throwUpstreamError('Chat', r)
  }
  return r.json()
}

export async function streamServerChat(messages: ChatMessage[], options: ServerChatOptions = {}, signal?: AbortSignal): Promise<Response> {
  const config = getAiConfig()
  const model = options.model || config.model
  if (!model) throw new Error('AI_MODEL or OPENAI_MODEL is not configured.')

  const r = await fetch(`${normalizeOpenAIBaseUrl(config.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? config.temperature,
      max_tokens: options.maxTokens ?? config.maxTokens,
      stream: true,
    }),
    signal,
  })
  if (!r.ok) {
    await throwUpstreamError('Chat', r)
  }
  return r
}
