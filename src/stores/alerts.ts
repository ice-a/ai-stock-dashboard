import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { usePortfolioStore } from './portfolio'
import { useNotificationsStore } from './notifications'
import { useQuotesStore } from './quotes'
import { useWatchlistStore } from './watchlist'
import { formatPercent, formatPrice } from '../utils/format'
import type { AlertEvent, AlertRule, AlertRuleType, AlertSeverity } from '../types'

const STORAGE_KEY = 'ai-dashboard:alerts'

interface PersistedAlerts {
  version: 1
  rules: AlertRule[]
  events: AlertEvent[]
}

export const ALERT_RULE_LABELS: Record<AlertRuleType, string> = {
  'price-above': '价格突破',
  'price-below': '价格跌破',
  'change-up': '单日上涨',
  'change-down': '单日下跌',
  'profit-rate-above': '持仓盈利',
  'profit-rate-below': '持仓亏损',
  'stale-quote': '行情过期',
  'fallback-source': '静态快照',
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizeRule(input: AlertRule): AlertRule | null {
  if (!input?.symbol || !input?.type) return null
  return {
    id: input.id || uid('ar'),
    symbol: String(input.symbol).trim().toUpperCase(),
    name: String(input.name || input.symbol).trim(),
    type: input.type,
    threshold: Number(input.threshold) || 0,
    enabled: input.enabled !== false,
    note: String(input.note || ''),
    cooldownMinutes: Math.max(5, Number(input.cooldownMinutes) || 60),
    lastTriggeredAt: typeof input.lastTriggeredAt === 'number' ? input.lastTriggeredAt : null,
    createdAt: Number(input.createdAt) || Date.now(),
    updatedAt: Number(input.updatedAt) || Date.now(),
  }
}

function normalizeEvent(input: AlertEvent): AlertEvent | null {
  if (!input?.ruleId || !input?.symbol || !input?.type) return null
  return {
    id: input.id || uid('ae'),
    ruleId: input.ruleId,
    symbol: String(input.symbol).trim().toUpperCase(),
    name: String(input.name || input.symbol).trim(),
    type: input.type,
    severity: input.severity || 'warning',
    title: String(input.title || ALERT_RULE_LABELS[input.type] || '预警触发'),
    message: String(input.message || ''),
    value: typeof input.value === 'number' ? input.value : null,
    threshold: Number(input.threshold) || 0,
    source: input.source,
    triggeredAt: Number(input.triggeredAt) || Date.now(),
    acknowledgedAt: typeof input.acknowledgedAt === 'number' ? input.acknowledgedAt : null,
  }
}

function loadAlerts(): PersistedAlerts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: 1, rules: [], events: [] }
    const parsed = JSON.parse(raw) as Partial<PersistedAlerts>
    return {
      version: 1,
      rules: Array.isArray(parsed.rules) ? parsed.rules.map(normalizeRule).filter(Boolean) as AlertRule[] : [],
      events: Array.isArray(parsed.events) ? parsed.events.map(normalizeEvent).filter(Boolean) as AlertEvent[] : [],
    }
  } catch {
    return { version: 1, rules: [], events: [] }
  }
}

