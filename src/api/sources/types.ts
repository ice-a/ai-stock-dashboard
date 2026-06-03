// 数据源抽象接口
import type { Quote, KLineData } from '../../types'

export interface ProviderMeta {
  id: string
  name: string
  region: string  // 描述
  needsAuth: boolean
}

export interface ProviderResult<T> {
  ok: boolean
  data?: T
  error?: string
  duration: number
  via?: string
  source: string
}

export interface QuoteProvider {
  meta: ProviderMeta
  fetchQuote?(symbol: string, options?: { signal?: AbortSignal }): Promise<ProviderResult<Quote>>
  fetchQuotes?(symbols: string[], options?: { signal?: AbortSignal }): Promise<ProviderResult<Quote[]>>
  fetchKLine?(symbol: string, options?: { range?: string; interval?: string; signal?: AbortSignal }): Promise<ProviderResult<KLineData | null>>
  isConfigured?(): boolean
}
