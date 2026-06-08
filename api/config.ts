interface ApiResponse {
  status(code: number): { json(payload: unknown): void }
}

export default async function handler(_req: unknown, res: ApiResponse) {
  const { getRuntimeConfig } = await import('../src/server/runtimeConfig')
  res.status(200).json(getRuntimeConfig())
}
