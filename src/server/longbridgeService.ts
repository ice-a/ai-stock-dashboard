import crypto from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import protobuf from 'protobufjs'
import WebSocket from 'ws'

export interface LongbridgeQuoteDto {
  symbol: string
  lastDone: string
  prevClose: string
  open: string
  high: string
  low: string
  volume: number
  turnover: string
  timestamp: number | null
  tradeStatus: number
}

export interface LongbridgeCandlestickDto {
  close: string
  open: string
  low: string
  high: string
  volume: number
  turnover: string
  timestamp: number | null
}

export interface LongbridgeStatusDto {
  configured: boolean
  region: string
  host: string
  quoteHost: string
  sdkLoaded: boolean
  disabledReason: string
}

type Query = Record<string, string | number | boolean | undefined>

const HTTP_URL = 'https://openapi.longbridge.com'
const HTTP_URL_CN = 'https://openapi.longbridge.cn'
const QUOTE_WS_URL = 'wss://openapi-quote.longbridge.com/v2'
const QUOTE_WS_URL_CN = 'wss://openapi-quote.longbridge.cn/v2'
const REQUEST_TIMEOUT_MS = 8_000
const CONNECT_TIMEOUT_MS = 4_000

const CMD_AUTH = 2
const CMD_GET_REALTIME_QUOTE = 11
const CMD_GET_SECURITY_CANDLESTICKS = 19

const PACKAGE_TYPE_REQUEST = 1
const PACKAGE_TYPE_RESPONSE = 2
const PACKAGE_FLAG_GZIP = 0b00100000

const STATUS_NORMAL = 0

const QUOTE_PROTO = `
syntax = "proto3";

message Error {
  int32 code = 1;
  string msg = 2;
}

message AuthRequest {
  string token = 1;
  map<string, string> metadata = 2;
}

message AuthResponse {
  string session_id = 1;
  int64 expires = 2;
  uint32 limit = 3;
  uint32 online = 4;
}

message MultiSecurityRequest {
  repeated string symbol = 1;
}

message SecurityQuoteResponse {
  repeated SecurityQuote secu_quote = 1;
}

message SecurityQuote {
  string symbol = 1;
  string last_done = 2;
  string prev_close = 3;
  string open = 4;
  string high = 5;
  string low = 6;
  int64 timestamp = 7;
  int64 volume = 8;
  string turnover = 9;
  int32 trade_status = 10;
}

message SecurityCandlestickRequest {
  string symbol = 1;
  int32 period = 2;
  int32 count = 3;
  int32 adjust_type = 4;
  int32 trade_session = 5;
}

message SecurityCandlestickResponse {
  string symbol = 1;
  repeated Candlestick candlesticks = 2;
}

message Candlestick {
  string close = 1;
  string open = 2;
  string low = 3;
  string high = 4;
  int64 volume = 5;
  string turnover = 6;
  int64 timestamp = 7;
  int32 trade_session = 8;
}
`

const protoRoot = protobuf.parse(QUOTE_PROTO).root
const AuthRequest = protoRoot.lookupType('AuthRequest')
const MultiSecurityRequest = protoRoot.lookupType('MultiSecurityRequest')
const SecurityQuoteResponse = protoRoot.lookupType('SecurityQuoteResponse')
const SecurityCandlestickRequest = protoRoot.lookupType('SecurityCandlestickRequest')
const SecurityCandlestickResponse = protoRoot.lookupType('SecurityCandlestickResponse')
const ErrorMessage = protoRoot.lookupType('Error')

function readEnv(name: string): string {
  return process.env[name]?.trim() || ''
}

function getCredentials() {
  const appKey = readEnv('LONGBRIDGE_APP_KEY') || readEnv('LONGPORT_APP_KEY')
  const appSecret = readEnv('LONGBRIDGE_APP_SECRET') || readEnv('LONGPORT_APP_SECRET')
  const accessToken = readEnv('LONGBRIDGE_ACCESS_TOKEN') || readEnv('LONGPORT_ACCESS_TOKEN')
  return { appKey, appSecret, accessToken }
}

function getRegion(): string {
  return (readEnv('LONGBRIDGE_REGION') || readEnv('LONGPORT_REGION')).toLowerCase()
}

function isChinaRegion(): boolean {
  return ['cn', 'china', 'mainland'].includes(getRegion())
}

function getHttpUrl(): string {
  return (readEnv('LONGBRIDGE_HTTP_URL') || (isChinaRegion() ? HTTP_URL_CN : HTTP_URL)).replace(/\/+$/, '')
}

function getQuoteWsUrl(): string {
  return readEnv('LONGBRIDGE_QUOTE_WS_URL') || (isChinaRegion() ? QUOTE_WS_URL_CN : QUOTE_WS_URL)
}

function isConfigured(): boolean {
  const creds = getCredentials()
  return Boolean(creds.appKey && creds.accessToken && (creds.appSecret || isBearerToken(creds.accessToken)))
}

