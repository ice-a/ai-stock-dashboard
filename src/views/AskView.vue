<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAIStore } from '../stores/ai'
import { useSectorStore } from '../stores/sector'
import { useQuotesStore } from '../stores/quotes'
import { chatStream } from '../api/ai'
import { parseLongportSymbol } from '../api/symbolMap'
import { sourceManager } from '../api/sourceManager'
import { fetchStockFullDetail, type StockFullDetail } from '../api/stockDetail'
import { searchStocks } from '../api/search'
import { analyzeStock, type StockAnalysis } from '../utils/analysis'
import { formatPercent, formatPrice } from '../utils/format'
import type { Quote } from '../types'
import type { Market } from '../sectors/types'

const route = useRoute()
const aiStore = useAIStore()
const sectorStore = useSectorStore()
const quotesStore = useQuotesStore()

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  symbol?: string
}

interface StockResearchContext {
  symbol: string
  name: string
  market: Market
  region: string
  quote: Quote | null
  detail: StockFullDetail
  analysis: StockAnalysis | null
  klineCount: number
  loadedAt: number
}

const messages = ref<Message[]>([])
const input = ref('')
const symbolContext = ref<string>('')
const preset = ref<'analysis' | 'sector' | 'macro' | 'custom'>('analysis')
const asking = ref(false)
const error = ref<string | null>(null)
const stockContext = ref<StockResearchContext | null>(null)
const stockContextLoading = ref(false)
const stockContextError = ref<string | null>(null)
let stockContextTimer: ReturnType<typeof setTimeout> | null = null
let stockContextAbort: AbortController | null = null

const presets = [
  { key: 'analysis', label: '个股分析', desc: '输入代码 → 估值/业务/风险结构化分析' },
  { key: 'sector', label: '产业链梳理', desc: '针对当前板块梳理产业链结构与代表标的' },
  { key: 'macro', label: '宏观/事件', desc: '宏观环境、政策、事件影响分析' },
  { key: 'custom', label: '自定义', desc: '完全开放对话' },
]

// 从板块系统获取股票列表
const sectorSymbols = computed(() => {
  const sector = sectorStore.activeSector
  if (!sector) return []
  return sector.stocks.map(s => ({ symbol: s.symbol, name: s.name }))
})

const normalizedSymbolContext = computed(() => normalizeSymbolInput(symbolContext.value))

const suggestedQuestions = computed(() => {
  if (preset.value !== 'analysis') return []
  const symbol = normalizedSymbolContext.value
  if (!symbol || !parseLongportSymbol(symbol)) return []

  const ctx = stockContext.value?.symbol === symbol ? stockContext.value : null
  const name = ctx?.name || findSectorStock(symbol)?.name || parseLongportSymbol(symbol)?.code || symbol
  const questions: string[] = [
    `请先给出 ${name}（${symbol}）当前的核心结论：看多、观望还是回避？`,
    `基于最新行情和近 6 个月 K 线，${name} 现在的技术面风险在哪里？`,
  ]

  if (ctx?.analysis?.signals.length) {
    questions.push(`这些技术信号「${ctx.analysis.signals.slice(0, 3).join('、')}」对未来 1-3 个月意味着什么？`)
  }
  if (ctx?.detail.news?.[0]) {
    questions.push(`最近新闻「${ctx.detail.news[0].title}」会如何影响 ${name} 的业绩和估值？`)
  }
  if (ctx?.detail.announcements?.[0]) {
    questions.push(`公告「${ctx.detail.announcements[0].title}」里最值得关注的机会和风险是什么？`)
  }
  if (ctx?.detail.etfs?.length) {
    questions.push(`和 ${ctx.detail.etfs.slice(0, 2).map(e => e.etfSymbol).join('、')} 这类 ETF 相比，直接买 ${name} 的优劣是什么？`)
  }
  questions.push(`请列出 ${name} 后续需要跟踪的 5 个关键指标。`)
  return [...new Set(questions)].slice(0, 6)
})

