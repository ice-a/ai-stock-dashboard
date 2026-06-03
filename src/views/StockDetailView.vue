<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQuotesStore } from '../stores/quotes'
import { useWatchlistStore } from '../stores/watchlist'
import { useSectorStore } from '../stores/sector'
import { useRefreshStore } from '../stores/refresh'
import { useAIStore } from '../stores/ai'
import { useAutoRefresh } from '../composables/useAutoRefresh'
import { useMarketSession, detectMarket } from '../composables/useMarketSession'
import { sourceManager } from '../api/sourceManager'
import { fetchStockFullDetail, type StockFullDetail, type AIAdvice } from '../api/stockDetail'
import { formatPrice, formatPercent, formatVolume, quoteTone, timeAgoShort } from '../utils/format'
import PriceTicker from '../components/PriceTicker.vue'
import WatchlistButton from '../components/WatchlistButton.vue'
import ExternalLinks from '../components/ExternalLinks.vue'
import type { KLinePoint } from '../types'
import type { Market } from '../sectors/types'

const KLineChart = defineAsyncComponent(() => import('../components/KLineChart.vue'))

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const quotesStore = useQuotesStore()
const watchlistStore = useWatchlistStore()
const sectorStore = useSectorStore()
const refreshStore = useRefreshStore()
const aiStore = useAIStore()

const symbol = computed(() => decodeURIComponent(String(route.params.symbol || '')))
const klineRange = ref('6mo')
const activeTab = ref<'kline' | 'news' | 'announcements' | 'etfs'>('kline')

// 从板块系统查找股票信息
const sectorStock = computed(() => {
  for (const sector of sectorStore.sectors) {
    const found = sector.stocks.find(s => s.symbol === symbol.value)
    if (found) return { ...found, sectorName: sector.name, sectorId: sector.id }
  }
  return null
})

const stockName = computed(() => sectorStock.value?.name || symbol.value)
const stockMarket = computed<Market>(() => (sectorStock.value?.market as Market) || '美股')

const quote = computed(() => quotesStore.get(symbol.value))
const favorite = computed(() => watchlistStore.bySymbol.get(symbol.value))

const klinePoints = ref<KLinePoint[]>([])
const klineLoading = ref(false)
const klineError = ref<string | null>(null)

// 详情数据
const detail = ref<StockFullDetail | null>(null)
const detailLoading = ref(false)
const detailError = ref<string | null>(null)

const noteText = ref('')
const targetPrice = ref<number | null>(null)

const market = computed(() => detectMarket(symbol.value))
const { isOpen } = useMarketSession()
const isMarketOpen = computed(() => isOpen(market.value))

const enabled = computed(() => refreshStore.enabled)
const interval = computed(() => refreshStore.detailInterval)
const { refreshNow } = useAutoRefresh({
  interval, enabled,
  fetcher: async () => {
    if (!symbol.value) return
    await quotesStore.fetchOne(symbol.value, { force: true })
  }
})

async function loadKLine() {
  if (!symbol.value) return
  klineLoading.value = true
  klineError.value = null
  try {
    const data = await sourceManager.fetchKLine(symbol.value, { range: klineRange.value, interval: '1d' })
    if (data) {
      klinePoints.value = data.points
    } else {
      klineError.value = '未返回 K 线'
    }
  } catch (e) {
    klineError.value = (e as Error).message
  } finally {
    klineLoading.value = false
  }
}

async function loadDetail() {
  if (!symbol.value) return
  detailLoading.value = true
  detailError.value = null
  try {
    detail.value = await fetchStockFullDetail(symbol.value, stockName.value, stockMarket.value)
  } catch (e) {
    detailError.value = (e as Error).message
  } finally {
    detailLoading.value = false
  }
}

// 手动触发 AI 投资建议生成
const adviceGenerating = ref(false)
const adviceError = ref<string | null>(null)

async function generateAdvice() {
  if (!symbol.value || adviceGenerating.value) return
  adviceGenerating.value = true
  adviceError.value = null
  try {
    const { fetchStockAdviceAI } = await import('../api/stockDetail')
    const advice = await fetchStockAdviceAI(symbol.value, stockName.value, stockMarket.value, klinePoints.value)
    if (detail.value) {
      detail.value.advice = advice
    } else {
      detail.value = { news: [], announcements: [], etfs: [], advice }
    }
  } catch (e) {
    adviceError.value = (e as Error).message
  } finally {
    adviceGenerating.value = false
  }
}

