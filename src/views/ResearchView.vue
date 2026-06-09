<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAIStore } from '../stores/ai'
import { usePortfolioStore } from '../stores/portfolio'
import { useQuotesStore } from '../stores/quotes'
import { useResearchStore } from '../stores/research'
import { useSectorStore } from '../stores/sector'
import { useWatchlistStore } from '../stores/watchlist'
import { chat } from '../api/ai'
import { parseLongportSymbol } from '../api/symbolMap'
import { sourceManager } from '../api/sourceManager'
import { analyzeStock } from '../utils/analysis'
import { formatDate, formatPercent, formatPrice, quoteTone } from '../utils/format'
import { markdownToText, renderMarkdown } from '../utils/markdown'

const aiStore = useAIStore()
const portfolioStore = usePortfolioStore()
const quotesStore = useQuotesStore()
const researchStore = useResearchStore()
const sectorStore = useSectorStore()
const watchlistStore = useWatchlistStore()

const symbolsText = ref('')
const comparing = ref(false)
const error = ref<string | null>(null)
const latestReportId = ref<string | null>(null)
const expandedReports = ref<Set<string>>(new Set())

const knownSymbols = computed(() => {
  const map = new Map<string, string>()
  for (const item of watchlistStore.items) map.set(item.symbol, item.symbol)
  for (const item of portfolioStore.computedHoldings) map.set(item.symbol, item.name)
  for (const sector of sectorStore.sectors) {
    for (const stock of sector.stocks) map.set(stock.symbol, stock.name)
  }
  return [...map.entries()].map(([symbol, name]) => ({ symbol, name })).slice(0, 24)
})

const comparisonSymbols = computed(() => {
  return [...new Set(symbolsText.value
    .split(/[\s,，;；]+/)
    .map(normalizeSymbolInput)
    .filter(symbol => symbol && parseLongportSymbol(symbol)))]
    .slice(0, 6)
})

const latestReport = computed(() => {
  if (!latestReportId.value) return null
  return researchStore.recentReports.find(report => report.id === latestReportId.value) || null
})

const canCompare = computed(() => comparisonSymbols.value.length >= 2 && aiStore.isConfigured && !comparing.value)

function normalizeSymbolInput(value: string): string {
  const raw = value.trim().toUpperCase()
  if (!raw) return ''
  if (parseLongportSymbol(raw)) return raw
  if (/^[A-Z]{1,6}$/.test(raw)) return `${raw}.US`
  if (/^\d{5}$/.test(raw)) return `${raw}.HK`
  if (/^\d{6}$/.test(raw)) return raw.startsWith('6') ? `${raw}.SH` : `${raw}.SZ`
  return raw
}

function findName(symbol: string): string {
  const stock = sectorStore.sectors.flatMap(sector => sector.stocks).find(item => item.symbol === symbol)
  const holding = portfolioStore.computedHoldings.find(item => item.symbol === symbol)
  const quote = quotesStore.get(symbol)
  return stock?.name || holding?.name || quote?.shortName || quote?.name || symbol
}

function appendSymbol(symbol: string) {
  const set = new Set(comparisonSymbols.value)
  set.add(symbol)
  symbolsText.value = [...set].join(', ')
}

function isExpanded(id: string): boolean {
  return expandedReports.value.has(id)
}