function ruleMessage(rule: AlertRule, value: number | null, source?: string): { title: string; message: string; severity: AlertSeverity } {
  const label = ALERT_RULE_LABELS[rule.type]
  if (rule.type === 'price-above') {
    return { title: `${rule.name} ${label}`, message: `当前价 ${formatPrice(value)} 已高于 ${formatPrice(rule.threshold)}。`, severity: 'critical' }
  }
  if (rule.type === 'price-below') {
    return { title: `${rule.name} ${label}`, message: `当前价 ${formatPrice(value)} 已低于 ${formatPrice(rule.threshold)}。`, severity: 'critical' }
  }
  if (rule.type === 'change-up') {
    return { title: `${rule.name} ${label}`, message: `单日涨幅 ${formatPercent(value)} 已超过 ${formatPercent(rule.threshold / 100)}。`, severity: 'warning' }
  }
  if (rule.type === 'change-down') {
    return { title: `${rule.name} ${label}`, message: `单日跌幅 ${formatPercent(value)} 已超过 ${formatPercent(Math.abs(rule.threshold) / 100)}。`, severity: 'warning' }
  }
  if (rule.type === 'profit-rate-above') {
    return { title: `${rule.name} ${label}`, message: `持仓收益率 ${formatPercent(value)} 已高于 ${formatPercent(rule.threshold / 100)}。`, severity: 'info' }
  }
  if (rule.type === 'profit-rate-below') {
    return { title: `${rule.name} ${label}`, message: `持仓收益率 ${formatPercent(value)} 已低于 -${Math.abs(rule.threshold).toFixed(2)}%。`, severity: 'critical' }
  }
  if (rule.type === 'stale-quote') {
    return { title: `${rule.name} ${label}`, message: `行情已 ${Math.round(value || 0)} 分钟未更新，超过 ${rule.threshold} 分钟阈值。`, severity: 'warning' }
  }
  return { title: `${rule.name} ${label}`, message: `当前行情来源为 ${source || 'fallback'}，请谨慎参考价格。`, severity: 'warning' }
}

