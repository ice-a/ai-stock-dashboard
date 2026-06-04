interface JsonResponse {
  status(code: number): { json(payload: unknown): void }
}

interface ApiError extends Error {
  statusCode?: number
}

export default async function handler(_req: unknown, res: JsonResponse) {
  try {
    const { getLongbridgeStatus } = await import('./_service.js')
    res.status(200).json(getLongbridgeStatus())
  } catch (e) {
    const error = e as ApiError
    res.status(error.statusCode || 502).json({ error: error.message })
  }
}
