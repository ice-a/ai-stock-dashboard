<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAIStore } from '../stores/ai'
import { sourceManager } from '../api/sourceManager'
import { chat } from '../api/ai'
import { fetchStockFullDetail, type StockFullDetail } from '../api/stockDetail'
import { getPopularStocks, type StockItem } from '../data/popularStocks'
import { analyzeStock, type StockAnalysis } from '../utils/analysis'
import { formatPercent, formatPrice, formatVolume, quoteTone } from '../utils/format'
import MysticAnimation from '../components/MysticAnimation.vue'
import type { Quote, Market } from '../types'

type MysticMethod = 'tarot' | 'liuyao' | 'meihua' | 'xiaoliuren' | 'astro'

interface MysticReading {
  title: string
  symbolText: string
  meaning: string
  advice: string
  details: string[]
}

interface PickResult {
  stock: StockItem
  reading: MysticReading
  quote: Quote | null
  detail: StockFullDetail
  analysis: StockAnalysis | null
  aiText: string
}

const router = useRouter()
const aiStore = useAIStore()

const market = ref<Market>('美股')
const method = ref<MysticMethod>('tarot')
const picking = ref(false)
const aiLoading = ref(false)
const error = ref<string | null>(null)
const result = ref<PickResult | null>(null)
const animating = ref(false)

const markets: Market[] = ['美股', '港股', 'A股']
const methods: Array<{ id: MysticMethod; label: string }> = [
  { id: 'tarot', label: '塔罗牌' },
  { id: 'liuyao', label: '六爻' },
  { id: 'meihua', label: '梅花易数' },
  { id: 'xiaoliuren', label: '小六壬' },
  { id: 'astro', label: '占星骰子' },
]

const allStocks = computed(() => getPopularStocks(50))

const candidates = computed(() => allStocks.value.filter(stock => stock.market === market.value))

function rand(max: number): number {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0] % max
}

function drawFrom<T>(items: T[]): T {
  return items[rand(items.length)]
}

function makeReading(selectedMethod: MysticMethod, stock: StockItem): MysticReading {
  if (selectedMethod === 'tarot') return tarotReading(stock)
  if (selectedMethod === 'liuyao') return liuyaoReading(stock)
  if (selectedMethod === 'meihua') return meihuaReading(stock)
  if (selectedMethod === 'xiaoliuren') return xiaoliurenReading(stock)
  return astroReading(stock)
}

function tarotReading(stock: StockItem): MysticReading {
  const cards = [
    ['星币骑士', '稳健推进，偏向基本面和现金流验证'],
    ['权杖三', '远方机会打开，适合看产业扩张和海外变量'],
    ['宝剑六', '处于换挡阶段，短线波动后看修复'],
    ['圣杯九', '情绪面偏乐观，但要警惕预期过满'],
    ['命运之轮', '事件驱动增强，行情节奏可能突然加快'],
    ['节制', '估值与业绩需要重新平衡，不宜追高'],
  ]
  const card = drawFrom(cards)
  const upright = rand(2) === 0
  return {
    title: `${card[0]}${upright ? '正位' : '逆位'}`,
    symbolText: upright ? '正位' : '逆位',
    meaning: upright ? card[1] : `${card[1]}；逆位提示先看风险和仓位控制`,
    advice: `${stock.name} 被牌面指向为“先观察节奏，再看确认”的标的。`,
    details: ['三张牌位：环境、阻力、触发点', `牌面倾向：${upright ? '顺势验证' : '反向提醒'}`, `对应主题：${stock.layer || '未知层级'}`],
  }
}

