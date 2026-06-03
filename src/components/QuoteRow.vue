<script setup lang="ts">
import { computed } from 'vue'
import { useQuotesStore } from '../stores/quotes'
import type { Quote } from '../types'
import { formatPercent, formatPrice, quoteTone } from '../utils/format'
import PriceTicker from './PriceTicker.vue'

const props = defineProps<{
  symbol: string
  d20?: number
  d60?: number
  d252?: number
  showBenchmark?: boolean
}>()

const quotesStore = useQuotesStore()
const quote = computed<Quote | undefined>(() => quotesStore.get(props.symbol))
const tone = computed(() => quoteTone(quote.value?.change))
</script>

<template>
  <div class="qr">
    <PriceTicker :value="quote?.change" :show-sign="true" :digits="2" class="main" :class="tone" />
    <div v-if="showBenchmark !== false" class="benchmarks small muted">
      <span v-if="props.d20 != null" :class="props.d20 >= 0 ? 'pos' : 'neg'">{{ formatPercent(props.d20 / 100) }}</span>
      <span v-if="props.d60 != null" :class="props.d60 >= 0 ? 'pos' : 'neg'">{{ formatPercent(props.d60 / 100) }}</span>
      <span v-if="props.d252 != null" :class="props.d252 >= 0 ? 'pos' : 'neg'">{{ formatPercent(props.d252 / 100) }}</span>
    </div>
  </div>
</template>

<style scoped>
.qr {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-end;
}
.main {
  font-weight: 600;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.benchmarks {
  display: flex;
  gap: 8px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.pos { color: var(--color-up); }
.neg { color: var(--color-down); }
.flat { color: var(--color-flat); }
</style>