function setRange(r: string) {
  klineRange.value = r
  loadKLine()
}

function saveNote() {
  if (!symbol.value) return
  if (watchlistStore.has(symbol.value)) {
    watchlistStore.update(symbol.value, { note: noteText.value, targetPrice: targetPrice.value })
  } else {
    watchlistStore.add(symbol.value, 'default', noteText.value, targetPrice.value)
  }
}

onMounted(() => {
  if (favorite.value) {
    noteText.value = favorite.value.note
    targetPrice.value = favorite.value.targetPrice
  }
  loadKLine()
  loadDetail()
  refreshNow()
})

watch(symbol, () => {
  if (favorite.value) {
    noteText.value = favorite.value.note
    targetPrice.value = favorite.value.targetPrice
  } else {
    noteText.value = ''
    targetPrice.value = null
  }
  activeTab.value = 'kline'
  loadKLine()
  loadDetail()
  refreshNow()
})

const stats = computed(() => {
  const q = quote.value
  if (!q) return null
  return {
    price: q.price,
    open: q.dayOpen,
    high: q.dayHigh,
    low: q.dayLow,
    prevClose: q.prevClose,
    volume: q.volume,
    change: q.change,
    marketCap: q.marketCap,
    high52w: q.fiftyTwoWeekHigh,
    low52w: q.fiftyTwoWeekLow,
    currency: q.currency,
    regularMarketTime: q.regularMarketTime,
  }
})

function calculateRangeChange(days: number): number | null {
  if (!klinePoints.value.length || quote.value?.price == null) return null
  const now = Date.now() / 1000
  const target = now - days * 86400
  let base = klinePoints.value[0]
  for (const p of klinePoints.value) {
    if (p.time <= target) base = p
    else break
  }
  if (!base || base.close === 0) return null
  return (quote.value.price - base.close) / base.close
}

const rangeChanges = computed(() => ({
  d1: calculateRangeChange(1),
  d20: calculateRangeChange(20),
  d60: calculateRangeChange(60),
  d252: calculateRangeChange(252),
}))

const tabs = [
  { id: 'kline' as const, label: 'K线图' },
  { id: 'news' as const, label: '新闻' },
  { id: 'announcements' as const, label: '公告' },
  { id: 'etfs' as const, label: 'ETF持仓' },
]
</script>

