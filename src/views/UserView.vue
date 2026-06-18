<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import UserAuth from '../components/UserAuth.vue'

const router = useRouter()
const userStore = useUserStore()

const editing = ref(false)
const nickname = ref(userStore.user?.nickname || '')
const avatarUrl = ref(userStore.user?.avatarUrl || '')
const saving = ref(false)
const saveStatus = ref<string | null>(null)
const avatarError = ref(false)

// 长桥配置
const lbAppKey = ref(userStore.user?.longbridgeConfig?.appKey || '')
const lbAppSecret = ref(userStore.user?.longbridgeConfig?.appSecret || '')
const lbAccessToken = ref(userStore.user?.longbridgeConfig?.accessToken || '')
const lbSaving = ref(false)
const lbTesting = ref(false)
const lbStatus = ref<string | null>(null)

// 数据源
const dataSource = ref(userStore.user?.dataSource || 'auto')

// 测试行情连接
async function testLongbridge() {
  lbTesting.value = true
  lbStatus.value = null
  
  try {
    // 先保存配置
    await userStore.updateLongbridgeConfig({
      appKey: lbAppKey.value,
      appSecret: lbAppSecret.value,
      accessToken: lbAccessToken.value,
    })
    
    // 测试获取行情
    const { sourceManager } = await import('../api/sourceManager')
    const testSymbol = '600519.SH' // 茅台
    const quote = await sourceManager.fetchQuote(testSymbol, { preferred: ['longport-cn'] })
    
    if (quote && quote.price) {
      lbStatus.value = `✓ 连接成功！茅台当前价：${quote.price}`
    } else {
      lbStatus.value = '✗ 连接失败，请检查配置'
    }
  } catch (e) {
    lbStatus.value = '✗ 连接失败: ' + (e as Error).message
  } finally {
    lbTesting.value = false
    setTimeout(() => { lbStatus.value = null }, 5000)
  }
}

// 头像显示
const avatarDisplay = computed(() => {
  if (avatarUrl.value && !avatarError.value) {
    return avatarUrl.value
  }
  return null
})

const avatarInitial = computed(() => {
  if (!userStore.user) return '?'
  return userStore.user.nickname?.[0]?.toUpperCase() || userStore.user.userId[0].toUpperCase()
})

// 图片加载失败
function onAvatarError() {
  avatarError.value = true
}

// 保存个人信息
async function saveProfile() {
  if (!userStore.user) return
  
  saving.value = true
  saveStatus.value = null
  
  try {
    await userStore.updateProfile({
      nickname: nickname.value,
      avatarUrl: avatarUrl.value,
    })
    
    saveStatus.value = '✓ 保存成功'
    editing.value = false
    avatarError.value = false
  } catch (e) {
    saveStatus.value = '✗ 保存失败: ' + (e as Error).message
  } finally {
    saving.value = false
    setTimeout(() => { saveStatus.value = null }, 3000)
  }
}

// 保存长桥配置
async function saveLongbridgeConfig() {
  lbSaving.value = true
  lbStatus.value = null
  
  try {
    await userStore.updateLongbridgeConfig({
      appKey: lbAppKey.value,
      appSecret: lbAppSecret.value,
      accessToken: lbAccessToken.value,
    })
    
    lbStatus.value = '✓ 长桥配置已保存'
  } catch (e) {
    lbStatus.value = '✗ 保存失败: ' + (e as Error).message
  } finally {
    lbSaving.value = false
    setTimeout(() => { lbStatus.value = null }, 3000)
  }
}

// 保存数据源
async function saveDataSource() {
  try {
    await userStore.updateDataSource(dataSource.value as any)
  } catch (e) {
    console.error('Failed to save data source:', e)
  }
}

// 退出登录
function handleLogout() {
  userStore.logout()
  router.push('/')
}

// 开始编辑
function startEdit() {
  nickname.value = userStore.user?.nickname || ''
  avatarUrl.value = userStore.user?.avatarUrl || ''
  avatarError.value = false
  editing.value = true
}
</script>

