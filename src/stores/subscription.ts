import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { SubscriptionTier, UserSubscription, UsageLimits, SubscriptionFeature } from '../types'
import { SUBSCRIPTION_PLANS, FREE_LIMITS } from '../types'
import { APP_API_ROUTES } from '../config/endpoints'

const USAGE_STORAGE_KEY = 'ai-dashboard:usage'

function loadUsage(): { aiRequestsUsed: number; lastReset: string } {
  try {
    const raw = localStorage.getItem(USAGE_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { aiRequestsUsed: 0, lastReset: new Date().toISOString().slice(0, 10) }
}

function saveUsage(data: { aiRequestsUsed: number; lastReset: string }) {
  try {
    localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(data))
  } catch { /* ignore */ }
}

export const useSubscriptionStore = defineStore('subscription', () => {
  const tier = ref<SubscriptionTier>('free')
  const subscription = ref<UserSubscription | null>(null)
  const loading = ref(false)
  const usage = ref(loadUsage())

  const currentPlan = computed(() => SUBSCRIPTION_PLANS.find(p => p.id === tier.value) || SUBSCRIPTION_PLANS[0])

  const isActive = computed(() => {
    if (tier.value === 'free') return true
    if (!subscription.value) return false
    if (subscription.value.status === 'cancelled' || subscription.value.status === 'expired') return false
    if (subscription.value.currentPeriodEnd && subscription.value.currentPeriodEnd < Date.now()) return false
    return true
  })

  const isPro = computed(() => tier.value === 'pro' && isActive.value)
  const isTeam = computed(() => tier.value === 'team' && isActive.value)
  const isPaid = computed(() => tier.value !== 'free' && isActive.value)

  const daysRemaining = computed(() => {
    if (!subscription.value?.currentPeriodEnd) return null
    const diff = subscription.value.currentPeriodEnd - Date.now()
    if (diff <= 0) return 0
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  })

  const usageLimits = computed<UsageLimits>(() => {
    if (isPaid.value) {
      return {
        maxStocks: Infinity,
        maxAlerts: Infinity,
        maxAiRequests: Infinity,
        aiRequestsUsed: 0,
        period: 'monthly',
      }
    }
    const today = new Date().toISOString().slice(0, 10)
    if (usage.value.lastReset !== today) {
      usage.value = { aiRequestsUsed: 0, lastReset: today }
      saveUsage(usage.value)
    }
    return { ...FREE_LIMITS, aiRequestsUsed: usage.value.aiRequestsUsed }
  })

  function hasFeature(feature: SubscriptionFeature): boolean {
    if (isPaid.value) {
      return currentPlan.value.features.includes(feature)
    }
    return false
  }

  function canAddStock(currentCount: number): boolean {
    return isPaid.value || currentCount < FREE_LIMITS.maxStocks
  }

  function canAddAlert(currentCount: number): boolean {
    return isPaid.value || currentCount < FREE_LIMITS.maxAlerts
  }

  function canUseAi(): boolean {
    if (isPaid.value) return true
    return usage.value.aiRequestsUsed < FREE_LIMITS.maxAiRequests
  }

  function trackAiUsage() {
    if (!isPaid.value) {
      usage.value.aiRequestsUsed++
      saveUsage(usage.value)
    }
  }

  async function refresh() {
    loading.value = true
    try {
      const r = await fetch(APP_API_ROUTES.subscriptionStatus)
      if (r.ok) {
        const data = await r.json() as { tier: SubscriptionTier; subscription: UserSubscription | null }
        tier.value = data.tier || 'free'
        subscription.value = data.subscription
      }
    } catch { /* offline */ }
    finally { loading.value = false }
  }

  async function checkout(targetTier: SubscriptionTier): Promise<{ url?: string; error?: string }> {
    loading.value = true
    try {
      const r = await fetch(APP_API_ROUTES.subscriptionCheckout, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: targetTier }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => null) as { error?: string; message?: string }
        return { error: err?.error || err?.message || '创建订单失败' }
      }
      const data = await r.json() as { url?: string; sessionId?: string }
      return { url: data.url }
    } catch (e) {
      return { error: (e as Error).message }
    } finally { loading.value = false }
  }

  async function cancelSubscription(): Promise<{ error?: string }> {
    loading.value = true
    try {
      const r = await fetch(APP_API_ROUTES.subscriptionCancel, { method: 'POST' })
      if (!r.ok) {
        const err = await r.json().catch(() => null) as { error?: string }
        return { error: err?.error || '取消订阅失败' }
      }
      await refresh()
      return {}
    } catch (e) {
      return { error: (e as Error).message }
    } finally { loading.value = false }
  }

  function applyTier(t: SubscriptionTier, sub?: UserSubscription | null) {
    tier.value = t
    if (sub !== undefined) subscription.value = sub
  }

  return {
    tier, subscription, loading, usage,
    currentPlan, isActive, isPro, isTeam, isPaid, daysRemaining, usageLimits,
    hasFeature, canAddStock, canAddAlert, canUseAi, trackAiUsage,
    refresh, checkout, cancelSubscription, applyTier,
  }
})
