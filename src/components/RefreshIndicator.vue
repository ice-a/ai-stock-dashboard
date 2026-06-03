<script setup lang="ts">
import { computed } from 'vue'
import { useRefreshStore } from '../stores/refresh'
import { useCountdown } from '../composables/useCountdown'
import { useI18n } from 'vue-i18n'

const refresh = useRefreshStore()
const { t } = useI18n()
const emit = defineEmits<{ (e: 'refresh'): void }>()

const { display } = useCountdown(computed(() => refresh.nextUpdateAt))

const statusInfo = computed(() => {
  switch (refresh.status) {
    case 'loading': return { color: 'blue', text: t('status.loading') }
    case 'success': return { color: 'green', text: t('status.success') }
    case 'error': return { color: 'red', text: t('status.error') }
    case 'paused': return { color: 'gray', text: t('status.paused') }
    case 'market-closed': return { color: 'gray', text: t('status.marketClosed') }
    default: return { color: 'gray', text: '' }
  }
})
</script>

<template>
  <button class="ri" :class="[`tone-${statusInfo.color}`]" @click="emit('refresh')" :title="refresh.message">
    <span class="dot" :class="{ active: refresh.status === 'loading' }"></span>
    <span class="label">{{ statusInfo.text }}</span>
    <span v-if="refresh.nextUpdateAt && refresh.status !== 'loading'" class="next">· {{ display }}</span>
    <span v-if="refresh.status === 'loading'" class="spinner"></span>
  </button>
</template>

<style scoped>
.ri {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-bg-elevated);
  color: var(--color-muted);
  font-size: var(--fs-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.ri:hover {
  border-color: var(--color-border-strong);
  color: var(--color-ink);
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  position: relative;
}
.dot.active::after {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  opacity: 0.5;
  animation: pulse 1s ease-out infinite;
}
@keyframes pulse {
  0% { transform: scale(0.8); opacity: 0.7; }
  100% { transform: scale(2.2); opacity: 0; }
}
.tone-blue { color: var(--color-blue); }
.tone-green { color: var(--color-up); }
.tone-red { color: var(--color-down); }
.tone-gray { color: var(--color-muted); }
.label { color: var(--color-ink-soft); }
.next { color: var(--color-muted); font-weight: 500; }
</style>
