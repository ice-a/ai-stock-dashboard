<script setup lang="ts">
import { computed } from 'vue'

interface Dimension {
  name: string
  score: number
  analysis: string
  signal: 'positive' | 'neutral' | 'negative'
}

interface RatingData {
  overallRating: string
  overallScore: number
  summary: string
  buyPrice?: number
  sellPrice?: number
  stopLoss?: number
  riskLevel?: string
  dimensions: Dimension[]
  risks: string[]
  catalysts: string[]
}

const props = defineProps<{
  data: RatingData | null
  loading?: boolean
}>()

const ratingColor = computed(() => {
  if (!props.data) return 'var(--color-muted)'
  const rating = props.data.overallRating
  if (rating === '买入' || rating === '增持') return 'var(--color-up)'
  if (rating === '减持' || rating === '卖出') return 'var(--color-down)'
  return 'var(--color-flat)'
})

const scoreColor = (score: number) => {
  if (score >= 8) return 'var(--color-up)'
  if (score >= 6) return 'var(--color-flat)'
  return 'var(--color-down)'
}

const signalIcon = (signal: string) => {
  if (signal === 'positive') return '↑'
  if (signal === 'negative') return '↓'
  return '→'
}

const signalClass = (signal: string) => {
  if (signal === 'positive') return 'pos'
  if (signal === 'negative') return 'neg'
  return 'flat'
}

const riskColor = computed(() => {
  if (!props.data?.riskLevel) return 'var(--color-muted)'
  if (props.data.riskLevel === '低') return 'var(--color-up)'
  if (props.data.riskLevel === '高') return 'var(--color-down)'
  return 'var(--color-flat)'
})
</script>

<template>
  <div class="stock-rating">
    <div v-if="loading" class="loading">
      <span class="spinner"></span>
      <span>AI 分析中...</span>
    </div>

    <div v-else-if="data" class="rating-content">
      <!-- 总体评级 -->
      <div class="overall">
        <div class="rating-badge" :style="{ color: ratingColor }">
          {{ data.overallRating }}
        </div>
        <div class="score">
          <span class="score-value" :style="{ color: scoreColor(data.overallScore) }">
            {{ data.overallScore.toFixed(1) }}
          </span>
          <span class="score-label">/10</span>
        </div>
        <div v-if="data.riskLevel" class="risk-badge" :style="{ color: riskColor }">
          风险：{{ data.riskLevel }}
        </div>
      </div>

      <!-- 总结 -->
      <p class="summary">{{ data.summary }}</p>

      <!-- 交易建议 -->
      <div v-if="data.buyPrice || data.sellPrice || data.stopLoss" class="trade-advice">
        <h4>交易建议</h4>
        <div class="price-grid">
          <div v-if="data.buyPrice" class="price-item buy">
            <span class="label">建议买入</span>
            <span class="value">{{ data.buyPrice }}</span>
          </div>
          <div v-if="data.sellPrice" class="price-item sell">
            <span class="label">目标卖出</span>
            <span class="value">{{ data.sellPrice }}</span>
          </div>
          <div v-if="data.stopLoss" class="price-item stop">
            <span class="label">止损位</span>
            <span class="value">{{ data.stopLoss }}</span>
          </div>
        </div>
      </div>

      <!-- 维度分析 -->
      <div class="dimensions">
        <h4>多维度分析</h4>
        <div class="dimension-grid">
          <div
            v-for="dim in data.dimensions"
            :key="dim.name"
            class="dimension-item"
          >
            <div class="dim-header">
              <span class="dim-name">{{ dim.name }}</span>
              <span class="dim-score" :style="{ color: scoreColor(dim.score) }">
                {{ dim.score }}
              </span>
            </div>
            <div class="dim-signal" :class="signalClass(dim.signal)">
              {{ signalIcon(dim.signal) }}
            </div>
            <p class="dim-analysis">{{ dim.analysis }}</p>
          </div>
        </div>
      </div>

      <!-- 催化剂和风险 -->
      <div class="catalysts-risks">
        <div v-if="data.catalysts?.length" class="catalysts">
          <h4>催化剂</h4>
          <ul>
            <li v-for="(item, i) in data.catalysts" :key="i">{{ item }}</li>
          </ul>
        </div>
        <div v-if="data.risks?.length" class="risks">
          <h4>风险提示</h4>
          <ul>
            <li v-for="(item, i) in data.risks" :key="i">{{ item }}</li>
          </ul>
        </div>
      </div>
    </div>

    <div v-else class="empty">
      <p>点击"AI 分析"获取多维度评级</p>
    </div>
  </div>
</template>

<style scoped>
.stock-rating {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}

.loading {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-muted);
  padding: var(--space-4) 0;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-link);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.rating-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.overall {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.rating-badge {
  font-size: var(--fs-2xl);
  font-weight: 800;
  padding: var(--space-2) var(--space-4);
  border: 2px solid currentColor;
  border-radius: var(--radius-md);
}

.score {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.score-value {
  font-size: var(--fs-3xl);
  font-weight: 800;
}

.score-label {
  color: var(--color-muted);
  font-size: var(--fs-sm);
}

.risk-badge {
  font-size: var(--fs-sm);
  font-weight: 600;
  padding: var(--space-1) var(--space-2);
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
}

.summary {
  font-size: var(--fs-base);
  line-height: 1.6;
  color: var(--color-ink);
}

.trade-advice {
  padding: var(--space-3);
  background: var(--color-bg-soft);
  border-radius: var(--radius-md);
}

.trade-advice h4 {
  margin: 0 0 var(--space-3);
  font-size: var(--fs-sm);
  color: var(--color-muted);
}

.price-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.price-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
}

.price-item .label {
  font-size: var(--fs-xs);
  color: var(--color-muted);
}

.price-item .value {
  font-size: var(--fs-lg);
  font-weight: 700;
}

.price-item.buy .value {
  color: var(--color-up);
}

.price-item.sell .value {
  color: var(--color-down);
}

.price-item.stop .value {
  color: var(--color-muted);
}

.dimensions h4 {
  margin: 0 0 var(--space-3);
  font-size: var(--fs-base);
}

.dimension-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
}

.dimension-item {
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
}

.dim-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.dim-name {
  font-weight: 600;
  font-size: var(--fs-sm);
}

.dim-score {
  font-weight: 800;
  font-size: var(--fs-lg);
}

.dim-signal {
  font-size: var(--fs-sm);
  font-weight: 600;
  margin-bottom: var(--space-2);
}

.dim-analysis {
  font-size: var(--fs-xs);
  color: var(--color-muted);
  line-height: 1.5;
  margin: 0;
}

.catalysts-risks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.catalysts-risks h4 {
  margin: 0 0 var(--space-2);
  font-size: var(--fs-sm);
}

.catalysts-risks ul {
  margin: 0;
  padding-left: var(--space-4);
}

.catalysts-risks li {
  font-size: var(--fs-sm);
  line-height: 1.6;
  margin-bottom: var(--space-1);
}

.catalysts li {
  color: var(--color-up);
}

.risks li {
  color: var(--color-down);
}

.empty {
  text-align: center;
  padding: var(--space-4);
  color: var(--color-muted);
}

.pos { color: var(--color-up); }
.neg { color: var(--color-down); }
.flat { color: var(--color-flat); }

@media (max-width: 640px) {
  .dimension-grid {
    grid-template-columns: 1fr;
  }
  .catalysts-risks {
    grid-template-columns: 1fr;
  }
  .price-grid {
    grid-template-columns: 1fr;
  }
}
</style>
