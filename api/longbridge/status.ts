interface JsonResponse {
  status(code: number): { json(payload: unknown): void }
}

export default async function handler(_req: unknown, res: JsonResponse) {
  try {
    const { getLongbridgeStatus } = await import('./_service.js')
    res.status(200).json(getLongbridgeStatus())
  } catch (e) {
    res.status(502).json({ error: (e as Error).message })
  }
}
