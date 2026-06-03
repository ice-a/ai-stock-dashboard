// OpenAI 兼容的 Chat Completions 客户端
// 支持 baseUrl + apiKey + model，可对接 OpenAI / Azure / DeepSeek / Moonshot / 智谱 / Ollama 等
// 流式输出（SSE）

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

function normalizeBaseUrl(baseUrl: string): string {
  let u = baseUrl.trim().replace(/\/+$/, '')
  // 兼容用户填的带 /v1 后缀或完整路径
  if (u.includes('/chat/completions')) return u
  if (/\/v\d+\/?$/.test(u)) return u
  // 部分 API 提供商已有自己的路径前缀（如智谱 /api/paas/v4），不追加 /v1
  if (/\/api\//.test(u)) return u
  return u + '/v1'
}

// 开发环境通过 Vite 代理解决 CORS 问题
// 将目标 URL 编码为 base64 作为代理路径
function getProxiedUrl(targetUrl: string): string {
  if (!import.meta.env.DEV) return targetUrl
  try {
    const url = new URL(targetUrl)
    const base = url.origin
    const path = url.pathname.replace(/^\//, '')
    const b64 = btoa(base)
    return `/api/ai-proxy/${b64}/${path}${url.search}`
  } catch {
    return targetUrl
  }
}

export async function listModels(baseUrl: string, apiKey: string, signal?: AbortSignal): Promise<ModelInfo[]> {
  if (!apiKey) {
    const r = await fetch('/api/ai/models', { signal })
    if (!r.ok) {
      const text = await r.text()
      throw new Error(`Models ${r.status}: ${text.substring(0, 200)}`)
    }
    const json = await r.json() as { data?: ModelInfo[] }
    return json.data || []
  }

  const base = normalizeBaseUrl(baseUrl)
  const modelsUrl = `${base}/models`
  const url = import.meta.env.DEV ? getProxiedUrl(modelsUrl) : modelsUrl
  const r = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    signal,
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Models ${r.status}: ${text.substring(0, 200)}`)
  }
  const json = (await r.json()) as { data?: ModelInfo[]; model?: ModelInfo }
  return json.data || (json.model ? [json.model] : [])
}

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions
): Promise<ChatResponse> {
  if (!options.apiKey) {
    const r = await fetch('/api/ai/chat', {
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
      const text = await r.text()
      throw new Error(`Chat ${r.status}: ${text.substring(0, 200)}`)
    }
    return r.json()
  }

  const base = normalizeBaseUrl(options.baseUrl)
  const chatUrl = `${base}/chat/completions`
  const url = import.meta.env.DEV ? getProxiedUrl(chatUrl) : chatUrl
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
    const text = await r.text()
    throw new Error(`Chat ${r.status}: ${text.substring(0, 200)}`)
  }
  return r.json()
}

// 流式 chat
export async function* chatStream(
  options: ChatOptions & { messages: ChatMessage[] }
): AsyncGenerator<string, void, void> {
  const { messages, ...rest } = options

  if (!rest.apiKey) {
    const r = await fetch('/api/ai/chat-stream', {
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
      const text = await r.text()
      throw new Error(`Chat ${r.status}: ${text.substring(0, 200)}`)
    }
    yield* readSseStream(r)
    return
  }

  const base = normalizeBaseUrl(rest.baseUrl)
  const chatUrl = `${base}/chat/completions`
  const url = import.meta.env.DEV ? getProxiedUrl(chatUrl) : chatUrl
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
    const text = await r.text()
    throw new Error(`Chat ${r.status}: ${text.substring(0, 200)}`)
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
    if (done) break
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
