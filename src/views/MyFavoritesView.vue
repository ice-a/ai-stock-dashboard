<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useWatchlistStore } from '../stores/watchlist'
import { useQuotesStore } from '../stores/quotes'
import { useRefreshStore } from '../stores/refresh'
import { useAutoRefresh } from '../composables/useAutoRefresh'
import { findLeader, findIdea } from '../utils/benchmarks'
import { sourceManager } from '../api/sourceManager'
import { analyzeStock, type StockAnalysis } from '../utils/analysis'
import type { KLinePoint } from '../types'
import WatchlistButton from '../components/WatchlistButton.vue'
import PriceTicker from '../components/PriceTicker.vue'
import ExternalLinks from '../components/ExternalLinks.vue'
import FavAnalysis from '../components/FavAnalysis.vue'
import { formatPercent } from '../utils/format'

const { t } = useI18n()
const router = useRouter()
const watchlistStore = useWatchlistStore()
const quotesStore = useQuotesStore()
const refreshStore = useRefreshStore()

const search = ref('')
const groupFilter = ref<string>('all')
const showAnalysis = ref(false)
const analysisLoading = ref(false)
const analysisMap = ref<Map<string, StockAnalysis>>(new Map())

const enriched = computed(() => {
  return watchlistStore.items.map(item => ({
    ...item,
    leader: findLeader(item.symbol),
    idea: findIdea(item.symbol),
    quote: quotesStore.get(item.symbol),
    analysis: analysisMap.value.get(item.symbol),
  }))
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return enriched.value.filter(item => {
    if (groupFilter.value !== 'all' && item.group !== groupFilter.value) return false
    if (q) {
      const blob = `${item.symbol} ${item.note} ${item.leader?.name || ''} ${item.leader?.layer || ''}`.toLowerCase()
      if (!blob.includes(q)) return false
    }
    return true
  })
})

const enabled = computed(() => refreshStore.enabled)
const interval = computed(() => refreshStore.listInterval)
const { refreshNow } = useAutoRefresh({
  interval, enabled,
  fetcher: async () => {
    if (!enriched.value.length) return
    await quotesStore.fetchAndStore(enriched.value.map(i => i.symbol))
  }
})

async function loadAnalysis() {
  if (analysisLoading.value) return
  analysisLoading.value = true
  const map = new Map<string, StockAnalysis>()
  const symbols = filtered.value.map(i => i.symbol)
  // 分批获取 K 线数据并分析
  const batchSize = 5
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize)
    await Promise.all(batch.map(async (symbol) => {
      try {
        const kline = await sourceManager.fetchKLine(symbol, { range: '1y', interval: '1d' })
        if (kline && kline.points.length >= 10) {
          map.set(symbol, analyzeStock(kline.points))
        }
      } catch { /* skip */ }
    }))
  }
  analysisMap.value = map
  analysisLoading.value = false
}

function toggleAnalysis() {
  showAnalysis.value = !showAnalysis.value
  if (showAnalysis.value && analysisMap.value.size === 0) {
    loadAnalysis()
  }
}

// 综合评分排序
function sortByScore() {
  // 触发 computed 更新（通过修改 search 触发 reactive）
  search.value = search.value + ''
}

const sortedByScore = computed(() => {
  if (!showAnalysis.value) return filtered.value
  return [...filtered.value].sort((a, b) => {
    const sa = a.analysis?.score ?? -1
    const sb = b.analysis?.score ?? -1
    return sb - sa
  })
})

const displayList = computed(() => {
  return showAnalysis.value ? sortedByScore.value : filtered.value
})

