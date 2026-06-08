<script setup lang="ts">
import { computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, GaugeChart, LineChart, RadarChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import { useSettingsStore } from '../stores/settings'
import { analyzeStock } from '../utils/analysis'
import { clamp, formatKLineTime, formatPercent, formatPrice, formatVolume } from '../utils/format'
import type { KLinePoint } from '../types'

use([
  CanvasRenderer,
  BarChart,
  GaugeChart,
  LineChart,
  RadarChart,
  GridComponent,
  LegendComponent,
  RadarComponent,
  TooltipComponent,
])

const props = defineProps<{
  data: KLinePoint[]
  currency?: string
}>()

const settings = useSettingsStore()
const isDark = computed(() => settings.theme === 'dark' || (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches))

const colors = computed(() => ({
  up: isDark.value ? '#f87171' : '#dc2626',
  down: isDark.value ? '#34d399' : '#16a34a',
  flat: isDark.value ? '#94a3b8' : '#6b7280',
  line: isDark.value ? '#60a5fa' : '#2563eb',
  cyan: isDark.value ? '#22d3ee' : '#0891b2',
  amber: isDark.value ? '#fbbf24' : '#b45309',
  grid: isDark.value ? '#1e293b' : '#eef3f8',
  text: isDark.value ? '#cbd5e1' : '#334155',
  bg: isDark.value ? 'rgba(19,28,46,0.96)' : 'rgba(255,255,255,0.96)',
  border: isDark.value ? '#334155' : '#d8e0e8',
}))

const analysis = computed(() => analyzeStock(props.data))

const latest = computed(() => props.data.at(-1) || null)

const last20Range = computed(() => {
  const recent = props.data.slice(-20)
  if (!recent.length) return { high: null as number | null, low: null as number | null }
  return {
    high: Math.max(...recent.map(p => p.high)),
    low: Math.min(...recent.map(p => p.low)),
  }
})

const kpis = computed(() => {
  const a = analysis.value
  return [
    { label: '综合评分', value: `${a.score}`, tone: a.score >= 60 ? 'pos' : a.score < 40 ? 'neg' : 'flat' },
    { label: '趋势', value: trendLabel(a.technical.trend), tone: a.technical.trend === 'up' ? 'pos' : a.technical.trend === 'down' ? 'neg' : 'flat' },
    { label: 'RSI14', value: a.technical.rsi14 != null ? a.technical.rsi14.toFixed(1) : '—', tone: rsiTone(a.technical.rsi14) },
    { label: '量比', value: a.volume.volumeRatio != null ? `${a.volume.volumeRatio.toFixed(2)}x` : '—', tone: a.volume.volumeRatio != null && a.volume.volumeRatio >= 1.5 ? 'pos' : 'flat' },
    { label: '支撑位', value: formatPrice(a.technical.support || last20Range.value.low, props.currency), tone: 'flat' },
    { label: '阻力位', value: formatPrice(a.technical.resistance || last20Range.value.high, props.currency), tone: 'flat' },
    { label: '最大回撤', value: formatPercent(a.performance.maxDrawdown != null ? -a.performance.maxDrawdown : null), tone: 'neg' },
    { label: '年化波动', value: formatPercent(a.performance.volatility), tone: a.performance.volatility != null && a.performance.volatility > 0.5 ? 'neg' : 'flat' },
  ]
})

function trendLabel(value: string): string {
  if (value === 'up') return '上行'
  if (value === 'down') return '下行'
  return '震荡'
}

function rsiTone(value: number | null): string {
  if (value == null) return 'flat'
  if (value >= 70) return 'neg'
  if (value <= 30) return 'pos'
  return 'flat'
}

function axisBase() {
  return {
    axisLine: { lineStyle: { color: colors.value.border } },
    axisTick: { show: false },
    axisLabel: { color: colors.value.text, fontSize: 10 },
    splitLine: { lineStyle: { color: colors.value.grid } },
  }
}

function tooltipBase() {
  return {
    backgroundColor: colors.value.bg,
    borderColor: colors.value.border,
    textStyle: { color: colors.value.text },
  }
}

const scoreOption = computed(() => ({
  backgroundColor: 'transparent',
  tooltip: tooltipBase(),
  series: [
    {
      type: 'gauge',
      min: 0,
      max: 100,
      radius: '96%',
      center: ['50%', '58%'],
      progress: { show: true, width: 10, itemStyle: { color: scoreColor(analysis.value.score) } },
      axisLine: { lineStyle: { width: 10, color: [[1, isDark.value ? '#263244' : '#e5edf5']] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { show: false },
      anchor: { show: false },
      detail: {
        valueAnimation: true,
        formatter: '{value}',
        color: colors.value.text,
        fontSize: 28,
        fontWeight: 800,
        offsetCenter: [0, '0%'],
      },
      title: {
        offsetCenter: [0, '34%'],
        color: colors.value.flat,
        fontSize: 12,
      },
      data: [{ value: analysis.value.score, name: '技术评分' }],
    },
  ],
}))

function scoreColor(score: number): string {
  if (score >= 60) return colors.value.up
  if (score < 40) return colors.value.down
  return colors.value.amber
}

const performanceOption = computed(() => {
  const perf = analysis.value.performance
  const items = [
    ['1周', perf.return1w],
    ['1月', perf.return1m],
    ['3月', perf.return3m],
    ['6月', perf.return6m],
    ['1年', perf.return1y],
  ] as Array<[string, number | null]>
  return {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltipBase(),
      trigger: 'axis',
      valueFormatter: (value: number) => `${value.toFixed(2)}%`,
    },
    grid: { left: 38, right: 12, top: 14, bottom: 28 },
    xAxis: {
      type: 'category',
      data: items.map(i => i[0]),
      ...axisBase(),
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: colors.value.text, fontSize: 10, formatter: '{value}%' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: colors.value.grid } },
    },
    series: [
      {
        type: 'bar',
        data: items.map(([, value]) => ({
          value: value != null ? +(value * 100).toFixed(2) : 0,
          itemStyle: { color: value == null ? colors.value.flat : value >= 0 ? colors.value.up : colors.value.down },
        })),
        barWidth: 24,
      },
    ],
  }
})

