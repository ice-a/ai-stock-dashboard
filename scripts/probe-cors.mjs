// 看 Stooq 是否带 CORS 头
const tests = [
  'https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcvn&h&e=csv',
  'https://stooq.com/',
  'https://query1.finance.yahoo.com/v7/finance/quote?symbols=AAPL',
  'https://api.allorigins.win/raw?url=https%3A%2F%2Fstooq.com%2Fq%2Fl%2F%3Fs%3Daapl.us',
  'https://corsproxy.io/?https%3A%2F%2Fstooq.com%2Fq%2Fl%2F%3Fs%3Daapl.us',
  'https://api.codetabs.com/v1/proxy?quest=https%3A%2F%2Fstooq.com%2Fq%2Fl%2F%3Fs%3Daapl.us%26f%3Dsd2t2ohlcvn%26h%26e%3Dcsv',
  'https://thingproxy.freeboard.io/fetch/https://stooq.com/q/l/?s=aapl.us&f=sd2t2ohlcvn&h&e=csv',
]
;(async () => {
  for (const url of tests) {
    try {
      const r = await fetch(url, {
        method: 'OPTIONS',
        headers: { 'Origin': 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' },
      })
      const aco = r.headers.get('access-control-allow-origin')
      const acm = r.headers.get('access-control-allow-methods')
      console.log(`${url.substring(8, 60).padEnd(52)} ${r.status}  ACAO=${aco}  ACAM=${acm}`)
    } catch (e) {
      console.log(`${url.substring(8, 60).padEnd(52)} ERR ${e.message || e}`)
    }
  }
})()
