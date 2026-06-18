<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatPercent, formatPrice } from '../utils/format'
import html2canvas from 'html2canvas'

interface Holding {
  symbol: string
  name: string
  buyPrice: number
  currentPrice: number | null
  quantity: number
  profit: number | null
  profitRate: number | null
}

const props = defineProps<{
  holdings: Holding[]
  summary: {
    totalCost: number
    totalMarketValue: number
    profit: number
    profitRate: number | null
    realizedProfit: number
    totalProfit: number
    totalProfitRate: number | null
  }
  mode?: 'profit' | 'holdings'
}>()

const shareMode = ref<'profit' | 'holdings'>(props.mode || 'profit')
const generating = ref(false)
const shareStatus = ref<'idle' | 'success' | 'error'>('idle')
const shareMessage = ref('')

const profitColor = (value: number | null) => {
  if (value == null) return 'var(--color-muted)'
  return value >= 0 ? 'var(--color-up)' : 'var(--color-down)'
}

const profitIcon = (value: number | null) => {
  if (value == null) return '—'
  return value >= 0 ? '+' : ''
}

const topHoldings = computed(() => {
  return [...props.holdings]
    .sort((a, b) => (b.profitRate ?? 0) - (a.profitRate ?? 0))
    .slice(0, 5)
})

// 生成并下载图片
async function generateImage() {
  generating.value = true
  shareStatus.value = 'idle'

  try {
    const element = document.getElementById('share-card')
    if (!element) {
      throw new Error('找不到分享卡片元素')
    }

    const canvas = await html2canvas(element, {
      backgroundColor: '#1a1a2e',
      scale: 2,
      useCORS: true,
      logging: false,
    })

    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = `持仓分享_${new Date().toISOString().slice(0, 10)}.png`
    link.href = dataUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    shareStatus.value = 'success'
    shareMessage.value = '图片已保存'
  } catch (error) {
    shareStatus.value = 'error'
    shareMessage.value = (error as Error).message || '生成图片失败'
  } finally {
    generating.value = false
  }
}

// 复制文字
async function copyToClipboard() {
  const text = shareMode.value === 'profit'
    ? generateProfitText()
    : generateHoldingsText()

  try {
    await navigator.clipboard.writeText(text)
    shareStatus.value = 'success'
    shareMessage.value = '已复制到剪贴板'
  } catch {
    shareStatus.value = 'error'
    shareMessage.value = '复制失败'
  }
}

function generateProfitText(): string {
  const lines = [
    '📊 我的投资成绩',
    '─'.repeat(20),
    `总投入：${formatPrice(props.summary.totalCost)}`,
    `当前市值：${formatPrice(props.summary.totalMarketValue)}`,
    `浮动盈亏：${profitIcon(props.summary.profit)}${formatPrice(props.summary.profit)}`,
    `收益率：${formatPercent(props.summary.profitRate)}`,
    `已实现盈亏：${profitIcon(props.summary.realizedProfit)}${formatPrice(props.summary.realizedProfit)}`,
    `总盈亏：${profitIcon(props.summary.totalProfit)}${formatPrice(props.summary.totalProfit)}`,
    `总收益率：${formatPercent(props.summary.totalProfitRate)}`,
    '─'.repeat(20),
    `持仓数量：${props.holdings.length} 只`,
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
  ]
  return lines.join('\n')
}

function generateHoldingsText(): string {
  const lines = [
    '📋 我的持仓',
    '─'.repeat(20),
    ...props.holdings.map(h => {
      const profitStr = h.profitRate != null
        ? `${profitIcon(h.profitRate)}${formatPercent(h.profitRate)}`
        : '—'
      return `${h.name}（${h.symbol}）${profitStr}`
    }),
    '─'.repeat(20),
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
  ]
  return lines.join('\n')
}

// 清除状态提示
function clearStatus() {
  shareStatus.value = 'idle'
  shareMessage.value = ''
}
</script>

