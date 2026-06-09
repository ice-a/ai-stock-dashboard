<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuotesStore } from '../stores/quotes'
import { useSectorStore } from '../stores/sector'
import { useRefreshStore } from '../stores/refresh'
import { useAIStore } from '../stores/ai'
import { useAutoRefresh } from '../composables/useAutoRefresh'
import { fetchIndices, type MarketIndex } from '../api/indices'
import { chat } from '../api/ai'
import QuoteCard from '../components/QuoteCard.vue'
import HitokotoBar from '../components/HitokotoBar.vue'
import { formatPercent } from '../utils/format'
import type { Market, SectorStock } from '../sectors/types'

interface SectorSummary {
  overview: string
  advice: string
  hotStocks: string[]
  risks: string[]
}

const router = useRouter()
const quotesStore = useQuotesStore()
const sectorStore = useSectorStore()
const refreshStore = useRefreshStore()
const aiStore = useAIStore()

// 市场指数
const indices = ref<MarketIndex[]>([])
const indicesLoading = ref(false)

// 日期 & 万年历
const today = new Date()
const dateStr = today.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
const calendarInfo = ref<string | null>(null)
const calendarLoading = ref(false)

// 默认使用 AI 产业链板块
const activeSector = computed(() => sectorStore.activeSector)

// 按市场分组
const stocksByMarket = computed(() => {
  const sector = activeSector.value
  if (!sector) return {} as Record<Market, SectorStock[]>
  const groups: Record<Market, SectorStock[]> = { '美股': [], '港股': [], 'A股': [] }
  for (const s of sector.stocks) {
    const m = s.market as Market
    if (groups[m]) groups[m].push(s)
  }
  return groups
})

// 按层级分组
const stocksByLayer = computed(() => {
  const sector = activeSector.value
  if (!sector) return {}
  const groups: Record<string, SectorStock[]> = {}
  for (const s of sector.stocks) {
    const layer = s.layer || '其他'
    if (!groups[layer]) groups[layer] = []
    groups[layer].push(s)
  }
  return groups
})

// AI 板块摘要（localStorage 持久化）
const SUMMARY_CACHE_KEY = 'ai_sector_summary'
const sectorSummary = ref<SectorSummary | null>(null)
const sectorSummaryLoading = ref(false)

function loadSummaryFromCache(sectorId: string): SectorSummary | null {
  try {
    const raw = localStorage.getItem(SUMMARY_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as Record<string, { data: SectorSummary; ts: number }>
    const entry = cache[sectorId]
    if (!entry) return null
    // 缓存 24 小时有效
    if (Date.now() - entry.ts > 24 * 60 * 60 * 1000) return null
    return entry.data
  } catch { return null }
}

function saveSummaryToCache(sectorId: string, data: SectorSummary) {
  try {
    const raw = localStorage.getItem(SUMMARY_CACHE_KEY)
    const cache = raw ? JSON.parse(raw) as Record<string, { data: SectorSummary; ts: number }> : {}
    cache[sectorId] = { data, ts: Date.now() }
    localStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify(cache))
  } catch { /* silent */ }
}

async function loadSectorSummary(force = false) {
  if (!aiStore.isConfigured) return
  const sector = activeSector.value
  if (!sector) return

  // 先查缓存
  if (!force) {
    const cached = loadSummaryFromCache(sector.id)
    if (cached) {
      sectorSummary.value = cached
      return
    }
  }

  sectorSummaryLoading.value = true
  try {
    const stockList = sector.stocks.map(s => `${s.name}(${s.symbol},${s.market})`).join('、')
    const prompt = `你是专业的股票板块分析师。请对以下板块进行综合分析。

板块名称: ${sector.name}
板块描述: ${sector.description || ''}
成分股: ${stockList}

请严格按以下 JSON 格式返回（不要有其他文字）:
{
  "overview": "该板块当前整体趋势和特点的一句话概述",
  "advice": "对该板块的一句话投资建议",
  "hotStocks": ["最值得关注的2-3只股票及理由（一句话）"],
  "risks": ["该板块的主要风险点（1-2条）"]
}`

    const resp = await chat(
      [
        { role: 'system', content: '你是专业的股票分析师，只输出 JSON，不要有其他文字。' },
        { role: 'user', content: prompt },
      ],
      {
        baseUrl: aiStore.baseUrl,
        apiKey: aiStore.apiKey,
        model: aiStore.model,
        temperature: 0.3,
        maxTokens: 1000,
      }
    )
    const text = resp.choices?.[0]?.message?.content || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as SectorSummary
      sectorSummary.value = parsed
      saveSummaryToCache(sector.id, parsed)
    }
  } catch { /* silent */ }
  sectorSummaryLoading.value = false
}

