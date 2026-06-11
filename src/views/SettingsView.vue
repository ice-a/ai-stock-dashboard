<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '../stores/settings'
import { useRefreshStore } from '../stores/refresh'
import { useQuotesStore } from '../stores/quotes'
import { useWatchlistStore } from '../stores/watchlist'
import { usePortfolioStore } from '../stores/portfolio'
import { useSectorStore } from '../stores/sector'
import { useAIStore } from '../stores/ai'
import { useNotificationsStore } from '../stores/notifications'
import { useRuntimeConfigStore } from '../stores/runtimeConfig'
import { useAccountStore } from '../stores/account'
import { useSubscriptionStore } from '../stores/subscription'
import { listModels, type ModelInfo } from '../api/ai'
import { EXTERNAL_ENDPOINTS } from '../config/endpoints'
import { setLocale, type Locale } from '../i18n'
import { loadPersonalConfigFromCloud, savePersonalConfigToCloud } from '../utils/personalConfig'

const { t } = useI18n()
const settings = useSettingsStore()
const refresh = useRefreshStore()
const quotes = useQuotesStore()
const watchlist = useWatchlistStore()
const portfolio = usePortfolioStore()
const sectorStore = useSectorStore()
const aiStore = useAIStore()
const notifications = useNotificationsStore()
const runtimeConfig = useRuntimeConfigStore()
const accountStore = useAccountStore()
const subscriptionStore = useSubscriptionStore()

// ============ AI 模型配置 ============
const modelList = ref<ModelInfo[]>([])
const modelLoading = ref(false)
const modelTestResult = ref<string | null>(null)
const cloudSyncing = ref(false)
const cloudSyncResult = ref<string | null>(null)
const notificationResult = ref<string | null>(null)

// 合并当前拉取的模型和已保存的模型列表
const allModels = computed(() => {
  const map = new Map<string, ModelInfo>()
  for (const m of aiStore.availableModels) map.set(m.id, m)
  for (const m of modelList.value) map.set(m.id, m)
  return [...map.values()]
})

const accountName = computed(() => {
  if (accountStore.authenticated && accountStore.user) return accountStore.user
  if (accountStore.guest) return '游客'
  return accountStore.enabled ? '未登录' : '本地'
})

const accountStorage = computed(() => accountStore.authenticated ? 'MongoDB' : '本机浏览器')

onMounted(() => {
  // 初始模型列表：有凭证就尝试拉取
  if (aiStore.hasCredentials) {
    refreshModels()
  }
  accountStore.refresh({ timeoutMs: 2000 })
})

function saveAI() {
  aiStore.save()
  modelTestResult.value = '✓ 已保存'
}

function saveNotifications() {
  notifications.save()
  notificationResult.value = '✓ 已保存'
}

async function testNotifications() {
  notifications.save()
  notificationResult.value = '正在发送测试通知…'
  const ok = await notifications.test()
  notificationResult.value = ok ? '✓ 测试通知已发送' : `✗ ${notifications.config.lastError || '发送失败'}`
}

async function saveCloudConfig() {
  if (!accountStore.authenticated) {
    cloudSyncResult.value = '✗ 请先登录账户'
    return
  }
  cloudSyncing.value = true
  cloudSyncResult.value = '正在保存个人配置…'
  try {
    const updatedAt = await savePersonalConfigToCloud()
    cloudSyncResult.value = `✓ 已保存到 MongoDB${updatedAt ? ` · ${new Date(updatedAt).toLocaleString()}` : ''}`
  } catch (e) {
    cloudSyncResult.value = `✗ ${(e as Error).message}`
  } finally {
    cloudSyncing.value = false
  }
}

async function loadCloudConfig() {
  if (!accountStore.authenticated) {
    cloudSyncResult.value = '✗ 请先登录账户'
    return
  }
  cloudSyncing.value = true
  cloudSyncResult.value = '正在载入个人配置…'
  try {
    const result = await loadPersonalConfigFromCloud()
    if (!result.loaded) {
      cloudSyncResult.value = '未找到云端配置，当前本地配置保持不变。'
      return
    }
    cloudSyncResult.value = `✓ 已载入：${result.applied.join('、') || '配置'}${result.updatedAt ? ` · ${new Date(result.updatedAt).toLocaleString()}` : ''}`
  } catch (e) {
    cloudSyncResult.value = `✗ ${(e as Error).message}`
  } finally {
    cloudSyncing.value = false
  }
}

