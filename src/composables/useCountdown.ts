import { computed, onUnmounted, ref } from 'vue'
import type { Quote } from '../types'

// 倒计时：基于 nextUpdateAt
export function useCountdown(target: { value: number | null | undefined }) {
  const now = ref(Date.now())
  const timer = ref<number | null>(null)

  if (typeof window !== 'undefined') {
    timer.value = window.setInterval(() => {
      now.value = Date.now()
    }, 1000)
  }

  onUnmounted(() => {
    if (timer.value != null) clearInterval(timer.value)
  })

  const secondsLeft = computed(() => {
    if (!target.value) return null
    const diff = Math.max(0, Math.floor((target.value - now.value) / 1000))
    return diff
  })

  const display = computed(() => {
    const s = secondsLeft.value
    if (s == null) return '—'
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m${s % 60}s`
  })

  return { secondsLeft, display }
}

// 闪烁提示：报价变化时
export function usePriceFlash(quote: { value: Quote | undefined }, prevPrice: { value: number | null }) {
  const flash = ref<'up' | 'down' | null>(null)
  let timer: number | null = null

  function check() {
    const cur = quote.value?.price
    const prev = prevPrice.value
    if (cur == null || prev == null || cur === prev) {
      return
    }
    flash.value = cur > prev ? 'up' : 'down'
    if (timer != null) clearTimeout(timer)
    timer = window.setTimeout(() => {
      flash.value = null
    }, 800)
    prevPrice.value = cur
  }

  return { flash, check, clear: () => {
    if (timer != null) clearTimeout(timer)
    flash.value = null
  } }
}
