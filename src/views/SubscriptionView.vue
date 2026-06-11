<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSubscriptionStore } from '../stores/subscription'
import { useAccountStore } from '../stores/account'
import { SUBSCRIPTION_PLANS, type SubscriptionTier, type SubscriptionFeature } from '../types'

const subscription = useSubscriptionStore()
const account = useAccountStore()

const selectedTier = ref<SubscriptionTier>('pro')
const checkoutLoading = ref(false)
const checkoutError = ref<string | null>(null)
const cancelLoading = ref(false)

const featureLabels: Record<SubscriptionFeature, string> = {
  unlimited_stocks: '无限股票自选',
  ai_analysis: 'AI 智能分析',
  advanced_alerts: '高级预警推送',
  cloud_sync: '云端配置同步',
  export_pdf: 'PDF 报告导出',
  priority_support: '优先客服支持',
  team_sharing: '团队协作分享',
  api_access: 'API 接入权限',
}

const allFeatures: SubscriptionFeature[] = [
  'unlimited_stocks', 'ai_analysis', 'advanced_alerts', 'cloud_sync',
  'export_pdf', 'priority_support', 'team_sharing', 'api_access',
]

onMounted(() => {
  subscription.refresh()
})

async function handleCheckout() {
  if (!account.authenticated) {
    checkoutError.value = '请先登录账户'
    return
  }
  checkoutLoading.value = true
  checkoutError.value = null
  try {
    const result = await subscription.checkout(selectedTier.value)
    if (result.error) {
      checkoutError.value = result.error
    } else if (result.url) {
      window.open(result.url, '_blank')
    }
  } finally {
    checkoutLoading.value = false
  }
}

async function handleCancel() {
  if (!confirm('确定要取消订阅吗？到期前仍可使用 Pro 功能。')) return
  cancelLoading.value = true
  try {
    const result = await subscription.cancelSubscription()
    if (result.error) {
      alert(result.error)
    }
  } finally {
    cancelLoading.value = false
  }
}

function formatPrice(price: number, currency: string): string {
  if (price === 0) return '免费'
  return `${currency === 'CNY' ? '¥' : '$'}${price}`
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleDateString('zh-CN')
}
</script>

<template>
  <div class="subscription-page">
    <header class="page-head">
      <div>
        <p class="eyebrow">订阅管理</p>
        <h1>选择适合你的方案</h1>
        <p class="muted">解锁全部功能，提升投资研究效率。</p>
      </div>
    </header>

    <!-- 当前状态 -->
    <section v-if="account.authenticated" class="current-status card">
      <div class="status-header">
        <h2>当前订阅</h2>
        <span class="tier-badge" :class="subscription.tier">
          {{ subscription.currentPlan.name }}
        </span>
      </div>
      <div class="status-grid">
        <div class="status-item">
          <span class="label">状态</span>
          <span class="value" :class="{ active: subscription.isActive, expired: !subscription.isActive }">
            {{ subscription.isActive ? '有效' : '已过期' }}
          </span>
        </div>
        <div v-if="subscription.isPaid" class="status-item">
          <span class="label">到期时间</span>
          <span class="value">{{ formatDate(subscription.subscription?.currentPeriodEnd ?? null) }}</span>
        </div>
        <div v-if="subscription.isPaid && subscription.daysRemaining != null" class="status-item">
          <span class="label">剩余天数</span>
          <span class="value">{{ subscription.daysRemaining }} 天</span>
        </div>
        <div v-if="!subscription.isPaid" class="status-item">
          <span class="label">今日 AI 使用</span>
          <span class="value">{{ subscription.usageLimits.aiRequestsUsed }} / 5</span>
        </div>
      </div>
      <div v-if="subscription.isPaid" class="status-actions">
        <button class="btn danger" :disabled="cancelLoading" @click="handleCancel">
          {{ cancelLoading ? '处理中...' : '取消订阅' }}
        </button>
      </div>
    </section>

    <section v-else class="login-prompt card">
      <p>请先 <router-link to="/login">登录账户</router-link> 查看订阅状态。</p>
    </section>

    <!-- 套餐对比 -->
    <section class="plans-grid">
      <div
        v-for="plan in SUBSCRIPTION_PLANS"
        :key="plan.id"
        class="plan-card card"
        :class="{ selected: selectedTier === plan.id, current: subscription.tier === plan.id }"
        @click="selectedTier = plan.id"
      >
        <div class="plan-header">
          <h3>{{ plan.name }}</h3>
          <div class="plan-price">
            <span class="price">{{ formatPrice(plan.price, plan.currency) }}</span>
            <span v-if="plan.price > 0" class="interval">/月</span>
          </div>
        </div>
        <div class="plan-features">
          <div v-for="feature in allFeatures" :key="feature" class="feature-item">
            <span class="check" :class="{ included: plan.features.includes(feature) || plan.id === 'free' }">
              {{ plan.features.includes(feature) || plan.id === 'free' ? '✓' : '—' }}
            </span>
            <span>{{ featureLabels[feature] }}</span>
          </div>
        </div>
        <div class="plan-footer">
          <span v-if="subscription.tier === plan.id" class="current-label">当前方案</span>
          <span v-else-if="plan.id === 'free'" class="free-label">默认</span>
        </div>
      </div>
    </section>

    <!-- 免费版限制说明 -->
    <section class="limits-card card">
      <h3>免费版限制</h3>
      <ul>
        <li>最多 3 只股票自选</li>
        <li>最多 3 个预警规则</li>
        <li>每日 5 次 AI 分析</li>
        <li>配置保存在浏览器本地</li>
      </ul>
    </section>

    <!-- 升级按钮 -->
    <section v-if="account.authenticated && !subscription.isPaid" class="checkout-section">
      <div v-if="checkoutError" class="error-message">{{ checkoutError }}</div>
      <button
        class="btn primary large"
        :disabled="checkoutLoading || selectedTier === 'free'"
        @click="handleCheckout"
      >
        {{ checkoutLoading ? '处理中...' : `升级到 ${selectedTier === 'team' ? 'Team' : 'Pro'}` }}
      </button>
      <p class="muted small">支付完成后立即生效，随时可取消。</p>
    </section>
  </div>
