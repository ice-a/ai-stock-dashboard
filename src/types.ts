export type Region =
  | '美股' | 'A股' | '港股' | '日本' | '韩国' | '台湾'
  | '欧洲' | '印度' | '澳大利亚' | '马来西亚'

export type StockStatus = '核心' | '重点' | '观察'

export interface LeaderStock {
  region: Region
  layer: string
  symbol: string   // LongPort style: NVDA.US, 300308.SZ
  name: string
  status: StockStatus
}

export interface WatchlistIdea {
  symbol: string
  name: string
  region: string
  layer: string
  evidence: string
  d1: number
  d5?: number
  d20: number
  d60: number
  d252: number
  risk: string
  tags: string[]
  tagLabel: '高优先级' | '等待确认' | '相对滞后' | '交易拥挤' | '核心高估值'
}

export interface DeepDiveStock {
  symbol: string
  quoteSymbol?: string
  name: string
  region: string
  layer: string
  status: WatchlistIdea['tagLabel']
  kline: { label: string; value: string }[]
  flow: string
  evidence: string
  valuation: string
  peers: string
  bear: string
  sourceLabel: string
  sourceUrl: string
}

export interface Quote {
  symbol: string                  // LongPort style
  yahooSymbol: string            // Yahoo style
  name?: string
  price: number | null
  prevClose: number | null
  change: number | null           // 1 day change ratio (e.g. 0.025 = +2.5%)
  changeAbs: number | null
  dayHigh: number | null
  dayLow: number | null
  dayOpen: number | null
  volume: number | null
  currency?: string
  marketState?: 'REGULAR' | 'PRE' | 'POST' | 'CLOSED' | 'PREPRE' | 'POSTPOST'
  marketCap?: number | null
  fiftyTwoWeekHigh?: number | null
  fiftyTwoWeekLow?: number | null
  shortName?: string
  longName?: string
  regularMarketTime?: number | null
  updatedAt: number
  source: 'longport' | 'eastmoney' | 'sina' | 'yahoo' | 'fallback' | 'cache'
}

export interface KLinePoint {
  time: number                   // unix seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface KLineData {
  symbol: string
  range: string
  interval: string
  points: KLinePoint[]
  meta: {
    currency?: string
    exchangeName?: string
    instrumentType?: string
    regularMarketPrice?: number
    previousClose?: number
  }
}

export interface FavoriteItem {
  symbol: string
  group: string                   // 'default' | user-defined
  note: string
  targetPrice: number | null
  addedAt: number
}

export interface PortfolioHolding {
  id: string
  symbol: string
  name: string
  buyPrice: number
  fee: number
  buyDate: string
  quantity: number
  createdAt: number
  updatedAt: number
}

export interface PortfolioHoldingComputed extends PortfolioHolding {
  currentPrice: number | null
  costAmount: number
  marketValue: number | null
  profit: number | null
  profitRate: number | null
  daysHeld: number
  source?: Quote['source']
}

export interface RefreshState {
  status: 'idle' | 'loading' | 'success' | 'error' | 'paused' | 'market-closed'
  lastUpdate: number | null
  nextUpdateAt: number | null
  failures: number
  message?: string
}
