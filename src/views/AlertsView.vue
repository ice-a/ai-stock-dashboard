<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ALERT_RULE_LABELS, useAlertsStore } from '../stores/alerts'
import { useQuotesStore } from '../stores/quotes'
import { useRefreshStore } from '../stores/refresh'
import { useAutoRefresh } from '../composables/useAutoRefresh'
import { isLikelySupported } from '../api/symbolMap'
import { formatDate, formatPercent, formatPrice, quoteTone } from '../utils/format'
import type { AlertEvent, AlertRule, AlertRuleType } from '../types'

const router = useRouter()
const alerts = useAlertsStore()
const quotesStore = useQuotesStore()
const refreshStore = useRefreshStore()

const form = ref({
  symbol: '',
  name: '',
  type: 'price-above' as AlertRuleType,
  threshold: null as number | null,
  note: '',
  cooldownMinutes: 60,
})
const refreshing = ref(false)
const typeFilter = ref<'all' | AlertRuleType>('all')
const statusFilter = ref<'all' | 'active' | 'paused'>('all')

const ruleTypes: { type: AlertRuleType; hint: string }[] = [
  { type: 'price-above', hint: '当前价大于或等于目标价' },
  { type: 'price-below', hint: '当前价小于或等于止损/观察价' },
  { type: 'change-up', hint: '单日涨幅达到百分比阈值' },
  { type: 'change-down', hint: '单日跌幅达到百分比阈值' },
  { type: 'profit-rate-above', hint: '持仓浮盈达到百分比阈值' },
  { type: 'profit-rate-below', hint: '持仓浮亏达到百分比阈值' },
  { type: 'stale-quote', hint: '行情更新时间超过分钟阈值' },
  { type: 'fallback-source', hint: '行情源降级为静态快照' },
]

const normalizedSymbol = computed(() => {
  const raw = form.value.symbol.trim().toUpperCase()
  if (!raw) return ''
  if (isLikelySupported(raw)) return raw
  if (/^[A-Z]{1,6}$/.test(raw)) return `${raw}.US`
  if (/^\d{5}$/.test(raw)) return `${raw}.HK`
  if (/^\d{6}$/.test(raw)) return raw.startsWith('6') ? `${raw}.SH` : `${raw}.SZ`
  return raw
})

const thresholdDisabled = computed(() => form.value.type === 'fallback-source')
const thresholdLabel = computed(() => {
  if (form.value.type.startsWith('price')) return '价格阈值'
  if (form.value.type.startsWith('change')) return '涨跌幅阈值（%）'
  if (form.value.type.startsWith('profit')) return '收益率阈值（%）'
  if (form.value.type === 'stale-quote') return '过期阈值（分钟）'
  return '无需阈值'
})
const canSubmit = computed(() => {
  if (!normalizedSymbol.value) return false
  if (thresholdDisabled.value) return true
  return Number(form.value.threshold) > 0
})

const knownSymbols = computed(() => {
  const map = new Map<string, string>()
  for (const item of alerts.watchlistOptions) map.set(item.symbol, item.name)
  for (const item of alerts.portfolioOptions) map.set(item.symbol, item.name)
  for (const rule of alerts.rules) map.set(rule.symbol, rule.name)
  return [...map.entries()].map(([symbol, name]) => ({ symbol, name }))
})

const filteredRules = computed(() => alerts.rules.filter((rule) => {
  if (typeFilter.value !== 'all' && rule.type !== typeFilter.value) return false
  if (statusFilter.value === 'active' && !rule.enabled) return false
  if (statusFilter.value === 'paused' && rule.enabled) return false
  return true
}))

const activeRuleCount = computed(() => alerts.rules.filter(rule => rule.enabled).length)

const enabled = computed(() => refreshStore.enabled)
const interval = computed(() => refreshStore.listInterval)

const { refreshNow } = useAutoRefresh({
  interval,
  enabled,
  fetcher: async () => {
    if (!alerts.symbols.length) {
      alerts.evaluateAll()
      return
    }
    await quotesStore.fetchAndStore(alerts.symbols, { force: true })
    alerts.evaluateAll()
  },
})

