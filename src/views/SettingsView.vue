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

async function syncToCloud() {
  syncStatus.value = '同步中...'
  try {
    await Promise.all([
      syncWatchlist(watchlist.items),
      syncPortfolio(portfolio.holdings, portfolio.transactions),
      syncSettings({
        theme: settings.theme,
        locale: settings.locale,
      }),
    ])
    syncStatus.value = '✓ 同步成功'
  } catch (e) {
    syncStatus.value = '✗ 同步失败'
  }
  setTimeout(() => { syncStatus.value = null }, 3000)
}

async function loadFromCloud() {
  syncStatus.value = '加载中...'
  try {
    const [watchlistData, portfolioData] = await Promise.all([
      loadWatchlist(),
      loadPortfolio(),
    ])
    if (watchlistData) watchlist.importJson(JSON.stringify({ items: watchlistData }))
    if (portfolioData) portfolio.importJson(JSON.stringify(portfolioData))
    syncStatus.value = '✓ 加载成功'
  } catch (e) {
    syncStatus.value = '✗ 加载失败'
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
    if (!aiStore.model && list.length > 0) aiStore.setModel(list[0].id)
    modelTestResult.value = `✓ 拉取到 ${list.length} 个模型`
  } catch (e) {
    modelTestResult.value = '✗ 拉取失败: ' + (e as Error).message
  } finally {
    modelLoading.value = false
  }
}

function onThemeChange(theme: 'light' | 'dark' | 'system') {
  settings.theme = theme
  document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches))
}

function onLocaleChange(locale: Locale) {
  settings.locale = locale
  setLocale(locale)
}