<template>
  <div class="page user-page">
    <!-- 未登录状态 -->
    <div v-if="!userStore.isLoggedIn" class="auth-container">
      <div class="auth-header">
        <h1>👤 用户中心</h1>
        <p class="muted">登录或注册以同步您的数据</p>
      </div>
      <UserAuth />
    </div>

    <!-- 已登录状态 -->
    <div v-else class="profile-container">
      <header class="profile-header">
        <h1>👤 用户中心</h1>
      </header>

      <!-- 用户卡片 -->
      <section class="user-card card">
        <div class="avatar-section">
          <div class="avatar-large">
            <img 
              v-if="avatarDisplay" 
              :src="avatarDisplay" 
              :alt="nickname"
              @error="onAvatarError"
            />
            <span v-else class="avatar-fallback">{{ avatarInitial }}</span>
          </div>
        </div>

        <div class="user-info">
          <div v-if="!editing" class="info-display">
            <h2 class="user-name">{{ userStore.user?.nickname || userStore.user?.userId }}</h2>
            <p class="user-id muted">ID: {{ userStore.user?.userId }}</p>
            <button class="btn" @click="startEdit">编辑资料</button>
          </div>

          <div v-else class="info-edit">
            <div class="form-group">
              <label>昵称</label>
              <input v-model="nickname" type="text" placeholder="输入昵称" />
            </div>
            <div class="form-group">
              <label>头像链接</label>
              <input v-model="avatarUrl" type="url" placeholder="https://example.com/avatar.jpg" />
              <span class="form-hint small muted">输入图片URL地址，留空使用首字母头像</span>
            </div>
            <div v-if="avatarUrl" class="avatar-preview">
              <span class="small muted">预览：</span>
              <img 
                :src="avatarUrl" 
                alt="头像预览" 
                @error="onAvatarError"
                class="preview-img"
              />
              <span v-if="avatarError" class="error-text small">图片加载失败</span>
            </div>
            <div class="edit-actions">
              <button class="btn primary" @click="saveProfile" :disabled="saving">
                <span v-if="saving" class="spinner"></span>
                {{ saving ? '保存中...' : '保存' }}
              </button>
              <button class="btn ghost" @click="editing = false">取消</button>
            </div>
          </div>

          <div v-if="saveStatus" class="save-status" :class="saveStatus.startsWith('✓') ? 'pos' : 'neg'">
            {{ saveStatus }}
          </div>
        </div>
      </section>

      <!-- API 调用次数 -->
      <section class="api-section card">
        <h3>🤖 AI 调用次数</h3>
        <div class="api-stats">
          <div class="api-remaining">
            <span class="api-count" :class="{ low: userStore.apiCallsRemaining < 20 }">
              {{ userStore.apiCallsRemaining }}
            </span>
            <span class="api-label small muted">剩余次数</span>
          </div>
          <div class="api-bar">
            <div 
              class="api-fill" 
              :style="{ width: `${(userStore.apiCallsRemaining / 100) * 100}%` }"
              :class="{ low: userStore.apiCallsRemaining < 20 }"
            ></div>
          </div>
        </div>
        <p class="small muted">每次使用 AI 分析功能会消耗 1 次调用次数</p>
      </section>

      <!-- 账户信息 -->
      <section class="info-section card">
        <h3>账户信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">用户ID</span>
            <span class="info-value">{{ userStore.user?.userId }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">密钥</span>
            <span class="info-value">••••••••</span>
          </div>
          <div class="info-item">
            <span class="info-label">注册时间</span>
            <span class="info-value">{{ userStore.user?.createdAt ? new Date(userStore.user.createdAt).toLocaleDateString('zh-CN') : '—' }}</span>
          </div>
        </div>
      </section>

      <!-- 数据源配置 -->
      <section class="datasource-section card">
        <h3>📊 数据源配置</h3>
        <p class="small muted">选择获取股票数据的渠道</p>
        <div class="form-group">
          <label>数据源</label>
          <select v-model="dataSource" @change="saveDataSource">
            <option value="auto">自动选择（推荐）</option>
            <option value="eastmoney">东方财富</option>
            <option value="sina">新浪财经</option>
            <option value="longport-cn">长桥中国（推荐）</option>
            <option value="longport">长桥国际</option>
          </select>
        </div>
      </section>

      <!-- 长桥配置 -->
      <section class="longbridge-section card">
        <h3>🔗 长桥 API 配置</h3>
        <p class="small muted">配置长桥 API 凭证以获取更稳定的行情数据</p>
        <div class="form-group">
          <label>App Key</label>
          <input v-model="lbAppKey" type="text" placeholder="输入长桥 App Key" />
        </div>
        <div class="form-group">
          <label>App Secret</label>
          <input v-model="lbAppSecret" type="password" placeholder="输入长桥 App Secret" />
        </div>
        <div class="form-group">
          <label>Access Token</label>
          <input v-model="lbAccessToken" type="password" placeholder="输入长桥 Access Token" />
        </div>
        <div class="form-actions">
          <button class="btn primary" @click="saveLongbridgeConfig" :disabled="lbSaving">
            <span v-if="lbSaving" class="spinner"></span>
            {{ lbSaving ? '保存中...' : '保存配置' }}
          </button>
          <button class="btn" @click="testLongbridge" :disabled="lbTesting">
            <span v-if="lbTesting" class="spinner"></span>
            {{ lbTesting ? '测试中...' : '🔗 测试连接' }}
          </button>
          <span v-if="lbStatus" class="status-msg" :class="lbStatus.startsWith('✓') ? 'pos' : 'neg'">
            {{ lbStatus }}
          </span>
        </div>
      </section>

      <!-- 数据同步 -->
      <section class="sync-section card">
        <h3>☁️ 数据同步</h3>
        <p class="small muted">登录后可将自选股、持仓等数据同步到云端，在多设备间共享。</p>
        <div class="sync-actions">
          <button class="btn" @click="$router.push('/settings')">
            ⚙️ 前往设置同步
          </button>
        </div>
      </section>

      <!-- 危险操作 -->
      <section class="danger-section card">
        <h3>账户操作</h3>
        <button class="btn danger" @click="handleLogout">
          退出登录
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.user-page {
  max-width: 600px;
  margin: 0 auto;
}

.auth-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.auth-header {
  text-align: center;
  padding: var(--space-4) 0;
}

.auth-header h1 {
  margin: 0 0 var(--space-2);
}

.profile-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.profile-header {
  padding: var(--space-4) 0;
}

.profile-header h1 {
  margin: 0;
}

.user-card {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-4);
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.avatar-large {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-info-bg);
}

