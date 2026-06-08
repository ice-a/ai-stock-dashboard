<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAccountStore } from '../stores/account'
import { useAIStore } from '../stores/ai'
import { usePortfolioStore } from '../stores/portfolio'
import { useQuotesStore } from '../stores/quotes'
import { useSectorStore } from '../stores/sector'
import { useSettingsStore } from '../stores/settings'
import { useWatchlistStore } from '../stores/watchlist'
import { formatPercent, formatPrice, quoteTone } from '../utils/format'
import { loadPersonalConfigFromCloud, savePersonalConfigToCloud } from '../utils/personalConfig'

const router = useRouter()
const account = useAccountStore()
const settings = useSettingsStore()
const ai = useAIStore()
const watchlist = useWatchlistStore()
const portfolio = usePortfolioStore()
const sector = useSectorStore()
const quotes = useQuotesStore()

const syncing = ref(false)
const syncResult = ref('')

const identity = computed(() => {
  if (account.authenticated && account.user) return account.user
  if (account.guest) return '游客'
  return account.enabled ? '未登录' : '本地'
})

const storageMode = computed(() => account.authenticated ? 'MongoDB' : '本机浏览器')
const authMode = computed(() => account.authenticated ? '账户' : (account.guest ? '游客' : '本地'))
const canLoginAccount = computed(() => account.enabled && !account.authenticated)
const canLogout = computed(() => account.authenticated || account.guest)
const aiKeyState = computed(() => {
  if (ai.serverManaged) return '服务端托管'
  return ai.apiKey ? '已配置' : '未配置'
})

const statCards = computed(() => [
  { label: '自选股', value: `${watchlist.items.length}` },
  { label: '持仓', value: `${portfolio.holdings.length}` },
  { label: '自定义板块', value: `${sector.customSectors.length}` },
  { label: '报价缓存', value: `${quotes.quotes.size}` },
])

const configRows = computed(() => [
  { key: '用户名', value: identity.value },
  { key: '身份', value: authMode.value },
  { key: '存储', value: storageMode.value },
  { key: '主题', value: settings.theme },
  { key: '语言', value: settings.locale },
  { key: '刷新', value: settings.enabled ? '开启' : '关闭' },
  { key: '列表刷新', value: `${settings.listInterval}s` },
  { key: '详情刷新', value: `${settings.detailInterval}s` },
  { key: 'AI Base URL', value: ai.baseUrl || '未配置' },
  { key: 'AI Key', value: aiKeyState.value },
  { key: 'AI 模型', value: ai.model || '未配置' },
  { key: 'Temperature', value: `${ai.temperature}` },
  { key: 'Max Tokens', value: `${ai.maxTokens}` },
])

const favoriteRows = computed(() => watchlist.items.map(item => ({
  ...item,
  quote: quotes.get(item.symbol),
})))

async function saveCloudConfig() {
  if (!account.authenticated) {
    syncResult.value = '请先登录账户'
    return
  }
  syncing.value = true
  syncResult.value = '保存中...'
  try {
    const updatedAt = await savePersonalConfigToCloud()
    syncResult.value = updatedAt ? `已保存 ${new Date(updatedAt).toLocaleString()}` : '已保存'
  } catch (e) {
    syncResult.value = (e as Error).message
  } finally {
    syncing.value = false
  }
}

async function loadCloudConfig() {
  if (!account.authenticated) {
    syncResult.value = '请先登录账户'
    return
  }
  syncing.value = true
  syncResult.value = '载入中...'
  try {
    const result = await loadPersonalConfigFromCloud()
    syncResult.value = result.loaded ? `已载入 ${result.applied.join('、') || '配置'}` : '云端无配置'
  } catch (e) {
    syncResult.value = (e as Error).message
  } finally {
    syncing.value = false
  }
}

async function logout() {
  await account.logout()
  router.push('/login')
}
</script>

<template>
  <div class="page user-page">
    <div class="topbar">
      <h1>用户信息</h1>
      <div class="actions">
        <button v-if="account.authenticated" class="btn primary" :disabled="syncing" @click="saveCloudConfig">
          <span v-if="syncing" class="spinner"></span>
          保存配置
        </button>
        <button v-if="account.authenticated" class="btn" :disabled="syncing" @click="loadCloudConfig">载入配置</button>
        <router-link v-if="canLoginAccount" to="/login" class="btn primary">账户登录</router-link>
        <button v-if="canLogout" class="btn ghost" @click="logout">{{ account.guest ? '退出游客' : '退出' }}</button>
      </div>
    </div>

    <section class="identity-strip">
      <div>
        <span class="small muted">用户名</span>
        <strong>{{ identity }}</strong>
      </div>
      <div>
        <span class="small muted">身份</span>
        <strong>{{ authMode }}</strong>
      </div>
      <div>
        <span class="small muted">存储</span>
        <strong>{{ storageMode }}</strong>
      </div>
      <div v-if="syncResult">
        <span class="small muted">同步</span>
        <strong>{{ syncResult }}</strong>
      </div>
    </section>

    <section class="stat-grid">
      <div v-for="item in statCards" :key="item.label" class="stat-card">
        <span class="small muted">{{ item.label }}</span>
        <strong>{{ item.value }}</strong>
      </div>
    </section>

    <section class="section">
      <h2>自选股</h2>
      <div class="table-wrap">
        <table v-if="favoriteRows.length">
          <thead>
            <tr>
              <th>代码</th>
              <th>分组</th>
              <th>价格</th>
              <th>涨跌</th>
              <th>目标价</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in favoriteRows" :key="item.symbol">
              <td><router-link :to="`/stock/${item.symbol}`">{{ item.symbol }}</router-link></td>
              <td>{{ item.group }}</td>
              <td>{{ formatPrice(item.quote?.price, item.quote?.currency) }}</td>
              <td :class="quoteTone(item.quote?.change)">{{ formatPercent(item.quote?.change) }}</td>
              <td>{{ formatPrice(item.targetPrice) }}</td>
              <td>{{ item.note || '—' }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">暂无自选股</div>
      </div>
    </section>

    <section class="section">
      <h2>配置</h2>
      <div class="config-grid">
        <div v-for="row in configRows" :key="row.key" class="config-row">
          <span class="small muted">{{ row.key }}</span>
          <strong>{{ row.value }}</strong>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.user-page { display: flex; flex-direction: column; gap: var(--space-4); }
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.topbar h1 { margin: 0; }
.actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.identity-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(140px, 1fr));
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}
.identity-strip > div,
.stat-card,
.config-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.identity-strip strong,
.config-row strong {
  overflow-wrap: anywhere;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: var(--space-2);
}
.stat-card {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}
.stat-card strong { font-size: var(--fs-xl); }
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.section h2 {
  margin: 0;
  font-size: var(--fs-lg);
}
.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}
table {
  width: 100%;
  border-collapse: collapse;
  min-width: 720px;
}
th,
td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  white-space: nowrap;
}
td:last-child { white-space: normal; min-width: 180px; }
tbody tr:last-child td { border-bottom: 0; }
.config-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(160px, 1fr));
  gap: var(--space-2);
}
.config-row {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}
.empty {
  padding: var(--space-5);
  color: var(--color-muted);
}
.pos { color: var(--color-up); }
.neg { color: var(--color-down); }
.flat { color: var(--color-muted); }
.spinner {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 4px;
}
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 760px) {
  .identity-strip,
  .stat-grid,
  .config-grid {
    grid-template-columns: 1fr;
  }
}
</style>
