// 测试 allorigins 代理 Yahoo（带 User-Agent）
const tests = [
  { name: 'allorigins+yahoo+UA', url: 'https://api.allorigins.win/raw?url=https%3A%2F%2Fquery1.finance.yahoo.com%2Fv7%2Ffinance%2Fquote%3Fsymbols%3DAAPL' },
  { name: 'allorigins+yahoo v2', url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://query1.finance.yahoo.com/v7/finance/quote?symbols=AAPL') },
  { name: 'allorigins+stooq',   url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcvn&h&e=csv') },
]
;(async () => {
  for (const t of tests) {
    try {
      const t0 = Date.now()
      const r = await fetch(t.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(15000),
      })
      const text = await r.text()
      const ms = Date.now() - t0
      console.log(`${t.name.padEnd(25)} ${r.status} ${String(ms).padStart(5)}ms  ${text.substring(0, 100).replace(/\s+/g, ' ')}`)
    } catch (e) {
      console.log(`${t.name.padEnd(25)} ERR ${e.message || e}`)
    }
  }
})()
