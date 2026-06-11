// OpenAI 兼容的 Chat Completions 客户端
// 支持 baseUrl + apiKey + model，可对接 OpenAI / Azure / DeepSeek / Moonshot / 智谱 / Ollama 等
// 流式输出（SSE）
import { APP_API_ROUTES, normalizeOpenAIBaseUrl } from '../config/endpoints'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  baseUrl: string
  apiKey?: string
  model: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  signal?: AbortSignal
}

export interface ChatChoice {
  index: number
  message?: ChatMessage
  delta?: { role?: string; content?: string }
  finishReason?: string
}

export interface ChatResponse {
  id: string
  choices: ChatChoice[]
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export interface ModelInfo {
  id: string
  object?: string
  created?: number
  owned_by?: string
}

let chatCooldownUntil = 0

function assertChatNotCoolingDown() {
  const remaining = chatCooldownUntil - Date.now()
  if (remaining > 0) {
    throw new Error(`AI_RATE_LIMIT_COOLDOWN:${Math.ceil(remaining / 1000)}`)
  }
}

async function throwApiError(prefix: string, response: Response): Promise<never> {
  const text = await response.text()
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after'))
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 60_000
    chatCooldownUntil = Math.max(chatCooldownUntil, Date.now() + waitMs)
    throw new Error(`AI_RATE_LIMIT:${Math.ceil(waitMs / 1000)}:${text.substring(0, 200)}`)
  }
  throw new Error(`${prefix} ${response.status}: ${text.substring(0, 200)}`)
}

// 开发环境通过 Vite 代理解决 CORS 问题
// 将目标 URL 编码为 base64 作为代理路径
function getProxiedUrl(targetUrl: string): string {
  try {
    const url = new URL(targetUrl)
    const base = url.origin
    const path = url.pathname.replace(/^\//, '')
    const b64 = btoa(base)
    return `${APP_API_ROUTES.aiDevProxy}/${b64}/${path}${url.search}`
  } catch {
    return targetUrl
  }
}

function normalizeModelList(json: unknown): ModelInfo[] {
  const payload = json as { data?: unknown; models?: unknown; model?: unknown }
  const rawList = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.models)
      ? payload.models
      : null

  if (rawList) {
    return rawList
      .map((item) => {
        if (typeof item === 'string') return { id: item }
        if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
          return item as ModelInfo
        }
        return null
      })
      .filter((item): item is ModelInfo => Boolean(item?.id))
  }

  if (payload.model) {
    if (typeof payload.model === 'string') return [{ id: payload.model }]
    if (typeof payload.model === 'object' && typeof (payload.model as { id?: unknown }).id === 'string') {
      return [payload.model as ModelInfo]
    }
  }

  const preview = JSON.stringify(json).slice(0, 160)
  throw new Error(`模型列表响应格式不正确：${preview}`)
}

export async function listModels(baseUrl: string, apiKey: string, signal?: AbortSignal): Promise<ModelInfo[]> {
  if (!apiKey) {
    const r = await fetch(APP_API_ROUTES.aiModels, { signal })
    if (!r.ok) {
      const text = await r.text()
      throw new Error(`Models ${r.status}: ${text.substring(0, 200)}`)
    }
    return normalizeModelList(await r.json())
  }

  const base = normalizeOpenAIBaseUrl(baseUrl)
  const modelsUrl = `${base}/models`
  const url = getProxiedUrl(modelsUrl)
  const r = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal,
  })
  if (!r.ok) {
    await throwApiError('Models', r)
  }
  return normalizeModelList(await r.json())
}

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions
): Promise<ChatResponse> {
  assertChatNotCoolingDown()
  if (!options.apiKey) {
    const r = await fetch(APP_API_ROUTES.aiChat, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      }),
      signal: options.signal,
    })
    if (!r.ok) {
      await throwApiError('Chat', r)
    }
    return r.json()
  }

  const base = normalizeOpenAIBaseUrl(options.baseUrl)
  const chatUrl = `${base}/chat/completions`
  const url = getProxiedUrl(chatUrl)
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
      stream: false,
    }),
    signal: options.signal,
  })
  if (!r.ok) {
    await throwApiError('Chat', r)
  }
  return r.json()
}

// 流式 chat
export async function* chatStream(
  options: ChatOptions & { messages: ChatMessage[] }
): AsyncGenerator<string, void, void> {
  assertChatNotCoolingDown()
  const { messages, ...rest } = options

  if (!rest.apiKey) {
    const r = await fetch(APP_API_ROUTES.aiChatStream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model: rest.model,
        temperature: rest.temperature,
        maxTokens: rest.maxTokens,
      }),
      signal: rest.signal,
    })
    if (!r.ok) {
      await throwApiError('Chat', r)
    }
    yield* readSseStream(r)
    return
  }

  const base = normalizeOpenAIBaseUrl(rest.baseUrl)
  const chatUrl = `${base}/chat/completions`
  const url = getProxiedUrl(chatUrl)
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${rest.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: rest.model,
      messages,
      temperature: rest.temperature ?? 0.7,
      max_tokens: rest.maxTokens ?? 2000,
      stream: true,
    }),
    signal: rest.signal,
  })
  if (!r.ok) {
    await throwApiError('Chat', r)
  }
  if (!r.body) {
    throw new Error('No response body')
  }
  yield* readSseStream(r)
}

async function* readSseStream(r: Response): AsyncGenerator<string, void, void> {
  if (!r.body) {
    throw new Error('No response body')
  }
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      if (buf.trim()) {
        const trimmed = buf.trim()
        if (trimmed.startsWith('data:')) {
          const payload = trimmed.slice(5).trim()
          if (payload !== '[DONE]') {
            try {
              const obj = JSON.parse(payload)
              const content = obj.choices?.[0]?.delta?.content
              if (content) yield content
            } catch { /* ignore */ }
          }
        }
      }
      break
    }
    buf += decoder.decode(value, { stream: true })
    // SSE: 多个 "data: {...}\n\n"
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const obj = JSON.parse(payload)
        const content = obj.choices?.[0]?.delta?.content
        if (content) yield content
      } catch {
        // ignore parse error
      }
    }
  }
}

// 股票分析 prompt 模板
export const STOCK_ANALYSIS_PROMPT = `你是一位资深股票分析师。基于以下研究主题和数据，给出深度分析。

# 主题
{topic}

# 股票
{symbol} {name}
最新价: {price} ({change})
52周区间: {low52}-{high52}
市值: {marketCap}
行业: {layer}
实时数据: {liveInfo}

# 用户问题
{question}

请用 Markdown 格式回答，结构清晰，包含：
- 核心结论（1-2 句）
- 关键因素分析
- 风险提示
- 操作建议（仅供参考，非投资建议）`

export interface StockAnalysisArgs {
  symbol: string
  name?: string
  region?: string
  layer?: string
  topicName: string
  topicDesc?: string
  liveInfo?: string
  question?: string
}

export function buildStockAnalysisPrompt(args: StockAnalysisArgs): string {
  return STOCK_ANALYSIS_PROMPT
    .replace('{topic}', `${args.topicName}（${args.topicDesc || ''}）`)
    .replace('{symbol}', args.symbol)
    .replace('{name}', args.name || args.symbol)
    .replace('{price}', 'N/A')
    .replace('{change}', 'N/A')
    .replace('{low52}', 'N/A')
    .replace('{high52}', 'N/A')
    .replace('{marketCap}', 'N/A')
    .replace('{layer}', args.layer || 'N/A')
    .replace('{liveInfo}', args.liveInfo || '（无）')
    .replace('{question}', args.question || '请给出当前价位的整体评估。')
}