<template>
  <div class="portfolio-share">
    <!-- 模式切换 -->
    <div class="mode-switch">
      <button
        :class="{ active: shareMode === 'profit' }"
        @click="shareMode = 'profit'; clearStatus()"
      >
        盈亏成绩
      </button>
      <button
        :class="{ active: shareMode === 'holdings' }"
        @click="shareMode = 'holdings'; clearStatus()"
      >
        持仓股票
      </button>
    </div>

    <!-- 分享卡片 -->
    <div id="share-card" class="share-card">
      <!-- 盈亏成绩模式 -->
      <div v-if="shareMode === 'profit'" class="profit-card">
        <div class="card-header">
          <span class="logo">📊</span>
          <h3>我的投资成绩</h3>
          <span class="date">{{ new Date().toLocaleDateString('zh-CN') }}</span>
        </div>

        <div class="profit-stats">
          <div class="stat main">
            <span class="stat-label">总盈亏</span>
            <span class="stat-value" :style="{ color: profitColor(summary.totalProfit) }">
              {{ profitIcon(summary.totalProfit) }}{{ formatPrice(summary.totalProfit) }}
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">总收益率</span>
            <span class="stat-value" :style="{ color: profitColor(summary.totalProfitRate) }">
              {{ formatPercent(summary.totalProfitRate) }}
            </span>
          </div>
        </div>

        <div class="profit-details">
          <div class="detail-row">
            <span>总投入</span>
            <span>{{ formatPrice(summary.totalCost) }}</span>
          </div>
          <div class="detail-row">
            <span>当前市值</span>
            <span>{{ formatPrice(summary.totalMarketValue) }}</span>
          </div>
          <div class="detail-row">
            <span>浮动盈亏</span>
            <span :style="{ color: profitColor(summary.profit) }">
              {{ profitIcon(summary.profit) }}{{ formatPrice(summary.profit) }}
            </span>
          </div>
          <div class="detail-row">
            <span>已实现盈亏</span>
            <span :style="{ color: profitColor(summary.realizedProfit) }">
              {{ profitIcon(summary.realizedProfit) }}{{ formatPrice(summary.realizedProfit) }}
            </span>
          </div>
        </div>

        <div class="profit-bar">
          <div
            class="profit-fill"
            :style="{
              width: `${Math.min(100, Math.abs(summary.profitRate ?? 0) * 100)}%`,
              background: summary.profitRate ?? 0 >= 0 ? 'var(--color-up)' : 'var(--color-down)',
            }"
          ></div>
        </div>
      </div>

      <!-- 持仓股票模式 -->
      <div v-else class="holdings-card">
        <div class="card-header">
          <span class="logo">📋</span>
          <h3>我的持仓</h3>
          <span class="date">{{ new Date().toLocaleDateString('zh-CN') }}</span>
        </div>

        <div class="holdings-list">
          <div
            v-for="holding in holdings"
            :key="holding.symbol"
            class="holding-item"
          >
            <div class="holding-info">
              <span class="holding-name">{{ holding.name }}</span>
              <span class="holding-symbol">{{ holding.symbol }}</span>
            </div>
            <div class="holding-profit" :style="{ color: profitColor(holding.profitRate) }">
              {{ formatPercent(holding.profitRate) }}
            </div>
          </div>
        </div>

        <div class="holdings-summary">
          <span>共 {{ holdings.length }} 只股票</span>
          <span :style="{ color: profitColor(summary.profitRate) }">
            整体 {{ formatPercent(summary.profitRate) }}
          </span>
        </div>
      </div>

      <div class="card-footer">
        <span class="watermark">AI Stock Dashboard</span>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="actions">
      <button class="btn primary" @click="generateImage" :disabled="generating">
        <span v-if="generating" class="spinner"></span>
        {{ generating ? '生成中...' : '保存图片' }}
      </button>
      <button class="btn ghost" @click="copyToClipboard">
        复制文字
      </button>
    </div>

    <!-- 状态提示 -->
    <Transition name="fade">
      <div v-if="shareStatus !== 'idle'" class="share-status" :class="shareStatus">
        {{ shareMessage }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.portfolio-share {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.mode-switch {
  display: flex;
  gap: var(--space-2);
}

.mode-switch button {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  color: var(--color-muted);
  font-size: var(--fs-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.mode-switch button.active {
  background: var(--color-info-bg);
  border-color: var(--color-link);
  color: var(--color-link);
  font-weight: 600;
}

.share-card {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  color: white;
  min-width: 320px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.card-header .logo {
  font-size: 24px;
}

.card-header h3 {
  flex: 1;
  margin: 0;
  font-size: var(--fs-lg);
  font-weight: 700;
}

.card-header .date {
  font-size: var(--fs-sm);
  opacity: 0.7;
}

.profit-stats {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat.main {
  flex: 1;
}

.stat-label {
  font-size: var(--fs-sm);
  opacity: 0.7;
}

.stat-value {
  font-size: var(--fs-2xl);
  font-weight: 800;
}

.profit-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-sm);
}

.detail-row span:first-child {
  opacity: 0.7;
}

.profit-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.profit-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.holdings-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.holding-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2);
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-sm);
}

.holding-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.holding-name {
  font-weight: 600;
  font-size: var(--fs-sm);
}

.holding-symbol {
  font-size: var(--fs-xs);
  opacity: 0.7;
}

.holding-profit {
  font-weight: 700;
  font-size: var(--fs-base);
}

.holdings-summary {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-sm);
  opacity: 0.8;
}

.card-footer {
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.watermark {
  font-size: var(--fs-xs);
  opacity: 0.5;
}

.actions {
  display: flex;
  gap: var(--space-2);
}

.actions button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.share-status {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  text-align: center;
}

.share-status.success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-up);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.share-status.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-down);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