.avatar-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-link);
}

.user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.info-display {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.user-name {
  margin: 0;
  font-size: var(--fs-xl);
}

.user-id {
  font-size: var(--fs-sm);
  font-family: var(--font-mono);
}

.info-edit {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-group label {
  font-size: var(--fs-sm);
  font-weight: 600;
}

.form-group input,
.form-group select {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
  font-size: var(--fs-base);
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-link);
  box-shadow: 0 0 0 2px var(--color-info-bg);
}

.form-hint {
  font-size: var(--fs-xs);
}

.edit-actions,
.form-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.avatar-preview {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--color-bg-muted);
  border-radius: var(--radius-sm);
}

.preview-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.error-text {
  color: var(--color-down);
}

.save-status,
.status-msg {
  font-size: var(--fs-sm);
  font-weight: 600;
}

/* API 调用次数 */
.api-section {
  padding: var(--space-4);
}

.api-section h3 {
  margin: 0 0 var(--space-3);
}

.api-stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.api-remaining {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.api-count {
  font-size: var(--fs-3xl);
  font-weight: 800;
  color: var(--color-up);
}

.api-count.low {
  color: var(--color-down);
}

.api-label {
  font-size: var(--fs-sm);
}

.api-bar {
  height: 8px;
  background: var(--color-bg-muted);
  border-radius: 4px;
  overflow: hidden;
}

.api-fill {
  height: 100%;
  background: var(--color-up);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.api-fill.low {
  background: var(--color-down);
}

/* 数据源配置 */
.datasource-section,
.longbridge-section {
  padding: var(--space-4);
}

.datasource-section h3,
.longbridge-section h3 {
  margin: 0 0 var(--space-2);
}

/* 其他部分 */
.info-section,
.sync-section,
.danger-section {
  padding: var(--space-4);
}

.info-section h3,
.sync-section h3,
.danger-section h3 {
  margin: 0 0 var(--space-3);
  font-size: var(--fs-lg);
}

.info-grid {
  display: grid;
  gap: var(--space-3);
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-size: var(--fs-sm);
  color: var(--color-muted);
}

.info-value {
  font-size: var(--fs-sm);
  font-weight: 600;
  font-family: var(--font-mono);
}

.sync-actions {
  display: flex;
  gap: var(--space-2);
}

.danger-section {
  border-color: rgba(239, 68, 68, 0.3);
}

.btn.danger {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-down);
  border-color: rgba(239, 68, 68, 0.3);
}

.btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
}

.pos { color: var(--color-up); }
.neg { color: var(--color-down); }

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: var(--space-2);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  .user-card {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  
  .info-display {
    align-items: center;
  }
  
  .edit-actions,
  .form-actions {
    justify-content: center;
  }
}
</style>
