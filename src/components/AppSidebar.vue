<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSectorStore } from '../stores/sector'

const router = useRouter()
const route = useRoute()
const sectorStore = useSectorStore()

const navItems = computed(() => [
  { to: '/', label: '概览', icon: 'OV' },
  { to: '/sectors', label: '板块', icon: 'SC' },
  { to: '/search', label: '个股搜索', icon: 'SE' },
  { to: '/favorites', label: '自选股', icon: 'WL' },
  { to: '/portfolio', label: '持仓', icon: 'PF' },
  { to: '/alerts', label: '预警中心', icon: 'AL' },
  { to: '/ask', label: 'AI 问答', icon: 'AI' },
  { to: '/mystic', label: '玄学选股', icon: 'MX' },
  { to: '/settings', label: '设置', icon: 'ST' },
])

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}

const showTopicMenu = ref(false)

function switchSector(id: string) {
  sectorStore.setActive(id)
  showTopicMenu.value = false
  router.push(`/sector/${id}`)
}
</script>

<template>
  <aside class="sb">
    <!-- 板块选择器 -->
    <div class="topic-picker">
      <button class="topic-btn" @click="showTopicMenu = !showTopicMenu" :title="sectorStore.activeSector?.description">
        <span class="emoji">{{ sectorStore.activeSector?.icon || '📊' }}</span>
        <span class="name">{{ sectorStore.activeSector?.name || '选择板块' }}</span>
        <span class="caret">▾</span>
      </button>
      <div v-if="showTopicMenu" class="topic-menu">
        <div class="topic-menu-title">切换板块</div>
        <button
          v-for="s in sectorStore.sectors"
          :key="s.id"
          class="topic-item"
          :class="{ active: s.id === sectorStore.activeId }"
          @click="switchSector(s.id)"
        >
          <span class="emoji">{{ s.icon || '📊' }}</span>
          <div class="meta">
            <div class="t-name">{{ s.name }}</div>
            <div class="t-stats">
              <span>{{ s.stocks.length }} 只股票</span>
              <span v-if="s.isBuiltIn">· 内置</span>
            </div>
          </div>
        </button>
        <router-link to="/sectors" class="topic-manage" @click="showTopicMenu = false">管理板块 →</router-link>
      </div>
    </div>

    <nav>
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        :class="{ active: isActive(item.to) }"
      >
        <span class="ic">{{ item.icon }}</span>
        <span class="label">{{ item.label }}</span>
      </router-link>
    </nav>
  </aside>
</template>

<style scoped>
.sb {
  position: sticky;
  top: var(--header-height);
  width: var(--sidebar-width);
  height: calc(100vh - var(--header-height));
  padding: var(--space-4) var(--space-3);
  border-right: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-bg-elevated) 72%, var(--color-bg));
  overflow-y: auto;
  flex-shrink: 0;
}
.topic-picker {
  position: relative;
  margin-bottom: var(--space-3);
}
.topic-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-ink);
  font-weight: 600;
  font-size: var(--fs-sm);
  cursor: pointer;
  text-align: left;
  transition: all var(--transition-fast);
}
.topic-btn:hover {
  border-color: var(--color-border-strong);
  background: var(--color-bg-muted);
}
.topic-btn .emoji { font-size: 16px; }
.topic-btn .name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.topic-btn .caret { color: var(--color-muted); font-size: 10px; }

.topic-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  z-index: 100;
  max-height: 60vh;
  overflow-y: auto;
}
.topic-menu-title {
  padding: 6px 8px;
  font-size: 11px;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.topic-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.topic-item:hover { background: var(--color-bg-soft); }
.topic-item.active { background: var(--color-info-bg); }
.topic-item .emoji { font-size: 18px; }
.topic-item .meta { flex: 1; min-width: 0; }
.topic-item .t-name { font-size: var(--fs-sm); font-weight: 600; }
.topic-item .t-stats { font-size: 11px; color: var(--color-muted); display: flex; gap: 4px; flex-wrap: wrap; }
.topic-manage {
  display: block;
  text-align: center;
  padding: 8px;
  font-size: 12px;
  color: var(--color-link);
  text-decoration: none;
  border-top: 1px solid var(--color-border);
  margin-top: 4px;
}
.topic-manage:hover { text-decoration: underline; }

nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 0 var(--space-3);
  height: 38px;
  border-radius: var(--radius-sm);
  color: var(--color-muted);
  text-decoration: none;
  font-size: var(--fs-base);
  font-weight: 500;
  transition: all var(--transition-fast);
}
.nav-item:hover {
  background: var(--color-bg-elevated);
  color: var(--color-ink);
  text-decoration: none;
}
.nav-item.active {
  background: var(--color-bg-elevated);
  color: var(--color-link);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}
.nav-item.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 9px;
  bottom: 9px;
  width: 3px;
  border-radius: var(--radius-full);
  background: var(--color-link);
}
.ic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  text-align: center;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0;
  opacity: 0.9;
}
.nav-item.active .ic {
  border-color: color-mix(in srgb, var(--color-link) 45%, var(--color-border));
  background: var(--color-info-bg);
}
@media (max-width: 900px) {
  .sb {
    width: 100%;
    position: fixed;
    top: auto;
    bottom: 0;
    height: auto;
    border-right: none;
    border-top: 1px solid var(--color-border);
    padding: var(--space-2);
    z-index: var(--z-sticky);
    background: var(--color-bg-elevated);
  }
  .topic-picker { display: none; }
  nav {
    flex-direction: row;
    overflow-x: auto;
    gap: 4px;
  }
  .nav-item {
    flex-shrink: 0;
    padding: 0 10px;
    height: 36px;
    font-size: 13px;
  }
  .ic { display: none; }
}
</style>
