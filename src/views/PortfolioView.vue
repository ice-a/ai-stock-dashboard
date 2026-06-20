<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePortfolioStore } from '../stores/portfolio'
import { useQuotesStore } from '../stores/quotes'
import { searchStocks, type SearchResult } from '../api/search'
import { isLikelySupported } from '../api/symbolMap'
import { formatDate, formatPercent, formatPrice, quoteTone } from '../utils/format'
import type { PortfolioHolding, PortfolioTransactionType } from '../types'
import PortfolioShare from '../components/PortfolioShare.vue'

const router = useRouter()
const portfolio = usePortfolioStore()
const quotesStore = useQuotesStore()
const showShareDialog = ref(false)

const form = ref({
  side: 'buy' as PortfolioTransactionType,
  symbol: '',
  name: '',
  buyPrice: null as number | null,
  fee: 0,
  buyDate: new Date().toISOString().slice(0, 10),
  quantity: null as number | null,
  note: '',
})
const results = ref<SearchResult[]>([])
const searchLoading = ref(false)
const editingId = ref<string | null>(null)
const formError = ref<string | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchAbort: AbortController | null = null

const canSubmit = computed(() => {
  if (!normalizedSymbol.value || !form.value.buyPrice || !form.value.quantity || !form.value.buyDate) return false
  if (form.value.side === 'sell') return form.value.quantity <= availableForForm.value
  return true
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
const sortedTransactions = computed(() => portfolio.recentTransactions)
const availableForForm = computed(() => normalizedSymbol.value ? portfolio.availableQuantity(normalizedSymbol.value) : 0)

watch(() => form.value.side, () => {
  editingId.value = null
  formError.value = null
})

watch(() => form.value.symbol, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  if (searchAbort) searchAbort.abort()
  if (!value.trim()) {
    results.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searchAbort = new AbortController()
    searchLoading.value = true
    try {
      results.value = await searchStocks(value)
    } finally {
      searchLoading.value = false
    }
  }, 260)
})

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer)
  if (searchAbort) searchAbort.abort()
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
  formError.value = null
  form.value = {
    side: 'buy',
    symbol: '',
    name: '',
    buyPrice: null,
    fee: 0,
    buyDate: new Date().toISOString().slice(0, 10),
    quantity: null,
    note: '',
  }
  results.value = []
}

function submitHolding() {
  if (!canSubmit.value) return
  formError.value = null
  const input = {
    symbol: normalizedSymbol.value,
    name: form.value.name.trim() || normalizedSymbol.value,
    buyPrice: Number(form.value.buyPrice),
    fee: Number(form.value.fee) || 0,
    buyDate: form.value.buyDate,
    quantity: Number(form.value.quantity),
  }
  try {
    if (form.value.side === 'sell') {
      portfolio.sellHolding({
        symbol: input.symbol,
        name: input.name,
        price: input.buyPrice,
        quantity: input.quantity,
        fee: input.fee,
        tradeDate: input.buyDate,
        note: form.value.note,
      })
    } else if (editingId.value) {
      portfolio.updateHolding(editingId.value, input)
    } else {
      portfolio.addHolding(input)
    }
  } catch (e) {
    formError.value = (e as Error).message
    return
  }
  quotesStore.fetchOne(input.symbol, { force: true }).catch(() => {})
  resetForm()
}

