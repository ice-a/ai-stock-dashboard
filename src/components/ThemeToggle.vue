<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useI18n } from 'vue-i18n'
import type { ThemeMode } from '../stores/settings'

const settings = useSettingsStore()
const { t } = useI18n()

const icon = computed(() => {
  if (settings.theme === 'dark') return '🌙'
  if (settings.theme === 'light') return '☀️'
  return '🖥'
})

const next = computed(() => {
  const order: ThemeMode[] = ['light', 'dark', 'system']
  const i = order.indexOf(settings.theme)
  return order[(i + 1) % order.length]
})

function cycle() {
  settings.setTheme(next.value)
}
</script>

<template>
  <button class="theme-toggle btn ghost icon" @click="cycle" :title="`Theme: ${settings.theme}`">
    <span class="ic">{{ icon }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  font-size: 16px;
}
.ic {
  display: inline-block;
  width: 18px;
  text-align: center;
}
</style>
