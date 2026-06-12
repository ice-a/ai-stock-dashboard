import { defineStore } from 'pinia'
import { APP_API_ROUTES } from '../config/endpoints'

const GUEST_STORAGE_KEY = 'ai-dashboard:guest-session'

interface AuthStatus {
  enabled: boolean
  authenticated: boolean
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
    checked: false,
    loading: false,
    error: null as string | null,
  }),

  actions: {
    applyStatus(status: AuthStatus) {
      this.enabled = Boolean(status.enabled)
      this.authenticated = Boolean(status.authenticated)
      if (this.authenticated) {
        this.guest = false
        saveGuestSession(false)
      }
      this.checked = true
    },

    async refresh(options: { timeoutMs?: number } = {}) {
      this.loading = true
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
      const timeout = options.timeoutMs && controller
        ? window.setTimeout(() => controller.abort(), options.timeoutMs)
        : null
      try {
        const r = await fetch(APP_API_ROUTES.authStatus, controller ? { signal: controller.signal } : undefined)
        if (r.status === 401) {
          this.applyStatus({ enabled: true, authenticated: false })
          return
        }
        const status = await r.json() as AuthStatus
        this.applyStatus(status)
      } catch (e) {
        if (this.guest) {
          this.checked = true
          this.error = (e as Error).message
          return
        }
        this.enabled = false
        this.authenticated = false
        this.checked = true
        this.error = (e as Error).message
      } finally {
        if (timeout) window.clearTimeout(timeout)
        this.loading = false
      }
    },

    enterGuest() {
      this.guest = true
      this.authenticated = false
      this.checked = true
      this.error = null
      saveGuestSession(true)
    },

    async logout() {
      await fetch(APP_API_ROUTES.authLogout, { method: 'POST' }).catch(() => null)
      this.authenticated = false
      this.guest = false
      this.checked = true
      saveGuestSession(false)
    },
  },
})
