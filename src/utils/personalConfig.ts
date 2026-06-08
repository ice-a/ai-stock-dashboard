import { useAccountStore } from '../stores/account'
import { sanitizeAvailableModels, sanitizeModelId, useAIStore, type AIConfig } from '../stores/ai'
import { usePortfolioStore } from '../stores/portfolio'
import { useQuotesStore } from '../stores/quotes'
import { useRefreshStore } from '../stores/refresh'
import { useSectorStore } from '../stores/sector'
import { useSettingsStore, type Settings } from '../stores/settings'
import { useWatchlistStore } from '../stores/watchlist'
import { setLocale } from '../i18n'
import type { FavoriteItem, PortfolioHolding, Quote } from '../types'

export interface PersonalConfig {
  version: 4
  settings: Settings
  ai: Pick<AIConfig, 'baseUrl' | 'apiKey' | 'model' | 'availableModels' | 'temperature' | 'maxTokens' | 'lastSync' | 'serverManaged'>
  favorites: FavoriteItem[]
  portfolio: PortfolioHolding[]
  sectors: unknown
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

  return {
    version: 4,
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
    sectors: safeParse(sector.exportJson(), { version: 1, sectors: [] }),
    savedAt: new Date().toISOString(),
  }
}

export function applyPersonalConfig(input: Record<string, unknown> | null | undefined): string[] {
  if (!input || typeof input !== 'object') return []

  const applied: string[] = []
  const settings = useSettingsStore()
  const refresh = useRefreshStore()
  const ai = useAIStore()
  const watchlist = useWatchlistStore()
  const portfolio = usePortfolioStore()
  const sector = useSectorStore()
  const quotes = useQuotesStore()

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
      serverManaged: ai.serverManaged || Boolean(remote.serverManaged),
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

  if (input.sectors && typeof input.sectors === 'object') {
    const result = sector.importJson(JSON.stringify(input.sectors))
    if (result.added || result.merged) applied.push('板块')
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
