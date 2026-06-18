/**
 * 计算区间涨跌幅（基于 K 线数据）
 */
export function calculateChangePercent(points: Array<{ time: number; close: number }>, days: number, latest: number | null): number | null {
  if (!points.length || latest == null) return null
  const now = Date.now() / 1000
  const targetTime = now - days * 86400
  let basePoint = points[0]
  for (const p of points) {
    if (p.time <= targetTime) {
      basePoint = p
    } else {
      break
    }
  }
  if (!basePoint || basePoint.close === 0) return null
  return (latest - basePoint.close) / basePoint.close
}