watch(() => form.value.type, (type) => {
  if (type === 'fallback-source') form.value.threshold = 0
  else if (type === 'stale-quote' && !form.value.threshold) form.value.threshold = 30
  else if ((type === 'change-up' || type === 'change-down') && !form.value.threshold) form.value.threshold = 3
  else if ((type === 'profit-rate-above' || type === 'profit-rate-below') && !form.value.threshold) form.value.threshold = 10
})

onMounted(() => {
  alerts.evaluateAll()
})

function selectKnownSymbol(symbol: string, name: string) {
  form.value.symbol = symbol
  if (!form.value.name || form.value.name === form.value.symbol) form.value.name = name
}

function submitRule() {
  if (!canSubmit.value) return
  const symbol = normalizedSymbol.value
  const name = form.value.name.trim() || knownSymbols.value.find(item => item.symbol === symbol)?.name || symbol
  alerts.addRule({
    symbol,
    name,
    type: form.value.type,
    threshold: thresholdDisabled.value ? 0 : Number(form.value.threshold),
    enabled: true,
    note: form.value.note.trim(),
    cooldownMinutes: Number(form.value.cooldownMinutes) || 60,
  })
  quotesStore.fetchOne(symbol, { force: true })
    .then(() => alerts.evaluateAll())
    .catch(() => alerts.evaluateAll())
  form.value = {
    symbol: '',
    name: '',
    type: 'price-above',
    threshold: null,
    note: '',
    cooldownMinutes: 60,
  }
}

async function refreshAlerts() {
  refreshing.value = true
  try {
    await refreshNow()
  } finally {
    refreshing.value = false
  }
}

function eventTone(event: AlertEvent): string {
  if (event.severity === 'critical') return 'critical'
  if (event.severity === 'warning') return 'warning'
  return 'info'
}

function formatRuleThreshold(rule: AlertRule): string {
  if (rule.type === 'fallback-source') return '静态快照'
  if (rule.type.startsWith('price')) return formatPrice(rule.threshold)
  if (rule.type === 'stale-quote') return `${rule.threshold} 分钟`
  return `${rule.threshold.toFixed(2)}%`
}

function formatEventValue(event: AlertEvent): string {
  if (event.value == null) return '—'
  if (event.type.startsWith('price')) return formatPrice(event.value)
  if (event.type === 'stale-quote') return `${Math.round(event.value)} 分钟`
  return formatPercent(event.value)
}

function goToStock(symbol: string) {
  router.push(`/stock/${encodeURIComponent(symbol)}`)
}
</script>