async function logoutAccount() {
  await accountStore.logout()
  window.location.href = '/login'
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
    version: 3,
    settings: settings.exportJson() ? JSON.parse(settings.exportJson()).settings : null,
    sectors: JSON.parse(sectorStore.exportJson()),
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
      if (parsed.sectors) {
        const result = sectorStore.importJson(JSON.stringify(parsed.sectors))
        messages.push(`板块新增 ${result.added} / 合并 ${result.merged}`)
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

    <section v-if="accountStore.authenticated" class="card section subscription-banner">
      <div class="sub-info">
        <span class="sub-label">当前订阅</span>
        <span class="sub-tier" :class="subscriptionStore.tier">{{ subscriptionStore.currentPlan.name }}</span>
        <span v-if="subscriptionStore.isPaid && subscriptionStore.daysRemaining != null" class="sub-remaining">
          剩余 {{ subscriptionStore.daysRemaining }} 天
        </span>
        <span v-if="!subscriptionStore.isPaid" class="sub-usage">
          今日 AI: {{ subscriptionStore.usageLimits.aiRequestsUsed }}/5
        </span>
      </div>
      <router-link to="/subscription" class="btn sm">
        {{ subscriptionStore.isPaid ? '管理订阅' : '升级 Pro' }}
      </router-link>
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
        <span>自定义板块：{{ sectorStore.customSectors.length }} 个</span>
      </div>
    </section>

    <section class="card section">
      <h2>Webhook 通知</h2>
      <p class="small muted">当前支持 Bark；预警触发时会发送通知，后续可扩展其他 webhook provider。</p>
      <div class="form-row">
        <label class="switch">
          <input v-model="notifications.config.enabled" type="checkbox" />
          <span>启用通知</span>
        </label>
      </div>
      <div class="form-row">
        <label class="lbl small muted">Provider</label>
        <select v-model="notifications.config.provider">
          <option value="bark">Bark</option>
        </select>
      </div>
      <div class="form-row">
        <label class="lbl small muted">Bark Server</label>
        <input v-model="notifications.config.bark.serverUrl" type="text" placeholder="https://api.day.app" class="grow" />
      </div>
      <div class="form-row">
        <label class="lbl small muted">Device Key</label>
        <input v-model="notifications.config.bark.deviceKey" type="password" placeholder="Bark 推送 key" class="grow" />
      </div>
      <div class="form-row">
        <label class="lbl small muted">分组</label>
        <input v-model="notifications.config.bark.group" type="text" placeholder="AI Stock Dashboard" />
        <label class="lbl small muted">级别</label>
        <select v-model="notifications.config.bark.level">
          <option value="active">active</option>
          <option value="timeSensitive">timeSensitive</option>
          <option value="passive">passive</option>
        </select>
      </div>
      <div class="form-row">
        <label class="lbl small muted">声音</label>
        <input v-model="notifications.config.bark.sound" type="text" placeholder="可选，如 glass" />
      </div>
      <div class="form-row">
        <button class="btn primary" @click="saveNotifications">保存通知配置</button>
        <button class="btn" :disabled="notifications.sending || !notifications.config.bark.deviceKey" @click="testNotifications">
          <span v-if="notifications.sending" class="spinner"></span>
          发送测试
        </button>
        <span v-if="notificationResult" class="test-result small" :class="notificationResult.startsWith('✓') ? 'pos' : 'neg'">{{ notificationResult }}</span>
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
.subscription-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, var(--color-info-bg), var(--color-bg-elevated));
}
.sub-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.sub-label { font-size: var(--fs-sm); color: var(--color-muted); }
.sub-tier {
  padding: 2px 10px;
  border-radius: 999px;
  font-size: var(--fs-xs);
  font-weight: 700;
}
.sub-tier.free { background: var(--color-bg-muted); color: var(--color-muted); }
.sub-tier.pro { background: var(--color-link-bg); color: var(--color-link); }
.sub-tier.team { background: var(--color-purple-bg, var(--color-link-bg)); color: var(--color-purple, var(--color-link)); }
.sub-remaining, .sub-usage {
  font-size: var(--fs-xs);
  color: var(--color-muted);
}
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
.account-panel { display: flex; flex-direction: column; gap: var(--space-3); }
.account-grid { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: var(--space-2); }
.account-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-soft);
}
.account-meta strong { overflow-wrap: anywhere; }
.stats-row { display: flex; gap: var(--space-4); flex-wrap: wrap; padding-top: var(--space-2); border-top: 1px solid var(--color-border); }
details summary { cursor: pointer; padding: 4px 0; }
.spinner {
  display: inline-block; width: 10px; height: 10px;
  border: 2px solid currentColor; border-right-color: transparent;
  border-radius: 50%; animation: spin 0.8s linear infinite;
  margin-right: 4px;
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) {
  .account-grid { grid-template-columns: 1fr 1fr; }
}
</style>