function liuyaoReading(stock: StockItem): MysticReading {
  const gua = ['乾为天', '坤为地', '水雷屯', '山水蒙', '水天需', '天水讼', '地水师', '风天小畜', '地天泰', '天地否', '雷火丰', '火风鼎']
  const lines = Array.from({ length: 6 }, () => rand(2) === 0 ? '— —' : '———')
  const moving = rand(6) + 1
  const hexagram = drawFrom(gua)
  return {
    title: hexagram,
    symbolText: lines.reverse().join('\n'),
    meaning: `动爻在第 ${moving} 爻，象意偏向“先有扰动，后看确认”。`,
    advice: `${stock.name} 适合先看趋势是否接住，再判断是否继续跟踪。`,
    details: [`本卦：${hexagram}`, `动爻：${moving} 爻`, `用神：${stock.layer || stock.market}`],
  }
}

function meihuaReading(stock: StockItem): MysticReading {
  const trigram = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤']
  const upper = drawFrom(trigram)
  const lower = drawFrom(trigram)
  const moving = rand(6) + 1
  return {
    title: `${upper}${lower}之象`,
    symbolText: `上卦 ${upper} / 下卦 ${lower}`,
    meaning: `体用关系显示主线仍在变化中，${moving} 爻动，重在观察催化能否落地。`,
    advice: `${stock.name} 的象意偏“题材有光，但需要价格确认”。`,
    details: [`上卦：${upper}`, `下卦：${lower}`, `动爻：${moving} 爻`],
  }
}

function xiaoliurenReading(stock: StockItem): MysticReading {
  const states = [
    ['大安', '稳定守成，适合看龙头和低波动位置'],
    ['留连', '进展偏慢，先等更清晰的信号'],
    ['速喜', '消息面容易带来短线波动'],
    ['赤口', '分歧较强，适合先看风险'],
    ['小吉', '小幅顺风，重在轻仓验证'],
    ['空亡', '预期容易落空，避免重仓押注'],
  ]
  const picked = drawFrom(states)
  return {
    title: picked[0],
    symbolText: picked[0],
    meaning: picked[1],
    advice: `${stock.name} 被小六壬归入“${picked[0]}”，娱乐解读偏向${picked[1]}。`,
    details: [`课体：${picked[0]}`, `市场：${stock.market}`, `主题：${stock.layer || '未标注'}`],
  }
}

function astroReading(stock: StockItem): MysticReading {
  const planets = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星']
  const signs = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼']
  const houses = ['一宫', '二宫', '三宫', '四宫', '五宫', '六宫', '七宫', '八宫', '九宫', '十宫', '十一宫', '十二宫']
  const planet = drawFrom(planets)
  const sign = drawFrom(signs)
  const house = drawFrom(houses)
  return {
    title: `${planet} / ${sign} / ${house}`,
    symbolText: `${planet} 落 ${sign} ${house}`,
    meaning: `${planet} 指向驱动力，${sign} 指向表现方式，${house} 指向事件落点。`,
    advice: `${stock.name} 的占星骰子偏向“看事件触发和市场情绪扩散”。`,
    details: [`行星：${planet}`, `星座：${sign}`, `宫位：${house}`],
  }
}

async function pickStock() {
  error.value = null
  result.value = null
  animating.value = true
  const pool = candidates.value
  if (!pool.length) {
    error.value = '当前市场暂无候选股票。'
    animating.value = false
    return
  }

  picking.value = true
  try {
    const stock = drawFrom(pool)
    const reading = makeReading(method.value, stock)
    
    // 等待动画播放完成（根据不同方式调整时间）
    const animationDuration = method.value === 'tarot' ? 5000 : 
                              method.value === 'astro' ? 4000 : 
                              method.value === 'liuyao' || method.value === 'meihua' ? 4500 : 3500
    await new Promise(resolve => setTimeout(resolve, animationDuration))
    
    // 动画完成后，显示选股结果，等待3-5秒让用户查看
    await new Promise(resolve => setTimeout(resolve, 4000))
    
    const [quote, kline, detail] = await Promise.all([
      sourceManager.fetchQuote(stock.symbol).catch(() => null),
      sourceManager.fetchKLine(stock.symbol, { range: '6mo', interval: '1d' }).catch(() => null),
      fetchStockFullDetail(stock.symbol, stock.name, stock.market).catch(() => ({ news: [], announcements: [], etfs: [], advice: null } as StockFullDetail)),
    ])

    result.value = {
      stock,
      reading,
      quote,
      detail,
      analysis: kline?.points?.length ? analyzeStock(kline.points) : null,
      aiText: '',
    }
  } catch (e) {
    error.value = (e as Error).message || '玄学选股失败，请稍后重试。'
  } finally {
    picking.value = false
    // 延迟关闭动画，让用户看到最终结果
    setTimeout(() => {
      animating.value = false
    }, 2000)
  }
}

