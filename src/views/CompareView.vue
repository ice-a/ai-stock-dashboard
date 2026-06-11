<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuotesStore } from '../stores/quotes'
import { parseLongportSymbol } from '../api/symbolMap'
import { sourceManager } from '../api/sourceManager'
import { analyzeStock, type StockAnalysis } from '../utils/analysis'
import { formatPrice, formatPercent, quoteTone } from '../utils/format'
import PriceTicker from '../components/PriceTicker.vue'

const router = useRouter()
const quotesStore = useQuotesStore()

const symbolsText = ref('')
const loading = ref(false)
const analysisMap = ref<Map<string, StockAnalysis>>(new Map())

const symbols = computed(() => {
  return [...new Set(symbolsText.value
    .split(/[\s,，;；]+/)
    .map(v => v.trim().toUpperCase())
    .filter(v => v && parseLongportSymbol(v)))]
    .slice(0, 8)
})

const stockData = computed(() => {
  return symbols.value.map(symbol => {
    const quote = quotesStore.get(symbol)
    const analysis = analysisMap.value.get(symbol)
    return { symbol, quote, analysis }
  })
})

function normalizeInput(value: string): string {
  const raw = value.trim().toUpperCase()
  if (!raw) return ''
  if (parseLongportSymbol(raw)) return raw
  if (/^[A-Z]{1,6}$/.test(raw)) return `${raw}.US`
  if (/^\d{5}$/.test(raw)) return `${raw}.HK`
  if (/^\d{6}$/.test(raw)) return raw.startsWith('6') ? `${raw}.SH` : `${raw}.SZ`
  return raw
}

function addSymbol(raw: string) {
  const s = normalizeInput(raw)
  if (!s || !parseLongportSymbol(s)) return
  const set = new Set(symbols.value)
  set.add(s)
  symbolsText.value = [...set].join(', ')
}

watch(symbols, async (newSymbols) => {
  if (newSymbols.length === 0) return
  loading.value = true
  try {
    await quotesStore.fetchAndStore(newSymbols, { force: true })
    const map = new Map<string, StockAnalysis>()
    await Promise.all(newSymbols.map(async (symbol) => {
      try {
        const kline = await sourceManager.fetchKLine(symbol, { range: '1y', interval: '1d' })
        if (kline?.points?.length && kline.points.length >= 10) {
          map.set(symbol, analyzeStock(kline.points))
        }
      } catch { /* skip */ }
    }))
    analysisMap.value = map
  } finally {
    loading.value = false
  }
}, { immediate: true })

function goToStock(symbol: string) {
  router.push(`/stock/${encodeURIComponent(symbol)}`)
}
</script>