export const useAlertsStore = defineStore('alerts', () => {
  const persisted = loadAlerts()
  const rules = ref<AlertRule[]>(persisted.rules)
  const events = ref<AlertEvent[]>(persisted.events)

  const quotesStore = useQuotesStore()
  const portfolioStore = usePortfolioStore()
  const watchlistStore = useWatchlistStore()
  const notificationsStore = useNotificationsStore()

  const enabledRules = computed(() => rules.value.filter(rule => rule.enabled))
  const symbols = computed(() => [...new Set(rules.value.map(rule => rule.symbol))])
  const unacknowledgedEvents = computed(() => events.value.filter(event => !event.acknowledgedAt))
  const recentEvents = computed(() => [...events.value].sort((a, b) => b.triggeredAt - a.triggeredAt).slice(0, 100))

  const watchlistOptions = computed(() => watchlistStore.items.map(item => ({
    symbol: item.symbol,
    name: item.symbol,
    targetPrice: item.targetPrice,
    note: item.note,
  })))

  const portfolioOptions = computed(() => portfolioStore.computedHoldings.map(item => ({
    symbol: item.symbol,
    name: item.name,
    profitRate: item.profitRate,
  })))

  function addRule(input: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt' | 'lastTriggeredAt'>) {
    const now = Date.now()
    rules.value.unshift({
      ...input,
      id: uid('ar'),
      symbol: input.symbol.trim().toUpperCase(),
      name: input.name.trim() || input.symbol.trim().toUpperCase(),
      threshold: Number(input.threshold) || 0,
      cooldownMinutes: Math.max(5, Number(input.cooldownMinutes) || 60),
      lastTriggeredAt: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  function updateRule(id: string, patch: Partial<Omit<AlertRule, 'id' | 'createdAt'>>) {
    const index = rules.value.findIndex(rule => rule.id === id)
    if (index < 0) return
    const current = rules.value[index]
    rules.value[index] = {
      ...current,
      ...patch,
      symbol: String(patch.symbol ?? current.symbol).trim().toUpperCase(),
      name: String(patch.name ?? current.name).trim() || current.symbol,
      threshold: Number(patch.threshold ?? current.threshold) || 0,
      cooldownMinutes: Math.max(5, Number(patch.cooldownMinutes ?? current.cooldownMinutes) || 60),
      updatedAt: Date.now(),
    }
  }

  function removeRule(id: string) {
    rules.value = rules.value.filter(rule => rule.id !== id)
  }

  function clearRules() {
    rules.value = []
  }

  function pushEvent(rule: AlertRule, value: number | null, source?: string): AlertEvent | null {
    const now = Date.now()
    const cooldownMs = rule.cooldownMinutes * 60_000
    if (rule.lastTriggeredAt && now - rule.lastTriggeredAt < cooldownMs) return null

    const content = ruleMessage(rule, value, source)
    const event: AlertEvent = {
      id: uid('ae'),
      ruleId: rule.id,
      symbol: rule.symbol,
      name: rule.name,
      type: rule.type,
      severity: content.severity,
      title: content.title,
      message: content.message,
      value,
      threshold: rule.threshold,
      source: source as AlertEvent['source'],
      triggeredAt: now,
      acknowledgedAt: null,
    }
    events.value.unshift(event)
    updateRule(rule.id, { lastTriggeredAt: now })
    if (events.value.length > 200) events.value = events.value.slice(0, 200)
    void notificationsStore.sendAlert(event)
    return event
  }

  function evaluateRule(rule: AlertRule): boolean {
    const quote = quotesStore.get(rule.symbol)
    const holding = portfolioStore.computedHoldings.find(item => item.symbol === rule.symbol)

    if (rule.type === 'price-above' && quote?.price != null && quote.price >= rule.threshold) {
      if (!pushEvent(rule, quote.price, quote.source)) return false
      return true
    }
    if (rule.type === 'price-below' && quote?.price != null && quote.price <= rule.threshold) {
      if (!pushEvent(rule, quote.price, quote.source)) return false
      return true
    }
    if (rule.type === 'change-up' && quote?.change != null && quote.change >= rule.threshold / 100) {
      if (!pushEvent(rule, quote.change, quote.source)) return false
      return true
    }
    if (rule.type === 'change-down' && quote?.change != null && quote.change <= -Math.abs(rule.threshold) / 100) {
      if (!pushEvent(rule, quote.change, quote.source)) return false
      return true
    }
    if (rule.type === 'profit-rate-above' && holding?.profitRate != null && holding.profitRate >= rule.threshold / 100) {
      if (!pushEvent(rule, holding.profitRate, holding.source)) return false
      return true
    }
    if (rule.type === 'profit-rate-below' && holding?.profitRate != null && holding.profitRate <= -Math.abs(rule.threshold) / 100) {
      if (!pushEvent(rule, holding.profitRate, holding.source)) return false
      return true
    }
    if (rule.type === 'stale-quote' && quote?.updatedAt) {
      const ageMinutes = (Date.now() - quote.updatedAt) / 60_000
      if (ageMinutes >= rule.threshold) {
        if (!pushEvent(rule, ageMinutes, quote.source)) return false
        return true
      }
    }
    if (rule.type === 'fallback-source' && quote?.source === 'fallback') {
      if (!pushEvent(rule, null, quote.source)) return false
      return true
    }
    return false
  }

  function evaluateAll(): number {
    let count = 0
    for (const rule of enabledRules.value) {
      if (evaluateRule(rule)) count++
    }
    return count
  }

  function acknowledgeEvent(id: string) {
    const event = events.value.find(item => item.id === id)
    if (event) event.acknowledgedAt = Date.now()
  }

  function acknowledgeAll() {
    const now = Date.now()
    for (const event of events.value) {
      if (!event.acknowledgedAt) event.acknowledgedAt = now
    }
  }

  function clearEvents() {
    events.value = []
  }

  function exportJson(): string {
    return JSON.stringify({ version: 1, rules: rules.value, events: events.value }, null, 2)
  }

  function importJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as Partial<PersistedAlerts>
      rules.value = Array.isArray(parsed.rules) ? parsed.rules.map(normalizeRule).filter(Boolean) as AlertRule[] : []
      events.value = Array.isArray(parsed.events) ? parsed.events.map(normalizeEvent).filter(Boolean) as AlertEvent[] : []
      return true
    } catch {
      return false
    }
  }

  watch([rules, events], () => {
    try {
      localStorage.setItem(STORAGE_KEY, exportJson())
    } catch { /* quota */ }
  }, { deep: true })

  return {
    rules,
    events,
    enabledRules,
    symbols,
    unacknowledgedEvents,
    recentEvents,
    watchlistOptions,
    portfolioOptions,
    addRule,
    updateRule,
    removeRule,
    clearRules,
    evaluateAll,
    acknowledgeEvent,
    acknowledgeAll,
    clearEvents,
    exportJson,
    importJson,
  }
})
