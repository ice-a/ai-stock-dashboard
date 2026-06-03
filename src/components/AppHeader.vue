<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { computed, ref } from 'vue'
import ThemeToggle from './ThemeToggle.vue'
import LangSwitch from './LangSwitch.vue'
import RefreshIndicator from './RefreshIndicator.vue'
import StockSearch from './StockSearch.vue'

const { t } = useI18n()
const route = useRoute()
const emit = defineEmits<{ (e: 'refresh'): void }>()
const showSearch = ref(false)

const subtitle = computed(() => {
  return t('app.subtitle')
})

const headerTitle = computed(() => {
  return (route.meta?.title as string) || t('app.title')
})
</script>

<template>
  <header class="hdr">
    <div class="hdr-left">
      <div class="brand">
        <div class="logo">
          <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
            <rect width="32" height="32" rx="6" fill="currentColor" opacity="0.15"/>
            <path d="M6 22 L11 14 L16 18 L21 8 L26 16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="26" cy="16" r="2.2" fill="currentColor"/>
          </svg>
        </div>
        <div>
          <div class="title">{{ headerTitle }}</div>
          <div class="subtitle small muted">{{ subtitle }}</div>
        </div>
      </div>
    </div>

    <!-- 搜索按钮（移动端可见） -->
    <div class="hdr-search">
      <button class="search-toggle" @click="showSearch = !showSearch" title="搜索股票">🔍</button>
      <div v-if="showSearch" class="search-overlay" @click.self="showSearch = false">
        <div class="search-modal">
          <StockSearch />
        </div>
      </div>
    </div>

    <div class="hdr-right">
      <RefreshIndicator @refresh="emit('refresh')" />
      <LangSwitch />
      <ThemeToggle />
    </div>
  </header>
</template>

<style scoped>
.hdr-search {
  position: relative;
}
.search-toggle {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 36px;
  height: 36px;
  cursor: pointer;
  font-size: 14px;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}
.search-toggle:hover {
  border-color: var(--color-link);
  background: var(--color-info-bg);
}
.search-overlay {
  position: fixed;
  top: var(--header-height);
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.3);
  z-index: 200;
  display: flex;
  justify-content: center;
  padding-top: var(--space-4);
}
.search-modal {
  width: 100%;
  max-width: 480px;
  padding: 0 var(--space-3);
}

.hdr {
  position: sticky;
  top: 0;
  z-index: var(--z-header);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  height: var(--header-height);
  padding: 0 var(--space-5);
  background: color-mix(in srgb, var(--color-bg-elevated) 88%, transparent);
  backdrop-filter: saturate(180%) blur(16px);
  -webkit-backdrop-filter: saturate(180%) blur(16px);
  border-bottom: 1px solid var(--color-border);
}
.hdr-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.logo {
  color: var(--color-blue);
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-muted);
  flex-shrink: 0;
}
.title {
  font-weight: 700;
  font-size: var(--fs-lg);
  color: var(--color-ink);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.subtitle {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hdr-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

@media (max-width: 640px) {
  .subtitle { display: none; }
  .hdr { padding: 0 var(--space-3); }
  .title { font-size: var(--fs-md); }
}
</style>
