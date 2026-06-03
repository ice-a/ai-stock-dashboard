<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settings'
import { useRefreshStore } from '../stores/refresh'
import { useQuotesStore } from '../stores/quotes'
import { useWatchlistStore } from '../stores/watchlist'
import { useTopicStore } from '../stores/topic'
import { useAIStore } from '../stores/ai'
import { useRuntimeConfigStore } from '../stores/runtimeConfig'
import { sourceManager } from '../api/sourceManager'
import { listModels, type ModelInfo } from '../api/ai'
import { setLocale, type Locale } from '../i18n'

const { t } = useI18n()
const settings = useSettingsStore()
const refresh = useRefreshStore()
const quotes = useQuotesStore()
const watchlist = useWatchlistStore()
const topicStore = useTopicStore()
const aiStore = useAIStore()
const runtimeConfig = useRuntimeConfigStore()

// ============ AI 模型配置 ============
const modelList = ref<ModelInfo[]>([])
const modelLoading = ref(false)
const modelTestResult = ref<string | null>(null)

// 合并当前拉取的模型和已保存的模型列表
const allModels = computed(() => {
  const map = new Map<string, ModelInfo>()
  for (const m of aiStore.availableModels) map.set(m.id, m)
  for (const m of modelList.value) map.set(m.id, m)
  return [...map.values()]
})

onMounted(() => {
  // 初始模型列表：有凭证就尝试拉取
  if (aiStore.hasCredentials) {
    refreshModels()
  }
})

// 填写 API Key 后自动拉取模型列表
let modelFetchTimer: ReturnType<typeof setTimeout> | null = null
watch(() => [aiStore.baseUrl, aiStore.apiKey], () => {
  if (modelFetchTimer) clearTimeout(modelFetchTimer)
  if (aiStore.hasCredentials) {
    modelFetchTimer = setTimeout(() => refreshModels(), 800)
  }
})

function saveAI() {
  aiStore.save()
  modelTestResult.value = '✓ 已保存'
}

async function refreshModels() {
  if (!aiStore.hasCredentials) {
    modelTestResult.value = '✗ 请先填写 Base URL 和 API Key'
    return
  }
  modelLoading.value = true
  modelTestResult.value = '拉取模型列表…'
  try {
    const list = await listModels(aiStore.baseUrl, aiStore.apiKey)
    modelList.value = list
    aiStore.setAvailableModels(list)
    // 自动选择第一个模型（如果当前未选择）
    if (!aiStore.model && list.length > 0) {
      aiStore.setModel(list[0].id)
    }
    modelTestResult.value = `✓ 拉取到 ${list.length} 个模型`
  } catch (e) {
    modelTestResult.value = `✗ ${(e as Error).message}`
  } finally {
    modelLoading.value = false
  }
}

// ============ 数据源健康度 ============
const healthTick = ref(0)
const sources = computed(() => {
  void healthTick.value
  return sourceManager.list()
})

const testingSources = ref<Record<string, string>>({})

async function testSource(id: 'longport' | 'eastmoney' | 'sina' | 'yahoo') {
  testingSources.value[id] = '...'
  const t0 = performance.now()
  try {
    const r = await sourceManager.fetchQuote('00700.HK', { preferred: [id] })
    const ms = Math.round(performance.now() - t0)
    testingSources.value[id] = r.source === id && r.price != null
      ? `✓ OK · ${ms}ms`
      : `✗ ${r.source}`
  } catch (e) {
    testingSources.value[id] = `✗ ${(e as Error).message}`
  }
  healthTick.value++
}

onMounted(() => {
  testSource('longport')
})

// ============ 主题 / 语言 / 刷新 ============
function onThemeChange(m: 'light' | 'dark' | 'system') {
  settings.setTheme(m)
}
function onLocaleChange(l: Locale) {
  setLocale(l)
  settings.setLocale(l)
}
function onListIntervalChange(e: Event) {
  const v = Number((e.target as HTMLSelectElement).value)
  settings.listInterval = v
  refresh.setListInterval(v)
}
function onDetailIntervalChange(e: Event) {
  const v = Number((e.target as HTMLSelectElement).value)
  settings.detailInterval = v
  refresh.setDetailInterval(v)
}

