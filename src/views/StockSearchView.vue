<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { searchStocks, type SearchResult } from '../api/search'
import { useQuotesStore } from '../stores/quotes'
import { getPopularStocks } from '../data/popularStocks'
import { isLikelySupported, parseLongportSymbol } from '../api/symbolMap'
import { formatPrice, formatPercent, quoteTone } from '../utils/format'

const router = useRouter()
const quotesStore = useQuotesStore()

const query = ref('')
const results = ref<SearchResult[]>([])
const loading = ref(false)
const searched = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const popularStocks = getPopularStocks(24)
const popularSymbols = popularStocks.map(s => s.symbol)

const normalizedDirectSymbol = computed(() => {
  const raw = query.value.trim().toUpperCase()
  if (!raw) return ''
  if (isLikelySupported(raw)) return raw
  if (/^[A-Z]{1,6}$/.test(raw)) return `${raw}.US`
  if (/^\d{5}$/.test(raw)) return `${raw}.HK`
  if (/^\d{6}$/.test(raw)) {
    return raw.startsWith('6') ? `${raw}.SH` : `${raw}.SZ`
  }
  return ''
})

watch(query, (value) => {
  if (timer) clearTimeout(timer)
  if (!value.trim()) {
    results.value = []
    searched.value = false
    loading.value = false
    return
  }
  timer = setTimeout(() => performSearch(), 260)
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})

onMounted(() => {
  quotesStore.fetchAndStore(popularSymbols, { force: false }).catch(() => {})
})

async function performSearch() {
  const keyword = query.value.trim()
  if (!keyword) return
  loading.value = true
  searched.value = true
  try {
    results.value = await searchStocks(keyword)
  } finally {
    loading.value = false
  }
}

function goToSymbol(symbol: string) {
  if (!symbol) return
  router.push(`/stock/${encodeURIComponent(symbol)}`)
}

function submit() {
  const first = results.value[0]?.symbol
  goToSymbol(normalizedDirectSymbol.value || first)
}

function refreshPopular() {
  quotesStore.fetchAndStore(popularSymbols, { force: true }).catch(() => {})
}
</script>

<template>
  <div class="page search-page">
    <section class="search-hero">
      <div>
        <p class="eyebrow">自定义查询</p>
        <h1>单股搜索</h1>
        <p class="muted">输入股票名称、代码或标准符号，快速进入个股详情与 K 线页面。</p>
      </div>
      <button class="btn" @click="refreshPopular">刷新热门行情</button>
    </section>

    <section class="query-panel">
      <div class="search-box">
        <span class="search-symbol">⌕</span>
        <input
          v-model="query"
          type="search"
          placeholder="例如 NVDA、00700、600519 或 腾讯"
          @keydown.enter.prevent="submit"
        />
        <button class="btn primary" :disabled="!query.trim()" @click="submit">查询</button>
      </div>
      <div v-if="normalizedDirectSymbol" class="direct-row">
        <span class="small muted">识别为</span>
        <button class="ticker direct" @click="goToSymbol(normalizedDirectSymbol)">
          {{ normalizedDirectSymbol }}
          <span class="ticker-name">{{ parseLongportSymbol(normalizedDirectSymbol)?.region }}</span>
        </button>
      </div>
    </section>

    <section v-if="query.trim()" class="results-section">
      <div class="section-head">
        <h2>搜索结果</h2>
        <span v-if="loading" class="small muted">搜索中...</span>
      </div>

      <div v-if="results.length" class="result-list">
        <button v-for="item in results" :key="item.symbol" class="result-row" @click="goToSymbol(item.symbol)">
          <div>
            <div class="result-title">{{ item.name }}</div>
            <div class="small muted">{{ item.code }} · {{ item.type }}</div>
          </div>
          <div class="result-meta">
            <span class="tag-light">{{ item.market }}</span>
            <span class="ticker">{{ item.symbol }}</span>
          </div>
        </button>
      </div>
      <div v-else-if="searched && !loading" class="empty-state muted">
        没有匹配结果，可以直接使用标准符号进入详情。
      </div>
    </section>

    <section class="popular-section">
      <div class="section-head">
        <h2>热门股票</h2>
        <span class="small muted">覆盖美股、港股、A 股</span>
      </div>
      <div class="popular-grid">
        <button v-for="stock in popularStocks" :key="stock.symbol" class="popular-card" @click="goToSymbol(stock.symbol)">
          <div class="popular-top">
            <div>
              <div class="popular-name">{{ stock.name }}</div>
              <div class="ticker">{{ stock.symbol }}</div>
            </div>
            <span class="tag-light">{{ stock.market }}</span>
          </div>
          <div class="popular-bottom">
            <div class="price">{{ formatPrice(quotesStore.get(stock.symbol)?.price) }}</div>
            <div class="change" :class="quoteTone(quotesStore.get(stock.symbol)?.change)">
              {{ formatPercent(quotesStore.get(stock.symbol)?.change) }}
            </div>
          </div>
          <div v-if="stock.layer" class="small muted layer">{{ stock.layer }}</div>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.search-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.search-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--space-4);
  padding: var(--space-5) 0 var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.eyebrow {
  margin: 0 0 6px;
  color: var(--color-link);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.search-hero h1 {
  margin-bottom: 8px;
}
.query-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  box-shadow: var(--shadow-sm);
}
.search-box {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-2);
}
.search-symbol {
  color: var(--color-muted);
  font-size: 20px;
  line-height: 1;
}
.search-box input {
  width: 100%;
  min-height: 44px;
  font-size: var(--fs-md);
}
.direct-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.direct {
  border-color: var(--color-link);
  color: var(--color-link);
  cursor: pointer;
}
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}
.result-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg-elevated);
}
.result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 0;
  border-bottom: 1px solid var(--color-border);
  background: transparent;
  text-align: left;
}
.result-row:last-child {
  border-bottom: 0;
}
.result-row:hover {
  background: var(--color-bg-soft);
}
.result-title {
  font-weight: 700;
}
.result-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}
.tag-light {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-muted);
  color: var(--color-muted);
  font-size: var(--fs-xs);
  font-weight: 600;
}
.empty-state {
  padding: var(--space-6);
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
}
.popular-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: var(--space-3);
}
.popular-card {
  display: flex;
  min-height: 132px;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  text-align: left;
  box-shadow: var(--shadow-sm);
  transition: border-color var(--transition-fast), transform var(--transition-fast), box-shadow var(--transition-fast);
}
.popular-card:hover {
  border-color: var(--color-link);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
.popular-top,
.popular-bottom {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}
.popular-name {
  font-weight: 700;
  margin-bottom: 4px;
}
.price {
  font-size: var(--fs-lg);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.change {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.layer {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pos { color: var(--color-up); }
.neg { color: var(--color-down); }
.flat { color: var(--color-flat); }

@media (max-width: 640px) {
  .search-hero {
    align-items: flex-start;
    flex-direction: column;
  }
  .search-box {
    grid-template-columns: auto 1fr;
  }
  .search-box .btn {
    grid-column: 1 / -1;
  }
  .result-row {
    align-items: flex-start;
    flex-direction: column;
  }
  .result-meta {
    justify-content: flex-start;
  }
}
</style>