<template>
  <div class="page compare-page">
    <section class="hero">
      <div>
        <p class="eyebrow">对比工具</p>
        <h1>股票横向对比</h1>
        <p class="muted">输入多个股票代码，实时对比行情、技术指标和走势信号。</p>
      </div>
    </section>

    <section class="input-panel card">
      <div class="input-row">
        <input
          v-model="symbolsText"
          type="text"
          placeholder="输入代码，用逗号分隔，如 NVDA, AMD, TSM"
          @keydown.enter.prevent="addSymbol(symbolsText.split(',').pop() || '')"
        />
        <button class="btn primary" :disabled="!symbols.length || loading" @click="addSymbol(symbolsText.split(',').pop() || '')">
          {{ loading ? '加载中...' : '添加' }}
        </button>
      </div>
      <div v-if="symbols.length" class="chips">
        <span v-for="s in symbols" :key="s" class="chip">
          {{ s }}
          <button class="chip-x" @click="symbolsText = symbols.filter(x => x !== s).join(', ')">×</button>
        </span>
      </div>
    </section>

    <section v-if="stockData.length" class="compare-table card">
      <table>
        <thead>
          <tr>
            <th>指标</th>
            <th v-for="item in stockData" :key="item.symbol" class="sym-col" @click="goToStock(item.symbol)">
              {{ item.symbol }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="label">现价</td>
            <td v-for="item in stockData" :key="item.symbol">
              <span class="mono">{{ formatPrice(item.quote?.price) }}</span>
            </td>
          </tr>
          <tr>
            <td class="label">日涨跌</td>
            <td v-for="item in stockData" :key="item.symbol" :class="quoteTone(item.quote?.change)">
              <strong>{{ formatPercent(item.quote?.change) }}</strong>
            </td>
          </tr>
          <tr>
            <td class="label">成交量</td>
            <td v-for="item in stockData" :key="item.symbol">
              <span class="mono small">{{ item.quote?.volume != null ? (item.quote.volume / 1e6).toFixed(1) + 'M' : '—' }}</span>
            </td>
          </tr>
          <tr>
            <td class="label">52周高</td>
            <td v-for="item in stockData" :key="item.symbol">
              <span class="mono small">{{ formatPrice(item.quote?.fiftyTwoWeekHigh) }}</span>
            </td>
          </tr>
          <tr>
            <td class="label">52周低</td>
            <td v-for="item in stockData" :key="item.symbol">
              <span class="mono small">{{ formatPrice(item.quote?.fiftyTwoWeekLow) }}</span>
            </td>
          </tr>
          <tr>
            <td class="label">技术评分</td>
            <td v-for="item in stockData" :key="item.symbol">
              <span v-if="item.analysis" class="score" :class="{ good: item.analysis.score >= 60, mid: item.analysis.score >= 40 && item.analysis.score < 60, bad: item.analysis.score < 40 }">
                {{ item.analysis.score }}/100
              </span>
              <span v-else class="muted small">—</span>
            </td>
          </tr>
          <tr>
            <td class="label">趋势</td>
            <td v-for="item in stockData" :key="item.symbol">
              <span v-if="item.analysis" :class="item.analysis.technical.trend === 'up' ? 'pos' : item.analysis.technical.trend === 'down' ? 'neg' : 'flat'">
                {{ item.analysis.technical.trend === 'up' ? '看多' : item.analysis.technical.trend === 'down' ? '看空' : '震荡' }}
              </span>
              <span v-else class="muted small">—</span>
            </td>
          </tr>
          <tr>
            <td class="label">RSI(14)</td>
            <td v-for="item in stockData" :key="item.symbol">
              <span v-if="item.analysis?.technical.rsi14 != null" :class="item.analysis.technical.rsi14 > 70 ? 'neg' : item.analysis.technical.rsi14 < 30 ? 'pos' : ''">
                {{ item.analysis.technical.rsi14.toFixed(1) }}
              </span>
              <span v-else class="muted small">—</span>
            </td>
          </tr>
          <tr>
            <td class="label">1月收益</td>
            <td v-for="item in stockData" :key="item.symbol" :class="quoteTone(item.analysis?.performance.return1m)">
              <span v-if="item.analysis?.performance.return1m != null">{{ formatPercent(item.analysis.performance.return1m) }}</span>
              <span v-else class="muted small">—</span>
            </td>
          </tr>
          <tr>
            <td class="label">波动率</td>
            <td v-for="item in stockData" :key="item.symbol">
              <span v-if="item.analysis?.performance.volatility != null" class="small">{{ (item.analysis.performance.volatility * 100).toFixed(1) }}%</span>
              <span v-else class="muted small">—</span>
            </td>
          </tr>
          <tr>
            <td class="label">信号</td>
            <td v-for="item in stockData" :key="item.symbol">
              <div v-if="item.analysis?.signals?.length" class="signals">
                <span v-for="(sig, i) in item.analysis.signals.slice(0, 3)" :key="i" class="signal-tag">{{ sig }}</span>
              </div>
              <span v-else class="muted small">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-else class="empty card">
      <p class="muted">输入至少 2 个股票代码开始对比。</p>
    </section>
  </div>
</template>

<style scoped>
.compare-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.hero {
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--color-cyan) 18%, transparent), transparent 34%),
    linear-gradient(135deg, var(--color-bg-elevated), var(--color-bg-muted));
}
.eyebrow {
  margin: 0 0 6px;
  color: var(--color-cyan);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.input-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.input-row {
  display: flex;
  gap: var(--space-2);
}
.input-row input { flex: 1; }
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-bg-muted);
  font-size: var(--fs-sm);
  font-family: var(--font-mono);
}
.chip-x {
  border: 0;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0;
}
.chip-x:hover { color: var(--color-down); }
.compare-table {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-sm);
}
th, td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}
th {
  font-weight: 700;
  color: var(--color-muted);
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.sym-col {
  cursor: pointer;
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--color-link);
}
.sym-col:hover { text-decoration: underline; }
.label {
  color: var(--color-muted);
  font-weight: 600;
}
.mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}
.score {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.score.good { color: var(--color-up); }
.score.mid { color: var(--color-flat); }
.score.bad { color: var(--color-down); }
.signals {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.signal-tag {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--color-bg-muted);
  font-size: 10px;
  font-weight: 600;
}
.pos { color: var(--color-up); }
.neg { color: var(--color-down); }
.flat { color: var(--color-flat); }
.empty {
  text-align: center;
  padding: var(--space-12);
}
</style>