function toggleReport(id: string) {
  const next = new Set(expandedReports.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedReports.value = next
}

function reportPreview(content: string): string {
  const text = markdownToText(content)
  return text.slice(0, 220) + (text.length > 220 ? '...' : '')
}

async function buildComparisonContext(symbols: string[]): Promise<string> {
  const rows = await Promise.all(symbols.map(async (symbol) => {
    const quote = await quotesStore.fetchOne(symbol, { force: true }).catch(() => quotesStore.get(symbol) || null)
    const kline = await sourceManager.fetchKLine(symbol, { range: '6mo', interval: '1d' }).catch(() => null)
    const analysis = kline?.points?.length ? analyzeStock(kline.points) : null
    const name = findName(symbol)
    const quoteLine = quote?.price != null
      ? `现价 ${formatPrice(quote.price, quote.currency)}，日涨跌 ${formatPercent(quote.change)}，来源 ${quote.source}`
      : '暂无有效报价'
    const analysisLine = analysis
      ? `技术评分 ${analysis.score}/100，趋势 ${analysis.technical.trend}，1月收益 ${formatPercent(analysis.performance.return1m)}，波动 ${formatPercent(analysis.performance.volatility)}，信号 ${analysis.signals.join('、') || '无'}`
      : 'K线不足，暂无技术评分'
    return `- ${name}（${symbol}）：${quoteLine}；${analysisLine}`
  }))
  return rows.join('\n')
}

async function generateComparison() {
  if (!canCompare.value) return
  comparing.value = true
  error.value = null
  latestReportId.value = null
  try {
    const symbols = comparisonSymbols.value
    const context = await buildComparisonContext(symbols)
    const resp = await chat([
      {
        role: 'system',
        content: '你是资深股票研究员。输出中文 Markdown，结论要清晰，避免空泛描述。所有建议仅作研究参考，不构成投资建议。',
      },
      {
        role: 'user',
        content: `请对以下股票做横向对比研究：\n\n${context}\n\n请按以下结构输出：\n1. 一句话总排名和适用投资者\n2. 对比表：趋势、估值/质量线索、主要机会、主要风险、适合仓位角色\n3. 未来 1-3 个月关键跟踪点\n4. 如果只能选 1-2 只，给出选择理由和反方条件`,
      },
    ], {
      baseUrl: aiStore.baseUrl,
      apiKey: aiStore.apiKey,
      model: aiStore.model,
      temperature: 0.35,
      maxTokens: 2200,
    })
    const content = resp.choices?.[0]?.message?.content || 'AI 未返回有效内容。'
    const report = researchStore.addReport({
      kind: 'comparison',
      title: `${symbols.join(' / ')} 对比研究`,
      symbols,
      content,
      payload: { symbols, context },
      model: aiStore.model,
      source: 'research-compare',
    })
    latestReportId.value = report.id
  } catch (e) {
    error.value = formatAIError((e as Error).message)
  } finally {
    comparing.value = false
  }
}

function formatAIError(message: string): string {
  const cooldown = message.match(/AI_RATE_LIMIT_COOLDOWN:(\d+)/)
  if (cooldown) return `AI 服务正在限流冷却中，请约 ${cooldown[1]} 秒后重试。`
  const limited = message.match(/AI_RATE_LIMIT:(\d+):/)
  if (limited) return `AI 服务请求过多或额度受限，请约 ${limited[1]} 秒后重试。`
  if (message.includes('401') || message.includes('403')) return 'AI API Key 无效或无权限，请在设置页检查配置。'
  return message || '对比分析生成失败。'
}
</script>

<template>
  <div class="page research-page">
    <section class="hero">
      <div>
        <p class="eyebrow">研究库</p>
        <h1>沉淀 AI 报告，支持多股票横向对比</h1>
        <p class="muted">个股详情生成的 AI 投资建议会自动归档；这里可以生成跨股票对比报告。</p>
      </div>
    </section>

    <section class="composer card">
      <div class="section-head">
        <div>
          <h2>多股票对比</h2>
          <p class="small muted">输入 2-6 个代码，支持 NVDA、00700、600519 这类简写。</p>
        </div>
        <button class="btn primary" :disabled="!canCompare" @click="generateComparison">
          <span v-if="comparing" class="spinner"></span>
          {{ comparing ? '生成中…' : '生成对比报告' }}
        </button>
      </div>
      <textarea v-model="symbolsText" rows="3" placeholder="例如：NVDA, AMD, AVGO, TSM"></textarea>
      <div class="quick-list" v-if="knownSymbols.length">
        <span class="small muted">快速加入</span>
        <button v-for="item in knownSymbols" :key="item.symbol" class="ticker-btn" @click="appendSymbol(item.symbol)">
          <code>{{ item.symbol }}</code>
          <span>{{ item.name }}</span>
        </button>
      </div>
      <div class="composer-foot">
        <span v-if="!aiStore.isConfigured" class="small neg">请先在设置页配置 AI。</span>
        <span v-else-if="comparisonSymbols.length" class="small muted">将对比：{{ comparisonSymbols.join('、') }}</span>
        <span v-else class="small muted">至少输入 2 个有效股票代码。</span>
        <span v-if="error" class="small neg">{{ error }}</span>
      </div>
    </section>

    <section v-if="latestReport" class="latest card">
      <div class="section-head">
        <h2>最新对比报告</h2>
        <span class="small muted">{{ formatDate(latestReport.createdAt, 'relative') }}</span>
      </div>
      <article class="markdown-body" v-html="renderMarkdown(latestReport.content)"></article>
    </section>

    <section class="history card">
      <div class="section-head">
        <div>
          <h2>报告历史</h2>
          <p class="small muted">最多保留最近 200 条报告，随个人配置同步。</p>
        </div>
        <button class="btn sm ghost" :disabled="!researchStore.reports.length" @click="researchStore.clear()">清空</button>
      </div>
      <div v-if="!researchStore.recentReports.length" class="empty-state">
        <h3>暂无报告</h3>
        <p class="muted">生成个股建议或对比报告后会出现在这里。</p>
      </div>
      <div v-else class="report-list">
        <article v-for="report in researchStore.recentReports" :key="report.id" class="report-card">
          <div class="report-top">
            <div>
              <h3>{{ report.title }}</h3>
              <div class="small muted">{{ formatDate(report.createdAt, 'datetime') }}</div>
            </div>
            <span class="tag">{{ report.kind === 'comparison' ? '对比' : '个股' }}</span>
          </div>
          <div class="symbols">
            <router-link v-for="symbol in report.symbols" :key="symbol" :to="`/stock/${encodeURIComponent(symbol)}`" class="ticker">
              {{ symbol }}
            </router-link>
          </div>
          <article
            v-if="isExpanded(report.id)"
            class="markdown-body compact"
            v-html="renderMarkdown(report.content)"
          ></article>
          <p v-else class="report-preview">{{ reportPreview(report.content) }}</p>
          <div class="report-actions">
            <span class="small muted">模型 {{ report.model || '—' }}</span>
            <div class="action-buttons">
              <button class="btn sm" @click="toggleReport(report.id)">{{ isExpanded(report.id) ? '收起' : '阅读' }}</button>
              <button class="btn sm ghost danger" @click="researchStore.removeReport(report.id)">删除</button>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.research-page {
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
.section-head,
.composer-foot,
.report-top,
.report-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.composer,
.history,
.latest {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
textarea {
  width: 100%;
  min-height: 92px;
  resize: vertical;
  padding: var(--space-3);
}
.quick-list,
.symbols {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.ticker-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 9px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-bg-muted);
  font-size: var(--fs-xs);
}
.ticker-btn:hover {
  border-color: var(--color-link);
  color: var(--color-link);
}
.empty-state {
  padding: var(--space-8);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
}
.report-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.report-card {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-muted);
}
.report-preview {
  min-height: 84px;
  color: var(--color-ink-soft);
}
.action-buttons {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}
.markdown-body.compact {
  max-height: 460px;
  overflow: auto;
  padding-right: var(--space-2);
}
.danger {
  color: var(--color-red);
}
.pos { color: var(--color-up); }
.neg { color: var(--color-down); }
.flat { color: var(--color-flat); }
@media (max-width: 800px) {
  .section-head,
  .composer-foot,
  .report-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .report-list {
    grid-template-columns: 1fr;
  }
}
</style>