const radarOption = computed(() => {
  const a = analysis.value
  const rsiScore = a.technical.rsi14 == null ? 50 : clamp(100 - Math.abs(a.technical.rsi14 - 50) * 2, 0, 100)
  const trendScore = a.technical.trend === 'up' ? 85 : a.technical.trend === 'down' ? 25 : 55
  const macdScore = a.technical.macdSignal === 'bullish' ? 80 : a.technical.macdSignal === 'bearish' ? 25 : 55
  const volumeScore = a.volume.volumeRatio == null ? 50 : clamp(a.volume.volumeRatio * 42, 10, 100)
  const drawdownScore = a.performance.maxDrawdown == null ? 70 : clamp(100 - a.performance.maxDrawdown * 220, 0, 100)

  return {
    backgroundColor: 'transparent',
    tooltip: tooltipBase(),
    radar: {
      radius: '68%',
      indicator: [
        { name: '趋势', max: 100 },
        { name: 'RSI', max: 100 },
        { name: 'MACD', max: 100 },
        { name: '量能', max: 100 },
        { name: '回撤', max: 100 },
      ],
      axisName: { color: colors.value.text, fontSize: 11 },
      splitLine: { lineStyle: { color: colors.value.grid } },
      splitArea: { areaStyle: { color: ['transparent', isDark.value ? 'rgba(96,165,250,0.04)' : 'rgba(37,99,235,0.04)'] } },
      axisLine: { lineStyle: { color: colors.value.grid } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: [trendScore, rsiScore, macdScore, volumeScore, drawdownScore],
            areaStyle: { color: isDark.value ? 'rgba(96,165,250,0.24)' : 'rgba(37,99,235,0.18)' },
            lineStyle: { color: colors.value.line, width: 2 },
            itemStyle: { color: colors.value.line },
          },
        ],
      },
    ],
  }
})

const drawdownOption = computed(() => {
  let peak = props.data[0]?.close || 0
  const points = props.data.map(p => {
    if (p.close > peak) peak = p.close
    return peak > 0 ? +(((p.close - peak) / peak) * 100).toFixed(2) : 0
  })
  return {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltipBase(),
      trigger: 'axis',
      valueFormatter: (value: number) => `${value.toFixed(2)}%`,
    },
    grid: { left: 42, right: 12, top: 14, bottom: 28 },
    xAxis: {
      type: 'category',
      data: props.data.map(p => formatKLineTime(p.time)),
      ...axisBase(),
      axisLabel: { color: colors.value.text, fontSize: 10, interval: 'auto' },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      max: 0,
      axisLabel: { color: colors.value.text, fontSize: 10, formatter: '{value}%' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: colors.value.grid } },
    },
    series: [
      {
        type: 'line',
        data: points,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: colors.value.down },
        areaStyle: { color: isDark.value ? 'rgba(52,211,153,0.16)' : 'rgba(22,163,74,0.12)' },
      },
    ],
  }
})

