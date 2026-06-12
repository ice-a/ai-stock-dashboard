<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { APP_API_ROUTES } from '../config/endpoints'
import { useAccountStore } from '../stores/account'

const route = useRoute()
const router = useRouter()
const account = useAccountStore()

const sitePassword = ref('')
const loading = ref(false)
const error = ref('')
const stage = ref<'checking' | 'site'>('checking')

const nextPath = () => {
  const next = String(route.query.next || '/')
  return next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

async function checkStatus() {
  stage.value = 'checking'
  error.value = ''
  try {
    const r = await fetch(APP_API_ROUTES.authStatus)
    const status = await r.json() as { enabled: boolean; authenticated: boolean }
    if (!status.enabled || status.authenticated) {
      router.replace(nextPath())
      return
    }
    if (account.guest) {
      router.replace(nextPath())
      return
    }
    stage.value = 'site'
  } catch {
    stage.value = 'site'
  }
}

onMounted(checkStatus)

async function submitSitePassword() {
  if (!sitePassword.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const r = await fetch(APP_API_ROUTES.authLogin, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: sitePassword.value }),
    })
    if (!r.ok) {
      if (r.status === 401) {
        error.value = '密码不正确。'
      } else if (r.status === 429) {
        error.value = '尝试次数过多，请稍后再试。'
      } else {
        error.value = '认证服务异常，请稍后再试。'
      }
      return
    }
    // Update account store state after successful login
    account.applyStatus({ enabled: true, authenticated: true })
    router.replace(nextPath())
  } catch {
    error.value = '无法连接认证服务。'
  } finally {
    loading.value = false
  }
}

function enterGuest() {
  account.enterGuest()
  router.replace(nextPath())
}
</script>

<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="brand">
        <div class="logo">
          <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
            <rect width="32" height="32" rx="6" fill="currentColor" opacity="0.15"/>
            <path d="M6 22 L11 14 L16 18 L21 8 L26 16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="26" cy="16" r="2.2" fill="currentColor"/>
          </svg>
        </div>
        <div>
          <h1>访问验证</h1>
        </div>
      </div>

      <form v-if="stage === 'site'" class="login-form" @submit.prevent="submitSitePassword">
        <label>
          <span class="small muted">密码</span>
          <input v-model="sitePassword" type="password" autocomplete="current-password" autofocus />
        </label>
        <button class="btn primary" :disabled="loading || !sitePassword">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? '验证中...' : '进入网站' }}
        </button>
        <button type="button" class="btn" :disabled="loading" @click="enterGuest">游客模式</button>
        <p v-if="error" class="error small">{{ error }}</p>
      </form>

      <div v-else class="checking muted">
        <span class="spinner"></span>
        正在检查登录状态...
      </div>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: var(--space-5);
  background:
    radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--color-info-bg) 80%, transparent), transparent 34%),
    var(--color-bg);
}
.login-panel {
  width: min(100%, 420px);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  box-shadow: var(--shadow-lg);
}
.brand {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  margin-bottom: var(--space-5);
}
.logo {
  color: var(--color-blue);
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-muted);
  flex-shrink: 0;
}
h1 {
  font-size: var(--fs-xl);
  margin-bottom: 4px;
}
.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
input {
  width: 100%;
  min-height: 42px;
}
.checking {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.error {
  color: var(--color-down);
  margin: 0;
}
</style>
