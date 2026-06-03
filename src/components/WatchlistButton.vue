<script setup lang="ts">
import { computed } from 'vue'
import { useWatchlistStore } from '../stores/watchlist'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ symbol: string; size?: 'sm' | 'md' }>()

const watchlist = useWatchlistStore()
const { t } = useI18n()
const isFav = computed(() => watchlist.has(props.symbol))

function toggle() {
  watchlist.toggle(props.symbol)
}
</script>

<template>
  <button
    class="fav-btn"
    :class="[isFav ? 'active' : '', props.size === 'sm' ? 'sm' : 'md']"
    @click.stop.prevent="toggle"
    :title="isFav ? t('app.removeFromFavorites') : t('app.addToFavorites')"
    :aria-label="isFav ? t('app.removeFromFavorites') : t('app.addToFavorites')"
  >
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M12 21s-7-4.5-7-11a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 6.5-7 11-7 11z"
        :fill="isFav ? 'currentColor' : 'none'"
        stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  </button>
</template>

<style scoped>
.fav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  padding: 0;
}
.fav-btn:hover {
  color: var(--color-amber);
  background: var(--color-bg-soft);
}
.fav-btn.active {
  color: var(--color-amber);
}
.fav-btn.md { width: 32px; height: 32px; }
.fav-btn.sm { width: 24px; height: 24px; }
.fav-btn.sm svg { width: 12px; height: 12px; }
</style>
