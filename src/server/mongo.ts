import { MongoClient, type Db } from 'mongodb'
import { readMongoDbName, readMongoUri } from './env'

type MongoCache = {
  client: MongoClient | null
  promise: Promise<MongoClient> | null
}

const globalCache = globalThis as typeof globalThis & {
  __aiStockMongo?: MongoCache
}

const cache: MongoCache = globalCache.__aiStockMongo || {
  client: null,
  promise: null,
}

globalCache.__aiStockMongo = cache

export function isMongoEnabled(): boolean {
  return Boolean(readMongoUri())
}

export async function getMongoClient(): Promise<MongoClient> {
  const uri = readMongoUri()
  if (!uri) throw new Error('MONGODB_URI is not configured.')

  if (cache.client) return cache.client
  if (!cache.promise) {
    cache.promise = new MongoClient(uri, {
      maxPoolSize: 5,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5000,
    }).connect()
  }
  cache.client = await cache.promise
  return cache.client
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient()
  return client.db(readMongoDbName())
}