// 涨跌幅 Top 6
const topGainers = computed(() => {
  const sector = activeSector.value
  if (!sector) return []
  return [...sector.stocks]
    .map(s => ({ ...s, change: quotesStore.get(s.symbol)?.change ?? 0 }))
    .sort((a, b) => b.change - a.change)
    .slice(0, 6)
})

const topLosers = computed(() => {
  const sector = activeSector.value
  if (!sector) return []
  return [...sector.stocks]
    .map(s => ({ ...s, change: quotesStore.get(s.symbol)?.change ?? 0 }))
    .sort((a, b) => a.change - b.change)
    .slice(0, 6)
})

const stats = computed(() => {
  const sector = activeSector.value
  if (!sector) return { total: 0, markets: 0, layers: 0 }
  const markets = new Set(sector.stocks.map(s => s.market))
  const layers = new Set(sector.stocks.map(s => s.layer || '其他'))
  return { total: sector.stocks.length, markets: markets.size, layers: layers.size }
})

const marketOrder: Market[] = ['美股', '港股', 'A股']
const marketIcons: Record<Market, string> = { '美股': '🇺🇸', '港股': '🇭🇰', 'A股': '🇨🇳' }

// 自动刷新
const enabled = computed(() => refreshStore.enabled)
const interval = computed(() => refreshStore.listInterval)
const { refreshNow } = useAutoRefresh({
  interval, enabled,
  fetcher: async () => {
    const sector = activeSector.value
    if (!sector) return
    const symbols = sector.stocks.map(s => s.symbol)
    if (symbols.length) await quotesStore.fetchAndStore(symbols)
  }
})

async function loadIndices() {
  indicesLoading.value = true
  try {
    indices.value = await fetchIndices()
  } catch { /* silent */ }
  indicesLoading.value = false
}

async function loadCalendar() {
  if (!aiStore.isConfigured) return
  calendarLoading.value = true
  try {
    const resp = await chat(
      [
        { role: 'system', content: '你是一个日历助手。用一句话输出今天的农历日期、节气或节日（如有）。没有特别信息就输出今日宜忌。简洁，不超过30字。' },
        { role: 'user', content: `今天是 ${dateStr}` },
      ],
      {
        baseUrl: aiStore.baseUrl,
        apiKey: aiStore.apiKey,
        model: aiStore.model,
        temperature: 0.3,
        maxTokens: 100,
      }
    )
    calendarInfo.value = resp.choices?.[0]?.message?.content || null
  } catch { /* silent */ }
  calendarLoading.value = false
}

onMounted(() => {
  loadIndices()
  const sector = activeSector.value
  if (sector) sectorSummary.value = loadSummaryFromCache(sector.id)
  refreshNow()
})

// 切换板块时只读取缓存，避免自动消耗 AI 配额
watch(() => sectorStore.activeId, () => {
  const sector = activeSector.value
  sectorSummary.value = sector ? loadSummaryFromCache(sector.id) : null
})

function goToStock(symbol: string) {
  router.push(`/stock/${encodeURIComponent(symbol)}`)
}
</script>

