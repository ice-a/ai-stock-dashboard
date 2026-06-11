export type Region =
  | '美股' | 'A股' | '港股' | '日本' | '韩国' | '台湾'
  | '欧洲' | '印度' | '澳大利亚' | '马来西亚'

// ============ Subscription Types ============
export type SubscriptionTier = 'free' | 'pro' | 'team'

export interface SubscriptionPlan {
  id: SubscriptionTier
  name: string
  price: number
  currency: string
  interval: 'month' | 'year'
  features: SubscriptionFeature[]
}

export type SubscriptionFeature =
  | 'unlimited_stocks'
  | 'ai_analysis'
  | 'advanced_alerts'
  | 'cloud_sync'
  | 'export_pdf'
  | 'priority_support'
  | 'team_sharing'
  | 'api_access'

export interface UserSubscription {
  tier: SubscriptionTier
  status: 'active' | 'cancelled' | 'expired' | 'trial'
  currentPeriodEnd: number | null
  trialEndsAt: number | null
  paymentMethod: string | null
  lastPaymentAt: number | null
}

export interface UsageLimits {
  maxStocks: number
  maxAlerts: number
  maxAiRequests: number
  aiRequestsUsed: number
  period: 'daily' | 'monthly'
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'CNY',
    interval: 'month',
    features: [],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    currency: 'CNY',
    interval: 'month',
    features: [
      'unlimited_stocks',
      'ai_analysis',
      'advanced_alerts',
      'cloud_sync',
      'export_pdf',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    price: 99,
    currency: 'CNY',
    interval: 'month',
    features: [
      'unlimited_stocks',
      'ai_analysis',
      'advanced_alerts',
      'cloud_sync',
      'export_pdf',
      'priority_support',
      'team_sharing',
      'api_access',
    ],
  },
]

export const FREE_LIMITS: UsageLimits = {
  maxStocks: 3,
  maxAlerts: 3,
  maxAiRequests: 5,
  aiRequestsUsed: 0,
  period: 'daily',
}

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
  source: 'longport' | 'eastmoney' | 'sina' | 'fallback' | 'cache'
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

export type PortfolioTransactionType = 'buy' | 'sell'

export interface PortfolioTransaction {
  id: string
  symbol: string
  name: string
  type: PortfolioTransactionType
  price: number
  quantity: number
  fee: number
  tradeDate: string
  note: string
  realizedProfit: number | null
  realizedProfitRate: number | null
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

export type AlertRuleType =
  | 'price-above'
  | 'price-below'
  | 'change-up'
  | 'change-down'
  | 'profit-rate-above'
  | 'profit-rate-below'
  | 'stale-quote'
  | 'fallback-source'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface AlertRule {
  id: string
  symbol: string
  name: string
  type: AlertRuleType
  threshold: number
  enabled: boolean
  note: string
  cooldownMinutes: number
  lastTriggeredAt: number | null
  createdAt: number
  updatedAt: number
}

export interface AlertEvent {
  id: string
  ruleId: string
  symbol: string
  name: string
  type: AlertRuleType
  severity: AlertSeverity
  title: string
  message: string
  value: number | null
  threshold: number
  source?: Quote['source']
  triggeredAt: number
  acknowledgedAt: number | null
}

export type NotificationProvider = 'bark'

export interface NotificationConfig {
  enabled: boolean
  provider: NotificationProvider
  bark: {
    serverUrl: string
    deviceKey: string
    group: string
    level: 'active' | 'timeSensitive' | 'passive'
    sound: string
  }
  lastTestAt: number | null
  lastError: string
}

export type AIResearchReportKind = 'stock-advice' | 'comparison'

export interface AIResearchReport {
  id: string
  kind: AIResearchReportKind
  title: string
  symbols: string[]
  content: string
  payload: unknown
  model: string
  source: 'stock-detail' | 'research-compare'
  createdAt: number
}

export interface RefreshState {
  status: 'idle' | 'loading' | 'success' | 'error' | 'paused' | 'market-closed'
  lastUpdate: number | null
  nextUpdateAt: number | null
  failures: number
  message?: string
}
