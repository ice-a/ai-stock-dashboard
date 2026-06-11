import type { Collection } from 'mongodb'
import { getMongoDb, isMongoEnabled } from '../src/server/mongo'
import { getUserFromCookie } from '../src/server/userAuth'
import type { SubscriptionTier, UserSubscription } from '../src/types'

const SUBSCRIPTIONS_COLLECTION = 'subscriptions'

export interface SubscriptionDocument {
  user: string
  tier: SubscriptionTier
  status: 'active' | 'cancelled' | 'expired' | 'trial'
  stripeSessionId: string | null
  stripeSubscriptionId: string | null
  currentPeriodEnd: Date | null
  trialEndsAt: Date | null
  paymentMethod: string | null
  lastPaymentAt: Date | null
  createdAt: Date
  updatedAt: Date
}

let indexReady: Promise<void> | null = null

function collection(): Promise<Collection<SubscriptionDocument>> {
  return getMongoDb().then((db: any) => db.collection(SUBSCRIPTIONS_COLLECTION) as Collection<SubscriptionDocument>)
}

async function ensureIndexes(): Promise<void> {
  if (!indexReady) {
    indexReady = collection()
      .then(col => col.createIndex({ user: 1 }, { unique: true }))
      .then(() => undefined)
  }
  await indexReady
}

export async function getSubscription(user: string): Promise<SubscriptionDocument | null> {
  if (!isMongoEnabled()) return null
  await ensureIndexes()
  return (await collection()).findOne({ user: user.toLowerCase() })
}

export async function createOrUpdateSubscription(
  user: string,
  data: Partial<SubscriptionDocument>
): Promise<SubscriptionDocument> {
  if (!isMongoEnabled()) throw new Error('MongoDB not configured')
  await ensureIndexes()
  const col = await collection()
  const now = new Date()
  const normalizedUser = user.toLowerCase()

  const existing = await col.findOne({ user: normalizedUser })
  if (existing) {
    await col.updateOne(
      { user: normalizedUser },
      { $set: { ...data, updatedAt: now } }
    )
    return { ...existing, ...data, updatedAt: now }
  }

  const doc: SubscriptionDocument = {
    user: normalizedUser,
    tier: data.tier || 'free',
    status: data.status || 'active',
    stripeSessionId: data.stripeSessionId || null,
    stripeSubscriptionId: data.stripeSubscriptionId || null,
    currentPeriodEnd: data.currentPeriodEnd || null,
    trialEndsAt: data.trialEndsAt || null,
    paymentMethod: data.paymentMethod || null,
    lastPaymentAt: data.lastPaymentAt || null,
    createdAt: now,
    updatedAt: now,
  }
  await col.insertOne(doc)
  return doc
}

export async function cancelSubscription(user: string): Promise<void> {
  if (!isMongoEnabled()) return
  await ensureIndexes()
  const col = await collection()
  await col.updateOne(
    { user: user.toLowerCase() },
    { $set: { status: 'cancelled', updatedAt: new Date() } }
  )
}

export async function getUserTier(user: string): Promise<SubscriptionTier> {
  const sub = await getSubscription(user)
  if (!sub) return 'free'
  if (sub.status === 'cancelled' || sub.status === 'expired') return 'free'
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) return 'free'
  return sub.tier
}

export function buildSubscriptionResponse(sub: SubscriptionDocument | null): UserSubscription {
  if (!sub) {
    return { tier: 'free', status: 'active', currentPeriodEnd: null, trialEndsAt: null, paymentMethod: null, lastPaymentAt: null }
  }
  return {
    tier: sub.tier,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd?.getTime() || null,
    trialEndsAt: sub.trialEndsAt?.getTime() || null,
    paymentMethod: sub.paymentMethod,
    lastPaymentAt: sub.lastPaymentAt?.getTime() || null,
  }
}

// Simple in-memory usage tracking for free tier
const usageMap = new Map<string, { count: number; date: string }>()

export function trackUsage(user: string): { allowed: boolean; remaining: number } {
  const today = new Date().toISOString().slice(0, 10)
  const key = `${user}:${today}`
  const entry = usageMap.get(key)
  if (!entry || entry.date !== today) {
    usageMap.set(key, { count: 1, date: today })
    return { allowed: true, remaining: 4 }
  }
  entry.count++
  const remaining = 5 - entry.count
  return { allowed: remaining >= 0, remaining: Math.max(0, remaining) }
}

export function checkUsageLimit(user: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  const key = `${user}:${today}`
  const entry = usageMap.get(key)
  if (!entry || entry.date !== today) return true
  return entry.count < 5
}