function clearCache() {
  quotes.clear()
  modelTestResult.value = '✓ 缓存已清除'
  setTimeout(() => { modelTestResult.value = null }, 2000)
}

function exportAll() {
  const data = {
    version: 2,
    settings: settings.exportJson() ? JSON.parse(settings.exportJson()).settings : null,
    topics: topicStore.topics,
    activeTopic: topicStore.activeId,
    favorites: watchlist.items,
    quotes: Object.fromEntries(quotes.quotes),
    ai: { baseUrl: aiStore.baseUrl, model: aiStore.model },
    exportedAt: new Date().toISOString(),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ai-dashboard-backup-${new Date().toISOString().slice(0,10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function exportFavorites() {
  const blob = new Blob([watchlist.exportJson()], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `favorites-${new Date().toISOString().slice(0,10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const fileInput = ref<HTMLInputElement | null>(null)
function importFavorites() {
  fileInput.value?.click()
}
function onFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement)?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const result = watchlist.importJson(String(reader.result || ''))
    modelTestResult.value = `✓ 导入完成：新增 ${result.added}，合并 ${result.merged}`
  }
  reader.readAsText(file)
}
</script>

<template>
  <div class="page">
    <h1>{{ t('settings.title') }}</h1>

    <section class="card section">
      <h2>站点访问控制</h2>
      <p class="small muted">部署环境设置 <code>SITE_PASSWORD</code> 后，访问网站需要先输入密码。可选设置 <code>SITE_AUTH_SECRET</code> 用于签名 Cookie，<code>SITE_AUTH_MAX_AGE_SECONDS</code> 控制登录有效期。</p>
    </section>

    <section class="card section">
      <h2>{{ t('settings.theme') }}</h2>
      <div class="theme-options">
        <label v-for="m in ['light', 'dark', 'system']" :key="m" class="radio-card" :class="{ active: settings.theme === m }">
          <input type="radio" name="theme" :value="m" :checked="settings.theme === m" @change="onThemeChange(m as any)" />
          <span class="icon">
            <template v-if="m === 'light'">☀️</template>
            <template v-else-if="m === 'dark'">🌙</template>
            <template v-else>🖥</template>
          </span>
          <span class="label">
            {{ m === 'light' ? t('settings.themeLight') : m === 'dark' ? t('settings.themeDark') : t('settings.themeSystem') }}
          </span>
        </label>
      </div>
    </section>

    <section class="card section">
      <h2>{{ t('settings.language') }}</h2>
      <div class="theme-options">
        <label class="radio-card" :class="{ active: settings.locale === 'zh-CN' }">
          <input type="radio" name="locale" value="zh-CN" :checked="settings.locale === 'zh-CN'" @change="onLocaleChange('zh-CN')" />
          <span class="icon">中</span>
          <span class="label">简体中文</span>
        </label>
        <label class="radio-card" :class="{ active: settings.locale === 'en-US' }">
          <input type="radio" name="locale" value="en-US" :checked="settings.locale === 'en-US'" @change="onLocaleChange('en-US')" />
          <span class="icon">EN</span>
          <span class="label">English</span>
        </label>
      </div>
    </section>

    <section class="card section">
      <h2>{{ t('refresh.title') }}</h2>
      <div class="form-row">
        <label class="switch">
          <input type="checkbox" :checked="settings.enabled" @change="(e) => { settings.enabled = (e.target as HTMLInputElement).checked; refresh.setEnabled((e.target as HTMLInputElement).checked) }" />
          <span>{{ t('refresh.enabled') }}</span>
        </label>
      </div>
      <div class="form-row">
        <label class="lbl small muted">{{ t('refresh.listInterval') }}</label>
        <select :value="settings.listInterval" @change="onListIntervalChange">
          <option v-for="v in [30, 60, 120, 300]" :key="v" :value="v">{{ v }} {{ t('refresh.seconds') }}</option>
        </select>
      </div>
      <div class="form-row">
        <label class="lbl small muted">{{ t('refresh.detailInterval') }}</label>
        <select :value="settings.detailInterval" @change="onDetailIntervalChange">
          <option v-for="v in [5, 15, 30, 60]" :key="v" :value="v">{{ v }} {{ t('refresh.seconds') }}</option>
        </select>
      </div>
      <div class="form-row">
        <label class="switch">
          <input type="checkbox" :checked="settings.pauseOnHidden" @change="(e) => { settings.pauseOnHidden = (e.target as HTMLInputElement).checked; refresh.setPauseOnHidden((e.target as HTMLInputElement).checked) }" />
          <span>{{ t('refresh.pauseOnHidden') }}</span>
        </label>
      </div>
      <div class="form-row">
        <label class="switch">
          <input type="checkbox" :checked="settings.alignToClock" @change="(e) => { settings.alignToClock = (e.target as HTMLInputElement).checked; refresh.setAlignToClock((e.target as HTMLInputElement).checked) }" />
          <span>{{ t('refresh.alignToClock') }}</span>
        </label>
      </div>
    </section>

    <section class="card section">
      <h2>AI 模型</h2>
      <p class="small muted">支持任意 OpenAI 兼容接口。部署环境可配置 <code>AI_BASE_URL</code>、<code>AI_API_KEY</code>、<code>AI_MODEL</code>；服务端托管时 API Key 不会进入浏览器。</p>
      <div v-if="aiStore.serverManaged" class="managed-banner small">
        当前 AI 由服务端环境变量托管：{{ runtimeConfig.config.ai.model || aiStore.model || '未设置模型' }}
      </div>
      <div class="form-row">
        <label class="lbl small muted">Base URL</label>
        <input v-model="aiStore.baseUrl" type="text" placeholder="https://api.openai.com/v1" class="grow" />
      </div>
      <div class="form-row">
        <label class="lbl small muted">API Key</label>
        <input v-model="aiStore.apiKey" type="password" :placeholder="aiStore.serverManaged ? '由服务端环境变量托管' : 'sk-...'" class="grow" />
      </div>
      <div class="form-row">
        <label class="lbl small muted">模型</label>
        <select v-model="aiStore.model" class="grow">
          <option v-if="!aiStore.model && !allModels.length" value="">— 请先拉取列表 —</option>
          <option v-for="m in allModels" :key="m.id" :value="m.id">{{ m.id }}</option>
        </select>
      </div>
      <div class="form-row">
        <button class="btn primary" @click="saveAI">保存</button>
        <button class="btn" :disabled="modelLoading" @click="refreshModels">
          <span v-if="modelLoading" class="spinner"></span>
          拉取模型列表
        </button>
        <span v-if="modelTestResult" class="test-result small" :class="modelTestResult.startsWith('✓') ? 'pos' : 'neg'">{{ modelTestResult }}</span>
      </div>
      <div class="form-row">
        <label class="lbl small muted">Temperature</label>
        <input v-model.number="aiStore.temperature" type="number" min="0" max="2" step="0.1" />
        <label class="lbl small muted" style="margin-left: 12px">Max Tokens</label>
        <input v-model.number="aiStore.maxTokens" type="number" min="100" max="32000" step="100" />
      </div>
    </section>

    <section class="card section">
      <h2>数据源健康度</h2>
      <p class="small muted">系统按 长桥兼容入口 → 东方财富 → 新浪 → Yahoo → 静态快照 顺序回退。Vercel 版本不打包 Longbridge 官方 Node SDK，避免超过 Serverless Function 体积限制。</p>
      <div class="source-list">
        <div v-for="s in sources" :key="s.id" class="source-row">
          <div class="src-name">
            <span class="dot" :class="s.lastSuccess ? 'up' : (s.attempts > 0 ? 'down' : 'idle')"></span>
            <strong>{{ s.name }}</strong>
            <code class="small muted">{{ s.id }}</code>
          </div>
          <div class="src-stats small muted">
            <span>尝试 {{ s.attempts }}</span>
            <span>失败 {{ s.failures }}</span>
            <span v-if="s.lastSuccess">
              上次成功 {{ new Date(s.lastSuccess).toLocaleTimeString() }}
              · {{ Math.round(s.lastDuration) }}ms
            </span>
            <span v-else class="neg">未使用</span>
            <span v-if="s.lastError" class="neg">· {{ s.lastError }}</span>
          </div>
          <button v-if="s.id === 'longport' || s.id === 'eastmoney' || s.id === 'sina' || s.id === 'yahoo'"
                  class="btn small"
                  :disabled="testingSources[s.id] === '...'"
                  @click="testSource(s.id as any)">
            <span v-if="testingSources[s.id] === '...'" class="spinner"></span>
            {{ testingSources[s.id] || '测试' }}
          </button>
        </div>
      </div>
    </section>

    <section class="card section">
      <h2>主题库</h2>
      <p class="small muted">当前激活：<strong>{{ topicStore.current.name }}</strong> · 共 {{ topicStore.topics.length }} 个主题</p>
      <router-link to="/topics" class="btn">管理主题库 →</router-link>
    </section>

    <section class="card section">
      <h2>数据管理</h2>
      <div class="actions">
        <button class="btn" @click="exportFavorites">导出自选股</button>
        <button class="btn" @click="exportAll">导出全部数据</button>
        <button class="btn" @click="importFavorites">导入自选股</button>
        <button class="btn" @click="clearCache">{{ t('settings.clearCache') }}</button>
        <input ref="fileInput" type="file" accept="application/json" style="display:none" @change="onFileSelected" />
      </div>
      <div class="stats-row small muted">
        <span>报价缓存：{{ quotes.quotes.size }} 个</span>
        <span>自选股：{{ watchlist.items.length }} 只</span>
        <span>主题：{{ topicStore.topics.length }} 个</span>
      </div>
    </section>

    <section class="card section">
      <h2>{{ t('settings.about') }}</h2>
      <p class="small muted">{{ t('settings.aboutText') }}</p>
    </section>
  </div>
</template>

<style scoped>
.section { display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-4); }
.section h2 { font-size: var(--fs-lg); margin: 0; }
.theme-options { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.radio-card {
  display: flex; align-items: center; gap: var(--space-2);
  padding: 10px 16px; border: 1px solid var(--color-border);
  border-radius: var(--radius-md); cursor: pointer; flex: 1; min-width: 140px;
  transition: all var(--transition-fast);
}
.radio-card:hover { border-color: var(--color-border-strong); }
.radio-card.active { background: var(--color-info-bg); border-color: var(--color-link); }
.radio-card input { display: none; }
.icon { font-size: 18px; }
.form-row { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.form-row .grow { flex: 1; min-width: 200px; }
.lbl { min-width: 100px; }
.switch { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
.test-result { font-weight: 600; }
.managed-banner {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-info-bg);
  color: var(--color-info-text);
}
.pos { color: var(--color-up); }
.neg { color: var(--color-down); }
.actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.stats-row { display: flex; gap: var(--space-4); flex-wrap: wrap; padding-top: var(--space-2); border-top: 1px solid var(--color-border); }
details summary { cursor: pointer; padding: 4px 0; }
.source-list { display: flex; flex-direction: column; gap: var(--space-2); }
.source-row {
  display: grid; grid-template-columns: 200px 1fr auto;
  align-items: center; gap: var(--space-3);
  padding: var(--space-2); background: var(--color-bg-soft);
  border-radius: var(--radius-md);
}
.src-name { display: flex; align-items: center; gap: 8px; }
.src-stats { display: flex; gap: 12px; flex-wrap: wrap; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-muted); }
.dot.up { background: var(--color-up); box-shadow: 0 0 6px var(--color-up); }
.dot.down { background: var(--color-down); }
.dot.idle { background: var(--color-muted); }
.spinner {
  display: inline-block; width: 10px; height: 10px;
  border: 2px solid currentColor; border-right-color: transparent;
  border-radius: 50%; animation: spin 0.8s linear infinite;
  margin-right: 4px;
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) {
  .source-row { grid-template-columns: 1fr; }
}
</style>
