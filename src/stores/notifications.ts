import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { APP_API_ROUTES } from '../config/endpoints'
import type { AlertEvent, NotificationConfig } from '../types'

const STORAGE_KEY = 'ai-dashboard:notifications'

const DEFAULT_CONFIG: NotificationConfig = {
  enabled: false,
  provider: 'bark',
  bark: {
    serverUrl: 'https://api.day.app',
    deviceKey: '',
    group: 'AI Stock Dashboard',
    level: 'active',
    sound: '',
  },
  lastTestAt: null,
  lastError: '',
}

function normalizeConfig(input: Partial<NotificationConfig> | null | undefined): NotificationConfig {
  const bark: Partial<NotificationConfig['bark']> = input?.bark || {}
  const level = bark.level === 'timeSensitive' || bark.level === 'passive' ? bark.level : 'active'
  return {
    enabled: Boolean(input?.enabled),
    provider: 'bark',
    bark: {
      serverUrl: String(bark.serverUrl || DEFAULT_CONFIG.bark.serverUrl).trim().replace(/\/+$/, ''),
      deviceKey: String(bark.deviceKey || '').trim(),
      group: String(bark.group || DEFAULT_CONFIG.bark.group).trim(),
      level,
      sound: String(bark.sound || '').trim(),
    },
    lastTestAt: typeof input?.lastTestAt === 'number' ? input.lastTestAt : null,
    lastError: String(input?.lastError || ''),
  }
}

function loadConfig(): NotificationConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return normalizeConfig(raw ? JSON.parse(raw) as Partial<NotificationConfig> : null)
  } catch {
    return normalizeConfig(null)
  }
}

async function sendBark(config: NotificationConfig, title: string, body: string, url?: string): Promise<void> {
  const response = await fetch(APP_API_ROUTES.notificationsSend, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'bark',
      bark: config.bark,
      title,
      body,
      url,
    }),
  })
  const json = await response.json().catch(() => null) as { error?: string; message?: string } | null
  if (!response.ok) {
    throw new Error(json?.message || json?.error || `通知发送失败：${response.status}`)
  }
}

export const useNotificationsStore = defineStore('notifications', () => {
  const config = ref<NotificationConfig>(loadConfig())
  const sending = ref(false)

  const isReady = computed(() => {
    return Boolean(config.value.enabled && config.value.provider === 'bark' && config.value.bark.serverUrl && config.value.bark.deviceKey)
  })

  function save(patch?: Partial<NotificationConfig>) {
    config.value = normalizeConfig({ ...config.value, ...patch })
  }

  async function send(title: string, body: string, url?: string): Promise<boolean> {
    if (!isReady.value) return false
    try {
      await sendBark(config.value, title, body, url)
      config.value.lastError = ''
      return true
    } catch (e) {
      config.value.lastError = (e as Error).message
      return false
    }
  }

  async function sendAlert(event: AlertEvent): Promise<boolean> {
    return send(event.title, `${event.symbol} ${event.message}`, `/stock/${encodeURIComponent(event.symbol)}`)
  }

  async function test(): Promise<boolean> {
    sending.value = true
    try {
      const ok = await send('AI Stock Dashboard 测试通知', 'Bark webhook 已配置成功。')
      if (ok) config.value.lastTestAt = Date.now()
      return ok
    } finally {
      sending.value = false
    }
  }

  function exportJson(): string {
    return JSON.stringify({ version: 1, config: config.value }, null, 2)
  }

  function importJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as { config?: Partial<NotificationConfig> }
      config.value = normalizeConfig(parsed.config)
      return true
    } catch {
      return false
    }
  }

  watch(config, (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch { /* quota */ }
  }, { deep: true })

  return {
    config,
    sending,
    isReady,
    save,
    send,
    sendAlert,
    test,
    exportJson,
    importJson,
  }
})