onMounted(() => {
  // 支持 URL 参数 ?symbol=XXX
  const urlSymbol = route.query.symbol as string
  if (urlSymbol) {
    symbolContext.value = decodeURIComponent(urlSymbol)
    preset.value = 'analysis'
  }
})

onUnmounted(() => {
  if (stockContextTimer) clearTimeout(stockContextTimer)
  stockContextAbort?.abort()
})

function applyPreset() {
  if (preset.value === 'sector') {
    const sector = sectorStore.activeSector
    input.value = `请帮我梳理「${sector?.name || '当前板块'}」的产业链结构，分环节列出代表标的。`
  } else if (preset.value === 'macro') {
    input.value = '请分析当前宏观经济环境对投资的影响。'
  }
}

function normalizeSymbolInput(value: string): string {
  const raw = value.trim().toUpperCase()
  if (!raw) return ''
  if (parseLongportSymbol(raw)) return raw
  if (/^[A-Z]{1,6}$/.test(raw)) return `${raw}.US`
  if (/^\d{5}$/.test(raw)) return `${raw}.HK`
  if (/^\d{6}$/.test(raw)) return raw.startsWith('6') ? `${raw}.SH` : `${raw}.SZ`
  return raw
}

function findSectorStock(symbol: string) {
  return sectorStore.sectors.flatMap(s => s.stocks).find(s => s.symbol === symbol)
}

function marketFromSymbol(symbol: string, fallback?: Market): Market {
  if (fallback) return fallback
  const parsed = parseLongportSymbol(symbol)
  if (parsed?.market === 'sh' || parsed?.market === 'sz') return 'A股'
  if (parsed?.market === 'hk') return '港股'
  return '美股'
}

async function loadStockContext(symbol = normalizedSymbolContext.value) {
  let targetSymbol = symbol
  if (!targetSymbol || !parseLongportSymbol(targetSymbol)) {
    const resolved = await resolveSymbolBySearch(symbolContext.value.trim() || targetSymbol)
    if (resolved) {
      targetSymbol = resolved
      if (symbolContext.value.trim().toUpperCase() !== resolved) symbolContext.value = resolved
    }
  }

  if (!targetSymbol || !parseLongportSymbol(targetSymbol)) {
    stockContext.value = null
    stockContextError.value = symbolContext.value.trim() ? '未识别到有效股票，请输入代码或名称，例如 NVDA、腾讯、600176。' : null
    return
  }

  if (stockContext.value?.symbol === targetSymbol && !stockContextError.value) return
  stockContextAbort?.abort()
  const ac = new AbortController()
  stockContextAbort = ac
  stockContextLoading.value = true
  stockContextError.value = null

  try {
    const sectorStock = findSectorStock(targetSymbol)
    const parsed = parseLongportSymbol(targetSymbol)
    const quote = await quotesStore.fetchOne(targetSymbol, { force: true, signal: ac.signal }).catch(() => null)
    const name = sectorStock?.name || quote?.shortName || quote?.name || parsed?.code || targetSymbol
    const market = marketFromSymbol(targetSymbol, sectorStock?.market as Market | undefined)
    const [kline, detail] = await Promise.all([
      sourceManager.fetchKLine(targetSymbol, { range: '6mo', interval: '1d', signal: ac.signal }).catch(() => null),
      fetchStockFullDetail(targetSymbol, name, market).catch(() => ({ news: [], announcements: [], etfs: [], advice: null } as StockFullDetail)),
    ])

    if (ac.signal.aborted) return
    stockContext.value = {
      symbol: targetSymbol,
      name,
      market,
      region: parsed?.region || market,
      quote,
      detail,
      analysis: kline?.points?.length ? analyzeStock(kline.points) : null,
      klineCount: kline?.points?.length || 0,
      loadedAt: Date.now(),
    }
  } catch (e) {
    if (!ac.signal.aborted) {
      stockContext.value = null
      stockContextError.value = (e as Error).message || '标的信息加载失败，请稍后重试。'
    }
  } finally {
    if (stockContextAbort === ac) {
      stockContextAbort = null
      stockContextLoading.value = false
    }
  }
}