<template>
  <div class="page" v-if="symbol">
    <div class="crumb small muted">
      <router-link to="/sectors">板块</router-link>
      <span v-if="sectorStock"> / </span>
      <router-link v-if="sectorStock" :to="`/sector/${sectorStock.sectorId}`">{{ sectorStock.sectorName }}</router-link>
      <span> / </span>
      <span>{{ stockName }}</span>
    </div>

    <div class="hero card">
      <div class="hero-main">
        <div class="left">
          <div class="row1">
            <h1 class="symbol">{{ symbol }}</h1>
            <WatchlistButton :symbol="symbol" />
            <span class="tag" :class="isMarketOpen ? 'open' : 'closed'">{{ isMarketOpen ? t('status.online') : t('status.marketClosed') }}</span>
          </div>
          <div class="name-row">
            <h2 class="name">{{ stockName }}</h2>
            <ExternalLinks :symbol="symbol" />
          </div>
          <div v-if="sectorStock" class="meta-tags">
            <span class="tag-light">{{ sectorStock.market }}</span>
            <span v-if="sectorStock.layer" class="tag-light">{{ sectorStock.layer }}</span>
            <span class="tag-light">{{ sectorStock.sectorName }}</span>
          </div>
        </div>
        <div class="right">
          <div class="price-big" v-if="stats">
            <PriceTicker :value="stats.price" :digits="2" />
            <span v-if="stats.currency" class="ccy small muted">{{ stats.currency }}</span>
          </div>
          <div class="change-big" v-if="stats">
            <span :class="quoteTone(stats.change)">
              <PriceTicker :value="stats.change" :show-sign="true" :digits="2" />
            </span>
            <span class="small muted">
              · {{ timeAgoShort(stats.regularMarketTime ? stats.regularMarketTime * 1000 : null) }}
            </span>
          </div>
        </div>
      </div>

      <div class="ranges" v-if="klinePoints.length">
        <div class="range">
          <div class="small muted">实时/今开</div>
          <div class="v"><PriceTicker :value="stats?.change" :show-sign="true" :digits="2" /></div>
        </div>
        <div class="range">
          <div class="small muted">20日</div>
          <div class="v" :class="rangeChanges.d20 != null ? (rangeChanges.d20 >= 0 ? 'pos' : 'neg') : ''">
            {{ rangeChanges.d20 != null ? formatPercent(rangeChanges.d20) : '—' }}
          </div>
        </div>
        <div class="range">
          <div class="small muted">60日</div>
          <div class="v" :class="rangeChanges.d60 != null ? (rangeChanges.d60 >= 0 ? 'pos' : 'neg') : ''">
            {{ rangeChanges.d60 != null ? formatPercent(rangeChanges.d60) : '—' }}
          </div>
        </div>
        <div class="range">
          <div class="small muted">252日</div>
          <div class="v" :class="rangeChanges.d252 != null ? (rangeChanges.d252 >= 0 ? 'pos' : 'neg') : ''">
            {{ rangeChanges.d252 != null ? formatPercent(rangeChanges.d252) : '—' }}
          </div>
        </div>
      </div>

      <div v-if="stats" class="kpis">
        <div class="kpi"><span class="k">开盘</span><span class="v">{{ formatPrice(stats.open, stats.currency) }}</span></div>
        <div class="kpi"><span class="k">昨收</span><span class="v">{{ formatPrice(stats.prevClose, stats.currency) }}</span></div>
        <div class="kpi"><span class="k">最高</span><span class="v">{{ formatPrice(stats.high, stats.currency) }}</span></div>
        <div class="kpi"><span class="k">最低</span><span class="v">{{ formatPrice(stats.low, stats.currency) }}</span></div>
        <div class="kpi"><span class="k">成交量</span><span class="v">{{ formatVolume(stats.volume) }}</span></div>
        <div class="kpi" v-if="stats.marketCap"><span class="k">市值</span><span class="v">{{ formatVolume(stats.marketCap) }}</span></div>
        <div class="kpi" v-if="stats.high52w"><span class="k">52周高</span><span class="v">{{ formatPrice(stats.high52w, stats.currency) }}</span></div>
        <div class="kpi" v-if="stats.low52w"><span class="k">52周低</span><span class="v">{{ formatPrice(stats.low52w, stats.currency) }}</span></div>
      </div>
    </div>

    <!-- Tab 导航 -->
    <div class="tab-nav">
      <button v-for="tab in tabs" :key="tab.id"
              class="tab-btn" :class="{ active: activeTab === tab.id }"
              @click="activeTab = tab.id">
        {{ tab.label }}
      </button>
    </div>

    <!-- K线图 Tab -->
    <section v-show="activeTab === 'kline'" class="tab-content">
      <div class="section-head">
        <h2>K线图</h2>
        <div class="range-pills">
          <button v-for="r in ['1mo','3mo','6mo','1y','2y']" :key="r" class="pill" :class="{ active: klineRange === r }" @click="setRange(r)">{{ t(`range.${r}`) }}</button>
        </div>
      </div>
      <div v-if="klineLoading" class="loading">加载 K 线…</div>
      <div v-else-if="klineError" class="error small">{{ klineError }}</div>
      <div v-else-if="!klinePoints.length" class="loading small muted">{{ t('empty.klineUnavailable') }}</div>
      <KLineChart v-else :symbol="symbol" :range="klineRange" :data="klinePoints" />
    </section>

    <!-- 新闻 Tab -->
    <section v-show="activeTab === 'news'" class="tab-content">
      <h2>相关新闻</h2>
      <div v-if="detailLoading" class="loading small muted">加载中…</div>
      <div v-else-if="!detail?.news?.length" class="empty muted">暂无新闻数据</div>
      <div v-else class="news-list">
        <a v-for="(item, i) in detail.news" :key="i" :href="item.url" target="_blank" rel="noopener" class="news-item card">
          <div class="news-title">{{ item.title }}</div>
          <div class="news-meta small muted">
            <span>{{ item.source }}</span>
            <span v-if="item.time"> · {{ item.time }}</span>
          </div>
          <div v-if="item.summary" class="news-summary small">{{ item.summary }}</div>
        </a>
      </div>
    </section>

    <!-- 公告 Tab -->
    <section v-show="activeTab === 'announcements'" class="tab-content">
      <h2>公司公告</h2>
      <div v-if="detailLoading" class="loading small muted">加载中…</div>
      <div v-else-if="!detail?.announcements?.length" class="empty muted">暂无公告数据</div>
      <div v-else class="ann-list">
        <a v-for="(item, i) in detail.announcements" :key="i" :href="item.url" target="_blank" rel="noopener" class="ann-item card">
          <div class="ann-title">{{ item.title }}</div>
          <div class="ann-meta small muted">
            <span v-if="item.type" class="tag-light">{{ item.type }}</span>
            <span>{{ item.time }}</span>
          </div>
        </a>
      </div>
    </section>

    <!-- ETF 持仓 Tab -->
    <section v-show="activeTab === 'etfs'" class="tab-content">
      <h2>ETF 持仓</h2>
      <div v-if="detailLoading" class="loading small muted">加载中…</div>
      <div v-else-if="!detail?.etfs?.length" class="empty muted">暂无 ETF 持仓数据</div>
      <div v-else class="etf-grid">
        <div v-for="(etf, i) in detail.etfs" :key="i" class="etf-item card"
             @click="router.push(`/stock/${encodeURIComponent(etf.etfSymbol)}`)">
          <div class="etf-symbol">{{ etf.etfSymbol }}</div>
          <div class="etf-name">{{ etf.etfName }}</div>
          <div class="etf-meta small muted">
            <span>{{ etf.market }}</span>
            <span v-if="etf.weight"> · 持仓 {{ etf.weight }}%</span>
          </div>
        </div>
      </div>
    </section>

    <!-- AI 投资建议 -->
    <section class="ai-advice card">
      <div class="advice-header">
        <h2>AI 投资建议</h2>
        <button v-if="aiStore.hasCredentials && !detail?.advice"
                class="btn primary" :disabled="adviceGenerating" @click="generateAdvice">
          <span v-if="adviceGenerating" class="spinner"></span>
          {{ adviceGenerating ? 'AI 分析中…' : '生成投资建议' }}
        </button>
      </div>

      <template v-if="detail?.advice">
        <div class="advice-rating-row">
          <span class="advice-badge" :class="detail.advice.rating === '买入' ? 'badge-buy' : detail.advice.rating === '持有' ? 'badge-hold' : detail.advice.rating === '减持' ? 'badge-sell' : 'badge-watch'">
            {{ detail.advice.rating }}
          </span>
          <span class="confidence small muted">置信度: {{ detail.advice.confidence }}</span>
        </div>

        <p class="advice-summary">{{ detail.advice.summary }}</p>

        <div class="advice-grid">
          <div class="advice-card">
            <div class="advice-label small muted">目标价</div>
            <div class="advice-val big">{{ detail.advice.targetPrice?.toFixed(2) ?? '—' }}</div>
            <div v-if="detail.advice.targetPrice && detail.advice.currentPrice" class="advice-upside small"
                 :class="detail.advice.targetPrice >= detail.advice.currentPrice ? 'pos' : 'neg'">
              {{ detail.advice.targetPrice >= detail.advice.currentPrice ? '↑' : '↓' }}
              {{ ((detail.advice.targetPrice - detail.advice.currentPrice) / detail.advice.currentPrice * 100).toFixed(1) }}%
            </div>
          </div>
          <div class="advice-card">
            <div class="advice-label small muted">时间框架</div>
            <div class="advice-val">{{ detail.advice.timeframe }}</div>
          </div>
        </div>

        <div class="advice-sections">
          <div class="advice-sec">
            <h3 class="pos">看多理由</h3>
            <ul>
              <li v-for="(r, i) in detail.advice.reasons" :key="i">{{ r }}</li>
            </ul>
          </div>
          <div class="advice-sec">
            <h3 class="neg">风险提示</h3>
            <ul>
              <li v-for="(r, i) in detail.advice.risks" :key="i">{{ r }}</li>
            </ul>
          </div>
        </div>

        <div v-if="detail.advice.klineAnalysis" class="kline-analysis">
          <h3>技术面分析</h3>
          <p>{{ detail.advice.klineAnalysis }}</p>
        </div>

        <div v-if="detail.advice.catalysts?.length" class="catalysts">
          <h3>近期催化剂</h3>
          <div class="catalyst-tags">
            <span v-for="(c, i) in detail.advice.catalysts" :key="i" class="catalyst-tag">{{ c }}</span>
          </div>
        </div>

        <router-link :to="`/ask?symbol=${encodeURIComponent(symbol)}`" class="ask-link small">
          向 AI 提问更多 →
        </router-link>
      </template>

      <template v-else-if="!aiStore.hasCredentials">
        <p class="muted small">请先在设置中配置 AI 模型以使用此功能</p>
      </template>

      <template v-else-if="adviceError">
        <p class="neg small">{{ adviceError }}</p>
        <button class="btn" @click="generateAdvice">重试</button>
      </template>

      <template v-else-if="!adviceGenerating">
        <p class="muted small">点击上方按钮，AI 将基于 K 线、新闻和公告生成综合投资建议</p>
      </template>
    </section>

    <!-- 自选备注 -->
    <section class="fav-section">
      <h2>自选备注</h2>
      <div class="fav-form">
        <label class="small muted">备注</label>
        <textarea v-model="noteText" rows="3" placeholder="写下你的看法、目标、跟踪点..."></textarea>
        <div class="form-row">
          <label class="small muted">目标价</label>
          <input v-model.number="targetPrice" type="number" step="0.01" placeholder="如 100.00" />
          <button class="btn primary" @click="saveNote">保存</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.crumb { margin-bottom: var(--space-3); }
