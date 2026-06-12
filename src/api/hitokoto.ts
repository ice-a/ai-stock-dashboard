const HITOKOTO_API = 'https://v1.hitokoto.cn/'

export interface HitokotoSentence {
  hitokoto: string
  from: string
  from_who: string | null
  type: string
}

const DEFAULT_SENTENCES: HitokotoSentence[] = [
  { hitokoto: '投资最重要的品质是耐心和纪律。', from: '巴菲特', from_who: null, type: 'e' },
  { hitokoto: '别人恐惧时我贪婪，别人贪婪时我恐惧。', from: '巴菲特', from_who: null, type: 'e' },
  { hitokoto: '不要把所有鸡蛋放在一个篮子里。', from: '投资格言', from_who: null, type: 'e' },
  { hitokoto: '市场总是对的，错的是你的判断。', from: '投资格言', from_who: null, type: 'e' },
  { hitokoto: '成功的投资不在于你做了什么，而在于你没有做什么。', from: '投资格言', from_who: null, type: 'e' },
  { hitokoto: '时间是优秀企业的朋友，是平庸企业的敌人。', from: '巴菲特', from_who: null, type: 'e' },
  { hitokoto: '风险来自于你不知道自己在做什么。', from: '巴菲特', from_who: null, type: 'e' },
  { hitokoto: '股市是转移耐心者财富到有耐心者的工具。', from: '投资格言', from_who: null, type: 'e' },
  { hitokoto: '买入好公司的股票，然后永远不要卖出。', from: '费雪', from_who: null, type: 'e' },
  { hitokoto: '投资的秘诀在于，当别人恐惧时贪婪，当别人贪婪时恐惧。', from: '格雷厄姆', from_who: null, type: 'e' },
  { hitokoto: '复利是世界第八大奇迹。', from: '爱因斯坦', from_who: null, type: 'e' },
  { hitokoto: '你不需要成为每家公司的专家，只需要能评估在你能力圈内的公司。', from: '巴菲特', from_who: null, type: 'e' },
]

let lastIndex = -1

export async function fetchHitokoto(categories = 'def'): Promise<HitokotoSentence> {
  try {
    const url = `${HITOKOTO_API}?c=${categories}&encode=json`
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const data = await r.json() as HitokotoSentence
    return data
  } catch {
    return getRandomDefault()
  }
}

function getRandomDefault(): HitokotoSentence {
  let idx: number
  do {
    idx = Math.floor(Math.random() * DEFAULT_SENTENCES.length)
  } while (idx === lastIndex && DEFAULT_SENTENCES.length > 1)
  lastIndex = idx
  return DEFAULT_SENTENCES[idx]
}