<template>
  <div class="page alerts-page">
    <section class="hero">
      <div>
        <p class="eyebrow">预警中心</p>
        <h1>把行情变化变成可处理信号</h1>
        <p class="muted">为自选股、持仓和行情质量设置规则。触发记录保存在本地，并随个人配置同步到云端。</p>
      </div>
      <div class="hero-actions">
        <button class="btn" :disabled="refreshing || !alerts.rules.length" @click="refreshAlerts">
          <span v-if="refreshing" class="spinner"></span>
          刷新并检测
        </button>
        <button class="btn" :disabled="!alerts.unacknowledgedEvents.length" @click="alerts.acknowledgeAll()">全部确认</button>
      </div>
    </section>

    <section class="summary-grid">
      <div class="summary-card">
        <span class="small muted">规则总数</span>
        <strong>{{ alerts.rules.length }}</strong>
      </div>
      <div class="summary-card">
        <span class="small muted">启用规则</span>
        <strong>{{ activeRuleCount }}</strong>
      </div>
      <div class="summary-card alert-stat">
        <span class="small muted">待确认</span>
        <strong>{{ alerts.unacknowledgedEvents.length }}</strong>
      </div>
      <div class="summary-card">
        <span class="small muted">监控股票</span>
        <strong>{{ alerts.symbols.length }}</strong>
      </div>
    </section>

    <section class="rule-composer card">
      <div class="section-head">
        <div>
          <h2>新增规则</h2>
          <p class="muted small">价格、涨跌幅、持仓收益和行情源质量都可以作为触发条件。</p>
        </div>
      </div>

      <div class="form-grid">
        <label>
          <span class="small muted">股票</span>
          <input v-model="form.symbol" list="alert-symbols" type="text" placeholder="NVDA / 00700 / 600519" />
          <datalist id="alert-symbols">
            <option v-for="item in knownSymbols" :key="item.symbol" :value="item.symbol">{{ item.name }}</option>
          </datalist>
        </label>
        <label>
          <span class="small muted">名称</span>
          <input v-model="form.name" type="text" placeholder="可选，默认使用代码" />
        </label>
        <label>
          <span class="small muted">规则类型</span>
          <select v-model="form.type">
            <option v-for="item in ruleTypes" :key="item.type" :value="item.type">{{ ALERT_RULE_LABELS[item.type] }}</option>
          </select>
        </label>
        <label>
          <span class="small muted">{{ thresholdLabel }}</span>
          <input v-model.number="form.threshold" type="number" min="0" step="0.01" :disabled="thresholdDisabled" placeholder="0.00" />
        </label>
        <label>
          <span class="small muted">冷却时间（分钟）</span>
          <input v-model.number="form.cooldownMinutes" type="number" min="5" step="5" />
        </label>
        <label>
          <span class="small muted">备注</span>
          <input v-model="form.note" type="text" placeholder="触发后需要关注什么" />
        </label>
      </div>

      <div class="known-list" v-if="knownSymbols.length">
        <span class="small muted">快速选择</span>
        <button v-for="item in knownSymbols.slice(0, 10)" :key="item.symbol" class="ticker-btn" @click="selectKnownSymbol(item.symbol, item.name)">
          <code>{{ item.symbol }}</code>
          <span>{{ item.name }}</span>
        </button>
      </div>

      <div class="form-actions">
        <span v-if="normalizedSymbol" class="small muted">将监控 <code>{{ normalizedSymbol }}</code></span>
        <span v-else class="small muted">{{ ruleTypes.find(item => item.type === form.type)?.hint }}</span>
        <button class="btn primary" :disabled="!canSubmit" @click="submitRule">添加预警</button>
      </div>
    </section>

    <section class="content-grid">
      <div class="rules-panel card">
        <div class="section-head">
          <h2>规则</h2>
          <div class="filters">
            <select v-model="typeFilter">
              <option value="all">全部类型</option>
              <option v-for="item in ruleTypes" :key="item.type" :value="item.type">{{ ALERT_RULE_LABELS[item.type] }}</option>
            </select>
            <select v-model="statusFilter">
              <option value="all">全部状态</option>
              <option value="active">启用</option>
              <option value="paused">暂停</option>
            </select>
          </div>
        </div>

        <div v-if="!filteredRules.length" class="empty-state">
          <h3>暂无预警规则</h3>
          <p class="muted">先添加一条价格或持仓预警，后续行情刷新会自动检测。</p>
        </div>

        <div v-else class="rule-list">
          <article v-for="rule in filteredRules" :key="rule.id" class="rule-card">
            <div class="rule-main">
              <button class="symbol-button" @click="goToStock(rule.symbol)">
                <strong>{{ rule.name }}</strong>
                <span>{{ rule.symbol }}</span>
              </button>
              <div>
                <span class="tag">{{ ALERT_RULE_LABELS[rule.type] }}</span>
                <p v-if="rule.note" class="small muted">{{ rule.note }}</p>
              </div>
            </div>
            <div class="rule-metric">
              <span class="small muted">阈值</span>
              <strong>{{ formatRuleThreshold(rule) }}</strong>
            </div>
            <div class="rule-metric">
              <span class="small muted">当前</span>
              <strong v-if="quotesStore.get(rule.symbol)?.price != null">{{ formatPrice(quotesStore.get(rule.symbol)?.price) }}</strong>
              <strong v-else>—</strong>
              <em :class="quoteTone(quotesStore.get(rule.symbol)?.change)">{{ formatPercent(quotesStore.get(rule.symbol)?.change) }}</em>
            </div>
            <div class="rule-actions">
              <button class="btn sm" @click="alerts.updateRule(rule.id, { enabled: !rule.enabled })">{{ rule.enabled ? '暂停' : '启用' }}</button>
              <button class="btn sm ghost danger" @click="alerts.removeRule(rule.id)">删除</button>
            </div>
          </article>
        </div>
      </div>

      <div class="events-panel card">
        <div class="section-head">
          <h2>触发记录</h2>
          <button class="btn sm ghost" :disabled="!alerts.events.length" @click="alerts.clearEvents()">清空记录</button>
        </div>

        <div v-if="!alerts.recentEvents.length" class="empty-state compact">
          <h3>暂无触发</h3>
          <p class="muted">满足条件后，记录会出现在这里。</p>
        </div>

        <div v-else class="event-list">
          <article
            v-for="event in alerts.recentEvents"
            :key="event.id"
            class="event-card"
            :class="[eventTone(event), { acked: event.acknowledgedAt }]"
          >
            <div class="event-top">
              <span class="severity">{{ event.severity }}</span>
              <span class="small muted">{{ formatDate(event.triggeredAt, 'relative') }}</span>
            </div>
            <h3>{{ event.title }}</h3>
            <p>{{ event.message }}</p>
            <div class="event-meta">
              <span class="ticker">{{ event.symbol }}</span>
              <span>{{ ALERT_RULE_LABELS[event.type] }}</span>
              <span>当前 {{ formatEventValue(event) }}</span>
              <span v-if="event.source">来源 {{ event.source }}</span>
            </div>
            <div class="event-actions">
              <button class="btn sm" @click="goToStock(event.symbol)">查看个股</button>
              <button v-if="!event.acknowledgedAt" class="btn sm primary" @click="alerts.acknowledgeEvent(event.id)">确认</button>
              <span v-else class="small muted">已确认 {{ formatDate(event.acknowledgedAt, 'relative') }}</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.alerts-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.hero,
