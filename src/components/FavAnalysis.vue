<script setup lang="ts">
import { computed } from 'vue'
import type { StockAnalysis } from '../utils/analysis'
import { formatPercent, formatPrice, formatVolume } from '../utils/format'

const props = defineProps<{
  analysis: StockAnalysis
  price?: number | null
}>()

const scoreColor = computed(() => {
  const s = props.analysis.score
  if (s >= 70) return 'var(--color-up)'
  if (s >= 40) return 'var(--color-flat)'
  return 'var(--color-down)'
})

const scoreLabel = computed(() => {
  const s = props.analysis.score
  if (s >= 80) return '强势'
  if (s >= 60) return '偏多'
  if (s >= 40) return '中性'
  if (s >= 20) return '偏空'
  return '弱势'
})

function pct(v: number | null): string {
  return v != null ? formatPercent(v) : '—'
}

function tone(v: number | null): string {
  if (v == null) return ''
  return v >= 0 ? 'pos' : 'neg'
}

function rsiClass(v: number | null): string {
  if (v == null) return ''
  if (v > 70) return 'neg'
  if (v < 30) return 'pos'
  return ''
}

const trendIcon = computed(() => {
  switch (props.analysis.technical.trend) {
    case 'up': return '↑'
    case 'down': return '↓'
    default: return '→'
  }
})

const trendClass = computed(() => {
  switch (props.analysis.technical.trend) {
    case 'up': return 'pos'
    case 'down': return 'neg'
    default: return 'flat'
  }
})
</script>

<template>
  <div class="analysis-card">
    <!-- 评分和信号 -->
    <div class="score-row">
      <div class="score-badge" :style="{ borderColor: scoreColor, color: scoreColor }">
        <span class="score-num">{{ analysis.score }}</span>
        <span class="score-label">{{ scoreLabel }}</span>
      </div>
      <div class="signals">
        <span v-for="s in analysis.signals" :key="s" class="signal-tag">{{ s }}</span>
      </div>
    </div>

    <div class="metrics-grid">
      <!-- 技术指标 -->
      <div class="metric-group">
        <h4>技术面</h4>
        <div class="metric-row">
          <span class="label">趋势</span>
          <span :class="trendClass">{{ trendIcon }} {{ analysis.technical.trend === 'up' ? '上升' : analysis.technical.trend === 'down' ? '下降' : '横盘' }}</span>
        </div>
        <div class="metric-row">
          <span class="label">RSI(14)</span>
          <span :class="rsiClass(analysis.technical.rsi14)">{{ analysis.technical.rsi14 != null ? analysis.technical.rsi14.toFixed(1) : '—' }}</span>
        </div>
        <div class="metric-row">
          <span class="label">MACD</span>
          <span :class="analysis.technical.macdSignal === 'bullish' ? 'pos' : analysis.technical.macdSignal === 'bearish' ? 'neg' : ''">
            {{ analysis.technical.macdSignal === 'bullish' ? '金叉' : analysis.technical.macdSignal === 'bearish' ? '死叉' : '中性' }}
          </span>
        </div>
        <div class="metric-row">
          <span class="label">MA5/MA20</span>
          <span>{{ analysis.technical.ma5 != null ? formatPrice(analysis.technical.ma5) : '—' }} / {{ analysis.technical.ma20 != null ? formatPrice(analysis.technical.ma20) : '—' }}</span>
        </div>
      </div>

      <!-- 收益率 -->
      <div class="metric-group">
        <h4>收益率</h4>
        <div class="metric-row">
          <span class="label">近1周</span>
          <span :class="tone(analysis.performance.return1w)">{{ pct(analysis.performance.return1w) }}</span>
        </div>
        <div class="metric-row">
          <span class="label">近1月</span>
          <span :class="tone(analysis.performance.return1m)">{{ pct(analysis.performance.return1m) }}</span>
        </div>
        <div class="metric-row">
          <span class="label">近3月</span>
          <span :class="tone(analysis.performance.return3m)">{{ pct(analysis.performance.return3m) }}</span>
        </div>
        <div class="metric-row">
          <span class="label">近1年</span>
          <span :class="tone(analysis.performance.return1y)">{{ pct(analysis.performance.return1y) }}</span>
        </div>
      </div>

      <!-- 风险指标 -->
      <div class="metric-group">
        <h4>风险</h4>
        <div class="metric-row">
          <span class="label">波动率</span>
          <span>{{ analysis.performance.volatility != null ? (analysis.performance.volatility * 100).toFixed(1) + '%' : '—' }}</span>
        </div>
        <div class="metric-row">
          <span class="label">最大回撤</span>
          <span class="neg">{{ analysis.performance.maxDrawdown != null ? formatPercent(-analysis.performance.maxDrawdown) : '—' }}</span>
        </div>
        <div class="metric-row">
          <span class="label">夏普比率</span>
          <span>{{ analysis.performance.sharpe != null ? analysis.performance.sharpe.toFixed(2) : '—' }}</span>
        </div>
        <div class="metric-row">
          <span class="label">支撑/阻力</span>
          <span>{{ analysis.technical.support != null ? formatPrice(analysis.technical.support) : '—' }} / {{ analysis.technical.resistance != null ? formatPrice(analysis.technical.resistance) : '—' }}</span>
        </div>
      </div>

      <!-- 成交量 -->
      <div class="metric-group">
        <h4>成交量</h4>
        <div class="metric-row">
          <span class="label">20日均量</span>
          <span>{{ analysis.volume.avgVolume20d != null ? formatVolume(analysis.volume.avgVolume20d) : '—' }}</span>
        </div>
        <div class="metric-row">
          <span class="label">量比</span>
          <span :class="analysis.volume.volumeRatio != null && analysis.volume.volumeRatio > 1.5 ? 'pos' : ''">
            {{ analysis.volume.volumeRatio != null ? analysis.volume.volumeRatio.toFixed(2) : '—' }}
          </span>
        </div>
        <div class="metric-row">
          <span class="label">量能趋势</span>
          <span :class="analysis.volume.volumeTrend === 'increasing' ? 'pos' : analysis.volume.volumeTrend === 'decreasing' ? 'neg' : ''">
            {{ analysis.volume.volumeTrend === 'increasing' ? '递增' : analysis.volume.volumeTrend === 'decreasing' ? '递减' : '平稳' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.analysis-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--color-bg-soft);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}
.score-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.score-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 16px;
  border: 2px solid;
  border-radius: var(--radius-md);
  min-width: 64px;
}
.score-num {
  font-size: var(--fs-xl);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.score-label {
  font-size: var(--fs-xs);
  font-weight: 600;
}
.signals {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.signal-tag {
  display: inline-block;
  padding: 2px 8px;
  font-size: var(--fs-xs);
  border-radius: 999px;
  background: var(--color-bg-muted);
  color: var(--color-ink-soft);
  white-space: nowrap;
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-3);
}
.metric-group h4 {
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--color-muted);
  margin: 0 0 var(--space-1) 0;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--color-border);
}
.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0;
  font-size: var(--fs-sm);
  font-variant-numeric: tabular-nums;
}
.metric-row .label {
  color: var(--color-muted);
}
.pos { color: var(--color-up); font-weight: 600; }
.neg { color: var(--color-down); font-weight: 600; }
.flat { color: var(--color-flat); }
</style>
