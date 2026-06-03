<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAIStore } from '../stores/ai'
import { useSectorStore } from '../stores/sector'
import { useQuotesStore } from '../stores/quotes'
import { chatStream } from '../api/ai'
import { parseLongportSymbol } from '../api/symbolMap'

const route = useRoute()
const aiStore = useAIStore()
const sectorStore = useSectorStore()
const quotesStore = useQuotesStore()

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  symbol?: string
}

const messages = ref<Message[]>([])
const input = ref('')
const symbolContext = ref<string>('')
const preset = ref<'analysis' | 'sector' | 'macro' | 'custom'>('analysis')
const asking = ref(false)
const error = ref<string | null>(null)

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

onMounted(() => {
  // 支持 URL 参数 ?symbol=XXX
  const urlSymbol = route.query.symbol as string
  if (urlSymbol) {
    symbolContext.value = decodeURIComponent(urlSymbol)
    preset.value = 'analysis'
  }
})

function applyPreset() {
  if (preset.value === 'sector') {
    const sector = sectorStore.activeSector
    input.value = `请帮我梳理「${sector?.name || '当前板块'}」的产业链结构，分环节列出代表标的。`
  } else if (preset.value === 'macro') {
    input.value = '请分析当前宏观经济环境对投资的影响。'
  }
}

function buildSystemPrompt(): string {
  const sector = sectorStore.activeSector

  if (preset.value === 'analysis' && symbolContext.value) {
    const q = quotesStore.get(symbolContext.value)
    const liveInfo = q && q.price != null
      ? `当前价 ${q.price.toFixed(2)} ${q.currency || ''}，涨跌 ${q.change != null ? (q.change * 100).toFixed(2) + '%' : 'N/A'}。`
      : ''
    const meta = parseLongportSymbol(symbolContext.value)
    const stockInfo = sector?.stocks.find(s => s.symbol === symbolContext.value)

    return `你是一位资深股票分析师。基于以下信息给出深度分析。

股票代码: ${symbolContext.value}
股票名称: ${stockInfo?.name || meta?.code || symbolContext.value}
所属市场: ${stockInfo?.market || meta?.region || '未知'}
产业链层级: ${stockInfo?.layer || '未知'}
所属板块: ${sector?.name || '未知'}
${liveInfo ? `实时数据: ${liveInfo}` : ''}
${stockInfo?.reason ? `入选理由: ${stockInfo.reason}` : ''}

请用 Markdown 格式回答，结构清晰，包含：
- 核心结论（1-2 句）
- 关键因素分析
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
  const userMsg: Message = { role: 'user', content: input.value, symbol: symbolContext.value || undefined }
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
    messages.value[assistantIdx].content += `\n\n[错误] ${(e as Error).message}`
  } finally {
    asking.value = false
  }
}

function clearChat() {
  messages.value = []
  input.value = ''
  symbolContext.value = ''
  error.value = null
}
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

    <div v-if="preset === 'analysis'" class="symbol-input">
      <label>分析标的</label>
      <input v-model="symbolContext" placeholder="NVDA.US" list="sector-symbols" />
      <datalist id="sector-symbols">
        <option v-for="s in sectorSymbols" :key="s.symbol" :value="s.symbol">{{ s.name }}</option>
      </datalist>
      <span class="small muted">支持 LongPort 格式：NVDA.US, 00700.HK, 600176.SH</span>
    </div>

    <div class="chat-window">
      <div v-if="messages.length === 0" class="empty">
        <p class="muted">选择预设或直接输入问题开始对话。</p>
      </div>
      <div v-for="(m, i) in messages" :key="i" class="msg" :class="m.role">
        <div class="msg-role">{{ m.role === 'user' ? '我' : (m.role === 'assistant' ? 'AI' : '系统') }}</div>
        <div class="msg-bubble">
          <span v-if="m.symbol" class="msg-tag">@{{ m.symbol }}</span>
          <pre>{{ m.content || (asking && i === messages.length - 1 ? '…' : '') }}</pre>
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
.symbol-input { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--color-bg-soft); border-radius: var(--radius-md); }
.symbol-input label { font-size: var(--fs-sm); color: var(--color-muted); }
.symbol-input input { flex: 1; max-width: 200px; }
.chat-window { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 12px; background: var(--color-bg-soft); border-radius: var(--radius-md); }
.empty { text-align: center; padding: 40px 0; }
.msg { display: flex; flex-direction: column; gap: 4px; max-width: 80%; }
.msg.user { align-self: flex-end; }
.msg.assistant { align-self: flex-start; }
.msg-role { font-size: 11px; color: var(--color-muted); }
.msg.user .msg-role { text-align: right; }
.msg-bubble { padding: 10px 14px; border-radius: var(--radius-md); }
.msg.user .msg-bubble { background: var(--color-link); color: white; }
.msg.assistant .msg-bubble { background: var(--color-bg-elevated); border: 1px solid var(--color-border); }
.msg-tag { display: inline-block; padding: 1px 6px; background: rgba(255,255,255,0.2); border-radius: 4px; font-size: 11px; margin-right: 4px; }
.msg-bubble pre { margin: 4px 0 0; white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: var(--fs-sm); line-height: 1.6; }
.input-bar { display: flex; gap: 8px; align-items: flex-end; }
.input-bar textarea { flex: 1; resize: vertical; }
.spinner { display: inline-block; width: 10px; height: 10px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 4px; }
@keyframes spin { to { transform: rotate(360deg); } }
.pos { color: var(--color-up); }
.neg { color: var(--color-down); }
</style>