<template>
  <div class="page">
    <!-- 日期 -->
    <section class="top-bar">
      <div class="date-area">
        <div class="date-main">{{ dateStr }}</div>
        <div v-if="calendarInfo" class="date-lunar small muted">{{ calendarInfo }}</div>
        <button v-else-if="aiStore.isConfigured" class="date-action small muted" :disabled="calendarLoading" @click="loadCalendar">
          {{ calendarLoading ? '万年历加载中…' : '生成万年历' }}
        </button>
      </div>
    </section>

    <!-- 全球指数 -->
    <section class="indices-section">
      <div class="indices-grid">
        <div v-for="idx in indices" :key="idx.code" class="index-chip"
             :class="idx.changePct >= 0 ? 'pos' : 'neg'">
          <span class="idx-icon">{{ idx.icon }}</span>
          <span class="idx-name">{{ idx.name }}</span>
          <span class="idx-price">{{ idx.price.toFixed(2) }}</span>
          <span class="idx-change">{{ idx.changePct >= 0 ? '+' : '' }}{{ idx.changePct.toFixed(2) }}%</span>
        </div>
        <div v-if="indicesLoading && !indices.length" class="muted small">指数加载中…</div>
      </div>
    </section>

    <!-- Hero -->
    <section class="hero">
      <div class="hero-top">
        <div>
          <h1>{{ activeSector?.icon || '📊' }} {{ activeSector?.name || '板块概览' }}</h1>
          <p class="muted">{{ activeSector?.description || '选择一个板块开始查看' }}</p>
        </div>
        <router-link to="/sectors" class="btn ghost">切换板块</router-link>
      </div>
      <div class="stat-bar">
        <div class="stat-item">
          <span class="stat-val">{{ stats.total }}</span>
          <span class="stat-label small muted">只股票</span>
        </div>
        <div class="stat-item">
          <span class="stat-val">{{ stats.markets }}</span>
          <span class="stat-label small muted">个市场</span>
        </div>
        <div class="stat-item">
          <span class="stat-val">{{ stats.layers }}</span>
          <span class="stat-label small muted">个层级</span>
        </div>
      </div>
      <HitokotoBar class="hero-hitokoto" />
    </section>

    <!-- AI 板块摘要 -->
    <section v-if="aiStore.isConfigured" class="sector-summary card">
      <div class="summary-header">
        <span class="summary-header-title">AI 板块分析</span>
        <button class="btn ghost small" :disabled="sectorSummaryLoading" @click="loadSectorSummary(true)">
          {{ sectorSummary ? '重新生成' : '生成分析' }}
        </button>
      </div>
      <div v-if="sectorSummaryLoading" class="summary-loading">
        <span class="spinner"></span> AI 板块分析中…
      </div>
      <div v-else-if="sectorSummary" class="summary-content">
        <div class="summary-main">
          <div class="summary-icon">🤖</div>
          <div class="summary-body">
            <p class="summary-overview">{{ sectorSummary.overview }}</p>
            <p class="summary-advice">{{ sectorSummary.advice }}</p>
          </div>
        </div>
        <div class="summary-details">
          <div v-if="sectorSummary.hotStocks?.length" class="summary-section">
            <h3>🔥 值得关注</h3>
            <ul>
              <li v-for="(s, i) in sectorSummary.hotStocks" :key="i">{{ s }}</li>
            </ul>
          </div>
          <div v-if="sectorSummary.risks?.length" class="summary-section">
            <h3>⚠️ 风险提示</h3>
            <ul>
              <li v-for="(r, i) in sectorSummary.risks" :key="i">{{ r }}</li>
            </ul>
          </div>
        </div>
      </div>
      <div v-else class="small muted">点击生成后，AI 会基于当前板块成分股生成摘要。</div>
    </section>

    <!-- 涨跌幅排行 -->
    <section class="rankings">
      <div class="ranking-col">
        <h2 class="ranking-title pos">涨幅前 6</h2>
        <div class="ranking-list">
          <div v-for="s in topGainers" :key="s.symbol" class="ranking-item card" @click="goToStock(s.symbol)">
            <div class="ri-left">
              <div class="ri-symbol">{{ s.symbol }}</div>
              <div class="ri-name small muted">{{ s.name }}</div>
            </div>
            <div class="ri-change pos">{{ formatPercent(s.change) }}</div>
          </div>
        </div>
      </div>
      <div class="ranking-col">
        <h2 class="ranking-title neg">跌幅前 6</h2>
        <div class="ranking-list">
          <div v-for="s in topLosers" :key="s.symbol" class="ranking-item card" @click="goToStock(s.symbol)">
            <div class="ri-left">
              <div class="ri-symbol">{{ s.symbol }}</div>
              <div class="ri-name small muted">{{ s.name }}</div>
            </div>
            <div class="ri-change neg">{{ formatPercent(s.change) }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 按市场分组 -->
    <section v-for="market in marketOrder" :key="market" class="market-section"
             v-show="stocksByMarket[market]?.length">
      <div class="section-head">
        <h2>{{ marketIcons[market] }} {{ market }} <span class="count small muted">{{ stocksByMarket[market]?.length }} 只</span></h2>
      </div>
      <div class="stock-grid">
        <QuoteCard
          v-for="s in stocksByMarket[market]"
          :key="s.symbol"
          :symbol="s.symbol"
          :name="s.name"
          :market="s.market"
          :layer="s.layer"
          :reason="s.reason"
          :quote="quotesStore.get(s.symbol)"
          clickable
          @click="goToStock(s.symbol)"
        />
      </div>
    </section>

    <!-- 按层级分组 -->
    <section class="layers-section" v-if="Object.keys(stocksByLayer).length > 1">
      <h2>产业链层级</h2>
      <div class="layers-grid">
        <div v-for="(stocks, layer) in stocksByLayer" :key="layer" class="layer-card card">
          <h3 class="layer-title">{{ layer }} <span class="count small muted">{{ stocks.length }} 只</span></h3>
          <div class="layer-stocks">
            <div v-for="s in stocks.slice(0, 5)" :key="s.symbol" class="layer-stock"
                 @click="goToStock(s.symbol)">
              <span class="ls-symbol">{{ s.symbol }}</span>
              <span class="ls-name small muted">{{ s.name }}</span>
            </div>
            <div v-if="stocks.length > 5" class="layer-more small muted">
              +{{ stocks.length - 5 }} 更多
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 顶部日期 + 一言 */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.date-main { font-size: var(--fs-lg); font-weight: 600; }
.date-lunar { margin-top: 2px; }
.date-action {
  margin-top: 2px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.date-action:hover { color: var(--color-link); }

/* 全球指数 */
.indices-section {
  margin-bottom: var(--space-5);
}
.indices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(156px, 1fr));
  gap: var(--space-2);
}
.index-chip {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 6px;
  row-gap: 2px;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  font-size: var(--fs-sm);
}
.idx-icon { font-size: 14px; }
.idx-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.idx-price {
  font-variant-numeric: tabular-nums;
  justify-self: end;
}
.idx-change {
  grid-column: 2 / 4;
  justify-self: end;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.hero { margin-bottom: var(--space-5); }
.hero-hitokoto {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}
.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.hero h1 { font-size: var(--fs-3xl); margin-bottom: 6px; }
.stat-bar {
  display: flex;
  gap: var(--space-5);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-border);
}
.stat-item { display: flex; align-items: baseline; gap: 6px; }
.stat-val { font-size: var(--fs-2xl); font-weight: 700; }

