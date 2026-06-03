import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useRefreshStore } from '../stores/refresh'

interface AutoRefreshOptions {
  interval: Ref<number>
  enabled: Ref<boolean>
  fetcher: () => Promise<void>
  alignToClock?: boolean
  pauseOnHidden?: boolean
}

export function useAutoRefresh(options: AutoRefreshOptions) {
  const { interval, enabled, fetcher } = options
  const settings = useSettingsStore()
  const refresh = useRefreshStore()
  const timer = ref<number | null>(null)
  const isRunning = ref(false)
  const isHidden = ref(false)
  const lastError = ref<string | null>(null)

  function clear() {
    if (timer.value != null) {
      clearTimeout(timer.value)
      timer.value = null
    }
  }

  function nextWait(): number {
    if (lastError.value) {
      // 指数退避：1, 2, 4, 8, 16, max 30
      return Math.min(30_000, 1000 * Math.pow(2, Math.min(refresh.failures, 5)))
    }
    if (settings.alignToClock) {
      // 整点对齐：等到下一个整点
      const now = new Date()
      const next = new Date(now)
      next.setMinutes(0, 0, 0)
      next.setHours(now.getHours() + 1)
      return next.getTime() - now.getTime()
    }
    return interval.value * 1000
  }

  async function tick() {
    if (isRunning.value) return
    if (!enabled.value) {
      refresh.setStatus('paused')
      schedule()
      return
    }
    if (settings.pauseOnHidden && isHidden.value) {
      refresh.setStatus('paused')
      schedule()
      return
    }
    isRunning.value = true
    try {
      await fetcher()
      lastError.value = null
    } catch (e) {
      lastError.value = (e as Error).message
    } finally {
      isRunning.value = false
      schedule()
    }
  }

  function schedule() {
    clear()
    if (!enabled.value) return
    if (settings.pauseOnHidden && isHidden.value) return
    const wait = nextWait()
    refresh.setNextUpdateAt(Date.now() + wait)
    timer.value = window.setTimeout(tick, wait)
  }

  function refreshNow() {
    clear()
    tick()
  }

  function onVisibility() {
    isHidden.value = document.visibilityState === 'hidden'
    if (!isHidden.value && enabled.value) {
      // 回到前台时立即刷一次
      refreshNow()
    }
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibility)
    isHidden.value = document.visibilityState === 'hidden'
    refreshNow()
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    clear()
  })

  watch(interval, () => schedule())
  watch(enabled, (v) => {
    if (v) refreshNow()
    else clear()
  })

  return { refreshNow, isRunning, lastError }
}
