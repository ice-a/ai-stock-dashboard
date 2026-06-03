<script setup lang="ts">
import { computed } from 'vue'
import type { Quote } from '../types'
import { formatPercent, quoteTone } from '../utils/format'

const props = defineProps<{
  value: number | null | undefined
  prevValue?: number | null
  digits?: number
  signed?: boolean
  suffix?: string
  flash?: boolean
}>()

const tone = computed(() => quoteTone(props.value))
const display = computed(() => {
  if (props.value == null || isNaN(props.value)) return '—'
  if (props.digits != null) {
    return props.value.toFixed(props.digits)
  }
  if (Math.abs(props.value) < 0.01 && props.value !== 0) {
    return props.value.toExponential(2)
  }
  return formatPercent(props.value)
})

const flashClass = computed(() => {
  if (!props.flash || props.prevValue == null) return ''
  if (props.value == null) return ''
  if (props.value > props.prevValue) return 'flash-up'
  if (props.value < props.prevValue) return 'flash-down'
  return ''
})
</script>

<template>
  <span :class="[tone, flashClass]">{{ display }}{{ suffix || '' }}</span>
</template>