.crumb a { color: var(--color-muted); text-decoration: none; }
.crumb a:hover { color: var(--color-link); text-decoration: underline; }
.hero {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}
.hero-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.left { flex: 1; min-width: 240px; }
.row1 {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.symbol {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: var(--fs-2xl);
  margin: 0;
}
.name {
  font-size: var(--fs-lg);
  margin: 4px 0;
  font-weight: 600;
}
.name-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.meta-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.tag-light {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--color-bg-muted);
  color: var(--color-muted);
  font-size: var(--fs-xs);
}
.tag.open { color: var(--color-up); background: var(--color-up-bg); }
.tag.closed { color: var(--color-muted); background: var(--color-bg-muted); }
.right {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.price-big {
  display: flex;
  align-items: baseline;
  gap: 6px;
  justify-content: flex-end;
}
.price-big :first-child {
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.ccy { font-weight: 400; }
.change-big {
  display: flex;
  align-items: baseline;
  gap: 6px;
  justify-content: flex-end;
}
.change-big :first-child {
  font-size: var(--fs-lg);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.ranges {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}
.range {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.range .v {
  font-size: var(--fs-md);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}
.kpi {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.kpi .k { font-size: var(--fs-xs); color: var(--color-muted); }
.kpi .v { font-weight: 600; font-variant-numeric: tabular-nums; }

/* Tab 导航 */
.tab-nav {
  display: flex;
  gap: 4px;
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: var(--space-1);
}
.tab-btn {
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--color-muted);
  font-size: var(--fs-sm);
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all var(--transition-fast);
}
.tab-btn:hover { color: var(--color-ink); }
.tab-btn.active {
  color: var(--color-link);
  border-bottom-color: var(--color-link);
}

.tab-content { margin-bottom: var(--space-5); }
.tab-content h2 { margin: 0 0 var(--space-3); }

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}
.section-head h2 { margin: 0; }
.range-pills { display: flex; gap: 4px; }
.pill {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-elevated);
  color: var(--color-muted);
  font-size: var(--fs-xs);
  cursor: pointer;
}
.pill:hover { color: var(--color-ink); }
.pill.active {
  background: var(--color-info-bg);
  border-color: var(--color-link);
  color: var(--color-link);
  font-weight: 600;
}
.loading, .error {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-muted);
}
.empty {
  text-align: center;
  padding: var(--space-6);
  color: var(--color-muted);
}

/* 新闻列表 */
.news-list { display: flex; flex-direction: column; gap: var(--space-3); }
.news-item {
  display: block;
  padding: var(--space-3);
  text-decoration: none;
  color: inherit;
  transition: border-color var(--transition-fast);
}
.news-item:hover { border-color: var(--color-link); }
.news-title { font-weight: 600; margin-bottom: 4px; }
.news-meta { display: flex; gap: var(--space-2); align-items: center; }
.news-summary { margin-top: 6px; line-height: 1.5; color: var(--color-muted); }

/* 公告列表 */
.ann-list { display: flex; flex-direction: column; gap: var(--space-2); }
.ann-item {
  display: block;
  padding: var(--space-3);
  text-decoration: none;
  color: inherit;
  transition: border-color var(--transition-fast);
}
.ann-item:hover { border-color: var(--color-link); }
.ann-title { font-weight: 600; margin-bottom: 4px; }
.ann-meta { display: flex; gap: var(--space-2); align-items: center; }

/* ETF 网格 */
.etf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--space-3);
}
.etf-item {
  padding: var(--space-3);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}
