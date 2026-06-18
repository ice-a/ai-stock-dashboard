<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settings'
import { useRefreshStore } from '../stores/refresh'
import { useQuotesStore } from '../stores/quotes'
import { useWatchlistStore } from '../stores/watchlist'
import { usePortfolioStore } from '../stores/portfolio'
import { useAIStore } from '../stores/ai'
import { useUserStore } from '../stores/user'
import { useRuntimeConfigStore } from '../stores/runtimeConfig'
import { listModels, type ModelInfo } from '../api/ai'
import { EXTERNAL_ENDPOINTS } from '../config/endpoints'
import { setLocale, type Locale } from '../i18n'
import UserAuth from '../components/UserAuth.vue'
import { syncWatchlist, syncPortfolio, syncSettings, loadWatchlist, loadPortfolio, loadSettings } from '../api/userSync'

const { t } = useI18n()
const settings = useSettingsStore()
const refresh = useRefreshStore()
const quotes = useQuotesStore()
const watchlist = useWatchlistStore()
const portfolio = usePortfolioStore()
const aiStore = useAIStore()
const userStore = useUserStore()
const runtimeConfig = useRuntimeConfigStore()

const modelList = ref<ModelInfo[]>([])
const modelLoading = ref(false)
const modelTestResult = ref<string | null>(null)
const syncStatus = ref<string | null>(null)

const allModels = computed(() => {
  const map = new Map<string, ModelInfo>()
  for (const m of aiStore.availableModels) map.set(m.id, m)
  for (const m of modelList.value) map.set(m.id, m)
  return [...map.values()]
})

onMounted(() => {
  if (aiStore.hasCredentials) {
    refreshModels()
  }
})

// 同步数据到云端
async function syncToCloud() {
  syncStatus.value = '同步中...'
  try {
    await Promise.all([
      syncWatchlist(watchlist.items),
      syncPortfolio(portfolio.holdings, portfolio.transactions),
      syncSettings({
        theme: settings.theme,
        locale: settings.locale,
        enabled: settings.enabled,
        listInterval: settings.listInterval,
        detailInterval: settings.detailInterval,
      }),
    ])
    syncStatus.value = '✓ 同步成功'
  } catch (e) {
    syncStatus.value = '✗ 同步失败: ' + (e as Error).message
  }
  setTimeout(() => { syncStatus.value = null }, 3000)
}

// 从云端加载数据
async function loadFromCloud() {
  syncStatus.value = '加载中...'
  try {
    const [watchlistData, portfolioData, settingsData] = await Promise.all([
      loadWatchlist(),
      loadPortfolio(),
      loadSettings(),
    ])
    
    if (watchlistData) {
      watchlist.importJson(JSON.stringify({ items: watchlistData }))
    }
    if (portfolioData) {
      portfolio.importJson(JSON.stringify(portfolioData))
    }
    if (settingsData) {
      if (settingsData.theme) settings.theme = settingsData.theme
      if (settingsData.locale) settings.locale = settingsData.locale
    }
    
    syncStatus.value = '✓ 加载成功'
  } catch (e) {
    syncStatus.value = '✗ 加载失败: ' + (e as Error).message
  }
  setTimeout(() => { syncStatus.value = null }, 3000)
}

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
    version: 4,
    settings: settings.exportJson() ? JSON.parse(settings.exportJson()).settings : null,
    favorites: watchlist.items,
    portfolio: portfolio.holdings,
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
const allFileInput = ref<HTMLInputElement | null>(null)
function importFavorites() {
  fileInput.value?.click()
}
function importAll() {
  allFileInput.value?.click()
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
function onAllFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'))
      let messages: string[] = []
      if (parsed.settings) {
        settings.importJson(JSON.stringify({ settings: parsed.settings }))
        messages.push('设置')
      }
      if (Array.isArray(parsed.favorites)) {
        const result = watchlist.importJson(JSON.stringify({ items: parsed.favorites }))
        messages.push(`自选新增 ${result.added} / 跳过 ${result.merged}`)
      }
      if (Array.isArray(parsed.portfolio)) {
        const result = portfolio.importJson(JSON.stringify({ holdings: parsed.portfolio }))
        messages.push(`持仓新增 ${result.added} / 跳过 ${result.merged}`)
      }
      if (parsed.quotes && typeof parsed.quotes === 'object') {
        quotes.setMany(Object.values(parsed.quotes) as any)
        messages.push('报价缓存')
      }
      modelTestResult.value = messages.length ? `✓ 导入完成：${messages.join('，')}` : '✗ 未识别的备份文件'
    } catch (err) {
      modelTestResult.value = `✗ ${(err as Error).message}`
    } finally {
      input.value = ''
    }
  }
  reader.readAsText(file)
}
</script>

