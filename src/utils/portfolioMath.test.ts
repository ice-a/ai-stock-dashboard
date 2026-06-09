import { describe, expect, it } from 'vitest'
import { executeFifoSale } from './portfolioMath'
import type { PortfolioHolding } from '../types'

function holding(patch: Partial<PortfolioHolding>): PortfolioHolding {
  return {
    id: patch.id || 'h1',
    symbol: patch.symbol || 'NVDA.US',
    name: patch.name || 'NVIDIA',
    buyPrice: patch.buyPrice ?? 100,
    fee: patch.fee ?? 0,
    buyDate: patch.buyDate || '2026-01-01',
    quantity: patch.quantity ?? 10,
    createdAt: patch.createdAt ?? 1,
    updatedAt: patch.updatedAt ?? 1,
  }
}

describe('executeFifoSale', () => {
  it('reduces the oldest lot first and preserves remaining proportional fee', () => {
    const result = executeFifoSale([
      holding({ id: 'old', buyPrice: 10, quantity: 10, fee: 10, buyDate: '2026-01-01', createdAt: 1 }),
      holding({ id: 'new', buyPrice: 20, quantity: 10, fee: 0, buyDate: '2026-02-01', createdAt: 2 }),
    ], {
      symbol: 'NVDA.US',
      price: 30,
      quantity: 6,
      fee: 3,
    })

    expect(result.allocatedCost).toBe(66)
    expect(result.proceeds).toBe(177)
    expect(result.realizedProfit).toBe(111)
    expect(result.realizedProfitRate).toBeCloseTo(111 / 66)
    expect(result.nextHoldings.find(item => item.id === 'old')?.quantity).toBe(4)
    expect(result.nextHoldings.find(item => item.id === 'old')?.fee).toBe(4)
  })

  it('continues into the next lot when sale exceeds the first lot', () => {
    const result = executeFifoSale([
      holding({ id: 'old', buyPrice: 10, quantity: 5, fee: 0, buyDate: '2026-01-01', createdAt: 1 }),
      holding({ id: 'new', buyPrice: 20, quantity: 5, fee: 0, buyDate: '2026-02-01', createdAt: 2 }),
    ], {
      symbol: 'NVDA.US',
      price: 25,
      quantity: 7,
      fee: 0,
    })

    expect(result.allocatedCost).toBe(90)
    expect(result.realizedProfit).toBe(85)
    expect(result.nextHoldings).toHaveLength(1)
    expect(result.nextHoldings[0].id).toBe('new')
    expect(result.nextHoldings[0].quantity).toBe(3)
  })

  it('rejects a sale larger than available quantity', () => {
    expect(() => executeFifoSale([
      holding({ quantity: 3 }),
    ], {
      symbol: 'NVDA.US',
      price: 25,
      quantity: 4,
      fee: 0,
    })).toThrow('可卖数量不足')
  })
})
