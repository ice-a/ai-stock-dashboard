<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { APP_API_ROUTES } from '../config/endpoints'
import { useAccountStore } from '../stores/account'
import { loadPersonalConfigFromCloud, savePersonalConfigToCloud } from '../utils/personalConfig'

const route = useRoute()
const router = useRouter()
const account = useAccountStore()

const sitePassword = ref('')
const accountUser = ref('')
const accountSign = ref('')
const loading = ref(false)
const error = ref('')
const stage = ref<'checking' | 'site' | 'account'>('checking')

const nextPath = () => {
  const next = String(route.query.next || '/')
  return next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

const checking = computed(() => stage.value === 'checking')
const title = computed(() => stage.value === 'site' ? '访问验证' : '登录 / 注册')
const accountSubmitText = computed(() => {
  if (loading.value) return '处理中...'
  return '登录 / 注册并进入'
})

async function checkStatus() {
  stage.value = 'checking'
  error.value = ''
  try {
    const r = await fetch(APP_API_ROUTES.authStatus)
    const status = await r.json() as { enabled: boolean; authenticated: boolean }
    if (status.enabled && !status.authenticated) {
      stage.value = 'site'
      return
    }

    await account.refresh({ timeoutMs: 2500 })
    if (account.enabled && account.guest) {
      router.replace(nextPath())
      return
    }
    if (account.enabled && !account.authenticated) {
      stage.value = 'account'
      return
    }

    if (!status.enabled || status.authenticated || account.authenticated) {
      router.replace(nextPath())
      return
    }
  } catch {
    stage.value = 'site'
  }
}

onMounted(checkStatus)

function friendlyAccountError(message: string): string {
  if (/Invalid user or (sign|seckey)/i.test(message)) return 'user 或 sign 不正确。'
  if (/not configured|MONGODB_URI/i.test(message)) return '服务端未配置 MongoDB，暂时不能使用账户登录。'
  if (/Too many attempts/i.test(message)) return '尝试次数过多，请稍后再试。'
  return message || '账户服务异常，请稍后再试。'
}

async function syncPersonalConfigAfterLogin() {
  const remote = await loadPersonalConfigFromCloud()
  if (!remote.loaded) await savePersonalConfigToCloud()
}

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
      const payload = await r.json().catch(() => null)
      if (r.status === 401) {
        error.value = '密码不正确。'
      } else if (r.status === 429) {
        error.value = '尝试次数过多，请稍后再试。'
      } else {
        error.value = payload?.message ? `认证服务异常：${payload.message}` : '认证服务异常，请稍后再试。'
      }
      return
    }
    await checkStatus()
  } catch {
    error.value = '无法连接认证服务。'
  } finally {
    loading.value = false
  }
}

async function submitAccount() {
  if (!accountUser.value || !accountSign.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    await account.loginOrRegister(accountUser.value, accountSign.value)
    await syncPersonalConfigAfterLogin()
    router.replace(nextPath())
  } catch (e) {
    error.value = friendlyAccountError((e as Error).message)
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
          <h1>{{ title }}</h1>
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
        <p v-if="error" class="error small">{{ error }}</p>
      </form>

      <form v-else-if="stage === 'account'" class="login-form" @submit.prevent="submitAccount">
        <label>
          <span class="small muted">用户名</span>
          <input v-model.trim="accountUser" type="text" autocomplete="username" autofocus placeholder="user" />
        </label>
        <label>
          <span class="small muted">sign</span>
          <input v-model="accountSign" type="text" autocomplete="off" placeholder="sign" />
        </label>
        <button class="btn primary" :disabled="loading || !accountUser || !accountSign">
          <span v-if="loading" class="spinner"></span>
          {{ accountSubmitText }}
        </button>
        <button type="button" class="btn" :disabled="loading" @click="enterGuest">游客登录</button>
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
