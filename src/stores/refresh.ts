import { defineStore } from 'pinia'
import { ref } from 'vue'

export type RefreshStatusType = 'idle' | 'loading' | 'success' | 'error' | 'paused' | 'market-closed'

export const useRefreshStore = defineStore('refresh', () => {
  const status = ref<RefreshStatusType>('idle')
  const lastUpdate = ref<number | null>(null)
  const nextUpdateAt = ref<number | null>(null)
  const failures = ref(0)
  const message = ref<string | undefined>(undefined)

  const listInterval = ref(60)
  const detailInterval = ref(15)
  const enabled = ref(true)
  const pauseOnHidden = ref(true)
  const alignToClock = ref(false)

  function setStatus(s: RefreshStatusType, msg?: string) {
    status.value = s
    if (msg !== undefined) message.value = msg
  }
  function recordSuccess() {
    lastUpdate.value = Date.now()
    failures.value = 0
    status.value = 'success'
  }
  function recordFailure(msg: string) {
    failures.value++
    message.value = msg
    status.value = 'error'
  }
  function setNextUpdateAt(t: number) {
    nextUpdateAt.value = t
  }
  function setListInterval(s: number) {
    listInterval.value = s
  }
  function setDetailInterval(s: number) {
    detailInterval.value = s
  }
  function setEnabled(b: boolean) {
    enabled.value = b
    if (!b) status.value = 'paused'
  }
  function setPauseOnHidden(b: boolean) {
    pauseOnHidden.value = b
  }
  function setAlignToClock(b: boolean) {
    alignToClock.value = b
  }

  return {
    status, lastUpdate, nextUpdateAt, failures, message,
    listInterval, detailInterval, enabled, pauseOnHidden, alignToClock,
    setStatus, recordSuccess, recordFailure,
    setNextUpdateAt,
    setListInterval, setDetailInterval, setEnabled, setPauseOnHidden, setAlignToClock,
  }
})