async function generateAIAdvice() {
  if (!result.value || aiLoading.value) return
  if (!aiStore.isConfigured) {
    error.value = '请先在设置页配置 AI 模型。'
    return
  }

  aiLoading.value = true
  error.value = null
  try {
    const r = result.value
    const prompt = `这是一个娱乐功能，请基于“玄学选股”的结果生成轻量 AI 荐股解读。

必须明确说明：仅供娱乐，不构成投资建议，不应据此交易。

市场：${r.stock.market}
股票：${r.stock.symbol} ${r.stock.name}
玄学方式：${methods.find(m => m.id === method.value)?.label}
卦象/牌面：${r.reading.title}
释义：${r.reading.meaning}
行情：最新价 ${r.quote?.price ?? 'N/A'}，涨跌幅 ${r.quote?.change != null ? (r.quote.change * 100).toFixed(2) + '%' : 'N/A'}
技术：评分 ${r.analysis?.score ?? 'N/A'}，趋势 ${r.analysis?.technical.trend ?? 'N/A'}，信号 ${r.analysis?.signals.join('、') || '暂无'}
新闻：${r.detail.news.slice(0, 3).map(n => n.title).join('；') || '暂无'}

请用中文 Markdown 输出，可使用小标题、列表和表格：
1. 娱乐结论
2. 为什么玄学会选到它
3. 真实数据里需要确认的点
4. 风险和免责`

    const resp = await chat(
      [
        { role: 'system', content: '你是一个娱乐向投研助手。不要给确定性买卖建议，必须强调仅供娱乐和风险自担。' },
        { role: 'user', content: prompt },
      ],
      {
        baseUrl: aiStore.baseUrl,
        apiKey: aiStore.apiKey,
        model: aiStore.model,
        temperature: 0.7,
        maxTokens: 1200,
      },
    )
    result.value.aiText = resp.choices?.[0]?.message?.content || ''
  } catch (e) {
    error.value = formatAIError((e as Error).message)
  } finally {
    aiLoading.value = false
  }
}

