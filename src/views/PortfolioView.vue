<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePortfolioStore } from '../stores/portfolio'
import { useQuotesStore } from '../stores/quotes'
import { searchStocks, type SearchResult } from '../api/search'
import { isLikelySupported } from '../api/symbolMap'
import { formatDate, formatPercent, formatPrice, quoteTone } from '../utils/format'
import type { PortfolioHolding } from '../types'

const router = useRouter()
const portfolio = usePortfolioStore()
const quotesStore = useQuotesStore()

const form = ref({
  symbol: '',
  name: '',
  buyPrice: null as number | null,
  fee: 0,
  buyDate: new Date().toISOString().slice(0, 10),
  quantity: null as number | null,
})
const results = ref<SearchResult[]>([])
const searchLoading = ref(false)
const editingId = ref<string | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const canSubmit = computed(() => {
  return Boolean(normalizedSymbol.value && form.value.buyPrice && form.value.quantity && form.value.buyDate)
})

const normalizedSymbol = computed(() => {
  const raw = form.value.symbol.trim().toUpperCase()
  if (!raw) return ''
  if (isLikelySupported(raw)) return raw
  if (/^[A-Z]{1,6}$/.test(raw)) return `${raw}.US`
  if (/^\d{5}$/.test(raw)) return `${raw}.HK`
  if (/^\d{6}$/.test(raw)) return raw.startsWith('6') ? `${raw}.SH` : `${raw}.SZ`
  return raw
})

const sortedHoldings = computed(() => portfolio.computedHoldings)

watch(() => form.value.symbol, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  if (!value.trim()) {
    results.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searchLoading.value = true
    try {
      results.value = await searchStocks(value)
    } finally {
      searchLoading.value = false
    }
  }, 260)
})

onMounted(() => {
  refreshQuotes()
})

function selectResult(item: SearchResult) {
  form.value.symbol = item.symbol
  form.value.name = item.name
  results.value = []
}

function resetForm() {
  editingId.value = null
  form.value = {
    symbol: '',
    name: '',
    buyPrice: null,
    fee: 0,
    buyDate: new Date().toISOString().slice(0, 10),
    quantity: null,
  }
  results.value = []
}

function submitHolding() {
  if (!canSubmit.value) return
  const input = {
    symbol: normalizedSymbol.value,
    name: form.value.name.trim() || normalizedSymbol.value,
    buyPrice: Number(form.value.buyPrice),
    fee: Number(form.value.fee) || 0,
    buyDate: form.value.buyDate,
    quantity: Number(form.value.quantity),
  }
  if (editingId.value) portfolio.updateHolding(editingId.value, input)
  else portfolio.addHolding(input)
  quotesStore.fetchOne(input.symbol, { force: true }).catch(() => {})
  resetForm()
}

