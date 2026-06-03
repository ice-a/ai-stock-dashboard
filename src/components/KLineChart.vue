<script setup lang="ts">
import { computed, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { CandlestickChart, LineChart, BarChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  AxisPointerComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import { formatKLineTime } from '../utils/format'
import { useSettingsStore } from '../stores/settings'

use([
  CanvasRenderer,
  CandlestickChart,
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  AxisPointerComponent,
])

const props = defineProps<{
  symbol: string
  range?: string
  data: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>
}>()

const settings = useSettingsStore()
const chartRef = ref<InstanceType<typeof VChart> | null>(null)
const isDark = computed(() => settings.theme === 'dark' || (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches))

// 计算 MA 均线
function calculateMA(dayCount: number, data: typeof props.data) {
  const result: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < dayCount - 1) {
      result.push(null)
      continue
    }
    let sum = 0
    for (let j = 0; j < dayCount; j++) {
      sum += data[i - j].close
    }
    result.push(+(sum / dayCount).toFixed(2))
  }
  return result
}

const option = computed(() => {
  const dates = props.data.map(d => formatKLineTime(d.time))
  const klineData = props.data.map(d => [d.open, d.close, d.low, d.high])
  const volumes = props.data.map((d, i) => ({
    value: d.volume,
    itemStyle: {
      color: d.close >= d.open
        ? (isDark.value ? 'rgba(52,211,153,0.6)' : 'rgba(22,163,74,0.6)')
        : (isDark.value ? 'rgba(248,113,113,0.6)' : 'rgba(220,38,38,0.6)')
    }
  }))
  const ma5 = calculateMA(5, props.data)
  const ma10 = calculateMA(10, props.data)
  const ma20 = calculateMA(20, props.data)
  const ma60 = calculateMA(60, props.data)

  const textStyle = { color: isDark.value ? '#cbd5e1' : '#334155' }
  const axisLine = { lineStyle: { color: isDark.value ? '#3a4a63' : '#dce3ea' } }
  const splitLine = { lineStyle: { color: isDark.value ? '#1e293b' : '#eef3f8' } }

  return {
    backgroundColor: 'transparent',
    animation: true,
    animationDuration: 300,
    legend: {
      data: ['MA5', 'MA10', 'MA20', 'MA60'],
      top: 0,
      textStyle,
      itemWidth: 14,
      itemHeight: 8,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: isDark.value ? 'rgba(19,28,46,0.95)' : 'rgba(255,255,255,0.95)',
      borderColor: isDark.value ? '#3a4a63' : '#dce3ea',
      textStyle: { color: isDark.value ? '#e6edf6' : '#17202a' },
    },
    axisPointer: {
      link: [{ xAxisIndex: 'all' }],
      label: { backgroundColor: isDark.value ? '#3a4a63' : '#b1bfd2' }
    },
    grid: [
      { left: 56, right: 16, top: 36, height: '60%' },
      { left: 56, right: 16, top: '74%', height: '18%' }
    ],
    xAxis: [
      {
        type: 'category', data: dates,
        boundaryGap: false,
        axisLine, axisTick: { show: false },
        axisLabel: { color: textStyle.color, fontSize: 10 },
        splitLine: { show: false },
      },
      {
        type: 'category', gridIndex: 1, data: dates,
        boundaryGap: false,
        axisLine, axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      }
    ],
    yAxis: [
      {
        scale: true, position: 'left',
        axisLine, axisTick: { show: false },
        axisLabel: { color: textStyle.color, fontSize: 10 },
        splitLine,
      },
      {
        scale: true, gridIndex: 1, position: 'left',
        axisLine, axisTick: { show: false },
        axisLabel: { color: textStyle.color, fontSize: 10 },
        splitLine: { show: false },
      }
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: 60, end: 100 },
      {
        type: 'slider', xAxisIndex: [0, 1], top: '94%',
        height: 16,
        start: 60, end: 100,
        borderColor: 'transparent',
        backgroundColor: isDark.value ? 'rgba(30,41,59,0.5)' : 'rgba(241,245,249,0.5)',
        fillerColor: isDark.value ? 'rgba(96,165,250,0.2)' : 'rgba(37,99,235,0.15)',
        handleStyle: { color: isDark.value ? '#60a5fa' : '#2563eb' },
        textStyle: { color: textStyle.color, fontSize: 10 },
      }
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: klineData,
        itemStyle: {
          color: isDark.value ? '#34d399' : '#16a34a',
          color0: isDark.value ? '#f87171' : '#dc2626',
          borderColor: isDark.value ? '#34d399' : '#16a34a',
          borderColor0: isDark.value ? '#f87171' : '#dc2626',
        }
      },
      { name: 'MA5', type: 'line', data: ma5, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#fbbf24' } },
      { name: 'MA10', type: 'line', data: ma10, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#a78bfa' } },
      { name: 'MA20', type: 'line', data: ma20, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#22d3ee' } },
      { name: 'MA60', type: 'line', data: ma60, smooth: true, showSymbol: false, lineStyle: { width: 1, color: '#f472b6' } },
      {
        name: 'Volume',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
      }
    ]
  }
})
</script>

<template>
  <div class="kline-wrap">
    <VChart
      ref="chartRef"
      :option="option"
      :autoresize="true"
      class="kline"
    />
  </div>
</template>

<style scoped>
.kline-wrap {
  width: 100%;
  height: 100%;
  min-height: 360px;
}
.kline {
  width: 100%;
  height: 100%;
  min-height: 360px;
}
</style>