export function getLongbridgeStatus(): LongbridgeStatusDto {
  return {
    configured: isConfigured(),
    region: getRegion() || 'global',
    host: getHttpUrl(),
    quoteHost: getQuoteWsUrl(),
    sdkLoaded: false,
    disabledReason: isConfigured() ? '' : 'Longbridge credentials are not configured.',
  }
}

function buildQuery(query: Query): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return params.toString()
}

function sha1(data: string | Buffer): string {
  return crypto.createHash('sha1').update(data).digest('hex')
}

function isBearerToken(token: string): boolean {
  return token.startsWith('Bearer ')
}

function signRequest(method: string, path: string, query: string, body: string, timestamp: string): string {
  const { appKey, appSecret, accessToken } = getCredentials()
  if (isBearerToken(accessToken) || !appSecret) return ''
  const signedHeaders = 'authorization;x-api-key;x-timestamp'
  const signedValues = `authorization:${accessToken}\nx-api-key:${appKey}\nx-timestamp:${timestamp}\n`
  let stringToSign = `${method}|${path}|${query}|${signedValues}|${signedHeaders}|`
  if (body) stringToSign += sha1(body)
  const payload = `HMAC-SHA256|${sha1(stringToSign)}`
  const signature = crypto.createHmac('sha256', appSecret).update(payload).digest('hex')
  return `HMAC-SHA256 SignedHeaders=${signedHeaders}, Signature=${signature}`
}

async function longbridgeHttp<T>(method: 'GET' | 'POST', path: string, query: Query = {}, body?: unknown): Promise<T> {
  const { appKey, accessToken } = getCredentials()
  if (!isConfigured()) throw new Error('Longbridge credentials are not configured')

  const queryString = buildQuery(query)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const bodyText = body ? JSON.stringify(body) : ''
  const url = `${getHttpUrl()}${path}${queryString ? `?${queryString}` : ''}`
  const signature = signRequest(method, path, queryString, bodyText, timestamp)
  const headers: Record<string, string> = {
    'User-Agent': 'openapi-sdk',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Api-Key': appKey,
    Authorization: accessToken,
    'X-Timestamp': timestamp,
  }
  if (signature) headers['X-Api-Signature'] = signature

  const res = await fetch(url, {
    method,
    headers,
    body: bodyText || undefined,
  })

  const text = await res.text()
  let json: { code?: number; message?: string; data?: T } | null = null
  try {
    json = JSON.parse(text)
  } catch {
    // Keep the raw response for diagnostics.
  }
  if (!res.ok) throw new Error(`Longbridge HTTP ${res.status}: ${text.slice(0, 160)}`)
  if (!json || json.code !== 0) {
    throw new Error(json?.message || `Unexpected Longbridge response: ${text.slice(0, 160)}`)
  }
  return json.data as T
}

function toBuffer(value: Uint8Array): Buffer {
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
}

function encodePacket(commandCode: number, requestId: number, body: Buffer): Buffer {
  const data = Buffer.alloc(1 + 1 + 4 + 2 + 3 + body.length)
  let offset = 0
  data.writeUInt8(PACKAGE_TYPE_REQUEST, offset++)
  data.writeUInt8(commandCode, offset++)
  data.writeUInt32BE(requestId, offset)
  offset += 4
  data.writeUInt16BE(REQUEST_TIMEOUT_MS, offset)
  offset += 2
  data.writeUIntBE(body.length, offset, 3)
  offset += 3
  body.copy(data, offset)
  return data
}

function decodePacket(data: Buffer): { type: number; commandCode: number; requestId: number; status: number; body: Buffer } {
  if (data.length < 10) throw new Error('Invalid Longbridge packet')
  const header = data.readUInt8(0)
  const type = header & 0b00001111
  const gzip = (header & PACKAGE_FLAG_GZIP) > 0
  if (type !== PACKAGE_TYPE_RESPONSE) throw new Error('Unexpected Longbridge packet type')
  let offset = 1
  const commandCode = data.readUInt8(offset++)
  const requestId = data.readUInt32BE(offset)
  offset += 4
  const status = data.readUInt8(offset++)
  const bodyLength = data.readUIntBE(offset, 3)
  offset += 3
  return {
    type,
    commandCode,
    requestId,
    status,
    body: gzip ? gunzipSync(data.subarray(offset, offset + bodyLength)) : data.subarray(offset, offset + bodyLength),
  }
}

function decodeError(body: Buffer): string {
  try {
    const err = ErrorMessage.decode(body) as protobuf.Message<{ code?: number; msg?: string }>
    const obj = ErrorMessage.toObject(err) as { code?: number; msg?: string }
    return obj.msg || `Longbridge response error ${obj.code ?? ''}`.trim()
  } catch {
    return 'Longbridge response error'
  }
}

