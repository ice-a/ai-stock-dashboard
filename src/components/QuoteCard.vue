<script setup lang="ts">
import { computed } from 'vue'
import type { Quote } from '../types'
import { formatPrice, formatPercent, quoteTone } from '../utils/format'
import PriceTicker from './PriceTicker.vue'
import WatchlistButton from './WatchlistButton.vue'

const props = defineProps<{
  symbol: string
  name?: string
  region?: string
  market?: string
  layer?: string
  status?: string
  reason?: string
  quote?: Quote
  clickable?: boolean
}>()

const emit = defineEmits<{ (e: 'click'): void }>()

const tone = computed(() => quoteTone(props.quote?.change))
</script>

<template>
  <component :is="props.clickable ? 'a' : 'div'"
    class="qc card"
    :class="{ clickable: props.clickable }"
    @click="props.clickable && emit('click')"
    :href="props.clickable ? undefined : undefined"
  >
    <div class="head">
      <div class="info">
        <div class="row1">
          <span class="ticker">{{ props.symbol }}</span>
          <WatchlistButton :symbol="props.symbol" size="sm" @click.stop />
        </div>
        <div v-if="props.name" class="name small">{{ props.name }}</div>
      </div>
      <div class="price">
        <PriceTicker :value="props.quote?.price" :digits="2" />
        <div class="change" :class="tone">
          <PriceTicker :value="props.quote?.change" :show-sign="true" :digits="2" />
        </div>
      </div>
    </div>
    <div v-if="props.region || props.market || props.layer || props.status || props.reason" class="meta small muted">
      <span v-if="props.region || props.market" class="tag">{{ props.region || props.market }}</span>
      <span v-if="props.layer" class="tag">{{ props.layer }}</span>
      <span v-if="props.status" class="tag" :class="props.status.includes('拥挤') ? 'hot' : props.status.includes('等待') ? 'wait' : props.status.includes('滞后') ? 'lag' : props.status.includes('核心') ? 'core' : 'watch'">{{ props.status }}</span>
      <span v-if="props.reason && !props.status" class="reason-text">{{ props.reason }}</span>
    </div>
    <div v-if="props.quote?.source === 'fallback' || !props.quote" class="badge small muted">
      <span v-if="!props.quote">—</span>
      <span v-else-if="props.quote.source === 'fallback'">静态快照</span>
    </div>
    <div v-else-if="props.quote?.source" class="badge small muted">{{ props.quote.source }}</div>
  </component>
</template>

<style scoped>
.qc {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  font-size: 13px;
  min-height: 92px;
}
.qc.clickable { cursor: pointer; }
.qc.clickable:hover {
  border-color: var(--color-blue);
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}
.row1 {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ticker {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 12px;
  color: var(--color-ink);
}
.name {
  color: var(--color-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.price {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-end;
}
.price :first-child {
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.change {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.pos { color: var(--color-up); }
.neg { color: var(--color-down); }
.flat { color: var(--color-flat); }
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: auto;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.reason-text {
  font-size: 11px;
  color: var(--color-muted);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
