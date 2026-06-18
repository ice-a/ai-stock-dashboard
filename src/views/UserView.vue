<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import UserAuth from '../components/UserAuth.vue'

const router = useRouter()
const userStore = useUserStore()

// 编辑状态
const editing = ref(false)
const nickname = ref('')
const avatarUrl = ref('')
const saving = ref(false)
const saveStatus = ref<string | null>(null)
const avatarError = ref(false)

// 长桥配置
const lbAppKey = ref('')
const lbAppSecret = ref('')
const lbAccessToken = ref('')
const lbSaving = ref(false)
const lbTesting = ref(false)
const lbStatus = ref<string | null>(null)

// 数据源
const dataSource = ref('auto')

// 头像显示
const avatarDisplay = computed(() => {
  if (avatarUrl.value && !avatarError.value) return avatarUrl.value
  return null
})

const avatarInitial = computed(() => {
  if (!userStore.user) return '?'
  return userStore.user.nickname?.[0]?.toUpperCase() || userStore.user.userId[0].toUpperCase()
})

// 初始化
onMounted(() => {
  if (userStore.user) {
    nickname.value = userStore.user.nickname || ''
    avatarUrl.value = userStore.user.avatarUrl || ''
    dataSource.value = userStore.user.dataSource || 'auto'
    if (userStore.user.longbridgeConfig) {
      lbAppKey.value = userStore.user.longbridgeConfig.appKey || ''
      lbAppSecret.value = userStore.user.longbridgeConfig.appSecret || ''
      lbAccessToken.value = userStore.user.longbridgeConfig.accessToken || ''
    }
  }
})

function onAvatarError() {
  avatarError.value = true
}

function startEdit() {
  nickname.value = userStore.user?.nickname || ''
  avatarUrl.value = userStore.user?.avatarUrl || ''
  avatarError.value = false
  editing.value = true
}

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
    saveStatus.value = '✗ 保存失败'
  } finally {
    saving.value = false
    setTimeout(() => { saveStatus.value = null }, 3000)
  }
}

async function saveLongbridgeConfig() {
  lbSaving.value = true
  lbStatus.value = null
  
  try {
    await userStore.updateLongbridgeConfig({
      appKey: lbAppKey.value,
      appSecret: lbAppSecret.value,
      accessToken: lbAccessToken.value,
    })
    lbStatus.value = '✓ 配置已保存'
  } catch (e) {
    lbStatus.value = '✗ 保存失败'
  } finally {
    lbSaving.value = false
    setTimeout(() => { lbStatus.value = null }, 3000)
  }
}