/* AI 板块摘要 */
.sector-summary {
  margin-bottom: var(--space-5);
  padding: var(--space-4);
}
.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}
.summary-header-title {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--color-muted);
}
.summary-loading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-muted);
  font-size: var(--fs-sm);
}
.summary-main {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}
.summary-icon {
  font-size: 28px;
  flex-shrink: 0;
}
.summary-body {
  flex: 1;
}
.summary-overview {
  font-size: var(--fs-md);
  font-weight: 600;
  margin: 0 0 var(--space-2);
  line-height: 1.6;
}
.summary-advice {
  font-size: var(--fs-sm);
  color: var(--color-muted);
  margin: 0;
  line-height: 1.6;
}
.summary-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}
.summary-section h3 {
  font-size: var(--fs-sm);
  margin: 0 0 var(--space-2);
}
.summary-section ul {
  margin: 0;
  padding-left: var(--space-4);
}
.summary-section li {
  font-size: var(--fs-sm);
  line-height: 1.6;
  margin-bottom: 4px;
}

.rankings {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}
.ranking-title { font-size: var(--fs-lg); margin: 0 0 var(--space-3); }
.ranking-list { display: flex; flex-direction: column; gap: var(--space-2); }
.ranking-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}
.ranking-item:hover { border-color: var(--color-link); }
.ri-symbol { font-family: var(--font-mono); font-weight: 700; }
.ri-change { font-weight: 700; font-variant-numeric: tabular-nums; }

.market-section { margin-bottom: var(--space-6); }
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--space-3);
}
.section-head h2 { margin: 0; }
.count { font-weight: 400; }
.stock-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-3);
}

.layers-section { margin-bottom: var(--space-6); }
.layers-section h2 { margin-bottom: var(--space-3); }
.layers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-3);
}
.layer-card { padding: var(--space-3); }
.layer-title { margin: 0 0 var(--space-2); font-size: var(--fs-md); }
.layer-stocks { display: flex; flex-direction: column; gap: 6px; }
.layer-stock {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  padding: 4px 0;
}
.layer-stock:hover .ls-symbol { color: var(--color-link); }
.ls-symbol { font-family: var(--font-mono); font-weight: 600; font-size: var(--fs-sm); }
.layer-more { padding-top: 4px; }

.pos { color: var(--color-up); }
.neg { color: var(--color-down); }

@media (max-width: 640px) {
  .top-bar { flex-direction: column; }
  .hero-top { flex-direction: column; }
  .stat-bar { flex-wrap: wrap; gap: var(--space-3); }
  .summary-details { grid-template-columns: 1fr; }
  .rankings { grid-template-columns: 1fr; }
  .stock-grid { grid-template-columns: 1fr; }
  .layers-grid { grid-template-columns: 1fr; }
  .indices-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .index-chip { padding-inline: 10px; }
}

@media (max-width: 420px) {
  .indices-grid { grid-template-columns: 1fr; }
}
</style>
