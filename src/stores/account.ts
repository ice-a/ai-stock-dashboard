import { defineStore } from 'pinia'
import { APP_API_ROUTES } from '../config/endpoints'

const GUEST_STORAGE_KEY = 'ai-dashboard:guest-session'

interface AccountStatus {
  enabled: boolean
  authenticated: boolean
  user: string | null
  error?: string
}

interface RefreshOptions {
  timeoutMs?: number
}

async function readError(r: Response, fallback: string): Promise<string> {
  const payload = await r.json().catch(() => null) as { message?: string; error?: string } | null
  return payload?.message || payload?.error || fallback
}

function loadGuestSession(): boolean {
  try {
    return localStorage.getItem(GUEST_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function saveGuestSession(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(GUEST_STORAGE_KEY, '1')
    else localStorage.removeItem(GUEST_STORAGE_KEY)
  } catch { /* ignore */ }
}

export const useAccountStore = defineStore('account', {
  state: () => ({
    enabled: false,
    authenticated: false,
    guest: loadGuestSession(),
    user: null as string | null,
    checked: false,
    loading: false,
    error: null as string | null,
  }),

  actions: {
    applyStatus(status: AccountStatus) {
      this.enabled = Boolean(status.enabled)
      this.authenticated = Boolean(status.authenticated)
      this.user = status.user || null
      if (this.authenticated) {
        this.guest = false
        saveGuestSession(false)
      }
      this.checked = true
      this.error = status.error || null
    },

    async refresh(options: RefreshOptions = {}) {
      this.loading = true
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timeout = options.timeoutMs && controller
        ? window.setTimeout(() => controller.abort(), options.timeoutMs)
        : null
      try {
        const r = await fetch(APP_API_ROUTES.accountStatus, controller ? { signal: controller.signal } : undefined)
        if (r.status === 401) {
          this.applyStatus({ enabled: true, authenticated: false, user: null })
          return
        }
        const status = await r.json() as AccountStatus
        this.applyStatus(status)
      } catch (e) {
        if (this.guest) {
          this.checked = true
          this.error = (e as Error).message
          return
        }
        this.enabled = false
        this.authenticated = false
        this.user = null
        this.checked = true
        this.error = (e as Error).message
      } finally {
        if (timeout) window.clearTimeout(timeout)
        this.loading = false
      }
    },

    async loginOrRegister(user: string, sign: string): Promise<{ created: boolean }> {
      this.loading = true
      this.error = null
      try {
        const r = await fetch(APP_API_ROUTES.accountLogin, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user, sign }),
        })
        if (!r.ok) throw new Error(await readError(r, '登录失败。'))
        const payload = await r.json() as { user?: string; created?: boolean }
        this.guest = false
        saveGuestSession(false)
        this.applyStatus({ enabled: true, authenticated: true, user: payload.user || user })
        return { created: Boolean(payload.created) }
      } finally {
        this.loading = false
      }
    },

    async login(user: string, sign: string) {
      await this.loginOrRegister(user, sign)
    },

    async register(user: string, sign: string) {
      this.loading = true
      this.error = null
      try {
        const r = await fetch(APP_API_ROUTES.accountRegister, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user, sign }),
        })
        if (!r.ok) throw new Error(await readError(r, '注册失败。'))
        const payload = await r.json() as { user?: string }
        this.guest = false
        saveGuestSession(false)
        this.applyStatus({ enabled: true, authenticated: true, user: payload.user || user })
      } finally {
        this.loading = false
      }
    },

    enterGuest() {
      this.guest = true
      this.authenticated = false
      this.user = null
      this.checked = true
      this.error = null
      saveGuestSession(true)
    },

    async logout() {
      await fetch(APP_API_ROUTES.accountLogout, { method: 'POST' }).catch(() => null)
      this.authenticated = false
      this.guest = false
      this.user = null
      this.checked = true
      saveGuestSession(false)
    },

    async fetchConfig(): Promise<{ config: Record<string, unknown> | null; updatedAt: string | null }> {
      const r = await fetch(APP_API_ROUTES.accountConfig)
      if (r.status === 401) {
        this.authenticated = false
        this.user = null
        throw new Error('请先登录账户。')
      }
      if (!r.ok) throw new Error(await readError(r, '读取个人配置失败。'))
      return await r.json() as { config: Record<string, unknown> | null; updatedAt: string | null }
    },

    async saveConfig(config: Record<string, unknown>): Promise<string | null> {
      const r = await fetch(APP_API_ROUTES.accountConfig, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      if (r.status === 401) {
        this.authenticated = false
        this.user = null
        throw new Error('请先登录账户。')
      }
      if (!r.ok) throw new Error(await readError(r, '保存个人配置失败。'))
      const payload = await r.json() as { updatedAt?: string }
      return payload.updatedAt || null
    },
  },
})