async function resolveSymbolBySearch(keyword: string): Promise<string> {
  if (!keyword) return ''
  const list = await searchStocks(keyword).catch(() => [])
  const first = list.find(item => parseLongportSymbol(item.symbol))
  return first?.symbol || ''
}

function buildContextBlock(ctx: StockResearchContext | null): string {
  if (!ctx) return ''
  const q = ctx.quote
  const quoteLine = q && q.price != null
    ? `最新价 ${q.price}，涨跌幅 ${q.change != null ? (q.change * 100).toFixed(2) + '%' : 'N/A'}，数据源 ${q.source}。`
    : '行情接口未返回有效价格。'
  const analysis = ctx.analysis
  const technicalLine = analysis
    ? `技术评分 ${analysis.score}/100，趋势 ${analysis.technical.trend}，RSI ${analysis.technical.rsi14?.toFixed(1) || 'N/A'}，信号：${analysis.signals.join('、') || '暂无明显信号'}。`
    : 'K 线不足，暂未生成技术指标。'
  const news = ctx.detail.news.slice(0, 5).map((n, i) => `${i + 1}. ${n.title}${n.time ? `（${n.time}` : ''}${n.source ? `，${n.source}` : ''}${n.time ? '）' : ''}`).join('\n')
  const announcements = ctx.detail.announcements.slice(0, 5).map((n, i) => `${i + 1}. ${n.title}${n.time ? `（${n.time}）` : ''}`).join('\n')
  const etfs = ctx.detail.etfs.slice(0, 5).map(e => `${e.etfSymbol} ${e.etfName}`).join('、')

  return `\n\n已获取到的标的上下文：\n- 行情：${quoteLine}\n- K 线：近 6 个月 ${ctx.klineCount} 条数据。${technicalLine}\n- 相关新闻：\n${news || '暂无'}\n- 公司公告：\n${announcements || '暂无'}\n- 相关 ETF：${etfs || '暂无'}`
}

function useSuggestedQuestion(question: string) {
  input.value = question
}

function buildSystemPrompt(): string {
  const sector = sectorStore.activeSector

  if (preset.value === 'analysis' && normalizedSymbolContext.value) {
    const targetSymbol = normalizedSymbolContext.value
    const context = stockContext.value?.symbol === targetSymbol ? stockContext.value : null
    const q = context?.quote || quotesStore.get(targetSymbol)
    const liveInfo = q && q.price != null
      ? `当前价 ${q.price.toFixed(2)} ${q.currency || ''}，涨跌 ${q.change != null ? (q.change * 100).toFixed(2) + '%' : 'N/A'}。`
      : ''
    const meta = parseLongportSymbol(targetSymbol)
    const stockInfo = findSectorStock(targetSymbol)

    return `你是一位资深股票分析师。基于以下信息给出深度分析。

股票代码: ${targetSymbol}
股票名称: ${context?.name || stockInfo?.name || meta?.code || targetSymbol}
所属市场: ${context?.market || stockInfo?.market || meta?.region || '未知'}
产业链层级: ${stockInfo?.layer || '未知'}
所属板块: ${sector?.name || '未知'}
${liveInfo ? `实时数据: ${liveInfo}` : ''}
${stockInfo?.reason ? `入选理由: ${stockInfo.reason}` : ''}${buildContextBlock(context)}

请用 Markdown 格式回答，结构清晰，包含：
- 核心结论（1-2 句）
- 关键因素分析（尽量用表格或分点）
- 风险提示
- 操作建议（仅供参考，非投资建议）`
  }

  if (preset.value === 'sector' && sector) {
    return `你是一个产业链研究助手。当前板块：${sector.name}（${sector.description}）。
板块包含 ${sector.stocks.length} 只股票，覆盖 ${[...new Set(sector.stocks.map(s => s.market))].join('、')} 市场。
请用表格或分层列表回答，标注数据来源与时间。`
  }

  if (preset.value === 'macro') {
    return '你是宏观分析师。关注宏观经济、利率、汇率、地缘政治对投资市场的影响。用中文回答。'
  }

  return '你是研究助手，回答简洁有结构。用中文回答。'
}

