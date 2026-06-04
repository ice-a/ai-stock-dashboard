import { getLongbridgeStatus } from '../../src/server/longbridgeService.ts'

interface JsonResponse {
  status(code: number): { json(payload: unknown): void }
}

export default function handler(_req: unknown, res: JsonResponse) {
  res.status(200).json(getLongbridgeStatus())
}
