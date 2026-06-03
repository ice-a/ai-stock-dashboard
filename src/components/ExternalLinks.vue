<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { longportQuoteUrl, yahooFinanceUrl, xueqiuUrl } from '../utils/linkBuilder'

const props = defineProps<{ symbol: string; name?: string; size?: 'sm' | 'md' }>()

const { t } = useI18n()
const isCN = computed(() => props.symbol.endsWith('.SH') || props.symbol.endsWith('.SZ') || props.symbol.endsWith('.HK'))
</script>

<template>
  <div class="ex" v-if="props.symbol">
    <a :href="longportQuoteUrl(props.symbol)" target="_blank" rel="noopener" class="link" :title="'长桥行情'">长桥</a>
    <a :href="yahooFinanceUrl(props.symbol)" target="_blank" rel="noopener" class="link" :title="t('app.openInYahoo')">Yahoo</a>
    <a v-if="isCN" :href="xueqiuUrl(props.symbol)" target="_blank" rel="noopener" class="link" :title="t('app.openInXueqiu')">雪球</a>
  </div>
</template>

<style scoped>
.ex {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.link {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 7px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-muted);
  background: var(--color-bg-muted);
  border: 1px solid transparent;
  border-radius: 999px;
  text-decoration: none;
  transition: all var(--transition-fast);
}
.link:hover {
  color: var(--color-link);
  border-color: var(--color-link);
  text-decoration: none;
}
</style>
