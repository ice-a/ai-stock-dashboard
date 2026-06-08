// 板块系统类型定义

export type Market = 'A股' | '港股' | '美股'

export interface SectorStock {
  symbol: string           // LongPort 格式: NVDA.US, 00700.HK, 600176.SH
  name: string
  market: Market
  reason?: string          // AI 生成时的入选理由
  layer?: string           // 产业链层级: 上游/中游/下游/基础设施
  tags?: string[]
}

export interface Sector {
  id: string               // kebab-case: 'ai-chain', 'semiconductor'
  name: string             // 显示名: 'AI 产业链', '半导体'
  description: string
  icon?: string            // emoji 或图标名
  stocks: SectorStock[]
  isBuiltIn: boolean       // 内置板块不可删除
  createdAt: number
  updatedAt: number
}

export interface StockNews {
  title: string
  source: string
  time: string
  url: string
  summary?: string
  generatedByAI?: boolean
}

export interface StockAnnouncement {
  title: string
  time: string
  url: string
  type?: string            // 公告类型
  generatedByAI?: boolean
}

export interface ETFHolding {
  etfSymbol: string
  etfName: string
  weight?: number          // 持仓占比
  market: Market
  generatedByAI?: boolean
}

export interface StockDetail {
  symbol: string
  name: string
  market: Market
  sector?: string          // 所属板块
  news: StockNews[]
  announcements: StockAnnouncement[]
  etfs: ETFHolding[]
  aiAnalysis?: string      // AI 生成的分析文本
  updatedAt: number
}

// AI 生成板块的 prompt 结构
export interface SectorGenerateRequest {
  sectorName: string
  description?: string
  maxStocks?: number
}

export interface SectorGenerateResponse {
  stocks: SectorStock[]
  summary: string
}
