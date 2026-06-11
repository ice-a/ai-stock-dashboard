import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

export interface ShortcutConfig {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  action: () => void
}

export function useKeyboardShortcuts(extraShortcuts: ShortcutConfig[] = []) {
  const router = useRouter()

  const defaultShortcuts: ShortcutConfig[] = [
    {
      key: '/',
      description: '搜索股票',
      action: () => router.push('/search'),
    },
    {
      key: 'h',
      description: '回到首页',
      action: () => router.push('/'),
    },
    {
      key: 'f',
      description: '自选股',
      action: () => router.push('/favorites'),
    },
    {
      key: 'p',
      description: '个人持仓',
      action: () => router.push('/portfolio'),
    },
    {
      key: 'a',
      description: '预警中心',
      action: () => router.push('/alerts'),
    },
    {
      key: 'r',
      description: '研究库',
      action: () => router.push('/research'),
    },
    {
      key: ',',
      description: '设置',
      action: () => router.push('/settings'),
    },
    {
      key: 'Escape',
      description: '返回',
      action: () => router.back(),
    },
  ]

  const shortcuts = [...defaultShortcuts, ...extraShortcuts]

  function handler(e: KeyboardEvent) {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

    for (const s of shortcuts) {
      if (e.key !== s.key) continue
      if (s.ctrl && !e.ctrlKey && !e.metaKey) continue
      if (s.shift && !e.shiftKey) continue
      if (s.alt && !e.altKey) continue
      if (s.ctrl && (e.ctrlKey || e.metaKey)) {
        if (!s.shift && e.shiftKey) continue
        if (!s.alt && e.altKey) continue
      }
      e.preventDefault()
      s.action()
      return
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handler)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handler)
  })

  return { shortcuts }
}