function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: { 'Accept-Language': 'en' },
      handshakeTimeout: CONNECT_TIMEOUT_MS,
    })
    ws.once('open', () => resolve(ws))
    ws.once('error', reject)
  })
}

function waitResponse(ws: WebSocket, commandCode: number, requestId: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('Longbridge request timeout'))
    }, REQUEST_TIMEOUT_MS)

    const onMessage = (raw: WebSocket.RawData) => {
      try {
        const packet = decodePacket(Buffer.isBuffer(raw) ? raw : Buffer.from(Array.isArray(raw) ? Buffer.concat(raw) : raw as ArrayBuffer))
        if (packet.commandCode !== commandCode || packet.requestId !== requestId) return
        cleanup()
        if (packet.status !== STATUS_NORMAL) reject(new Error(decodeError(packet.body)))
        else resolve(packet.body)
      } catch (e) {
        cleanup()
        reject(e)
      }
    }

    const onError = (e: Error) => {
      cleanup()
      reject(e)
    }

    const cleanup = () => {
      clearTimeout(timer)
      ws.off('message', onMessage)
      ws.off('error', onError)
    }

    ws.on('message', onMessage)
    ws.once('error', onError)
  })
}

async function requestWs<T>(
  ws: WebSocket,
  commandCode: number,
  requestId: number,
  requestType: protobuf.Type,
  responseType: protobuf.Type,
  payload: Record<string, unknown>,
): Promise<T> {
  const err = requestType.verify(payload)
  if (err) throw new Error(err)
  const body = toBuffer(requestType.encode(requestType.create(payload)).finish())
  const response = waitResponse(ws, commandCode, requestId)
  ws.send(encodePacket(commandCode, requestId, body))
  const responseBody = await response
  const decoded = responseType.decode(responseBody)
  return responseType.toObject(decoded, {
    longs: Number,
    enums: Number,
    defaults: true,
    arrays: true,
  }) as T
}

async function withQuoteWs<T>(fn: (ws: WebSocket) => Promise<T>): Promise<T> {
  const token = await longbridgeHttp<{ otp: string; limit: number; online: number }>('GET', '/v1/socket/token')
  const url = new URL(getQuoteWsUrl())
  url.searchParams.set('version', '1')
  url.searchParams.set('codec', '1')
  url.searchParams.set('platform', '9')

  const ws = await openSocket(url.toString())
  try {
    await requestWs(ws, CMD_AUTH, 1, AuthRequest, protoRoot.lookupType('AuthResponse'), {
      token: token.otp,
      metadata: { 'accept-language': 'en' },
    })
    return await fn(ws)
  } finally {
    ws.close()
  }
}

export async function getLongbridgeQuotes(symbols: string[]): Promise<LongbridgeQuoteDto[]> {
  const cleanSymbols = symbols.map(s => s.trim().toUpperCase()).filter(Boolean)
  if (cleanSymbols.length === 0) return []

  return withQuoteWs(async ws => {
    const response = await requestWs<{ secuQuote: Array<{
      symbol: string
      lastDone: string
      prevClose: string
      open: string
      high: string
      low: string
      volume: number
      turnover: string
      timestamp: number
      tradeStatus: number
    }> }>(ws, CMD_GET_REALTIME_QUOTE, 2, MultiSecurityRequest, SecurityQuoteResponse, {
      symbol: cleanSymbols,
    })

    return response.secuQuote.map(q => ({
      symbol: q.symbol,
      lastDone: q.lastDone,
      prevClose: q.prevClose,
      open: q.open,
      high: q.high,
      low: q.low,
      volume: q.volume,
      turnover: q.turnover,
      timestamp: q.timestamp || null,
      tradeStatus: q.tradeStatus,
    }))
  })
}

function periodToLongbridge(period: string): number {
  if (period === 'week') return 2000
  if (period === 'month') return 3000
  if (period === 'min') return 1
  return 1000
}

export async function getLongbridgeCandlesticks(symbol: string, period = 'day', count = 200): Promise<LongbridgeCandlestickDto[]> {
  const cleanSymbol = symbol.trim().toUpperCase()
  if (!cleanSymbol) return []

  return withQuoteWs(async ws => {
    const response = await requestWs<{ candlesticks: Array<{
      close: string
      open: string
      low: string
      high: string
      volume: number
      turnover: string
      timestamp: number
    }> }>(ws, CMD_GET_SECURITY_CANDLESTICKS, 2, SecurityCandlestickRequest, SecurityCandlestickResponse, {
      symbol: cleanSymbol,
      period: periodToLongbridge(period),
      count: Math.min(Math.max(count, 1), 1000),
      adjustType: 0,
      tradeSession: 0,
    })

    return response.candlesticks.map(row => ({
      close: row.close,
      open: row.open,
      low: row.low,
      high: row.high,
      volume: row.volume,
      turnover: row.turnover,
      timestamp: row.timestamp || null,
    }))
  })
}
