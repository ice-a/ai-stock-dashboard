// 一言 API
// https://developer.hitokoto.cn/sentence/

export interface HitokotoResponse {
  id: number
  hitokoto: string
  type: string
  from: string
  from_who: string | null
  creator: string
  created_at: string
  uuid: string
}

const TYPE_MAP: Record<string, string> = {
  a: '动画',
  b: '漫画',
  c: '游戏',
  d: '文学',
  e: '原创',
  f: '来自网络',
  g: '其他',
  h: '影视',
  i: '诗词',
  j: '网易云',
  k: '哲学',
  l: '抖机灵',
}

export async function fetchHitokoto(type?: string): Promise<HitokotoResponse> {
  const url = type
    ? `https://v1.hitokoto.cn/?c=${type}&encode=json`
    : 'https://v1.hitokoto.cn/?encode=json'
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Hitokoto ${r.status}`)
  return r.json()
}

export function getHitokotoTypeName(type: string): string {
  return TYPE_MAP[type] || type
}