function exportData() {
  const data = {
    version: 4,
    favorites: watchlist.items,
    portfolio: { holdings: portfolio.holdings, transactions: portfolio.transactions },
    exportedAt: new Date().toISOString(),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `backup-${new Date().toISOString().slice(0,10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const fileInput = ref<HTMLInputElement | null>(null)
function importData() {
  fileInput.value?.click()
}
function onFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement)?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || '{}'))
      let count = 0
      if (Array.isArray(parsed.favorites)) {
        watchlist.importJson(JSON.stringify({ items: parsed.favorites }))
        count += parsed.favorites.length
      }
      if (parsed.portfolio) {
        portfolio.importJson(JSON.stringify(parsed.portfolio))
      }
      modelTestResult.value = `✓ 导入成功`
    } catch {
      modelTestResult.value = '✗ 导入失败'
    }
  }
  reader.readAsText(file)
}
</script>

<template>
  <div class="page settings-page">
    <h1>⚙️ 设置</h1>

    <!-- 外观 -->
    <section class="settings-section card">
      <div class="section-header">
        <span class="section-icon">🎨</span>
        <h3>外观</h3>
      </div>
      <div class="setting-row">
        <label>主题</label>
        <div class="theme-options">
          <button v-for="m in ['light', 'dark', 'system']" :key="m" 
                  :class="{ active: settings.theme === m }" 
                  @click="onThemeChange(m as any)">
            {{ m === 'light' ? '☀️ 浅色' : m === 'dark' ? '🌙 深色' : '🖥 跟随系统' }}
          </button>
        </div>
      </div>
      <div class="setting-row">
        <label>语言</label>
        <div class="theme-options">
          <button :class="{ active: settings.locale === 'zh-CN' }" @click="onLocaleChange('zh-CN')">中文</button>
          <button :class="{ active: settings.locale === 'en-US' }" @click="onLocaleChange('en-US')">English</button>
        </div>
      </div>
    </section>

    <!-- AI 配置 -->
    <section class="settings-section card">
      <div class="section-header">
        <span class="section-icon">🤖</span>
        <div>
          <h3>AI 模型</h3>
          <p class="small muted">支持 OpenAI 兼容接口</p>
        </div>
      </div>
      <div v-if="aiStore.serverManaged" class="managed-banner">
        当前 AI 由服务端托管：{{ runtimeConfig.config.ai.model }}
      </div>
      <div class="setting-row">
        <label>Base URL</label>
        <input v-model="aiStore.baseUrl" type="text" :placeholder="EXTERNAL_ENDPOINTS.openai.baseUrl" />
      </div>
      <div class="setting-row">
        <label>API Key</label>
        <input v-model="aiStore.apiKey" type="password" placeholder="sk-..." />
      </div>
      <div class="setting-row">
        <label>模型</label>
        <select v-model="aiStore.model">
          <option v-if="!aiStore.model && !allModels.length" value="">请先拉取列表</option>
          <option v-for="m in allModels" :key="m.id" :value="m.id">{{ m.id }}</option>
        </select>
      </div>
      <div class="setting-row">
        <label>Temperature</label>
        <input v-model.number="aiStore.temperature" type="number" min="0" max="2" step="0.1" />
      </div>
      <div class="setting-actions">
        <button class="btn primary" @click="saveAI">保存</button>
        <button class="btn" :disabled="modelLoading" @click="refreshModels">
          {{ modelLoading ? '拉取中...' : '拉取模型列表' }}
        </button>
        <span v-if="modelTestResult" class="test-result" :class="modelTestResult.startsWith('✓') ? 'pos' : 'neg'">
          {{ modelTestResult }}
        </span>
      </div>
    </section>

    <!-- 刷新设置 -->
    <section class="settings-section card">
      <div class="section-header">
        <span class="section-icon">🔄</span>
        <h3>自动刷新</h3>
      </div>
      <div class="setting-row">
        <label>启用自动刷新</label>
        <label class="switch">
          <input type="checkbox" :checked="settings.enabled" @change="(e) => { settings.enabled = (e.target as HTMLInputElement).checked; refresh.setEnabled((e.target as HTMLInputElement).checked) }" />
          <span class="slider"></span>
        </label>
      </div>
      <div class="setting-row">
        <label>列表刷新间隔</label>
        <select :value="settings.listInterval" @change="(e) => { settings.listInterval = Number((e.target as HTMLSelectElement).value); refresh.setListInterval(Number((e.target as HTMLSelectElement).value)) }">
          <option v-for="v in [30, 60, 120, 300]" :key="v" :value="v">{{ v }} 秒</option>
        </select>
      </div>
      <div class="setting-row">
        <label>详情刷新间隔</label>
        <select :value="settings.detailInterval" @change="(e) => { settings.detailInterval = Number((e.target as HTMLSelectElement).value); refresh.setDetailInterval(Number((e.target as HTMLSelectElement).value)) }">
          <option v-for="v in [5, 15, 30, 60]" :key="v" :value="v">{{ v }} 秒</option>
        </select>
      </div>
    </section>

    <!-- 数据同步 -->
    <section class="settings-section card">
      <div class="section-header">
        <span class="section-icon">☁️</span>
        <div>
          <h3>数据同步</h3>
          <p class="small muted">{{ userStore.isLoggedIn ? '已登录' : '登录后可同步数据' }}</p>
        </div>
      </div>
      <div v-if="userStore.isLoggedIn" class="setting-actions">
        <button class="btn" @click="syncToCloud">☁️ 同步到云端</button>
        <button class="btn" @click="loadFromCloud">📥 从云端加载</button>
        <span v-if="syncStatus" class="status-msg" :class="syncStatus.startsWith('✓') ? 'pos' : 'neg'">
          {{ syncStatus }}
        </span>
      </div>
      <div v-else>
        <router-link to="/user" class="btn primary">前往登录</router-link>
      </div>
    </section>

    <!-- 数据管理 -->
    <section class="settings-section card">
      <div class="section-header">
        <span class="section-icon">💾</span>
        <h3>数据管理</h3>
      </div>
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-value">{{ quotes.quotes.size }}</span>
          <span class="stat-label small muted">报价缓存</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ watchlist.items.length }}</span>
          <span class="stat-label small muted">自选股</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ portfolio.holdings.length }}</span>
          <span class="stat-label small muted">持仓</span>
        </div>
      </div>
      <div class="setting-actions">
        <button class="btn" @click="exportData">📤 导出数据</button>
        <button class="btn" @click="importData">📥 导入数据</button>
        <input ref="fileInput" type="file" accept=".json" style="display:none" @change="onFileSelected" />
      </div>
    </section>

    <!-- 环境变量 -->
    <section class="settings-section card">
      <div class="section-header">
        <span class="section-icon">🔧</span>
        <h3>服务配置</h3>
      </div>
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
            {{ runtimeConfig.config.ai?.configured ? '✓ 已配置' : '✗ 未配置' }}
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
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 560px;
  margin: 0 auto;
  padding-bottom: var(--space-6);
}

.settings-page h1 {
  margin: 0 0 var(--space-4);
  padding: var(--space-4) 0;
}

.settings-section {
  padding: var(--space-4);
  margin-bottom: var(--space-4);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.section-icon {
  font-size: 24px;
}

.section-header h3 {
  margin: 0;
  font-size: var(--fs-base);
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-row label {
  font-size: var(--fs-sm);
  font-weight: 500;
  flex-shrink: 0;
}

.setting-row input[type="text"],
.setting-row input[type="password"],
.setting-row input[type="number"],
.setting-row select {
  flex: 1;
  max-width: 280px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
  font-size: var(--fs-sm);
}

.theme-options {
  display: flex;
  gap: var(--space-2);
}

.theme-options button {
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-muted);
  font-size: var(--fs-sm);
  cursor: pointer;
}

.theme-options button.active {
  background: var(--color-info-bg);
  border-color: var(--color-link);
  color: var(--color-link);
  font-weight: 600;
}

.setting-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-top: var(--space-3);
  flex-wrap: wrap;
}

.test-result,
.status-msg {
  font-size: var(--fs-sm);
  font-weight: 600;
}

.managed-banner {
  padding: var(--space-2) var(--space-3);
  background: var(--color-info-bg);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  margin-bottom: var(--space-3);
}

/* 开关 */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-border);
  border-radius: 12px;
  transition: 0.3s;
}

.slider:before {
  content: "";
  position: absolute;
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background: white;
  border-radius: 50%;
  transition: 0.3s;
}

input:checked + .slider {
  background: var(--color-link);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

/* 统计 */
.stats-row {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  margin-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: var(--fs-xl);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* 环境变量 */
.env-grid {
  display: grid;
  gap: var(--space-2);
}

.env-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.env-item:last-child {
  border-bottom: none;
}

.env-label {
  font-size: var(--fs-sm);
  color: var(--color-muted);
}

.env-value {
  font-size: var(--fs-sm);
  font-weight: 600;
}

.pos { color: var(--color-up); }
.neg { color: var(--color-down); }

@media (max-width: 640px) {
  .settings-page {
    padding-bottom: calc(60px + var(--space-4));
  }
  
  .settings-page h1 {
    font-size: var(--fs-xl);
    padding: var(--space-3) 0;
  }
  
  .setting-row {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }
  
  .setting-row label {
    font-size: var(--fs-sm);
  }
  
  .setting-row input[type="text"],
  .setting-row input[type="password"],
  .setting-row input[type="number"],
  .setting-row select {
    max-width: 100%;
    width: 100%;
  }
  
  .theme-options {
    flex-wrap: wrap;
  }
  
  .theme-options button {
    flex: 1;
    min-width: 80px;
    text-align: center;
  }
  
  .setting-actions {
    flex-direction: column;
    align-items: stretch;
  }
  
  .setting-actions .btn {
    width: 100%;
    justify-content: center;
  }
  
  .stats-row {
    justify-content: space-around;
  }
  
  .env-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-1);
  }
}

@media (max-width: 375px) {
  .settings-section {
    padding: var(--space-3);
  }
  
  .section-header {
    gap: var(--space-2);
  }
  
  .section-icon {
    font-size: 20px;
  }
}
</style>
