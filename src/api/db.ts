// MongoDB API 客户端

export interface DbQuery {
  [key: string]: any
}

export interface DbData {
  [key: string]: any
}

export interface DbResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  insertedId?: string
  insertedCount?: number
  modifiedCount?: number
  deletedCount?: number
  count?: number
}

// 执行数据库操作
async function execDb<T = any>(
  action: string,
  collection: string,
  data?: DbData,
  query?: DbQuery
): Promise<DbResponse<T>> {
  try {
    const response = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, collection, data, query }),
    })
    return await response.json()
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 查找数据
export async function dbFind<T = any>(collection: string, query?: DbQuery): Promise<T[]> {
  const result = await execDb<T[]>('find', collection, undefined, query)
  return result.data || []
}

// 查找单条数据
export async function dbFindOne<T = any>(collection: string, query?: DbQuery): Promise<T | null> {
  const result = await execDb<T>('findOne', collection, undefined, query)
  return result.data || null
}

// 插入数据
export async function dbInsert(collection: string, data: DbData): Promise<string | null> {
  const result = await execDb('insert', collection, data)
  return result.insertedId || null
}

// 插入多条数据
export async function dbInsertMany(collection: string, data: DbData[]): Promise<number> {
  const result = await execDb('insertMany', collection, data)
  return result.insertedCount || 0
}

// 更新数据
export async function dbUpdate(collection: string, query: DbQuery, data: DbData): Promise<number> {
  const result = await execDb('update', collection, data, query)
  return result.modifiedCount || 0
}

// 更新多条数据
export async function dbUpdateMany(collection: string, query: DbQuery, data: DbData): Promise<number> {
  const result = await execDb('updateMany', collection, data, query)
  return result.modifiedCount || 0
}

// Upsert 数据（存在则更新，不存在则插入）
export async function dbUpsert(collection: string, query: DbQuery, data: DbData): Promise<boolean> {
  const result = await execDb('upsert', collection, data, query)
  return result.success
}

// 删除数据
export async function dbDelete(collection: string, query: DbQuery): Promise<number> {
  const result = await execDb('delete', collection, undefined, query)
  return result.deletedCount || 0
}

// 删除多条数据
export async function dbDeleteMany(collection: string, query: DbQuery): Promise<number> {
  const result = await execDb('deleteMany', collection, undefined, query)
  return result.deletedCount || 0
}

// 统计数量
export async function dbCount(collection: string, query?: DbQuery): Promise<number> {
  const result = await execDb('count', collection, undefined, query)
  return result.count || 0
}

// 持仓数据操作
export const portfolioDb = {
  // 保存持仓数据
  async save(userId: string, holdings: any[], transactions: any[]) {
    return dbUpsert(
      'portfolios',
      { userId },
      { userId, holdings, transactions }
    )
  },

  // 加载持仓数据
  async load(userId: string) {
    return dbFindOne<{ holdings: any[]; transactions: any[] }>(
      'portfolios',
      { userId }
    )
  },
}

// 自选股数据操作
export const watchlistDb = {
  // 保存自选股
  async save(userId: string, items: any[]) {
    return dbUpsert(
      'watchlists',
      { userId },
      { userId, items }
    )
  },

  // 加载自选股
  async load(userId: string) {
    return dbFindOne<{ items: any[] }>(
      'watchlists',
      { userId }
    )
  },
}

// 股票分析数据操作
export const analysisDb = {
  // 保存分析结果
  async save(symbol: string, analysis: any) {
    return dbUpsert(
      'analyses',
      { symbol },
      { symbol, analysis }
    )
  },

  // 加载分析结果
  async load(symbol: string) {
    return dbFindOne<{ analysis: any }>(
      'analyses',
      { symbol }
    )
  },

  // 获取最近的分析
  async getRecent(limit: number = 10) {
    const results = await dbFind<{ symbol: string; analysis: any; updatedAt: Date }>(
      'analyses'
    )
    return results
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit)
  },
}

// 用户设置操作
export const settingsDb = {
  // 保存设置
  async save(userId: string, settings: any) {
    return dbUpsert(
      'settings',
      { userId },
      { userId, settings }
    )
  },

  // 加载设置
  async load(userId: string) {
    return dbFindOne<{ settings: any }>(
      'settings',
      { userId }
    )
  },
}

// 分享记录操作
export const shareDb = {
  // 保存分享记录
  async save(shareData: {
    userId: string
    type: 'profit' | 'holdings'
    content: any
    imageUrl?: string
  }) {
    return dbInsert('shares', shareData)
  },

  // 获取用户的分享记录
  async getByUser(userId: string, limit: number = 20) {
    const results = await dbFind<{
      _id: string
      type: string
      content: any
      imageUrl?: string
      createdAt: Date
    }>('shares', { userId })
    return results
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
  },

  // 通过 ID 获取分享
  async getById(id: string) {
    return dbFindOne('shares', { _id: id })
  },
}
