import { useAccountStore } from '../stores/account'
import { sanitizeAvailableModels, sanitizeModelId, useAIStore, type AIConfig } from '../stores/ai'
import { useAlertsStore } from '../stores/alerts'
import { useNotificationsStore } from '../stores/notifications'
import { usePortfolioStore } from '../stores/portfolio'
import { useQuotesStore } from '../stores/quotes'
import { useResearchStore } from '../stores/research'
import { useRefreshStore } from '../stores/refresh'
import { useRuntimeConfigStore } from '../stores/runtimeConfig'
import { useSectorStore } from '../stores/sector'
import { useSettingsStore, type Settings } from '../stores/settings'
import { useWatchlistStore } from '../stores/watchlist'
import { setLocale } from '../i18n'
import type { FavoriteItem, PortfolioHolding, PortfolioTransaction, Quote } from '../types'

export interface PersonalConfig {
  version: 6
  settings: Settings
  ai: Pick<AIConfig, 'baseUrl' | 'apiKey' | 'model' | 'availableModels' | 'temperature' | 'maxTokens' | 'lastSync' | 'serverManaged'>
  favorites: FavoriteItem[]
  portfolio: PortfolioHolding[]
  portfolioTransactions: PortfolioTransaction[]
  sectors: unknown
  alerts: unknown
  notifications: unknown
  research: unknown
  quotes?: Record<string, Quote>
  savedAt: string
}

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

export function buildPersonalConfig(): PersonalConfig {
  const settings = useSettingsStore()
  const ai = useAIStore()
  const watchlist = useWatchlistStore()
  const portfolio = usePortfolioStore()
  const sector = useSectorStore()
  const alerts = useAlertsStore()
  const notifications = useNotificationsStore()
  const research = useResearchStore()

  return {
    version: 6,
    settings: settings.snapshot(),
    ai: {
      baseUrl: ai.baseUrl,
      apiKey: ai.apiKey,
      model: ai.model,
      availableModels: ai.availableModels,
      temperature: ai.temperature,
      maxTokens: ai.maxTokens,
      lastSync: ai.lastSync,
      serverManaged: ai.serverManaged,
    },
    favorites: watchlist.items,
    portfolio: portfolio.holdings,
    portfolioTransactions: portfolio.transactions,
    sectors: safeParse(sector.exportJson(), { version: 1, sectors: [] }),
    alerts: safeParse(alerts.exportJson(), { version: 1, rules: [], events: [] }),
    notifications: safeParse(notifications.exportJson(), { version: 1, config: null }),
    research: safeParse(research.exportJson(), { version: 1, reports: [] }),
    savedAt: new Date().toISOString(),
  }
}

export function applyPersonalConfig(input: Record<string, unknown> | null | undefined): string[] {
  if (!input || typeof input !== 'object') return []

  const applied: string[] = []
  const settings = useSettingsStore()
  const refresh = useRefreshStore()
  const runtimeConfig = useRuntimeConfigStore()
  const ai = useAIStore()
  const watchlist = useWatchlistStore()
  const portfolio = usePortfolioStore()
  const sector = useSectorStore()
  const quotes = useQuotesStore()
  const alerts = useAlertsStore()
  const notifications = useNotificationsStore()
  const research = useResearchStore()

  if (input.settings && typeof input.settings === 'object') {
    if (settings.importJson(JSON.stringify({ settings: input.settings }))) {
      refresh.setListInterval(settings.listInterval)
      refresh.setDetailInterval(settings.detailInterval)
      refresh.setEnabled(settings.enabled)
      refresh.setPauseOnHidden(settings.pauseOnHidden)
      refresh.setAlignToClock(settings.alignToClock)
      setLocale(settings.locale)
      applied.push('设置')
    }
  }

  if (input.ai && typeof input.ai === 'object') {
    const remote = input.ai as Partial<AIConfig>
    ai.save({
      baseUrl: typeof remote.baseUrl === 'string' ? remote.baseUrl : ai.baseUrl,
      apiKey: typeof remote.apiKey === 'string' ? remote.apiKey : ai.apiKey,
      model: sanitizeModelId(remote.model, ai.model),
      availableModels: Array.isArray(remote.availableModels) ? sanitizeAvailableModels(remote.availableModels) : ai.availableModels,
      temperature: Number.isFinite(remote.temperature) ? Number(remote.temperature) : ai.temperature,
      maxTokens: Number.isFinite(remote.maxTokens) ? Number(remote.maxTokens) : ai.maxTokens,
      lastSync: typeof remote.lastSync === 'number' ? remote.lastSync : ai.lastSync,
      serverManaged: runtimeConfig.config.ai.serverManaged && (ai.serverManaged || Boolean(remote.serverManaged)),
    })
    applied.push('AI 模型')
  }

  if (Array.isArray(input.favorites)) {
    watchlist.items = input.favorites as FavoriteItem[]
    applied.push('自选股')
  }

  if (Array.isArray(input.portfolio)) {
    portfolio.holdings = input.portfolio as PortfolioHolding[]
    applied.push('持仓')
  }

  if (Array.isArray(input.portfolioTransactions)) {
    portfolio.transactions = input.portfolioTransactions as PortfolioTransaction[]
    applied.push('交易流水')
  }

  if (input.sectors && typeof input.sectors === 'object') {
    const result = sector.importJson(JSON.stringify(input.sectors))
    if (result.added || result.merged) applied.push('板块')
  }

  if (input.alerts && typeof input.alerts === 'object') {
    if (alerts.importJson(JSON.stringify(input.alerts))) applied.push('预警')
  }

  if (input.notifications && typeof input.notifications === 'object') {
    if (notifications.importJson(JSON.stringify(input.notifications))) applied.push('通知')
  }

  if (input.research && typeof input.research === 'object') {
    if (research.importJson(JSON.stringify(input.research))) applied.push('研究报告')
  }

  if (input.quotes && typeof input.quotes === 'object' && !Array.isArray(input.quotes)) {
    quotes.setMany(Object.values(input.quotes) as Quote[])
    applied.push('报价缓存')
  }

  return applied
}

export async function loadPersonalConfigFromCloud(): Promise<{ loaded: boolean; applied: string[]; updatedAt: string | null }> {
  const account = useAccountStore()
  const payload = await account.fetchConfig()
  const applied = applyPersonalConfig(payload.config)
  return { loaded: Boolean(payload.config), applied, updatedAt: payload.updatedAt }
}

export async function savePersonalConfigToCloud(): Promise<string | null> {
  const account = useAccountStore()
  return await account.saveConfig(buildPersonalConfig() as unknown as Record<string, unknown>)
}
