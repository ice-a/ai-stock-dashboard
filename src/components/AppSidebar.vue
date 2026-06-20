<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'

const route = useRoute()
const userStore = useUserStore()
const avatarError = ref(false)

const navItems = computed(() => [
  { to: '/', label: '概览', icon: 'OV' },
  { to: '/search', label: '个股搜索', icon: 'SE' },
  { to: '/favorites', label: '自选股', icon: 'WL' },
  { to: '/portfolio', label: '持仓', icon: 'PF' },
  { to: '/mystic', label: '玄学选股', icon: 'MX' },
  { to: '/settings', label: '设置', icon: 'ST' },
  { to: '/user', label: '用户中心', icon: '👤' },
])

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}

const userAvatarUrl = computed(() => {
  if (!userStore.user?.avatarUrl || avatarError.value) return null
  return userStore.user.avatarUrl
})

const userAvatarInitial = computed(() => {
  if (!userStore.user) return '?'
  return userStore.user.nickname?.[0]?.toUpperCase() || userStore.user.userId[0].toUpperCase()
})

function onAvatarError() {
  avatarError.value = true
}
</script>

<template>
  <aside class="sb">
    <nav>
      <router-link
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="nav-item"
        :class="{ active: isActive(item.to) }"
      >
        <span class="ic">
          <template v-if="item.to === '/user' && userStore.isLoggedIn">
            <span class="nav-avatar">
              <img v-if="userAvatarUrl" :src="userAvatarUrl" :alt="userStore.user?.nickname" @error="onAvatarError" />
              <span v-else>{{ userAvatarInitial }}</span>
            </span>
          </template>
          <template v-else>
            {{ item.icon }}
          </template>
        </span>
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
  overflow: hidden;
}

.nav-item.active .ic {
  border-color: color-mix(in srgb, var(--color-link) 45%, var(--color-border));
  background: var(--color-info-bg);
}

.nav-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  color: var(--color-link);
  overflow: hidden;
}

.nav-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

  nav {
    flex-direction: row;
    justify-content: space-around;
    overflow-x: auto;
    gap: 2px;
  }

  .nav-item {
    flex-direction: column;
    flex-shrink: 0;
    padding: var(--space-1) var(--space-2);
    height: auto;
    min-height: 56px;
    font-size: 11px;
    gap: 2px;
  }
  
  .nav-item.active::before {
    display: none; /* 移动端隐藏活跃指示器 */
  }

  .ic { 
    display: flex;
    width: 24px;
    height: 24px;
    font-size: 12px;
  }
  
  .label {
    white-space: nowrap;
  }
}

@media (max-width: 375px) {
  .nav-item {
    padding: var(--space-1);
    min-width: 48px;
  }
}
</style>