.section-head,
.form-actions,
.event-top,
.event-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.hero {
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background:
    radial-gradient(circle at top left, color-mix(in srgb, var(--color-amber) 18%, transparent), transparent 34%),
    linear-gradient(135deg, var(--color-bg-elevated), var(--color-bg-muted));
  box-shadow: var(--shadow-sm);
}
.hero h1 {
  margin: 3px 0 var(--space-2);
}
.hero-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.eyebrow {
  margin: 0;
  color: var(--color-amber);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
}
.summary-card {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-elevated);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.summary-card strong {
  font-size: var(--fs-2xl);
}
.alert-stat strong {
  color: var(--color-amber);
}
.rule-composer {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}
.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.known-list {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.ticker-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-bg-muted);
  padding: 4px 9px;
  font-size: var(--fs-xs);
}
.ticker-btn:hover {
  border-color: var(--color-link);
  color: var(--color-link);
}
.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(340px, 0.75fr);
  gap: var(--space-4);
  align-items: start;
}
.rules-panel,
.events-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.filters {
  display: flex;
  gap: var(--space-2);
}
.empty-state {
  padding: var(--space-8);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  text-align: center;
  background: var(--color-bg-muted);
}
.empty-state.compact {
  padding: var(--space-5);
}
.rule-list,
.event-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.rule-card {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 110px 120px auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-muted);
}
.rule-main {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.symbol-button {
  border: 0;
  background: transparent;
  padding: 0;
  color: inherit;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.symbol-button span {
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
}
.rule-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.rule-metric strong {
  font-variant-numeric: tabular-nums;
}
.rule-metric em {
  font-size: var(--fs-xs);
  font-style: normal;
}
.rule-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
.event-card {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-left-width: 4px;
  border-radius: var(--radius-lg);
  background: var(--color-bg-muted);
}
.event-card.critical {
  border-left-color: var(--color-red);
}
.event-card.warning {
  border-left-color: var(--color-amber);
}
.event-card.info {
  border-left-color: var(--color-blue);
}
.event-card.acked {
  opacity: 0.72;
}
.event-card h3 {
  margin-top: var(--space-2);
}
.event-card p {
  margin: var(--space-2) 0;
}
.severity {
  padding: 2px 7px;
  border-radius: var(--radius-full);
  background: var(--color-chip-bg);
  color: var(--color-chip-text);
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
}
.event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  color: var(--color-muted);
  font-size: var(--fs-sm);
}
.event-actions {
  margin-top: var(--space-3);
}
.danger {
  color: var(--color-red);
}
input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
@media (max-width: 1100px) {
  .summary-grid,
  .form-grid,
  .content-grid {
    grid-template-columns: 1fr 1fr;
  }
  .content-grid {
    grid-template-columns: 1fr;
  }
  .rule-card {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 700px) {
  .hero,
  .section-head,
  .form-actions,
  .event-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .summary-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }
  .rule-card {
    grid-template-columns: 1fr;
  }
  .rule-actions,
  .filters {
    justify-content: stretch;
  }
  .rule-actions .btn,
  .filters select {
    flex: 1;
  }
}
</style>
