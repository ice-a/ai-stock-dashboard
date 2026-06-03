<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppSidebar from './components/AppSidebar.vue'
import { useQuotesStore } from './stores/quotes'
import { useRefreshStore } from './stores/refresh'
import { useTopicStore } from './stores/topic'
import { usePortfolioStore } from './stores/portfolio'
import { useAutoRefresh } from './composables/useAutoRefresh'
import { ref, watch } from 'vue'

const quotesStore = useQuotesStore()
const refreshStore = useRefreshStore()
const topicStore = useTopicStore()
const portfolioStore = usePortfolioStore()
const route = useRoute()

const isPublicPage = computed(() => route.meta?.public === true)

// 启动时拉当前主题的观察名单 + 自选股
const initialSymbols = computed(() => {
  const set = new Set<string>()
  for (const i of topicStore.currentData.watchlistIdeas) set.add(i.symbol)
  for (const s of topicStore.currentData.leaderUniverse) set.add(s.symbol)
  for (const s of portfolioStore.symbols) set.add(s)
  return [...set].slice(0, 100)  // 限制初始量
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
  }
})

// 切换主题时清缓存重新拉
watch(() => topicStore.activeId, () => {
  quotesStore.clear()
  refreshNow()
})

// 启动时立即拉一次
const bootstrapped = ref(false)
if (!bootstrapped.value) {
  bootstrapped.value = true
  setTimeout(() => {
    if (!isPublicPage.value) refreshNow()
  }, 100)
}

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
            <component :is="Component" />
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
