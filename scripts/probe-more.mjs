// 测试更多代理源
const tests = [
  { name: 'codetabs+yahoo',    url: 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent('https://query1.finance.yahoo.com/v7/finance/quote?symbols=AAPL') },
  { name: 'codetabs+stooq',    url: 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent('https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcvn&h&e=csv') },
  { name: 'crossorigin-me',    url: 'https://crossorigin.me/https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcvn&h&e=csv' },
  { name: 'goproxy+yahoo',     url: 'https://goproxy.akramer.workers.dev/?url=' + encodeURIComponent('https://query1.finance.yahoo.com/v7/finance/quote?symbols=AAPL') },
  { name: 'corsproxy.p.rapidapi', url: 'https://cors-proxy.htmldriven.com/?url=' + encodeURIComponent('https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcvn&h&e=csv') },
  { name: 'corsanywhere-h',    url: 'https://cors-anywhere.herokuapp.com/https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcvn&h&e=csv' },
  { name: 'DirectAAPL',        url: 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=AAPL' },
]
;(async () => {
  for (const t of tests) {
    try {
      const t0 = Date.now()
      const r = await fetch(t.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(12000),
      })
      const text = await r.text()
      const ms = Date.now() - t0
      console.log(`${t.name.padEnd(22)} ${r.status} ${String(ms).padStart(5)}ms  ${text.substring(0, 80).replace(/\s+/g, ' ')}`)
    } catch (e) {
      console.log(`${t.name.padEnd(22)} ERR ${(e.message || e).toString().substring(0, 60)}`)
    }
  }
})()
