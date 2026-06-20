<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import AppSidebar from './components/AppSidebar.vue'
import WelcomeModal from './components/WelcomeModal.vue'
import { useQuotesStore } from './stores/quotes'
import { useRefreshStore } from './stores/refresh'
import { useWatchlistStore } from './stores/watchlist'
import { useAutoRefresh } from './composables/useAutoRefresh'
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts'
import './styles/mobile.css'

const quotesStore = useQuotesStore()
const refreshStore = useRefreshStore()
const watchlistStore = useWatchlistStore()
const route = useRoute()

const isPublicPage = computed(() => route.meta?.public === true)
const isMobile = ref(window.innerWidth <= 768)

// 监听窗口大小变化
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth <= 768
  })
}

const initialSymbols = computed(() => {
  return watchlistStore.items.map(item => item.symbol).slice(0, 100)
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

useKeyboardShortcuts([
  {
    key: 'r',
    ctrl: true,
    description: '刷新行情',
    action: () => refreshNow(),
  },
])

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

  // 清理旧的板块和主题数据
  try {
    localStorage.removeItem('ai-dashboard:sectors')
    localStorage.removeItem('ai-dashboard:active-sector')
    localStorage.removeItem('ai-dashboard:topics')
    localStorage.removeItem('ai-dashboard:active-topic')
    localStorage.removeItem('ai_sector_summary')
  } catch { /* ignore */ }

  scheduleInitialRefresh()
})

function handleRefresh() {
  refreshNow()
}
</script>

<template>
  <div class="app" :class="{ 'is-mobile': isMobile }">
    <WelcomeModal />
    <AppHeader v-if="!isPublicPage" @refresh="handleRefresh" />
    <div class="layout" :class="{ public: isPublicPage }">
      <AppSidebar v-if="!isPublicPage" />
      <main class="main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <keep-alive :include="['HomeView', 'StockDetailView']">
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
