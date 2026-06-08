import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface Settings {
  theme: ThemeMode
  locale: 'zh-CN' | 'en-US'
  listInterval: number
  detailInterval: number
  enabled: boolean
  pauseOnHidden: boolean
  alignToClock: boolean
}

const STORAGE_KEY = 'ai-dashboard:settings'

const DEFAULTS: Settings = {
  theme: 'system',
  locale: 'zh-CN',
  listInterval: 60,
  detailInterval: 15,
  enabled: true,
  pauseOnHidden: true,
  alignToClock: false,
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    // 兼容老版本：剔除 workerUrl / activeProxyId
    delete parsed.workerUrl
    delete parsed.activeProxyId
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

function applyTheme(mode: ThemeMode) {
  let resolved: 'light' | 'dark' = 'light'
  if (mode === 'system') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } else {
    resolved = mode
  }
  document.documentElement.setAttribute('data-theme', resolved)
  document.documentElement.style.colorScheme = resolved
}

export const useSettingsStore = defineStore('settings', () => {
  const initial = load()
  const theme = ref<ThemeMode>(initial.theme)
  const locale = ref<Settings['locale']>(initial.locale)
  const listInterval = ref(initial.listInterval)
  const detailInterval = ref(initial.detailInterval)
  const enabled = ref(initial.enabled)
  const pauseOnHidden = ref(initial.pauseOnHidden)
  const alignToClock = ref(initial.alignToClock)

  function setTheme(m: ThemeMode) {
    theme.value = m
    applyTheme(m)
  }

  function setLocale(l: Settings['locale']) {
    locale.value = l
  }

  function snapshot(): Settings {
    return {
      theme: theme.value,
      locale: locale.value,
      listInterval: listInterval.value,
      detailInterval: detailInterval.value,
      enabled: enabled.value,
      pauseOnHidden: pauseOnHidden.value,
      alignToClock: alignToClock.value,
    }
  }

  function exportJson(): string {
    return JSON.stringify({ version: 2, settings: snapshot() }, null, 2)
  }

  function importJson(json: string): boolean {
    try {
      const parsed = JSON.parse(json)
      if (!parsed || !parsed.settings) return false
      const s = parsed.settings as Partial<Settings>
      theme.value = s.theme ?? 'system'
      locale.value = s.locale ?? 'zh-CN'
      listInterval.value = s.listInterval ?? 60
      detailInterval.value = s.detailInterval ?? 15
      enabled.value = s.enabled ?? true
      pauseOnHidden.value = s.pauseOnHidden ?? true
      alignToClock.value = s.alignToClock ?? false
      applyTheme(theme.value)
      return true
    } catch {
      return false
    }
  }

  watch([theme, locale, listInterval, detailInterval, enabled, pauseOnHidden, alignToClock],
    () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot()))
      } catch { /* quota */ }
    },
    { deep: true })

  applyTheme(theme.value)

  if (typeof window !== 'undefined') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', () => {
      if (theme.value === 'system') applyTheme('system')
    })
  }

  return {
    theme, locale, listInterval, detailInterval, enabled, pauseOnHidden, alignToClock,
    setTheme, setLocale, snapshot, exportJson, importJson,
  }
})
