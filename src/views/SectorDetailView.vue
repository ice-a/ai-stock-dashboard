<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSectorStore } from '../stores/sector'
import { useQuotesStore } from '../stores/quotes'
import { useRefreshStore } from '../stores/refresh'
import { useAutoRefresh } from '../composables/useAutoRefresh'
import QuoteCard from '../components/QuoteCard.vue'
import type { Market, SectorStock } from '../sectors/types'

const route = useRoute()
const router = useRouter()
const sectorStore = useSectorStore()
const quotesStore = useQuotesStore()
const refreshStore = useRefreshStore()

const search = ref('')
const activeMarket = ref<Market | '全部'>('全部')
const sortBy = ref<'name' | 'change' | 'price'>('name')

const sectorId = computed(() => route.params.id as string)

// 切换板块
onMounted(() => {
  if (sectorId.value && sectorId.value !== sectorStore.activeId) {
    sectorStore.setActive(sectorId.value)
  }
})

const sector = computed(() =>
  sectorStore.sectors.find(s => s.id === sectorId.value)
)

const markets: (Market | '全部')[] = ['全部', '美股', '港股', 'A股']

const filteredStocks = computed(() => {
  if (!sector.value) return []
  let stocks = sector.value.stocks

  // 市场筛选
  if (activeMarket.value !== '全部') {
    stocks = stocks.filter(s => s.market === activeMarket.value)
  }

  // 搜索
  const q = search.value.trim().toLowerCase()
  if (q) {
    stocks = stocks.filter(s =>
      s.symbol.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      (s.reason || '').toLowerCase().includes(q) ||
      (s.layer || '').toLowerCase().includes(q)
    )
  }

  // 排序
  if (sortBy.value === 'change') {
    stocks = [...stocks].sort((a, b) => {
      const qa = quotesStore.get(a.symbol)
      const qb = quotesStore.get(b.symbol)
      return (qb?.change ?? 0) - (qa?.change ?? 0)
    })
  } else if (sortBy.value === 'price') {
    stocks = [...stocks].sort((a, b) => {
      const qa = quotesStore.get(a.symbol)
      const qb = quotesStore.get(b.symbol)
      return (qb?.price ?? 0) - (qa?.price ?? 0)
    })
  }

  return stocks
})

// 按市场分组（当选择"全部"时）
const groupedStocks = computed(() => {
  if (activeMarket.value !== '全部') return null
  const groups: Record<Market, SectorStock[]> = { '美股': [], '港股': [], 'A股': [] }
  for (const s of filteredStocks.value) {
    const m = s.market as Market
    if (groups[m]) groups[m].push(s)
  }
  return groups
})

// 自动刷新
const enabled = computed(() => refreshStore.enabled)
const interval = computed(() => refreshStore.listInterval)
const { refreshNow } = useAutoRefresh({
  interval, enabled,
  fetcher: async () => {
    const symbols = filteredStocks.value.map(s => s.symbol)
    if (symbols.length) await quotesStore.fetchAndStore(symbols)
  }
})

function goToStock(symbol: string) {
  router.push(`/stock/${encodeURIComponent(symbol)}`)
}

function marketCount(market: Market): number {
  return sector.value?.stocks.filter(s => s.market === market).length || 0
}
</script>