async function testLongbridge() {
  lbTesting.value = true
  lbStatus.value = null
  
  try {
    await userStore.updateLongbridgeConfig({
      appKey: lbAppKey.value,
      appSecret: lbAppSecret.value,
      accessToken: lbAccessToken.value,
    })
    
    const { sourceManager } = await import('../api/sourceManager')
    const quote = await sourceManager.fetchQuote('600519.SH', { preferred: ['longport-cn'] })
    
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

async function saveDataSource() {
  await userStore.updateDataSource(dataSource.value as any)
}

function handleLogout() {
  userStore.logout()
  router.push('/')
}
</script>

<template>
  <div class="page user-page">
    <!-- 未登录 -->
    <div v-if="!userStore.isLoggedIn" class="auth-container">
      <div class="auth-hero">
        <div class="hero-icon">👤</div>
        <h1>用户中心</h1>
        <p class="muted">登录后可同步数据、使用 AI 分析功能</p>
      </div>
      <UserAuth />
    </div>

    <!-- 已登录 -->
    <div v-else class="profile-container">
      <!-- 用户卡片 -->
      <section class="user-hero card">
        <div class="hero-bg"></div>
        <div class="hero-content">
          <div class="avatar-wrapper">
            <div class="avatar-large">
              <img v-if="avatarDisplay" :src="avatarDisplay" :alt="nickname" @error="onAvatarError" />
              <span v-else class="avatar-fallback">{{ avatarInitial }}</span>
            </div>
            <button class="avatar-edit-btn" @click="startEdit" title="编辑资料">✏️</button>
          </div>
          <div class="user-meta">
            <h2>{{ userStore.user?.nickname || userStore.user?.userId }}</h2>
            <p class="user-id">ID: {{ userStore.user?.userId }}</p>
          </div>
        </div>
      </section>

      <!-- 编辑弹窗 -->
      <Teleport to="body">
        <div v-if="editing" class="modal-overlay" @click.self="editing = false">
          <div class="modal">
            <div class="modal-header">
              <h3>编辑资料</h3>
              <button class="modal-close" @click="editing = false">×</button>
            </div>
            <div class="modal-body">
              <div class="form-group">
                <label>昵称</label>
                <input v-model="nickname" type="text" placeholder="输入昵称" />
              </div>
              <div class="form-group">
                <label>头像链接</label>
                <input v-model="avatarUrl" type="url" placeholder="https://example.com/avatar.jpg" />
                <span class="form-hint">输入图片URL，留空使用首字母头像</span>
              </div>
              <div v-if="avatarUrl" class="avatar-preview">
                <span>预览：</span>
                <img :src="avatarUrl" @error="onAvatarError" class="preview-img" />
                <span v-if="avatarError" class="error-text">图片加载失败</span>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn ghost" @click="editing = false">取消</button>
              <button class="btn primary" @click="saveProfile" :disabled="saving">
                {{ saving ? '保存中...' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- AI 额度卡片 -->
      <section class="quota-card card">
        <div class="quota-header">
          <span class="quota-icon">🤖</span>
          <div>
            <h3>AI 分析额度</h3>
            <p class="small muted">每次 AI 分析消耗 1 次</p>
          </div>
        </div>
        <div class="quota-body">
          <div class="quota-number" :class="{ low: userStore.apiCallsRemaining < 20 }">
            {{ userStore.apiCallsRemaining }}
          </div>
          <div class="quota-bar">
            <div class="quota-fill" :style="{ width: `${userStore.apiCallsRemaining}%` }" :class="{ low: userStore.apiCallsRemaining < 20 }"></div>
          </div>
          <span class="quota-label small muted">剩余次数</span>
        </div>
      </section>

      <!-- 数据源配置 -->
      <section class="config-card card">
        <div class="config-header">
          <span class="config-icon">📊</span>
          <div>
            <h3>数据源</h3>
            <p class="small muted">选择股票数据来源</p>
          </div>
        </div>
        <select v-model="dataSource" @change="saveDataSource" class="config-select">
          <option value="auto">自动选择</option>
          <option value="eastmoney">东方财富</option>
          <option value="sina">新浪财经</option>
          <option value="longport-cn">长桥中国</option>
          <option value="longport">长桥国际</option>
        </select>
      </section>

      <!-- 长桥配置 -->
      <section class="config-card card">
        <div class="config-header">
          <span class="config-icon">🔗</span>
          <div>
            <h3>长桥 API</h3>
            <p class="small muted">配置长桥获取更稳定的行情</p>
          </div>
        </div>
        <div class="config-body">
          <div class="form-group">
            <label>App Key</label>
            <input v-model="lbAppKey" type="text" placeholder="输入 App Key" />
          </div>
          <div class="form-group">
            <label>App Secret</label>
            <input v-model="lbAppSecret" type="password" placeholder="输入 App Secret" />
          </div>
          <div class="form-group">
            <label>Access Token</label>
            <input v-model="lbAccessToken" type="password" placeholder="输入 Access Token" />
          </div>
          <div class="config-actions">
            <button class="btn primary" @click="saveLongbridgeConfig" :disabled="lbSaving">
              {{ lbSaving ? '保存中...' : '保存' }}
            </button>
            <button class="btn" @click="testLongbridge" :disabled="lbTesting">
              {{ lbTesting ? '测试中...' : '🔗 测试连接' }}
            </button>
          </div>
          <div v-if="lbStatus" class="status-msg" :class="lbStatus.startsWith('✓') ? 'pos' : 'neg'">
            {{ lbStatus }}
          </div>
        </div>
      </section>

      <!-- 账户信息 -->
      <section class="info-card card">
        <div class="info-header">
          <span class="info-icon">ℹ️</span>
          <h3>账户信息</h3>
        </div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">用户ID</span>
            <span class="info-value">{{ userStore.user?.userId }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">注册时间</span>
            <span class="info-value">{{ userStore.user?.createdAt ? new Date(userStore.user.createdAt).toLocaleDateString('zh-CN') : '—' }}</span>
          </div>
        </div>
      </section>

      <!-- 操作按钮 -->
      <section class="actions-card card">
        <button class="btn" @click="$router.push('/settings')">⚙️ 设置</button>
        <button class="btn danger" @click="handleLogout">🚪 退出登录</button>
      </section>

      <!-- 状态提示 -->
      <div v-if="saveStatus" class="global-status" :class="saveStatus.startsWith('✓') ? 'pos' : 'neg'">
        {{ saveStatus }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-page {
  max-width: 480px;
  margin: 0 auto;
  padding-bottom: var(--space-6);
}

/* 认证区域 */
.auth-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.auth-hero {
  text-align: center;
  padding: var(--space-6) 0 var(--space-4);
}

.hero-icon {
  font-size: 48px;
  margin-bottom: var(--space-3);
}

.auth-hero h1 {
  margin: 0 0 var(--space-2);
  font-size: var(--fs-2xl);
}

/* 用户卡片 */
.user-hero {
  position: relative;
  overflow: hidden;
  padding: 0;
}

.hero-bg {
  height: 80px;
  background: linear-gradient(135deg, var(--color-info-bg), var(--color-link));
  opacity: 0.3;
}

.hero-content {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  padding: 0 var(--space-4) var(--space-4);
  margin-top: -40px;
}

.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.avatar-large {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--color-bg-elevated);
  border: 3px solid var(--color-bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-link);
}

.avatar-edit-btn {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  cursor: pointer;
}

.user-meta h2 {
  margin: 0;
  font-size: var(--fs-lg);
}

.user-id {
  margin: 2px 0 0;
  font-size: var(--fs-xs);
  color: var(--color-muted);
  font-family: var(--font-mono);
}

/* 额度卡片 */
.quota-card {
  padding: var(--space-4);
}

.quota-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.quota-icon {
  font-size: 24px;
}

.quota-header h3 {
  margin: 0;
  font-size: var(--fs-base);
}

.quota-body {
  text-align: center;
}

.quota-number {
  font-size: var(--fs-3xl);
  font-weight: 800;
  color: var(--color-up);
  font-variant-numeric: tabular-nums;
}

.quota-number.low {
  color: var(--color-down);
}

.quota-bar {
  height: 6px;
  background: var(--color-bg-muted);
  border-radius: 3px;
  overflow: hidden;
  margin: var(--space-2) 0;
}

.quota-fill {
  height: 100%;
  background: var(--color-up);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.quota-fill.low {
  background: var(--color-down);
}

/* 配置卡片 */
.config-card {
  padding: var(--space-4);
}

.config-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.config-icon {
  font-size: 24px;
}

.config-header h3 {
  margin: 0;
  font-size: var(--fs-base);
}

.config-select {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
}

.config-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.config-actions {
  display: flex;
  gap: var(--space-2);
}

/* 表单 */
.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.form-group label {
  font-size: var(--fs-sm);
  font-weight: 600;
}

.form-group input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
  font-size: var(--fs-sm);
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-link);
}

.form-hint {
  font-size: var(--fs-xs);
  color: var(--color-muted);
}

/* 信息卡片 */
.info-card {
  padding: var(--space-4);
}

.info-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.info-icon {
  font-size: 20px;
}

.info-header h3 {
  margin: 0;
  font-size: var(--fs-base);
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.info-row:last-child {
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

/* 操作卡片 */
.actions-card {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
}

.actions-card .btn {
  flex: 1;
}

.btn.danger {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-down);
  border-color: rgba(239, 68, 68, 0.3);
}

/* 状态消息 */
.status-msg {
  font-size: var(--fs-sm);
  font-weight: 600;
  padding: var(--space-2);
  border-radius: var(--radius-sm);
}

.global-status {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--fs-sm);
  font-weight: 600;
  z-index: 1000;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateX(-50%) translateY(20px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

.pos { color: var(--color-up); background: rgba(16, 185, 129, 0.1); }
.neg { color: var(--color-down); background: rgba(239, 68, 68, 0.1); }

/* 模态框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.modal {
  width: 100%;
  max-width: 400px;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  color: var(--color-muted);
}

.modal-body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4);
  border-top: 1px solid var(--color-border);
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
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.error-text {
  color: var(--color-down);
  font-size: var(--fs-xs);
}

/* 信息卡片 */
.info-card,
.actions-card {
  padding: var(--space-4);
}

.info-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.info-icon {
  font-size: 20px;
}

.info-header h3 {
  margin: 0;
  font-size: var(--fs-base);
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
}

.info-row:last-child {
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

.actions-card {
  display: flex;
  gap: var(--space-2);
}

.actions-card .btn {
  flex: 1;
}
</style>