function formatAIError(message: string): string {
  const cooldown = message.match(/AI_RATE_LIMIT_COOLDOWN:(\d+)/)
  if (cooldown) return `AI 服务正在限流冷却中，请约 ${cooldown[1]} 秒后重试。`
  const limited = message.match(/AI_RATE_LIMIT:(\d+):/)
  if (limited) return `AI 服务请求过多或额度受限，请约 ${limited[1]} 秒后重试。`
  if (message.includes('429') || message.toLowerCase().includes('too many requests')) {
    return 'AI 服务请求过多或额度受限，请稍后重试，或在设置页切换模型/API Key。'
  }
  return message || 'AI 荐股解读生成失败。'
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
  if (!content.trim()) return ''
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
    const trimmed = lines[i].trim()
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
        out.push('<tr>')
        for (const cell of parseTableRow(lines[i])) out.push(`<td>${renderInline(cell)}</td>`)
        out.push('</tr>')
        i++
      }
      i--
      out.push('</tbody></table>')
      continue
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      closeList()
      const level = Math.min(heading[1].length + 1, 4)
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      continue
    }

    const numberedHeading = trimmed.match(/^\d+\.\s+(.+)$/)
    if (numberedHeading && numberedHeading[1].length <= 32) {
      flushParagraph()
      closeList()
      out.push(`<h3>${renderInline(trimmed)}</h3>`)
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

function goToStock(symbol: string) {
  router.push(`/stock/${encodeURIComponent(symbol)}`)
}
</script>

<template>
  <div class="page mystic-page">
    <header class="page-head">
      <div>
        <p class="eyebrow">娱乐模式</p>
        <h1>玄学选股</h1>
      </div>
      <div class="disclaimer">AI 荐股与玄学选股仅供娱乐，请勿当真；不构成任何投资建议。</div>
    </header>

    <section class="control-panel">
      <div class="control-group">
        <span class="control-label">市场</span>
        <div class="seg">
          <button v-for="m in markets" :key="m" :class="{ active: market === m }" @click="market = m">
            {{ m }}
          </button>
        </div>
      </div>

      <div class="control-group">
        <span class="control-label">方式</span>
        <div class="method-grid">
          <button v-for="m in methods" :key="m.id" class="method-btn" :class="{ active: method === m.id }" @click="method = m.id">
            {{ m.label }}
          </button>
        </div>
      </div>

      <button class="btn primary pick-btn" :disabled="picking" @click="pickStock">
        <span v-if="picking" class="spinner"></span>
        {{ picking ? '起卦中…' : '开始玄学选股' }}
      </button>
    </section>

    <p v-if="error" class="error-line">{{ error }}</p>

    <!-- 动画区域 -->
    <section v-if="animating && !result" class="animation-section">
      <MysticAnimation
        :type="method"
        title=""
        symbol-text=""
        meaning=""
        :details="[]"
        :playing="animating && !result"
      />
    </section>

    <section v-if="result" class="result-layout">
      <div class="reading-panel">
        <div class="panel-head">
          <span class="small muted">卦象</span>
          <strong>{{ methods.find(m => m.id === method)?.label }}</strong>
        </div>
        <h2>{{ result.reading.title }}</h2>
        <pre class="symbol-lines">{{ result.reading.symbolText }}</pre>
        <p>{{ result.reading.meaning }}</p>
        <p class="reading-advice">{{ result.reading.advice }}</p>
        <div class="detail-chips">
          <span v-for="item in result.reading.details" :key="item">{{ item }}</span>
        </div>
      </div>

      <div class="stock-panel">
        <div class="stock-top">
          <div>
            <div class="stock-name">{{ result.stock.name }}</div>
            <button class="symbol-link" @click="goToStock(result.stock.symbol)">{{ result.stock.symbol }}</button>
          </div>
          <div class="price-box">
            <strong>{{ formatPrice(result.quote?.price, result.quote?.currency) }}</strong>
            <span :class="quoteTone(result.quote?.change)">{{ formatPercent(result.quote?.change) }}</span>
          </div>
        </div>

        <div class="metrics-grid">
          <div>
            <span class="small muted">市场</span>
            <strong>{{ result.stock.market }}</strong>
          </div>
          <div>
            <span class="small muted">层级</span>
            <strong>{{ result.stock.layer || '—' }}</strong>
          </div>
          <div>
            <span class="small muted">成交量</span>
            <strong>{{ formatVolume(result.quote?.volume) }}</strong>
          </div>
          <div>
            <span class="small muted">技术评分</span>
            <strong>{{ result.analysis?.score ?? '—' }}</strong>
          </div>
        </div>

        <div v-if="result.analysis?.signals.length" class="signal-row">
          <span v-for="signal in result.analysis.signals.slice(0, 5)" :key="signal">{{ signal }}</span>
        </div>

        <div class="info-sections">
          <div>
            <h3>相关新闻</h3>
            <p v-if="!result.detail.news.length" class="small muted">暂无新闻数据</p>
            <a v-for="item in result.detail.news.slice(0, 3)" :key="item.url || item.title" :href="item.url" target="_blank" rel="noopener">
              {{ item.title }}
            </a>
          </div>
          <div>
            <h3>相关 ETF</h3>
            <p v-if="!result.detail.etfs.length" class="small muted">暂无相关 ETF</p>
            <button v-for="item in result.detail.etfs.slice(0, 3)" :key="item.etfSymbol" @click="goToStock(item.etfSymbol)">
              {{ item.etfSymbol }} {{ item.etfName }}
            </button>
          </div>
        </div>
      </div>

      <div class="ai-panel">
        <div class="panel-head">
          <span class="small muted">AI 荐股</span>
          <button class="btn ghost sm" :disabled="aiLoading || !aiStore.isConfigured" @click="generateAIAdvice">
            {{ aiLoading ? '生成中…' : '娱乐解读' }}
          </button>
        </div>
        <div class="ai-disclaimer">仅供娱乐，请勿当真；AI 输出不构成投资建议，不应作为交易依据。</div>
        <div v-if="result.aiText" class="ai-text" v-html="renderMarkdown(result.aiText)"></div>
        <p v-else-if="!aiStore.isConfigured" class="small muted">配置 AI 模型后可生成娱乐向荐股解读。</p>
        <p v-else class="small muted">点击“娱乐解读”生成 AI 版玄学荐股说明。</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.mystic-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-5) 0 var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.eyebrow {
  margin: 0 0 6px;
  color: var(--color-link);
  font-size: var(--fs-xs);
  font-weight: 800;
}
.page-head h1 {
  margin: 0;
}
.disclaimer,
.ai-disclaimer {
  max-width: 520px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid rgba(245, 158, 11, 0.4);
  border-radius: var(--radius-md);
  background: rgba(245, 158, 11, 0.1);
  color: #b45309;
  font-size: var(--fs-sm);
  line-height: 1.5;
}
.control-panel,
.reading-panel,
.stock-panel,
.ai-panel {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  box-shadow: var(--shadow-sm);
}
.control-panel {
  display: grid;
  grid-template-columns: minmax(220px, 0.7fr) 1fr auto;
  gap: var(--space-4);
  align-items: end;
}
.control-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.control-label {
  color: var(--color-muted);
  font-size: var(--fs-sm);
  font-weight: 700;
}
.seg,
.method-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.seg button,
.method-btn {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
}
.seg button.active,
.method-btn.active {
  border-color: var(--color-link);
  background: var(--color-info-bg);
  color: var(--color-link);
  font-weight: 700;
}
.pick-btn {
  min-width: 140px;
}
.error-line {
  margin: 0;
  color: var(--color-down);
  font-size: var(--fs-sm);
}
.animation-section {
  margin: var(--space-4) 0;
  padding: var(--space-4);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.result-layout {
  display: grid;
  grid-template-columns: minmax(280px, 0.8fr) minmax(360px, 1.2fr);
  gap: var(--space-4);
}
.ai-panel {
  grid-column: 1 / -1;
}
.panel-head,
.stock-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
}
.reading-panel h2 {
  margin: var(--space-3) 0 var(--space-2);
}
.symbol-lines {
  margin: 0 0 var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-bg-soft);
  color: var(--color-ink);
  font-family: var(--font-mono);
  line-height: 1.4;
  white-space: pre-wrap;
}
.reading-advice {
  font-weight: 700;
}
.detail-chips,
.signal-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: var(--space-3);
}
.detail-chips span,
.signal-row span {
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-soft);
  color: var(--color-muted);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.stock-name {
  font-size: var(--fs-xl);
  font-weight: 800;
}
.symbol-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-link);
  font-family: var(--font-mono);
  font-weight: 700;
}
.price-box {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-variant-numeric: tabular-nums;
}
.price-box strong {
  font-size: var(--fs-xl);
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
  margin-top: var(--space-4);
}
.metrics-grid > div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-bg-soft);
}
.metrics-grid strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.info-sections {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}
.info-sections h3 {
  margin: 0 0 var(--space-2);
  font-size: var(--fs-sm);
}
.info-sections a,
.info-sections button {
  display: block;
  width: 100%;
  margin-bottom: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-ink);
  text-align: left;
  text-decoration: none;
  font-size: var(--fs-sm);
  line-height: 1.5;
}
.info-sections a:hover,
.info-sections button:hover {
  color: var(--color-link);
}
.ai-disclaimer {
  max-width: none;
  margin: var(--space-3) 0;
}
.ai-text {
  color: var(--color-ink);
  font-size: var(--fs-sm);
  line-height: 1.65;
}
.ai-text :deep(h2),
.ai-text :deep(h3) {
  margin: var(--space-4) 0 var(--space-2);
  font-size: var(--fs-md);
  line-height: 1.3;
}
.ai-text :deep(h4) {
  margin: var(--space-3) 0 var(--space-2);
  font-size: var(--fs-sm);
  line-height: 1.3;
}
.ai-text :deep(h2:first-child),
.ai-text :deep(h3:first-child),
.ai-text :deep(h4:first-child),
.ai-text :deep(p:first-child) {
  margin-top: 0;
}
.ai-text :deep(p) {
  margin: 0 0 var(--space-2);
}
.ai-text :deep(ul),
.ai-text :deep(ol) {
  margin: 0 0 var(--space-3);
  padding-left: 1.25rem;
}
.ai-text :deep(li) {
  margin-bottom: 4px;
}
.ai-text :deep(table) {
  width: 100%;
  margin: var(--space-2) 0 var(--space-3);
  border-collapse: collapse;
  font-size: var(--fs-xs);
}
.ai-text :deep(th),
.ai-text :deep(td) {
  padding: 7px 8px;
  border: 1px solid var(--color-border);
  vertical-align: top;
}
.ai-text :deep(th) {
  background: var(--color-bg-soft);
  font-weight: 700;
}
.ai-text :deep(code) {
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-soft);
  font-family: var(--font-mono);
  font-size: 0.92em;
}
.ai-text :deep(a) {
  color: var(--color-link);
}
.ai-text :deep(.bullet) {
  padding-left: var(--space-3);
  border-left: 2px solid var(--color-border);
}
.spinner {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 4px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.pos { color: var(--color-up); }
.neg { color: var(--color-down); }
.flat { color: var(--color-flat); }

@media (max-width: 980px) {
  .page-head,
  .control-panel,
  .result-layout,
  .info-sections {
    grid-template-columns: 1fr;
  }
  .page-head {
    flex-direction: column;
  }
  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .price-box {
    align-items: flex-start;
  }
}

@media (max-width: 640px) {
  .page {
    padding-bottom: calc(60px + var(--space-4));
  }
  
  .control-panel {
    padding: var(--space-3);
    gap: var(--space-3);
  }
  
  .control-group {
    width: 100%;
  }
  
  .seg {
    flex-wrap: wrap;
  }
  
  .seg button {
    flex: 1;
    min-width: 60px;
  }
  
  .method-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }
  
  .pick-btn {
    width: 100%;
  }
  
  .result-layout {
    gap: var(--space-3);
  }
  
  .reading-panel,
  .stock-panel,
  .ai-panel {
    padding: var(--space-3);
  }
  
  .stock-top {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }
  
  .price-box {
    align-items: flex-start;
  }
  
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .info-sections {
    grid-template-columns: 1fr;
  }
  
  .mystic-animation {
    padding: var(--space-3);
    min-height: 150px;
  }
  
  .tarot-card {
    width: 80px;
    height: 120px;
  }
  
  .dice {
    font-size: 36px;
  }
  
  .astro-symbol {
    font-size: 40px;
  }
}

@media (max-width: 375px) {
  .control-panel {
    padding: var(--space-2);
  }
  
  .method-grid {
    grid-template-columns: 1fr 1fr;
    gap: var(--space-1);
  }
  
  .method-btn {
    padding: var(--space-2);
    font-size: var(--fs-sm);
  }
}
</style>
