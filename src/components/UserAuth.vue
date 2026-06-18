<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '../stores/user'

const userStore = useUserStore()

const mode = ref<'login' | 'register'>('login')
const userId = ref('')
const key = ref('')
const nickname = ref('')
const showKey = ref(false)

async function handleSubmit() {
  if (!userId.value || !key.value) {
    userStore.error = '请填写用户ID和密钥'
    return
  }

  if (mode.value === 'login') {
    await userStore.login(userId.value, key.value)
  } else {
    await userStore.register(userId.value, key.value, nickname.value || undefined)
  }
}

function generateNewKey() {
  key.value = userStore.generateKey()
  showKey.value = true
}

function copyKey() {
  navigator.clipboard.writeText(key.value)
}
</script>

<template>
  <div class="user-auth">
    <div class="auth-card">
      <h2>{{ mode === 'login' ? '登录' : '注册' }}</h2>
      <p class="auth-desc">
        {{ mode === 'login' ? '输入用户ID和密钥以同步您的数据' : '创建账户以保存您的配置和数据' }}
      </p>

      <div class="auth-tabs">
        <button :class="{ active: mode === 'login' }" @click="mode = 'login'">登录</button>
        <button :class="{ active: mode === 'register' }" @click="mode = 'register'">注册</button>
      </div>

      <form @submit.prevent="handleSubmit" class="auth-form">
        <div class="form-group">
          <label>用户ID</label>
          <input
            v-model="userId"
            type="text"
            placeholder="输入您的用户ID"
            autocomplete="username"
          />
        </div>

        <div class="form-group">
          <label>密钥</label>
          <div class="key-input">
            <input
              v-model="key"
              :type="showKey ? 'text' : 'password'"
              placeholder="输入您的密钥"
              autocomplete="current-password"
            />
            <button type="button" class="btn-icon" @click="showKey = !showKey">
              {{ showKey ? '🙈' : '👁️' }}
            </button>
            <button type="button" class="btn-icon" @click="copyKey" v-if="key">
              📋
            </button>
          </div>
          <button
            v-if="mode === 'register'"
            type="button"
            class="btn-generate"
            @click="generateNewKey"
          >
            生成随机密钥
          </button>
        </div>

        <div v-if="mode === 'register'" class="form-group">
          <label>昵称（可选）</label>
          <input
            v-model="nickname"
            type="text"
            placeholder="输入昵称"
          />
        </div>

        <div v-if="userStore.error" class="auth-error">
          {{ userStore.error }}
        </div>

        <button type="submit" class="btn primary auth-submit" :disabled="userStore.loading">
          <span v-if="userStore.loading" class="spinner"></span>
          {{ userStore.loading ? '处理中...' : (mode === 'login' ? '登录' : '注册') }}
        </button>
      </form>

      <div class="auth-info">
        <p>💡 提示：</p>
        <ul>
          <li>注册后请妥善保管您的用户ID和密钥</li>
          <li>同一密钥可在多设备登录同步数据</li>
          <li>数据通过 MongoDB 安全存储</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-auth {
  display: flex;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
}

.auth-card {
  width: 100%;
  max-width: 420px;
  padding: var(--space-6);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.auth-card h2 {
  margin: 0 0 var(--space-2);
  font-size: var(--fs-2xl);
  text-align: center;
}

.auth-desc {
  margin: 0 0 var(--space-4);
  text-align: center;
  color: var(--color-muted);
  font-size: var(--fs-sm);
}

.auth-tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  padding: 4px;
  background: var(--color-bg-muted);
  border-radius: var(--radius-md);
}

.auth-tabs button {
  flex: 1;
  padding: var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-muted);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.auth-tabs button.active {
  background: var(--color-bg-elevated);
  color: var(--color-ink);
  box-shadow: var(--shadow-sm);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-group label {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--color-ink);
}

.form-group input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-ink);
  font-size: var(--fs-base);
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-link);
  box-shadow: 0 0 0 2px var(--color-info-bg);
}

.key-input {
  display: flex;
  gap: var(--space-2);
}

.key-input input {
  flex: 1;
}

.btn-icon {
  width: 40px;
  height: 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.btn-icon:hover {
  background: var(--color-bg-muted);
}

.btn-generate {
  padding: var(--space-1) var(--space-2);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-link);
  font-size: var(--fs-xs);
  cursor: pointer;
}

.btn-generate:hover {
  background: var(--color-info-bg);
}

.auth-error {
  padding: var(--space-2) var(--space-3);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-sm);
  color: var(--color-down);
  font-size: var(--fs-sm);
}

.auth-submit {
  width: 100%;
  padding: var(--space-3);
  font-size: var(--fs-base);
}

.auth-info {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.auth-info p {
  margin: 0 0 var(--space-2);
  font-size: var(--fs-sm);
  font-weight: 600;
}

.auth-info ul {
  margin: 0;
  padding-left: var(--space-4);
  font-size: var(--fs-xs);
  color: var(--color-muted);
}

.auth-info li {
  margin-bottom: var(--space-1);
}

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
</style>
