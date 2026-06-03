// 主题（研究领域）类型
// 不再硬编码"AI 底层供应链"，用户可自由创建/切换主题

import type { LeaderStock, WatchlistIdea, DeepDiveStock } from '../types'

export interface ChainLayer {
  id: string
  name: string
  emoji?: string
  description: string
  stocks: { symbol: string; name: string; note?: string }[]
}

export interface DsxLayer {
  id: string
  name: string
  description: string
  stocks: { symbol: string; name: string }[]
}

export interface HomeCard {
  id: string
  title: string
  value: string
  description?: string
  tone?: 'up' | 'down' | 'neutral' | 'info'
  link?: string
}

export interface PostMarketRow {
  symbol: string
  name: string
  region: string
  reason: string
  change?: number
}

export interface TopicData {
  leaderUniverse: LeaderStock[]
  watchlistIdeas: WatchlistIdea[]
  deepDiveStocks: DeepDiveStock[]
  chainLayers: ChainLayer[]
  dsxLayers: DsxLayer[]
  homeCards: HomeCard[]
  postMarketStrong?: PostMarketRow[]
  postMarketWeak?: PostMarketRow[]
  counterConditions?: { title: string; items: string[] }[]
}

export interface Topic {
  id: string
  name: string
  emoji?: string
  description?: string
  systemPrompt?: string  // AI 分析时的 system 提示
  isBuiltIn?: boolean
  createdAt: number
  updatedAt: number
  data: TopicData
}

export interface TopicSummary {
  id: string
  name: string
  emoji?: string
  description?: string
  count: {
    universe: number
    watchlist: number
    deepDive: number
    chains: number
    dsx: number
  }
  createdAt: number
  isBuiltIn?: boolean
}