.etf-item:hover { border-color: var(--color-link); }
.etf-symbol { font-family: var(--font-mono); font-weight: 700; font-size: var(--fs-md); }
.etf-name { font-size: var(--fs-sm); margin-top: 2px; }
.etf-meta { margin-top: 6px; display: flex; gap: var(--space-2); }

/* AI 投资建议 */
.ai-advice {
  margin-bottom: var(--space-5);
  padding: var(--space-4);
}
.advice-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}
.advice-header h2 { margin: 0; }
.advice-badge {
  padding: 3px 12px;
  border-radius: 999px;
  font-size: var(--fs-sm);
  font-weight: 700;
}
.badge-buy { background: rgba(34,197,94,0.15); color: var(--color-up); }
.badge-hold { background: rgba(245,158,11,0.15); color: #b45309; }
.badge-sell { background: rgba(239,68,68,0.15); color: var(--color-down); }
.badge-watch { background: var(--color-bg-muted); color: var(--color-muted); }
.confidence { margin-left: auto; }
.advice-summary {
  font-size: var(--fs-md);
  line-height: 1.6;
  margin: 0 0 var(--space-4);
  padding: var(--space-3);
  background: var(--color-bg-soft);
  border-radius: var(--radius-md);
}
.advice-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.advice-card {
  padding: var(--space-3);
  background: var(--color-bg-soft);
  border-radius: var(--radius-md);
  text-align: center;
}
.advice-label { margin-bottom: 4px; }
.advice-val { font-size: var(--fs-lg); font-weight: 700; font-variant-numeric: tabular-nums; }
.advice-val.big { font-size: var(--fs-2xl); }
.advice-upside { font-weight: 600; margin-top: 2px; }
.advice-sections {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}
.advice-sec h3 { font-size: var(--fs-sm); margin: 0 0 var(--space-2); }
.advice-sec ul { margin: 0; padding-left: var(--space-4); }
.advice-sec li { font-size: var(--fs-sm); line-height: 1.6; margin-bottom: 4px; }
.kline-analysis, .catalysts {
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  background: var(--color-bg-soft);
  border-radius: var(--radius-md);
}
.kline-analysis h3, .catalysts h3 { font-size: var(--fs-sm); margin: 0 0 var(--space-2); }
.kline-analysis p { margin: 0; line-height: 1.6; font-size: var(--fs-sm); }
.catalyst-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.catalyst-tag {
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--color-info-bg);
  color: var(--color-link);
  font-size: var(--fs-xs);
  font-weight: 500;
}
.ask-link { color: var(--color-link); text-decoration: none; display: inline-block; margin-top: var(--space-2); }
.ask-link:hover { text-decoration: underline; }

.pos { color: var(--color-up); }
.neg { color: var(--color-down); }

.fav-section {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}
.fav-form { display: flex; flex-direction: column; gap: var(--space-2); }
.fav-form textarea {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font: inherit;
  background: var(--color-bg);
  color: var(--color-ink);
  resize: vertical;
}
.form-row { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.form-row input { flex: 1; min-width: 100px; }

@media (max-width: 640px) {
  .hero-main { flex-direction: column; }
  .right { text-align: left; }
  .price-big, .change-big { justify-content: flex-start; }
  .tab-nav { overflow-x: auto; }
}
</style>
