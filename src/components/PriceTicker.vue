<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  value: number | null | undefined
  showSign?: boolean
  digits?: number
}>()

const flash = ref<'up' | 'down' | null>(null)
let timer: number | null = null
const last = ref<number | null>(null)

watch(() => props.value, (v) => {
  if (v == null) { last.value = null; return }
  if (last.value == null) { last.value = v; return }
  if (v === last.value) return
  if (v > last.value) {
    flash.value = 'up'
  } else if (v < last.value) {
    flash.value = 'down'
  }
  if (timer != null) clearTimeout(timer)
  timer = window.setTimeout(() => { flash.value = null }, 800)
  last.value = v
})

onUnmounted(() => {
  if (timer != null) clearTimeout(timer)
})

const display = computed(() => {
  if (props.value == null || isNaN(props.value)) return '—'
  const digits = props.digits ?? 2
  let s = props.value.toFixed(digits)
  if (props.showSign && props.value > 0) s = '+' + s
  return s
})
</script>

<template>
  <span :class="['pc', flash ? `flash-${flash}` : '']">{{ display }}</span>
</template>

<style scoped>
.pc {
  display: inline-block;
  padding: 0 2px;
  border-radius: 3px;
  font-variant-numeric: tabular-nums;
  transition: background-color 0.6s ease-out;
}
.flash-up {
  background: var(--color-up-bg);
  transition: background-color 0s;
}
.flash-down {
  background: var(--color-down-bg);
  transition: background-color 0s;
}
</style>