<template>
  <div class="page">
    <h1>{{ t('settings.title') }}</h1>

    <!-- 用户账户 -->
    <section class="card section">
      <h2>👤 用户账户</h2>
      <div v-if="userStore.isLoggedIn" class="user-info">
        <div class="user-profile">
          <span class="user-avatar">{{ userStore.user?.nickname?.[0] || userStore.user?.userId?.[0] || '?' }}</span>
          <div>
            <div class="user-name">{{ userStore.user?.nickname || userStore.user?.userId }}</div>
            <div class="user-id small muted">ID: {{ userStore.user?.userId }}</div>
          </div>
        </div>
        <div class="user-actions">
          <button class="btn" @click="syncToCloud">☁️ 同步到云端</button>
          <button class="btn" @click="loadFromCloud">📥 从云端加载</button>
          <button class="btn ghost" @click="userStore.logout">退出登录</button>
        </div>
        <div v-if="syncStatus" class="sync-status" :class="syncStatus.startsWith('✓') ? 'pos' : 'neg'">
          {{ syncStatus }}
        </div>
      </div>
      <UserAuth v-else />
    </section>

    <!-- 环境变量配置 -->
    <section class="card section">
      <h2>⚙️ 环境变量配置</h2>
      <p class="small muted">以下配置从服务器环境变量读取，如需修改请联系管理员。</p>
      <div class="env-grid">
        <div class="env-item">
          <span class="env-label">MongoDB</span>
          <span class="env-value" :class="runtimeConfig.config.mongo?.configured ? 'pos' : 'neg'">
            {{ runtimeConfig.config.mongo?.configured ? '✓ 已配置' : '✗ 未配置' }}
          </span>
        </div>
        <div class="env-item">
          <span class="env-label">AI 模型</span>
          <span class="env-value" :class="runtimeConfig.config.ai?.configured ? 'pos' : 'neg'">
            {{ runtimeConfig.config.ai?.model || '未设置' }}
          </span>
        </div>
        <div class="env-item">
          <span class="env-label">站点密码</span>
          <span class="env-value" :class="runtimeConfig.config.site?.hasPassword ? 'pos' : 'neg'">
            {{ runtimeConfig.config.site?.hasPassword ? '✓ 已设置' : '✗ 未设置' }}
          </span>
        </div>
      </div>
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
        <input v-model="aiStore.baseUrl" type="text" :placeholder="EXTERNAL_ENDPOINTS.openai.baseUrl" class="grow" />
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
      <h2>数据管理</h2>
      <div class="actions">
        <button class="btn" @click="exportFavorites">导出自选股</button>
        <button class="btn" @click="exportAll">导出全部数据</button>
        <button class="btn" @click="importAll">导入全部数据</button>
        <button class="btn" @click="importFavorites">导入自选股</button>
        <button class="btn" @click="clearCache">{{ t('settings.clearCache') }}</button>
        <input ref="fileInput" type="file" accept="application/json" style="display:none" @change="onFileSelected" />
        <input ref="allFileInput" type="file" accept="application/json" style="display:none" @change="onAllFileSelected" />
      </div>
      <div class="stats-row small muted">
        <span>报价缓存：{{ quotes.quotes.size }} 个</span>
        <span>自选股：{{ watchlist.items.length }} 只</span>
        <span>持仓：{{ portfolio.holdings.length }} 条</span>
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
.spinner {
  display: inline-block; width: 10px; height: 10px;
  border: 2px solid currentColor; border-right-color: transparent;
  border-radius: 50%; animation: spin 0.8s linear infinite;
  margin-right: 4px;
}
@keyframes spin { to { transform: rotate(360deg); } }

.user-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.user-profile {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-info-bg);
  color: var(--color-link);
  font-size: var(--fs-xl);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-name {
  font-weight: 600;
  font-size: var(--fs-base);
}

.user-id {
  font-size: var(--fs-xs);
  font-family: var(--font-mono);
}

.user-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.sync-status {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  font-weight: 600;
}

.env-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-3);
}

.env-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
}

.env-label {
  font-size: var(--fs-xs);
  color: var(--color-muted);
  font-weight: 600;
}

.env-value {
  font-size: var(--fs-sm);
  font-weight: 600;
}
</style>