</template>

<style scoped>
.subscription-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.page-head {
  padding: var(--space-5) 0 var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.eyebrow {
  margin: 0 0 6px;
  color: var(--color-link);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.card {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  box-shadow: var(--shadow-sm);
}
.current-status {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.status-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.tier-badge {
  padding: 4px 12px;
  border-radius: 999px;
  font-size: var(--fs-xs);
  font-weight: 700;
  text-transform: uppercase;
}
.tier-badge.free { background: var(--color-bg-muted); color: var(--color-muted); }
.tier-badge.pro { background: var(--color-link-bg); color: var(--color-link); }
.tier-badge.team { background: var(--color-purple-bg, var(--color-link-bg)); color: var(--color-purple, var(--color-link)); }
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-3);
}
.status-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.status-item .label {
  font-size: var(--fs-xs);
  color: var(--color-muted);
}
.status-item .value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.status-item .value.active { color: var(--color-up); }
.status-item .value.expired { color: var(--color-down); }
.status-actions {
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}
.login-prompt {
  text-align: center;
  padding: var(--space-6);
}
.login-prompt a { color: var(--color-link); }
.plans-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}
.plan-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 2px solid var(--color-border);
}
.plan-card:hover {
  border-color: var(--color-link);
}
.plan-card.selected {
  border-color: var(--color-link);
  box-shadow: 0 0 0 1px var(--color-link);
}
.plan-card.current {
  opacity: 0.7;
  pointer-events: none;
}
.plan-header h3 {
  margin: 0 0 8px;
}
.plan-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.price {
  font-size: var(--fs-2xl);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.interval {
  font-size: var(--fs-sm);
  color: var(--color-muted);
}
.plan-features {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}
.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fs-sm);
}
.check {
  width: 20px;
  text-align: center;
  font-weight: 700;
  color: var(--color-muted);
}
.check.included { color: var(--color-up); }
.plan-footer {
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}
.current-label {
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--color-link);
}
.free-label {
  font-size: var(--fs-xs);
  color: var(--color-muted);
}
.limits-card h3 {
  margin: 0 0 var(--space-2);
}
.limits-card ul {
  margin: 0;
  padding-left: var(--space-4);
}
.limits-card li {
  margin-bottom: 4px;
  font-size: var(--fs-sm);
  color: var(--color-ink-soft);
}
.checkout-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6);
}
.error-message {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-error-bg);
  color: var(--color-down);
  font-size: var(--fs-sm);
}
.btn.large {
  padding: 12px 32px;
  font-size: var(--fs-md);
}
.danger { color: var(--color-down); }

@media (max-width: 768px) {
  .plans-grid {
    grid-template-columns: 1fr;
  }
}
</style>
