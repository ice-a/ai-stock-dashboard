interface ApiResponse {
  status(code: number): { json(payload: unknown): void }
}

interface ApiError extends Error {
  statusCode?: number
}

export default async function handler(_req: unknown, res: ApiResponse) {
  try {
    const { listServerModels } = await import('../../src/server/aiService')
    res.status(200).json({ data: await listServerModels() })
  } catch (e) {
    const error = e as ApiError
    res.status(error.statusCode || 502).json({ error: error.message })
  }
}
