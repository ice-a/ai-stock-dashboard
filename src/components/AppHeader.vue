<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { computed, ref } from 'vue'
import ThemeToggle from './ThemeToggle.vue'
import LangSwitch from './LangSwitch.vue'
import RefreshIndicator from './RefreshIndicator.vue'
import { useAccountStore } from '../stores/account'
import { useUserStore } from '../stores/user'
import { useMarketSession } from '../composables/useMarketSession'

const { t } = useI18n()
const route = useRoute()
const emit = defineEmits<{ (e: 'refresh'): void }>()
const account = useAccountStore()
const userStore = useUserStore()
const { isOpen } = useMarketSession()
const avatarError = ref(false)

const subtitle = computed(() => {
  return t('app.subtitle')
})

const headerTitle = computed(() => {
  return (route.meta?.title as string) || t('app.title')
})

const accountLabel = computed(() => {
  if (userStore.isLoggedIn) return userStore.user?.nickname || userStore.user?.userId || '用户'
  if (account.authenticated) return '已验证'
  if (account.guest) return '游客'
  return account.enabled ? '未登录' : '本地'
})

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

const marketStatuses = computed(() => {
  return [
    { market: 'cn' as const, label: 'A股', open: isOpen('cn') },
    { market: 'us' as const, label: '美股', open: isOpen('us') },
    { market: 'hk' as const, label: '港股', open: isOpen('hk') },
  ]
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

    <div class="hdr-right">
      <div class="market-statuses">
        <span
          v-for="ms in marketStatuses"
          :key="ms.market"
          class="market-dot"
          :class="{ open: ms.open }"
          :title="`${ms.label} ${ms.open ? '交易中' : '已休市'}`"
        >
          {{ ms.label }}
        </span>
      </div>
      <router-link to="/user" class="user-chip" :title="`用户：${accountLabel}`">
        <span class="user-avatar-small">
          <img v-if="userAvatarUrl" :src="userAvatarUrl" :alt="accountLabel" @error="onAvatarError" />
          <span v-else class="avatar-initial">{{ userAvatarInitial }}</span>
        </span>
        <span class="user-label">{{ accountLabel }}</span>
      </router-link>
      <RefreshIndicator @refresh="emit('refresh')" />
      <LangSwitch />
      <ThemeToggle />
    </div>
  </header>
</template>

<style scoped>
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
.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 140px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-elevated);
  color: var(--color-ink);
  font-size: var(--fs-sm);
  font-weight: 600;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-chip:hover {
  border-color: var(--color-border-strong);
  text-decoration: none;
}

.user-avatar-small {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-info-bg);
  color: var(--color-link);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
  overflow: hidden;
}

.user-avatar-small img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-initial {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.user-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.market-statuses {
  display: flex;
  align-items: center;
  gap: 6px;
}
.market-dot {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 600;
  color: var(--color-muted);
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--color-bg-muted);
}
.market-dot::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-muted);
}
.market-dot.open {
  color: var(--color-up);
  background: color-mix(in srgb, var(--color-up) 10%, transparent);
}
.market-dot.open::before {
  background: var(--color-up);
}

@media (max-width: 640px) {
  .subtitle { display: none; }
  .user-chip { max-width: 72px; }
  .hdr { padding: 0 var(--space-3); }
  .title { font-size: var(--fs-md); }
}
</style>