async function send() {
  if (!input.value.trim() || asking.value) return
  if (!aiStore.isConfigured) {
    error.value = '请先在设置中配置 AI 模型。'
    return
  }
  error.value = null
  const contextSymbol = preset.value === 'analysis' ? normalizedSymbolContext.value : ''
  const userMsg: Message = { role: 'user', content: input.value, symbol: contextSymbol || undefined }
  messages.value.push(userMsg)
  input.value = ''

  const systemPrompt = buildSystemPrompt()

  const assistantIdx = messages.value.length
  messages.value.push({ role: 'assistant', content: '' })
  asking.value = true

  try {
    const apiMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ]
    const recent = messages.value.slice(0, assistantIdx).slice(-8)
    for (const m of recent) {
      apiMessages.push({ role: m.role, content: m.content })
    }
    apiMessages.push({ role: 'user', content: userMsg.content })

    for await (const chunk of chatStream({
      baseUrl: aiStore.baseUrl,
      apiKey: aiStore.apiKey,
      model: aiStore.model,
      temperature: aiStore.temperature,
      maxTokens: aiStore.maxTokens,
      messages: apiMessages,
    })) {
      messages.value[assistantIdx].content += chunk
    }
  } catch (e) {
    messages.value[assistantIdx].content += `\n\n[错误] ${formatAIError((e as Error).message)}`
  } finally {
    asking.value = false
  }
}

function formatAIError(message: string): string {
  const cooldown = message.match(/AI_RATE_LIMIT_COOLDOWN:(\d+)/)
  if (cooldown) return `AI 服务正在限流冷却中，请约 ${cooldown[1]} 秒后重试。`
  const limited = message.match(/AI_RATE_LIMIT:(\d+):/)
  if (limited) return `AI 服务请求过多或额度受限，请约 ${limited[1]} 秒后重试，或在设置页切换模型/API Key。`
  if (message.includes('429') || message.toLowerCase().includes('too many requests')) {
    return 'AI 服务请求过多或额度受限，请稍后重试，或在设置页切换模型/API Key。'
  }
  return message
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function parseTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
}

