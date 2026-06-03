// 静态快照：API 失败时回退
// 数据来自原报告 2026-06-01/02 的快照
import { AI_SUPPLY_CHAIN_TOPIC } from '../topics/defaultTopic'
import { CPO_TOPIC } from '../topics/cpoTopic'

interface FallbackEntry {
  d1: number
  d20: number
  d60: number
  d252: number
  name?: string
}

const FALLBACK_MAP: Record<string, FallbackEntry> = {}

for (const idea of AI_SUPPLY_CHAIN_TOPIC.data.watchlistIdeas) {
  FALLBACK_MAP[idea.symbol] = {
    d1: idea.d1,
    d20: idea.d20,
    d60: idea.d60,
    d252: idea.d252,
    name: idea.name,
  }
}

// CPO 主题观察名单快照
for (const idea of CPO_TOPIC.data.watchlistIdeas) {
  FALLBACK_MAP[idea.symbol] = {
    d1: idea.d1,
    d20: idea.d20,
    d60: idea.d60,
    d252: idea.d252,
    name: idea.name,
  }
}

// 一些不在观察名单里但可能在公司池里出现的标的
const EXTRA_FALLBACK: Record<string, FallbackEntry> = {
  'NVDA.US': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: 'NVIDIA' },
  'AVGO.US': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: 'Broadcom' },
  'TSM.US': { d1: 0.0, d20: 0, d60: 0, d252: 0, name: 'TSMC ADR' },
}

const ALL: Record<string, FallbackEntry> = { ...EXTRA_FALLBACK, ...FALLBACK_MAP }

export function getFallbackQuote(symbol: string): FallbackEntry | null {
  return ALL[symbol] || null
}

export function hasFallback(symbol: string): boolean {
  return symbol in ALL
}
