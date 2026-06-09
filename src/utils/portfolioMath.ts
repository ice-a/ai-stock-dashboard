import type { PortfolioHolding } from '../types'

export interface FifoSaleInput {
  symbol: string
  price: number
  quantity: number
  fee: number
}

export interface FifoSaleResult {
  nextHoldings: PortfolioHolding[]
  allocatedCost: number
  proceeds: number
  realizedProfit: number
  realizedProfitRate: number | null
}

export function executeFifoSale(holdings: PortfolioHolding[], input: FifoSaleInput): FifoSaleResult {
  const symbol = input.symbol.trim().toUpperCase()
  const quantity = Number(input.quantity) || 0
  if (quantity <= 0) throw new Error('卖出数量必须大于 0。')

  const available = holdings
    .filter(item => item.symbol === symbol)
    .reduce((sum, item) => sum + item.quantity, 0)
  if (quantity > available) throw new Error(`可卖数量不足：当前仅持有 ${available} 股。`)

  let remaining = quantity
  let allocatedCost = 0
  const nextHoldings = holdings
    .map(item => ({ ...item }))
    .sort((a, b) => {
      const dateDiff = new Date(a.buyDate).getTime() - new Date(b.buyDate).getTime()
      return dateDiff || a.createdAt - b.createdAt
    })

  for (const lot of nextHoldings) {
    if (lot.symbol !== symbol || remaining <= 0) continue
    const originalQuantity = lot.quantity
    const originalFee = lot.fee
    const qty = Math.min(originalQuantity, remaining)
    const feePerShare = originalQuantity > 0 ? originalFee / originalQuantity : 0
    const costPerShare = lot.buyPrice + feePerShare
    allocatedCost += costPerShare * qty
    lot.quantity = originalQuantity - qty
    lot.fee = Math.max(0, originalFee - feePerShare * qty)
    lot.updatedAt = Date.now()
    remaining -= qty
  }

  const proceeds = Number(input.price) * quantity - (Number(input.fee) || 0)
  const realizedProfit = proceeds - allocatedCost
  return {
    nextHoldings: nextHoldings.filter(item => item.quantity > 0.000001),
    allocatedCost,
    proceeds,
    realizedProfit,
    realizedProfitRate: allocatedCost > 0 ? realizedProfit / allocatedCost : null,
  }
}
