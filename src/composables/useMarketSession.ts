// 简易市场交易时段判断（基于本机时区，简单启发式）
// 返回当前是否在交易时段
import { ref, onMounted, onUnmounted } from 'vue'

type Market = 'us' | 'cn' | 'hk' | 'jp' | 'kr' | 'tw' | 'eu' | 'in' | 'au' | 'my' | 'unknown'

export function detectMarket(symbol: string): Market {
  if (symbol.endsWith('.US')) return 'us'
  if (symbol.endsWith('.SH') || symbol.endsWith('.SZ')) return 'cn'
  if (symbol.endsWith('.HK')) return 'hk'
  if (symbol.endsWith('.T')) return 'jp'
  if (symbol.endsWith('.KS') || symbol.endsWith('.KQ')) return 'kr'
  if (symbol.endsWith('.TW')) return 'tw'
  if (symbol.endsWith('.PA') || symbol.endsWith('.DE') || symbol.endsWith('.AS')
      || symbol.endsWith('.SW') || symbol.endsWith('.MI') || symbol.endsWith('.HE')
      || symbol.endsWith('.ST')) return 'eu'
  if (symbol.endsWith('.NS') || symbol.endsWith('.BO')) return 'in'
  if (symbol.endsWith('.AX')) return 'au'
  if (symbol.endsWith('.KL')) return 'my'
  return 'unknown'
}

// 粗略判断当前是否交易时段（用浏览器本地时区估计）
export function isMarketOpen(market: Market, now = new Date()): boolean {
  const day = now.getDay()
  if (day === 0 || day === 6) {
    // 周末只有极少数市场开放，跳过
    if (market === 'au') {
      // 澳洲周六仍闭市
      return false
    }
    return false
  }
  const minutes = now.getHours() * 60 + now.getMinutes()
  switch (market) {
    case 'us': {
      // 简化：UTC-5 09:30-16:00 = 北京 22:30/23:30 - 05:00
      // 我们用浏览器本地时间做粗略判断
      // 假定用户时区为 UTC+8 (中国)
      const utcMin = minutes - (-now.getTimezoneOffset())
      const norm = ((utcMin % 1440) + 1440) % 1440
      return norm >= 13 * 60 + 30 && norm < 21 * 60
    }
    case 'cn':
      return (minutes >= 9 * 60 + 30 && minutes < 11 * 60 + 30) ||
             (minutes >= 13 * 60 && minutes < 15 * 60)
    case 'hk':
      return (minutes >= 9 * 60 + 30 && minutes < 12 * 60) ||
             (minutes >= 13 * 60 && minutes < 16 * 60)
    case 'jp':
      return (minutes >= 9 * 60 && minutes < 11 * 60 + 30) ||
             (minutes >= 12 * 60 + 30 && minutes < 15 * 60)
    case 'kr':
      return (minutes >= 9 * 60 && minutes < 15 * 60 + 30)
    case 'tw':
      return (minutes >= 9 * 60 && minutes < 13 * 60 + 30)
    case 'eu':
      // 欧股通常 15:00-23:30 北京（巴黎/法兰克福）
      return minutes >= 15 * 60 && minutes < 23 * 60 + 30
    case 'in':
      return (minutes >= 13 * 60 + 30 && minutes < 18 * 60 + 30)
    case 'au':
      return (minutes >= 9 * 60 && minutes < 13 * 60) ||
             (minutes >= 14 * 60 && minutes < 16 * 60)
    case 'my':
      return (minutes >= 9 * 60 && minutes < 12 * 60 + 30) ||
             (minutes >= 14 * 60 + 30 && minutes < 17 * 60)
    default:
      return true
  }
}

export function useMarketSession() {
  const now = ref(new Date())
  let timer: number | null = null

  onMounted(() => {
    timer = window.setInterval(() => {
      now.value = new Date()
    }, 60_000)
  })
  onUnmounted(() => {
    if (timer != null) clearInterval(timer)
  })

  function isOpen(market: Market) {
    return isMarketOpen(market, now.value)
  }

  return { now, isOpen }
}