const priceVolumeOption = computed(() => {
  const recent = props.data.slice(-30)
  const base = recent[0]?.close || 1
  return {
    backgroundColor: 'transparent',
    tooltip: {
      ...tooltipBase(),
      trigger: 'axis',
    },
    legend: {
      top: 0,
      right: 4,
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: colors.value.text, fontSize: 10 },
    },
    grid: { left: 42, right: 12, top: 30, bottom: 28 },
    xAxis: {
      type: 'category',
      data: recent.map(p => formatKLineTime(p.time)),
      ...axisBase(),
      splitLine: { show: false },
      axisLabel: { color: colors.value.text, fontSize: 10, interval: 'auto' },
    },
    yAxis: [
      {
        type: 'value',
        name: '价格',
        axisLabel: { color: colors.value.text, fontSize: 10, formatter: '{value}%' },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: colors.value.grid } },
      },
      {
        type: 'value',
        name: '量',
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '价格相对',
        type: 'line',
        data: recent.map(p => +(((p.close - base) / base) * 100).toFixed(2)),
        smooth: true,
        showSymbol: false,
        lineStyle: { color: colors.value.line, width: 2 },
      },
      {
        name: '成交量',
        type: 'bar',
        yAxisIndex: 1,
        data: recent.map(p => ({
          value: p.volume,
          itemStyle: { color: p.close >= p.open ? colors.value.up : colors.value.down, opacity: 0.35 },
        })),
        barWidth: '46%',
      },
    ],
  }
})
</script>

<template>
  <section class="insight-panel">
    <div class="insight-head">
      <div>
        <h2>关键图表</h2>
        <p class="small muted">基于当前 K 线区间自动计算，帮助快速判断趋势、收益、回撤和量能。</p>
      </div>
      <div v-if="latest" class="latest small muted">
        最新收盘 <strong>{{ formatPrice(latest.close, props.currency) }}</strong>
      </div>
    </div>

    <div class="kpi-grid">
      <div v-for="item in kpis" :key="item.label" class="kpi-tile">
        <span>{{ item.label }}</span>
        <strong :class="item.tone">{{ item.value }}</strong>
      </div>
    </div>

    <div v-if="analysis.signals.length" class="signal-row">
      <span v-for="signal in analysis.signals.slice(0, 6)" :key="signal">{{ signal }}</span>
    </div>

    <div class="chart-grid">
      <div class="chart-card score-card">
        <div class="chart-title">技术评分</div>
        <VChart :option="scoreOption" autoresize class="chart score-chart" />
      </div>
      <div class="chart-card">
        <div class="chart-title">区间收益</div>
        <VChart :option="performanceOption" autoresize class="chart" />
      </div>
      <div class="chart-card">
        <div class="chart-title">技术雷达</div>
        <VChart :option="radarOption" autoresize class="chart" />
      </div>
      <div class="chart-card">
        <div class="chart-title">最大回撤路径</div>
        <VChart :option="drawdownOption" autoresize class="chart" />
      </div>
      <div class="chart-card wide">
        <div class="chart-title">近 30 日价量</div>
        <VChart :option="priceVolumeOption" autoresize class="chart" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.insight-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}
.insight-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}
.insight-head h2 {
  margin: 0 0 4px;
}
.latest {
  text-align: right;
  white-space: nowrap;
}
.latest strong {
  color: var(--color-ink);
  font-variant-numeric: tabular-nums;
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: var(--space-2);
}
.kpi-tile {
  min-height: 64px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 4px;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
}
.kpi-tile span {
  color: var(--color-muted);
  font-size: var(--fs-xs);
}
.kpi-tile strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--fs-md);
  font-variant-numeric: tabular-nums;
}
.signal-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.signal-row span {
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-info-bg);
  color: var(--color-link);
  font-size: var(--fs-xs);
  font-weight: 700;
}
.chart-grid {
  display: grid;
  grid-template-columns: 0.75fr 1fr 1fr;
  gap: var(--space-3);
}
.chart-card {
  min-height: 230px;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  box-shadow: var(--shadow-sm);
}
.chart-card.wide {
  grid-column: span 2;
}
.chart-title {
  height: 20px;
  color: var(--color-muted);
  font-size: var(--fs-sm);
  font-weight: 700;
}
.chart {
  width: 100%;
  height: 190px;
}
.score-chart {
  height: 190px;
}
.pos { color: var(--color-up); }
.neg { color: var(--color-down); }
.flat { color: var(--color-flat); }

@media (max-width: 1100px) {
  .kpi-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .chart-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .insight-head {
    flex-direction: column;
  }
  .latest {
    text-align: left;
  }
  .kpi-grid,
  .chart-grid {
    grid-template-columns: 1fr;
  }
  .chart-card.wide {
    grid-column: auto;
  }
}
</style>