<template>
  <div class="page" v-if="sector">
    <header class="page-head">
      <div>
        <div class="breadcrumb">
          <router-link to="/sectors" class="muted">板块</router-link>
          <span class="muted"> / </span>
          <span>{{ sector.name }}</span>
        </div>
        <h1>{{ sector.icon || '📊' }} {{ sector.name }}</h1>
        <p class="muted">{{ sector.description }}</p>
      </div>
    </header>

    <!-- 板块统计摘要 -->
    <div class="sector-summary">
      <div class="summary-item">
        <span class="summary-val">{{ sector.stocks.length }}</span>
        <span class="summary-label small muted">只股票</span>
      </div>
      <div class="summary-item">
        <span class="summary-val">{{ marketCount('美股') }}</span>
        <span class="summary-label small muted">美股</span>
      </div>
      <div class="summary-item">
        <span class="summary-val">{{ marketCount('港股') }}</span>
        <span class="summary-label small muted">港股</span>
      </div>
      <div class="summary-item">
        <span class="summary-val">{{ marketCount('A股') }}</span>
        <span class="summary-label small muted">A股</span>
      </div>
      <router-link to="/ask" class="ask-ai small">AI 分析该板块 →</router-link>
    </div>

    <!-- 筛选栏 -->
    <div class="toolbar">
      <div class="market-tabs">
        <button v-for="m in markets" :key="m"
                class="tab" :class="{ active: activeMarket === m }"
                @click="activeMarket = m">
          {{ m }}
          <span v-if="m !== '全部'" class="tab-count">{{ marketCount(m) }}</span>
        </button>
      </div>
      <div class="toolbar-right">
        <input v-model="search" type="search" placeholder="搜索代码/名称/理由..." class="search-input" />
        <select v-model="sortBy" class="sort-select">
          <option value="name">按名称</option>
          <option value="change">按涨跌</option>
          <option value="price">按价格</option>
        </select>
      </div>
    </div>

    <!-- 全部市场：分组显示 -->
    <template v-if="groupedStocks">
      <template v-for="market in (['美股', '港股', 'A股'] as Market[])" :key="market">
        <section v-if="groupedStocks[market].length > 0" class="market-section">
          <h2 class="market-title">
            {{ market }}
            <span class="market-count">{{ groupedStocks[market].length }} 只</span>
          </h2>
          <div class="stock-grid">
            <div v-for="stock in groupedStocks[market]" :key="stock.symbol"
                 class="stock-item card" @click="goToStock(stock.symbol)">
              <div class="stock-main">
                <div class="stock-symbol">{{ stock.symbol }}</div>
                <div class="stock-name">{{ stock.name }}</div>
                <div v-if="stock.layer" class="stock-layer small muted">{{ stock.layer }}</div>
              </div>
              <div class="stock-quote">
                <div class="stock-price">{{ quotesStore.get(stock.symbol)?.price?.toFixed(2) ?? '—' }}</div>
                <div class="stock-change" :class="(quotesStore.get(stock.symbol)?.change ?? 0) >= 0 ? 'pos' : 'neg'">
                  {{ quotesStore.get(stock.symbol)?.change != null ? (quotesStore.get(stock.symbol)!.change! * 100).toFixed(2) + '%' : '—' }}
                </div>
              </div>
              <div v-if="stock.reason" class="stock-reason small muted">{{ stock.reason }}</div>
            </div>
          </div>
        </section>
      </template>
    </template>

    <!-- 单市场：平铺显示 -->
    <div v-else class="stock-grid">
      <div v-for="stock in filteredStocks" :key="stock.symbol"
           class="stock-item card" @click="goToStock(stock.symbol)">
        <div class="stock-main">
          <div class="stock-symbol">{{ stock.symbol }}</div>
          <div class="stock-name">{{ stock.name }}</div>
          <div v-if="stock.layer" class="stock-layer small muted">{{ stock.layer }}</div>
        </div>
        <div class="stock-quote">
          <div class="stock-price">{{ quotesStore.get(stock.symbol)?.price?.toFixed(2) ?? '—' }}</div>
          <div class="stock-change" :class="(quotesStore.get(stock.symbol)?.change ?? 0) >= 0 ? 'pos' : 'neg'">
            {{ quotesStore.get(stock.symbol)?.change != null ? (quotesStore.get(stock.symbol)!.change! * 100).toFixed(2) + '%' : '—' }}
          </div>
        </div>
        <div v-if="stock.reason" class="stock-reason small muted">{{ stock.reason }}</div>
      </div>
    </div>

    <div v-if="filteredStocks.length === 0" class="empty muted">
      无匹配股票
    </div>
  </div>
</template>

<style scoped>
.page-head {
  margin-bottom: var(--space-4);
}
.sector-summary {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-3) 0;
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}
.summary-item { display: flex; align-items: baseline; gap: 6px; }
.summary-val { font-size: var(--fs-xl); font-weight: 700; }
.ask-ai { color: var(--color-link); text-decoration: none; margin-left: auto; }
.ask-ai:hover { text-decoration: underline; }
.breadcrumb {
  font-size: var(--fs-sm);
  margin-bottom: var(--space-1);
}
.breadcrumb a { text-decoration: none; }
.breadcrumb a:hover { text-decoration: underline; }
h1 { margin: var(--space-1) 0; }
.page-head p { margin: 0; }

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}
.market-tabs { display: flex; gap: 4px; }
.tab {
  padding: 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  font-size: var(--fs-sm);
  transition: all var(--transition-fast);
}
.tab:hover { border-color: var(--color-link); }
.tab.active { background: var(--color-link); color: white; border-color: var(--color-link); }
.tab-count {
  font-size: var(--fs-xs);
  opacity: 0.7;
  margin-left: 4px;
}
.toolbar-right { display: flex; gap: var(--space-2); }
.search-input { width: 200px; }
.sort-select { width: 100px; }

.market-section { margin-bottom: var(--space-6); }
.market-title {
  font-size: var(--fs-lg);
  margin: 0 0 var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.market-count { font-size: var(--fs-sm); color: var(--color-muted); font-weight: 400; }

.stock-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-3);
}
.stock-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.stock-item:hover { border-color: var(--color-link); }
.stock-main { flex: 1; }
.stock-symbol {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: var(--fs-md);
}
.stock-name { font-size: var(--fs-sm); margin-top: 2px; }
.stock-layer { margin-top: 4px; }
.stock-quote { text-align: right; }
.stock-price { font-size: var(--fs-lg); font-weight: 700; font-variant-numeric: tabular-nums; }
.stock-change { font-size: var(--fs-sm); font-weight: 600; font-variant-numeric: tabular-nums; }
.stock-reason {
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
  line-height: 1.4;
}
.pos { color: var(--color-up); }
.neg { color: var(--color-down); }
.empty { text-align: center; padding: var(--space-8); }
@media (max-width: 640px) {
  .toolbar { flex-direction: column; align-items: stretch; }
  .toolbar-right { flex-wrap: wrap; }
  .stock-grid { grid-template-columns: 1fr; }
}
</style>