function exportCSV() {
  const rows = [
    ['symbol', 'name', 'region', 'layer', 'group', 'note', 'targetPrice', 'addedAt', 'price', 'change',
     'score', 'trend', 'rsi', 'return1m', 'volatility', 'signals'],
    ...enriched.value.map(i => [
      i.symbol,
      i.leader?.name || '',
      i.leader?.region || '',
      i.leader?.layer || '',
      i.group,
      (i.note || '').replace(/[\n,]/g, ' '),
      i.targetPrice ?? '',
      new Date(i.addedAt).toISOString(),
      i.quote?.price ?? '',
      i.quote?.change ?? '',
      i.analysis?.score ?? '',
      i.analysis?.technical.trend ?? '',
      i.analysis?.technical.rsi14?.toFixed(1) ?? '',
      i.analysis?.performance.return1m != null ? (i.analysis.performance.return1m * 100).toFixed(2) + '%' : '',
      i.analysis?.performance.volatility != null ? (i.analysis.performance.volatility * 100).toFixed(1) + '%' : '',
      (i.analysis?.signals || []).join('; '),
    ])
  ]
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `favorites-analysis-${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>自选股</h1>
      <div class="page-actions">
        <button class="btn" :class="{ primary: showAnalysis }" @click="toggleAnalysis">
          <span v-if="analysisLoading" class="spinner"></span>
          {{ showAnalysis ? '关闭分析' : '多维度分析' }}
        </button>
        <button class="btn" @click="exportCSV">导出 CSV</button>
      </div>
    </header>

    <div class="toolbar">
      <input v-model="search" type="search" placeholder="搜索代码、备注、层级..." class="search" />
      <select v-model="groupFilter">
        <option value="all">全部分组</option>
        <option v-for="g in watchlistStore.groups" :key="g" :value="g">{{ g }}</option>
      </select>
    </div>

    <div v-if="displayList.length === 0" class="empty card">
      <p class="muted">{{ t('empty.noFavorites') }}</p>
      <router-link to="/universe" class="btn primary">前往公司池</router-link>
    </div>

    <div v-else class="fav-list">
      <div v-for="item in displayList" :key="item.symbol" class="fav-card card">
        <div class="fav-head">
          <div class="info">
            <div class="row1">
              <router-link :to="`/stock/${encodeURIComponent(item.symbol)}`" class="symbol-link">{{ item.symbol }}</router-link>
              <span class="tag-light">{{ item.group }}</span>
              <span v-if="item.analysis" class="score-mini" :style="{ color: item.analysis.score >= 60 ? 'var(--color-up)' : item.analysis.score >= 40 ? 'var(--color-flat)' : 'var(--color-down)' }">
                {{ item.analysis.score }}分
              </span>
            </div>
            <h3 class="name">{{ item.leader?.name || item.idea?.name || item.symbol }}</h3>
            <div class="meta small muted">
              <span v-if="item.leader">{{ item.leader.region }} · {{ item.leader.layer }}</span>
            </div>
          </div>
          <div class="quote-area">
            <div class="price">
              <PriceTicker :value="item.quote?.price" :digits="2" />
            </div>
            <div class="change" :class="item.quote?.change != null ? (item.quote.change >= 0 ? 'pos' : 'neg') : 'flat'">
              <PriceTicker :value="item.quote?.change" :show-sign="true" :digits="2" />
            </div>
          </div>
          <div class="actions">
            <WatchlistButton :symbol="item.symbol" />
            <ExternalLinks :symbol="item.symbol" />
          </div>
        </div>
        <div v-if="item.targetPrice || item.note" class="fav-body">
          <div v-if="item.targetPrice" class="target">
            <span class="small muted">目标价</span>
            <strong>{{ item.targetPrice }}</strong>
            <span v-if="item.quote?.price && item.targetPrice" class="diff" :class="(item.quote.price - item.targetPrice) >= 0 ? 'pos' : 'neg'">
              {{ formatPercent((item.quote.price - item.targetPrice) / item.targetPrice) }}
            </span>
          </div>
          <div v-if="item.note" class="note">{{ item.note }}</div>
        </div>
        <!-- 多维度分析 -->
        <FavAnalysis v-if="showAnalysis && item.analysis" :analysis="item.analysis" :price="item.quote?.price" />
        <div v-else-if="showAnalysis && !item.analysis" class="no-analysis small muted">
          暂无分析数据（K 线不足）
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}
.page-actions {
  display: flex;
  gap: var(--space-2);
}
.toolbar {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}
.search { flex: 1; max-width: 400px; }
.empty {
  text-align: center;
  padding: var(--space-12);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: center;
}
.fav-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.fav-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.fav-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.info { flex: 1; min-width: 200px; }
.row1 { display: flex; align-items: center; gap: var(--space-2); }
.symbol-link {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: var(--fs-md);
  color: var(--color-ink);
  text-decoration: none;
}
.symbol-link:hover { color: var(--color-link); text-decoration: none; }
.name { font-size: var(--fs-base); margin: 2px 0; font-weight: 600; }
.tag-light {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--color-bg-muted);
  color: var(--color-muted);
  font-size: var(--fs-xs);
}
.score-mini {
  font-size: var(--fs-xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.quote-area {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.price :first-child {
  font-size: var(--fs-xl);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.change :first-child {
  font-size: var(--fs-sm);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.actions { display: flex; align-items: center; gap: 6px; }
.fav-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}
.target {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.target strong {
  font-size: var(--fs-md);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.diff {
  font-size: var(--fs-sm);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--color-bg-muted);
}
.pos { color: var(--color-up); }
.neg { color: var(--color-down); }
.flat { color: var(--color-flat); }
.note {
  font-size: var(--fs-sm);
  color: var(--color-ink-soft);
  background: var(--color-bg-muted);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  line-height: 1.5;
}
.no-analysis {
  text-align: center;
  padding: var(--space-2);
}
.spinner {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 4px;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
