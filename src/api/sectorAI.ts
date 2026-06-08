// AI 动态生成板块股票列表
import type { SectorStock, SectorGenerateResponse } from '../sectors/types'
import { useAIStore } from '../stores/ai'

const SECTOR_PROMPT = `你是一位专业的股票分析师。请根据以下板块信息，生成相关的股票列表。

板块名称: {name}
板块描述: {description}
数量要求: 最多 {max} 只

请严格按以下 JSON 格式返回（不要有其他文字）:
{
  "stocks": [
    {
      "symbol": "长桥格式代码（如 NVDA.US, 00700.HK, 600176.SH）",
      "name": "公司名称",
      "market": "美股/港股/A股",
      "reason": "入选理由（一句话）",
      "layer": "产业链层级（如 上游·芯片, 中游·平台, 下游·应用）",
      "tags": ["标签1", "标签2"]
    }
  ],
  "summary": "板块整体分析摘要（2-3句话）"
}

注意:
1. symbol 必须使用长桥格式：美股 XXX.US, 港股 XXXX.HK, A股沪市 XXXXXX.SH 深市 XXXXXX.SZ
2. 优先选择行业龙头和高关注度公司
3. market 只能是 "美股"/"港股"/"A股" 之一
4. 每只股票必须有明确的入选理由`

export async function generateSectorStocks(
  sectorName: string,
  description: string,
  maxStocks: number = 30,
): Promise<SectorGenerateResponse> {
  const ai = useAIStore()
  if (!ai.isConfigured) {
    throw new Error('请先在设置页配置 AI Base URL、API Key 和模型。')
  }

  const prompt = SECTOR_PROMPT
    .replace('{name}', sectorName)
    .replace('{description}', description)
    .replace('{max}', String(maxStocks))

  const { chat } = await import('./ai')
  const resp = await chat(
    [
      { role: 'system', content: '你是专业的股票分析师，只输出 JSON，不要有其他文字。' },
      { role: 'user', content: prompt },
    ],
    {
      baseUrl: ai.baseUrl,
      apiKey: ai.apiKey,
      model: ai.model,
      temperature: 0.3,
      maxTokens: 4000,
    }
  )

  const text = resp.choices?.[0]?.message?.content || ''
  // 提取 JSON（兼容 markdown code block）
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('AI 返回格式错误，请重试')
  }
  const parsed = JSON.parse(jsonMatch[0]) as SectorGenerateResponse
  if (!parsed.stocks || !Array.isArray(parsed.stocks)) {
    throw new Error('AI 返回数据结构错误')
  }
  return parsed
}

// 基于个股的 AI 分析
export async function analyzeStockAI(
  symbol: string,
  name: string,
  context: string,
): Promise<string> {
  const ai = useAIStore()
  if (!ai.isConfigured) {
    throw new Error('请先在设置页配置 AI Base URL、API Key 和模型。')
  }

  const { chatStream } = await import('./ai')
  const stream = chatStream({
    baseUrl: ai.baseUrl,
    apiKey: ai.apiKey,
    model: ai.model,
    temperature: 0.5,
    maxTokens: 3000,
    messages: [
      {
        role: 'system',
        content: '你是一位资深股票分析师。基于提供的信息给出深度分析，用 Markdown 格式回答。包含：核心结论、关键因素、风险提示、操作建议。'
      },
      {
        role: 'user',
        content: `请分析以下股票:\n\n股票: ${symbol} (${name})\n\n${context}`
      },
    ],
  })

  let result = ''
  for await (const chunk of stream) {
    result += chunk
  }
  return result
}