function renderMarkdown(content: string): string {
  if (!content.trim()) return '<span class="typing">...</span>'
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let paragraph: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const flushParagraph = () => {
    if (!paragraph.length) return
    out.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`)
    paragraph = []
  }
  const closeList = () => {
    if (!listType) return
    out.push(`</${listType}>`)
    listType = null
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      closeList()
      continue
    }

    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushParagraph()
      closeList()
      const headers = parseTableRow(trimmed)
      out.push('<table><thead><tr>')
      for (const h of headers) out.push(`<th>${renderInline(h)}</th>`)
      out.push('</tr></thead><tbody>')
      i += 2
      while (i < lines.length && lines[i].trim().includes('|')) {
        const cells = parseTableRow(lines[i])
        out.push('<tr>')
        for (const cell of cells) out.push(`<td>${renderInline(cell)}</td>`)
        out.push('</tr>')
        i++
      }
      i--
      out.push('</tbody></table>')
      continue
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      closeList()
      const level = heading[1].length + 1
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      continue
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/)
    if (bullet) {
      flushParagraph()
      if (listType !== 'ul') {
        closeList()
        listType = 'ul'
        out.push('<ul>')
      }
      out.push(`<li>${renderInline(bullet[1])}</li>`)
      continue
    }

    const numbered = trimmed.match(/^\d+\.\s+(.+)$/)
    if (numbered) {
      flushParagraph()
      if (listType !== 'ol') {
        closeList()
        listType = 'ol'
        out.push('<ol>')
      }
      out.push(`<li>${renderInline(numbered[1])}</li>`)
      continue
    }

    closeList()
    paragraph.push(trimmed)
  }

  flushParagraph()
  closeList()
  return out.join('')
}

function changeClass(value?: number | null): string {
  if (value == null) return 'flat'
  return value > 0 ? 'pos' : value < 0 ? 'neg' : 'flat'
}

function trendLabel(value?: string): string {
  if (value === 'up') return '上行'
  if (value === 'down') return '下行'
  return '震荡'
}

function formatLoadedAt(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function clearChat() {
  messages.value = []
  input.value = ''
  symbolContext.value = ''
  stockContext.value = null
  stockContextError.value = null
  error.value = null
}

watch([normalizedSymbolContext, preset], ([symbol, mode]) => {
  if (stockContextTimer) clearTimeout(stockContextTimer)
  if (mode !== 'analysis') return
  if (!symbol) {
    stockContext.value = null
    stockContextError.value = null
    return
  }
  stockContextError.value = null
  stockContextTimer = setTimeout(() => loadStockContext(symbol), 520)
})
</script>

<template>
  <div class="page chat-page">
    <header class="chat-head">
      <div>
        <h1>AI 研究助手</h1>
        <p class="small muted">
          模型：<code>{{ aiStore.model || '未选择' }}</code>
          · 板块：<strong>{{ sectorStore.activeSector?.name || '未选择' }}</strong>
        </p>
      </div>
      <div class="head-actions">
        <button class="btn ghost" @click="clearChat">清空</button>
      </div>
    </header>

    <div v-if="!aiStore.isConfigured" class="alert">
      请先在 <router-link to="/settings">设置</router-link> 中配置 AI 模型（Base URL + API Key + 模型名）。
    </div>

    <div class="preset-bar">
      <button v-for="p in presets" :key="p.key" class="preset" :class="{ active: preset === p.key }" @click="preset = (p.key as any); applyPreset()">
        <strong>{{ p.label }}</strong>
        <span class="small muted">{{ p.desc }}</span>
      </button>
    </div>

    <div v-if="preset === 'analysis'" class="symbol-panel">
      <div class="symbol-input">
        <label>分析标的</label>
        <input v-model="symbolContext" placeholder="NVDA.US" list="sector-symbols" />
        <button class="btn ghost sm" :disabled="stockContextLoading || !normalizedSymbolContext" @click="loadStockContext()">
          {{ stockContextLoading ? '加载中' : '刷新' }}
        </button>
        <datalist id="sector-symbols">
          <option v-for="s in sectorSymbols" :key="s.symbol" :value="s.symbol">{{ s.name }}</option>
        </datalist>
        <span class="small muted">支持 NVDA.US、00700.HK、600176.SH；纯字母会按美股补全。</span>
      </div>

      <div v-if="stockContextLoading" class="context-state small muted">
        正在获取行情、K 线、新闻和公告…
      </div>
      <div v-else-if="stockContextError" class="context-state error small">
        {{ stockContextError }}
      </div>
      <div v-else-if="stockContext" class="stock-context">
        <div class="context-main">
          <div>
            <div class="context-title">{{ stockContext.name }}</div>
            <div class="small muted">{{ stockContext.symbol }} · {{ stockContext.region }} · {{ stockContext.quote?.source || '暂无行情源' }}</div>
          </div>
          <div class="context-price">
            <strong>{{ formatPrice(stockContext.quote?.price, stockContext.quote?.currency) }}</strong>
            <span :class="changeClass(stockContext.quote?.change)">
              {{ formatPercent(stockContext.quote?.change) }}
            </span>
          </div>
        </div>
        <div class="context-metrics">
          <div>
            <span class="small muted">技术评分</span>
            <strong>{{ stockContext.analysis?.score ?? '—' }}</strong>
          </div>
          <div>
            <span class="small muted">趋势</span>
            <strong>{{ trendLabel(stockContext.analysis?.technical.trend) }}</strong>
          </div>
          <div>
            <span class="small muted">K 线</span>
            <strong>{{ stockContext.klineCount || '—' }}</strong>
          </div>
          <div>
            <span class="small muted">更新</span>
            <strong>{{ formatLoadedAt(stockContext.loadedAt) }}</strong>
          </div>
        </div>
        <div v-if="stockContext.analysis?.signals.length" class="signal-row">
          <span v-for="signal in stockContext.analysis.signals.slice(0, 5)" :key="signal" class="signal-chip">{{ signal }}</span>
        </div>
        <div v-if="stockContext.detail.news.length" class="context-news small">
          <span class="muted">最新新闻</span>
          <span>{{ stockContext.detail.news[0].title }}</span>
        </div>
      </div>

      <div v-if="suggestedQuestions.length" class="question-suggestions">
        <button v-for="q in suggestedQuestions" :key="q" class="question-chip" @click="useSuggestedQuestion(q)">
          {{ q }}
        </button>
      </div>
    </div>

    <div class="chat-window">
      <div v-if="messages.length === 0" class="empty">
        <p class="muted">选择预设或直接输入问题开始对话。</p>
      </div>
      <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
        <div class="msg-role">{{ m.role === 'user' ? '我' : (m.role === 'assistant' ? 'AI' : '系统') }}</div>
        <div class="msg-bubble">
          <span v-if="m.symbol" class="msg-tag">@{{ m.symbol }}</span>
          <div
            v-if="m.role === 'assistant'"
            class="markdown-body"
            v-html="renderMarkdown(m.content || (asking && i === messages.length - 1 ? '...' : ''))"
          ></div>
          <pre v-else>{{ m.content || (asking && i === messages.length - 1 ? '…' : '') }}</pre>
        </div>
      </div>
    </div>

    <div class="input-bar">
      <textarea
        v-model="input"
        rows="2"
        placeholder="输入问题，Ctrl+Enter 发送"
        @keydown.ctrl.enter="send"
        @keydown.meta.enter="send"
      ></textarea>
      <button class="btn primary" :disabled="asking || !input.trim()" @click="send">
        <span v-if="asking" class="spinner"></span>
        发送
      </button>
    </div>

    <p v-if="error" class="neg small">{{ error }}</p>
  </div>
</template>

<style scoped>
.chat-page { display: flex; flex-direction: column; gap: var(--space-3); height: calc(100vh - var(--header-height) - 40px); }
.chat-head { display: flex; justify-content: space-between; align-items: flex-start; }
.chat-head h1 { margin: 0 0 4px; }
.head-actions { display: flex; gap: 8px; }
.alert { background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); color: #b45309; padding: 10px 14px; border-radius: var(--radius-md); font-size: var(--fs-sm); }
.dark .alert { background: rgba(245, 158, 11, 0.08); color: #fbbf24; border-color: rgba(245, 158, 11, 0.3); }
.preset-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; }
.preset { display: flex; flex-direction: column; gap: 2px; padding: 8px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-elevated); cursor: pointer; text-align: left; }
.preset:hover { border-color: var(--color-border-strong); }
.preset.active { background: var(--color-info-bg); border-color: var(--color-link); }
.preset strong { font-size: var(--fs-sm); }
.preset span { font-size: 11px; }
.symbol-panel { display: flex; flex-direction: column; gap: var(--space-2); }
.symbol-input { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--color-bg-soft); border-radius: var(--radius-md); flex-wrap: wrap; }
.symbol-input label { font-size: var(--fs-sm); color: var(--color-muted); }
.symbol-input input { flex: 1; max-width: 200px; }
.context-state {
  padding: var(--space-2) var(--space-3);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-soft);
}
.context-state.error {
  color: var(--color-down);
  border-color: color-mix(in srgb, var(--color-down) 45%, var(--color-border));
}
.stock-context {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}
.context-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}
.context-title {
  font-weight: 700;
}
.context-price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-variant-numeric: tabular-nums;
}
.context-price strong {
  font-size: var(--fs-lg);
}
.context-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}
.context-metrics > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-bg-soft);
}
.context-metrics strong {
  font-size: var(--fs-sm);
  font-variant-numeric: tabular-nums;
}
.signal-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.signal-chip {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-info-bg);
  color: var(--color-link);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.context-news {
  display: flex;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}
.context-news span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.question-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.question-chip {
  max-width: 100%;
  min-height: 30px;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-elevated);
  color: var(--color-ink);
  font-size: var(--fs-xs);
  text-align: left;
}
.question-chip:hover {
  border-color: var(--color-link);
  color: var(--color-link);
}
.chat-window { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 12px; background: var(--color-bg-soft); border-radius: var(--radius-md); }
.empty { text-align: center; padding: 40px 0; }
.msg { display: flex; flex-direction: column; gap: 4px; max-width: 80%; }
.msg.user { align-self: flex-end; }
.msg.assistant { align-self: flex-start; max-width: 92%; }
.msg-role { font-size: 11px; color: var(--color-muted); }
.msg.user .msg-role { text-align: right; }
.msg-bubble { padding: 10px 14px; border-radius: var(--radius-md); }
.msg.user .msg-bubble { background: var(--color-link); color: white; }
.msg.assistant .msg-bubble { background: var(--color-bg-elevated); border: 1px solid var(--color-border); }
.msg-tag { display: inline-block; padding: 1px 6px; background: rgba(255,255,255,0.2); border-radius: 4px; font-size: 11px; margin-right: 4px; }
.msg-bubble pre { margin: 4px 0 0; white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: var(--fs-sm); line-height: 1.6; }
.markdown-body {
  margin-top: 4px;
  color: var(--color-ink);
  font-size: var(--fs-sm);
  line-height: 1.65;
}
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: var(--space-3) 0 var(--space-2);
  font-size: var(--fs-md);
  line-height: 1.3;
}
.markdown-body :deep(h2:first-child),
.markdown-body :deep(h3:first-child),
.markdown-body :deep(h4:first-child),
.markdown-body :deep(p:first-child) {
  margin-top: 0;
}
.markdown-body :deep(p) {
  margin: 0 0 var(--space-2);
}
.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 0 0 var(--space-2);
  padding-left: 1.25rem;
}
.markdown-body :deep(li) {
  margin-bottom: 4px;
}
.markdown-body :deep(table) {
  width: 100%;
  margin: var(--space-2) 0 var(--space-3);
  border-collapse: collapse;
  font-size: var(--fs-xs);
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 7px 8px;
  border: 1px solid var(--color-border);
  vertical-align: top;
}
.markdown-body :deep(th) {
  background: var(--color-bg-soft);
  font-weight: 700;
}
.markdown-body :deep(code) {
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-soft);
  font-family: var(--font-mono);
  font-size: 0.92em;
}
.markdown-body :deep(a) {
  color: var(--color-link);
}
.input-bar { display: flex; gap: 8px; align-items: flex-end; }
.input-bar textarea { flex: 1; resize: vertical; }
.spinner { display: inline-block; width: 10px; height: 10px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 4px; }
@keyframes spin { to { transform: rotate(360deg); } }
.pos { color: var(--color-up); }
.neg { color: var(--color-down); }
.flat { color: var(--color-flat); }

@media (max-width: 640px) {
  .chat-page { height: auto; min-height: calc(100vh - var(--header-height) - 80px); }
  .context-main { flex-direction: column; }
  .context-price { align-items: flex-start; }
  .context-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .msg,
  .msg.assistant { max-width: 100%; }
  .input-bar { flex-direction: column; align-items: stretch; }
}
</style>
