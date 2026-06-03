import { listServerModels } from '../../src/server/aiService.ts'

interface ApiResponse {
  status(code: number): { json(payload: unknown): void }
}

export default async function handler(_req: unknown, res: ApiResponse) {
  try {
    res.status(200).json({ data: await listServerModels() })
  } catch (e) {
    res.status(502).json({ error: (e as Error).message })
  }
}