function editHolding(item: PortfolioHolding) {
  editingId.value = item.id
  form.value = {
    symbol: item.symbol,
    name: item.name,
    buyPrice: item.buyPrice,
    fee: item.fee,
    buyDate: item.buyDate,
    quantity: item.quantity,
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function refreshQuotes() {
  if (portfolio.symbols.length) {
    quotesStore.fetchAndStore(portfolio.symbols, { force: true }).catch(() => {})
  }
}

function goToStock(symbol: string) {
  router.push(`/stock/${encodeURIComponent(symbol)}`)
}
</script>

<template>
  <div class="page portfolio-page">
    <section class="portfolio-head">
      <div>
        <p class="eyebrow">个人持仓</p>
        <h1>持仓盈亏</h1>
        <p class="muted">记录买入价格、数量、手续费和日期，按实时行情计算浮动盈亏。</p>
      </div>
      <button class="btn" :disabled="!portfolio.symbols.length" @click="refreshQuotes">刷新行情</button>
    </section>

    <section class="summary-grid">
      <div class="summary-card">
        <span class="small muted">持仓股票</span>
        <strong>{{ portfolio.summary.count }}</strong>
      </div>
      <div class="summary-card">
        <span class="small muted">投入成本</span>
        <strong>{{ formatPrice(portfolio.summary.totalCost) }}</strong>
      </div>
      <div class="summary-card">
        <span class="small muted">当前市值</span>
        <strong>{{ formatPrice(portfolio.summary.totalMarketValue) }}</strong>
      </div>
      <div class="summary-card" :class="quoteTone(portfolio.summary.profitRate)">
        <span class="small muted">浮动盈亏</span>
        <strong>{{ formatPrice(portfolio.summary.profit) }}</strong>
        <em>{{ formatPercent(portfolio.summary.profitRate) }}</em>
      </div>
    </section>

    <section class="holding-form">
      <div class="form-title">
        <h2>{{ editingId ? '编辑持仓' : '添加持仓' }}</h2>
        <button v-if="editingId" class="btn ghost sm" @click="resetForm">取消编辑</button>
      </div>
      <div class="form-grid">
        <label>
          <span class="small muted">股票</span>
          <input v-model="form.symbol" type="text" placeholder="代码或名称，如 NVDA / 腾讯" />
        </label>
        <label>
          <span class="small muted">名称</span>
          <input v-model="form.name" type="text" placeholder="自动或手动填写" />
        </label>
        <label>
          <span class="small muted">买入价格</span>
          <input v-model.number="form.buyPrice" type="number" min="0" step="0.001" placeholder="0.00" />
        </label>
        <label>
          <span class="small muted">数量（股）</span>
          <input v-model.number="form.quantity" type="number" min="0" step="1" placeholder="100" />
        </label>
        <label>
          <span class="small muted">手续费</span>
          <input v-model.number="form.fee" type="number" min="0" step="0.01" placeholder="0" />
        </label>
        <label>
          <span class="small muted">购买日期</span>
          <input v-model="form.buyDate" type="date" />
        </label>
      </div>

      <div v-if="results.length" class="suggestions">
        <button v-for="item in results" :key="item.symbol" @click="selectResult(item)">
          <span>{{ item.name }}</span>
          <code>{{ item.symbol }}</code>
          <em>{{ item.market }}</em>
        </button>
      </div>
      <div v-else-if="searchLoading" class="small muted">搜索中...</div>

      <div class="form-actions">
        <span v-if="normalizedSymbol" class="small muted">将保存为 <code>{{ normalizedSymbol }}</code></span>
        <button class="btn primary" :disabled="!canSubmit" @click="submitHolding">
          {{ editingId ? '保存修改' : '添加持仓' }}
        </button>
      </div>
    </section>

    <section class="holdings-section">
      <div class="section-head">
        <h2>持仓明细</h2>
        <span v-if="portfolio.summary.missingQuotes" class="small muted">{{ portfolio.summary.missingQuotes }} 条暂无行情</span>
      </div>

      <div v-if="!sortedHoldings.length" class="empty-state">
        <h3>暂无持仓</h3>
        <p class="muted">添加第一条持仓后，这里会展示成本、市值和盈亏。</p>
      </div>

      <div v-else class="holdings-table">
        <div class="table-head">
          <span>股票</span>
          <span>买入</span>
          <span>当前</span>
          <span>市值/成本</span>
          <span>盈亏</span>
          <span>操作</span>
        </div>
        <div v-for="item in sortedHoldings" :key="item.id" class="table-row">
          <button class="stock-cell" @click="goToStock(item.symbol)">
            <strong>{{ item.name }}</strong>
            <span class="ticker">{{ item.symbol }}</span>
          </button>
          <div>
            <strong>{{ formatPrice(item.buyPrice) }}</strong>
            <span class="small muted">{{ item.quantity }} 股 · {{ formatDate(new Date(item.buyDate), 'date') }}</span>
            <span class="small muted">手续费 {{ formatPrice(item.fee) }}</span>
          </div>
          <div>
            <strong>{{ formatPrice(item.currentPrice) }}</strong>
            <span class="small muted">{{ item.source || '暂无' }}</span>
          </div>
          <div>
            <strong>{{ formatPrice(item.marketValue) }}</strong>
            <span class="small muted">成本 {{ formatPrice(item.costAmount) }}</span>
          </div>
          <div :class="quoteTone(item.profitRate)">
            <strong>{{ formatPrice(item.profit) }}</strong>
            <span>{{ formatPercent(item.profitRate) }}</span>
            <span class="small muted">{{ item.daysHeld }} 天</span>
          </div>
          <div class="actions">
            <button class="btn sm" @click="editHolding(item)">编辑</button>
            <button class="btn sm ghost danger" @click="portfolio.removeHolding(item.id)">删除</button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.portfolio-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.portfolio-head {
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
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
}
.summary-card {
  display: flex;
  min-height: 116px;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  box-shadow: var(--shadow-sm);
}
.summary-card strong {
  font-size: var(--fs-xl);
  font-variant-numeric: tabular-nums;
}
.summary-card em {
  font-style: normal;
  font-weight: 700;
}
.holding-form,
.holdings-section {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  box-shadow: var(--shadow-sm);
}
.form-title,
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
input {
  width: 100%;
}
.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
.suggestions button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
}
.suggestions button:hover {
  border-color: var(--color-link);
}
.suggestions em {
  color: var(--color-muted);
  font-size: var(--fs-xs);
  font-style: normal;
}
.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-4);
}
.empty-state {
  padding: var(--space-8);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
}
.holdings-table {
  display: flex;
  flex-direction: column;
}
.table-head,
.table-row {
  display: grid;
  grid-template-columns: 1.4fr 1.3fr 0.9fr 1.2fr 1fr auto;
  gap: var(--space-3);
  align-items: center;
}
.table-head {
  padding: 0 var(--space-3) var(--space-2);
  color: var(--color-muted);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.table-row {
  min-height: 86px;
  padding: var(--space-3);
  border-top: 1px solid var(--color-border);
}
.table-row > div,
.stock-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.stock-cell {
  border: 0;
  background: transparent;
  text-align: left;
}
.stock-cell:hover strong {
  color: var(--color-link);
}
.actions {
  display: flex;
  flex-direction: row;
  gap: var(--space-2);
}
.danger {
  color: var(--color-down);
}
.pos { color: var(--color-up); }
.neg { color: var(--color-down); }
.flat { color: var(--color-flat); }

@media (max-width: 980px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .table-head {
    display: none;
  }
  .table-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
}

@media (max-width: 640px) {
  .portfolio-head {
    align-items: flex-start;
    flex-direction: column;
  }
  .summary-grid,
  .form-grid,
  .table-row {
    grid-template-columns: 1fr;
  }
  .form-actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
