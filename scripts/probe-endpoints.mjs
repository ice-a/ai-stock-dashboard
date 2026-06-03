// 探测 Yahoo / Stooq / 公共代理可达性
const tests = [
  { name: 'corsproxy+yahoo-q1', url: 'https://corsproxy.io/?https%3A%2F%2Fquery1.finance.yahoo.com%2Fv7%2Ffinance%2Fquote%3Fsymbols%3DAAPL' },
  { name: 'corsproxy+yahoo-q2', url: 'https://corsproxy.io/?https%3A%2F%2Fquery2.finance.yahoo.com%2Fv7%2Ffinance%2Fquote%3Fsymbols%3DAAPL' },
  { name: 'allorigins+yahoo',    url: 'https://api.allorigins.win/raw?url=https%3A%2F%2Fquery1.finance.yahoo.com%2Fv7%2Ffinance%2Fquote%3Fsymbols%3DAAPL' },
  { name: 'stooq-direct',        url: 'https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcvn&h&e=csv' },
  { name: 'stooq-proxy',         url: 'https://corsproxy.io/?https%3A%2F%2Fstooq.com%2Fq%2Fl%2F%3Fs%3Daapl.us%26f%3Dsd2t2ohlcvn%26h%26e%3Dcsv' },
  { name: 'yahoo-direct',        url: 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=AAPL' },
]
;(async () => {
  for (const t of tests) {
    try {
      const t0 = Date.now()
      const r = await fetch(t.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000),
      })
      const text = await r.text()
      const ms = Date.now() - t0
      const snippet = text.substring(0, 100).replace(/\s+/g, ' ')
      console.log(`${t.name.padEnd(22)} ${r.status} ${String(ms).padStart(4)}ms  ${snippet}`)
    } catch (e) {
      console.log(`${t.name.padEnd(22)} ERR ${e.message || e}`)
    }
  }
})()
