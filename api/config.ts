import { getRuntimeConfig } from '../src/server/runtimeConfig.ts'

interface ApiResponse {
  status(code: number): { json(payload: unknown): void }
}

export default function handler(_req: unknown, res: ApiResponse) {
  res.status(200).json(getRuntimeConfig())
}
