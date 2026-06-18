import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getMongoDb, isMongoEnabled } from '../src/server/mongo'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isMongoEnabled()) {
    return res.status(503).json({ success: false, error: 'MongoDB not configured' })
  }

  const { action, collection, data, query } = req.body || {}

  if (!collection) {
    return res.status(400).json({ success: false, error: 'Collection is required' })
  }

  try {
    const db = await getMongoDb()
    const col = db.collection(collection)

    switch (action) {
      case 'find': {
        const result = await col.find(query || {}).toArray()
        return res.status(200).json({ success: true, data: result })
      }

      case 'findOne': {
        const result = await col.findOne(query || {})
        return res.status(200).json({ success: true, data: result })
      }

      case 'insert': {
        const result = await col.insertOne({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        return res.status(200).json({ success: true, insertedId: result.insertedId })
      }

      case 'insertMany': {
        const result = await col.insertMany(
          (data || []).map((item: any) => ({
            ...item,
            createdAt: new Date(),
            updatedAt: new Date(),
          }))
        )
        return res.status(200).json({ success: true, insertedCount: result.insertedCount })
      }

      case 'update': {
        const result = await col.updateOne(
          query || {},
          { $set: { ...data, updatedAt: new Date() } }
        )
        return res.status(200).json({ success: true, modifiedCount: result.modifiedCount })
      }

      case 'updateMany': {
        const result = await col.updateMany(
          query || {},
          { $set: { ...data, updatedAt: new Date() } }
        )
        return res.status(200).json({ success: true, modifiedCount: result.modifiedCount })
      }

      case 'upsert': {
        const result = await col.updateOne(
          query || {},
          { $set: { ...data, updatedAt: new Date() } },
          { upsert: true }
        )
        return res.status(200).json({
          success: true,
          modifiedCount: result.modifiedCount,
          upsertedId: result.upsertedId,
        })
      }

      case 'delete': {
        const result = await col.deleteOne(query || {})
        return res.status(200).json({ success: true, deletedCount: result.deletedCount })
      }

      case 'deleteMany': {
        const result = await col.deleteMany(query || {})
        return res.status(200).json({ success: true, deletedCount: result.deletedCount })
      }

      case 'count': {
        const count = await col.countDocuments(query || {})
        return res.status(200).json({ success: true, count })
      }

      default:
        return res.status(400).json({ success: false, error: 'Invalid action' })
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
}
