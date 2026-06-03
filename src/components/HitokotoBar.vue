<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchHitokoto, getHitokotoTypeName, type HitokotoResponse } from '../api/hitokoto'

const props = defineProps<{
  type?: string
  compact?: boolean
}>()

const data = ref<HitokotoResponse | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    data.value = await fetchHitokoto(props.type)
  } catch {
    // silent
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="hitokoto" :class="{ compact }" v-if="data" @click="load">
    <p class="hk-text">「{{ data.hitokoto }}」</p>
    <div class="hk-meta small muted">
      <span v-if="data.from_who">—— {{ data.from_who }}</span>
      <span v-if="data.from">《{{ data.from }}》</span>
      <span class="hk-type">{{ getHitokotoTypeName(data.type) }}</span>
    </div>
  </div>
</template>

<style scoped>
.hitokoto {
  cursor: pointer;
  padding: var(--space-3);
  border-left: 3px solid var(--color-border);
  transition: border-color var(--transition-fast);
}
.hitokoto:hover { border-left-color: var(--color-link); }
.hitokoto.compact { padding: var(--space-2); }
.hk-text {
  margin: 0;
  font-size: var(--fs-sm);
  line-height: 1.6;
  color: var(--color-ink-soft);
}
.compact .hk-text { font-size: var(--fs-xs); }
.hk-meta {
  margin-top: 4px;
  display: flex;
  gap: var(--space-2);
  align-items: center;
}
.hk-type {
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--color-bg-muted);
  font-size: 10px;
}
</style>
