<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppSidebar from './components/AppSidebar.vue'
import { useQuotesStore } from './stores/quotes'
import { useRefreshStore } from './stores/refresh'
import { useTopicStore } from './stores/topic'
import { useAutoRefresh } from './composables/useAutoRefresh'
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts'

const quotesStore = useQuotesStore()
const refreshStore = useRefreshStore()
const topicStore = useTopicStore()
const route = useRoute()

const isPublicPage = computed(() => route.meta?.public === true)

const initialSymbols = computed(() => {
  const set = new Set<string>()
  for (const i of topicStore.currentData.watchlistIdeas) set.add(i.symbol)
  for (const s of topicStore.currentData.leaderUniverse) set.add(s.symbol)
  return [...set].slice(0, 100)
})

const enabled = computed(() => refreshStore.enabled)
const interval = computed(() => refreshStore.listInterval)

const { refreshNow } = useAutoRefresh({
  interval,
  enabled,
  fetcher: async () => {
    if (isPublicPage.value) return
    if (initialSymbols.value.length === 0) return
    await quotesStore.fetchAndStore(initialSymbols.value, { force: false })
    try {
      const { useAlertsStore } = await import('./stores/alerts')
      const alertsStore = useAlertsStore()
      alertsStore.evaluateAll()
    } catch { /* ignore */ }
  }
})

useKeyboardShortcuts([
  {
    key: 'r',
    ctrl: true,
    description: '刷新行情',
    action: () => refreshNow(),
  },
])

watch(() => topicStore.activeId, () => {
  quotesStore.clear()
  refreshNow()
})

const bootstrapped = ref(false)

function scheduleInitialRefresh() {
  const run = () => {
    if (!isPublicPage.value) refreshNow()
  }
  const idle = (window as Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
  }).requestIdleCallback
  if (idle) idle(run, { timeout: 2000 })
  else window.setTimeout(run, 1200)
}

onMounted(() => {
  if (bootstrapped.value) return
  bootstrapped.value = true
  scheduleInitialRefresh()
})

function handleRefresh() {
  refreshNow()
}
</script>

<template>
  <div class="app">
    <AppHeader v-if="!isPublicPage" @refresh="handleRefresh" />
    <div class="layout" :class="{ public: isPublicPage }">
      <AppSidebar v-if="!isPublicPage" />
      <main class="main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <keep-alive :include="['HomeView', 'StockDetailView', 'SectorsView', 'SectorDetailView']">
              <component :is="Component" />
            </keep-alive>
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  background: var(--color-bg);
}
.layout {
  display: flex;
  align-items: flex-start;
}
.layout.public {
  display: block;
}
.main {
  flex: 1;
  min-width: 0;
  min-height: calc(100vh - var(--header-height));
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .layout {
    flex-direction: column;
  }
  .main {
    padding-bottom: 70px;
  }
}
</style>