function editHolding(item: PortfolioHolding) {
  editingId.value = item.id
  form.value = {
    side: 'buy',
    symbol: item.symbol,
    name: item.name,
    buyPrice: item.buyPrice,
    fee: item.fee,
    buyDate: item.buyDate,
    quantity: item.quantity,
    note: '',
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function sellFromHolding(item: PortfolioHolding) {
  editingId.value = null
  formError.value = null
  form.value = {
    side: 'sell',
    symbol: item.symbol,
    name: item.name,
    buyPrice: quotesStore.get(item.symbol)?.price ?? item.buyPrice,
    fee: 0,
    buyDate: new Date().toISOString().slice(0, 10),
    quantity: item.quantity,
    note: '',
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

function transactionTone(type: PortfolioTransactionType) {
  return type === 'buy' ? 'pos' : 'neg'
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
      <div class="head-actions">
        <button class="btn ghost" :disabled="!portfolio.computedHoldings.length" @click="showShareDialog = true">
          分享持仓
        </button>
        <button class="btn" :disabled="!portfolio.symbols.length" @click="refreshQuotes">刷新行情</button>
      </div>
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
      <div class="summary-card" :class="quoteTone(portfolio.summary.realizedProfit)">
        <span class="small muted">已实现盈亏</span>
        <strong>{{ formatPrice(portfolio.summary.realizedProfit) }}</strong>
      </div>
      <div class="summary-card" :class="quoteTone(portfolio.summary.totalProfitRate)">
        <span class="small muted">累计盈亏</span>
        <strong>{{ formatPrice(portfolio.summary.totalProfit) }}</strong>
        <em>{{ formatPercent(portfolio.summary.totalProfitRate) }}</em>
      </div>
    </section>

    <section class="holding-form">
      <div class="form-title">
        <h2>{{ editingId ? '编辑持仓' : form.side === 'sell' ? '记录卖出' : '记录买入' }}</h2>
        <button v-if="editingId" class="btn ghost sm" @click="resetForm">取消编辑</button>
      </div>
      <div class="form-grid">
        <label>
          <span class="small muted">交易方向</span>
          <select v-model="form.side" :disabled="Boolean(editingId)">
            <option value="buy">买入 / 加仓</option>
            <option value="sell">卖出 / 减仓</option>
          </select>
        </label>
        <label>
          <span class="small muted">股票</span>
          <input v-model="form.symbol" type="text" placeholder="代码或名称，如 NVDA / 腾讯" />
        </label>
        <label>
          <span class="small muted">名称</span>
          <input v-model="form.name" type="text" placeholder="自动或手动填写" />
        </label>
        <label>
          <span class="small muted">{{ form.side === 'sell' ? '卖出价格' : '买入价格' }}</span>
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
          <span class="small muted">交易日期</span>
          <input v-model="form.buyDate" type="date" />
        </label>
        <label>
          <span class="small muted">备注</span>
          <input v-model="form.note" type="text" placeholder="交易理由、计划或复盘" />
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
        <span v-if="formError" class="small neg">{{ formError }}</span>
        <span v-else-if="normalizedSymbol && form.side === 'sell'" class="small muted">
          将卖出 <code>{{ normalizedSymbol }}</code>，当前可卖 {{ availableForForm }} 股
        </span>
        <span v-else-if="normalizedSymbol" class="small muted">将保存为 <code>{{ normalizedSymbol }}</code></span>
        <button class="btn primary" :disabled="!canSubmit" @click="submitHolding">
          {{ editingId ? '保存修改' : form.side === 'sell' ? '记录卖出' : '记录买入' }}
        </button>
      </div>
    </section>

    <section class="holdings-section">
      <div class="section-head">
        <h2>当前持仓汇总</h2>
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
            <button class="btn sm" @click="sellFromHolding(item)">卖出</button>
            <button class="btn sm ghost danger" @click="portfolio.removeHolding(item.id)">删除</button>
          </div>
        </div>
      </div>
    </section>

    <section class="transactions-section">
      <div class="section-head">
        <h2>交易流水</h2>
        <span class="small muted">{{ sortedTransactions.length }} 条记录</span>
      </div>
      <div v-if="!sortedTransactions.length" class="empty-state">
        <h3>暂无交易流水</h3>
        <p class="muted">之后的买入、卖出会在这里形成可复盘记录。</p>
      </div>
      <div v-else class="transactions-table">
        <div class="tx-head">
          <span>日期</span>
          <span>股票</span>
          <span>方向</span>
          <span>价格/数量</span>
          <span>已实现盈亏</span>
          <span>备注</span>
        </div>
        <div v-for="tx in sortedTransactions" :key="tx.id" class="tx-row">
          <span>{{ formatDate(new Date(tx.tradeDate), 'date') }}</span>
          <button class="stock-cell" @click="goToStock(tx.symbol)">
            <strong>{{ tx.name }}</strong>
            <span class="ticker">{{ tx.symbol }}</span>
          </button>
          <span class="tx-side" :class="transactionTone(tx.type)">{{ tx.type === 'buy' ? '买入' : '卖出' }}</span>
          <div>
            <strong>{{ formatPrice(tx.price) }}</strong>
            <span class="small muted">{{ tx.quantity }} 股 · 费 {{ formatPrice(tx.fee) }}</span>
          </div>
          <div :class="quoteTone(tx.realizedProfitRate)">
            <strong>{{ tx.realizedProfit == null ? '—' : formatPrice(tx.realizedProfit) }}</strong>
            <span>{{ tx.realizedProfitRate == null ? '—' : formatPercent(tx.realizedProfitRate) }}</span>
          </div>
          <span class="small muted">{{ tx.note || '—' }}</span>
        </div>
      </div>
    </section>

    <!-- 分享对话框 -->
    <Teleport to="body">
      <div v-if="showShareDialog" class="dialog-overlay" @click.self="showShareDialog = false">
        <div class="dialog">
          <div class="dialog-header">
            <h3>分享持仓</h3>
            <button class="btn-close" @click="showShareDialog = false">×</button>
          </div>
          <div class="dialog-body">
            <PortfolioShare
              :holdings="portfolio.computedHoldings"
              :summary="portfolio.summary"
            />
          </div>
        </div>
      </div>
    </Teleport>
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

.head-actions {
  display: flex;
  gap: var(--space-2);
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
.holdings-section,
.transactions-section {
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

.transactions-table {
  display: flex;
  flex-direction: column;
}
.tx-head,
.tx-row {
  display: grid;
  grid-template-columns: 0.9fr 1.3fr 0.7fr 1fr 1fr 1.2fr;
  gap: var(--space-3);
  align-items: center;
}
.tx-head {
  padding: 0 var(--space-3) var(--space-2);
  color: var(--color-muted);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.tx-row {
  min-height: 74px;
  padding: var(--space-3);
  border-top: 1px solid var(--color-border);
}
.tx-row > div,
.tx-row > span {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.tx-side {
  font-weight: 700;
}

@media (max-width: 980px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .table-head {
    display: none;
  }
  .tx-head {
    display: none;
  }
  .table-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
  }
  .tx-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .page {
    padding-bottom: calc(60px + var(--space-4));
  }
  
  .portfolio-head {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .head-actions {
    width: 100%;
    flex-wrap: wrap;
  }
  
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  
  .form-grid,
  .table-row,
  .tx-row {
    grid-template-columns: 1fr;
  }
  
  .form-actions {
    align-items: stretch;
    flex-direction: column;
  }
  
  .table-row {
    padding: var(--space-3);
    background: var(--color-bg-elevated);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-2);
    border-top: none;
  }
  
  .tx-row {
    padding: var(--space-3);
    background: var(--color-bg-elevated);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-2);
    border-top: none;
  }
  
  .dialog {
    max-width: 100%;
    margin: var(--space-2);
    max-height: 85vh;
  }
}

@media (max-width: 375px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
  
  .summary-card {
    min-height: auto;
    padding: var(--space-3);
  }
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.dialog {
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.dialog-header h3 {
  margin: 0;
  font-size: var(--fs-lg);
}

.btn-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  font-size: 24px;
  cursor: pointer;
  color: var(--color-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}

.btn-close:hover {
  background: var(--color-bg-muted);
}

.dialog-body {
  padding: var(--space-4);
}
</style>
