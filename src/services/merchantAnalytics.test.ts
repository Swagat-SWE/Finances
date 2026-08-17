import { describe, expect, it } from 'vitest'
import { accounts, categories } from '../data/mockData'
import type { Transaction } from '../data/models'
import { buildMerchantAnalytics } from './merchantAnalytics'

const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'fixture', accountId: 'amex', statementId: 'statement', transactionDate: '2026-08-01', merchantRaw: 'AMAZON MARKETPLACE', merchantNormalized: 'Amazon', description: 'AMAZON MARKETPLACE', amount: 20, currency: 'USD', categoryId: 'shopping', subcategory: 'Online', transactionType: 'purchase', sourceFile: 'fixture.csv', confidence: 1, ...overrides,
})

describe('merchant analytics', () => {
  it('uses the same spending definition as the dashboard and reconciles card totals', () => {
    const result = buildMerchantAnalytics([
      transaction({ id: 'purchase-1', amount: 20, accountId: 'amex' }),
      transaction({ id: 'purchase-2', amount: 30, accountId: 'chase' }),
      transaction({ id: 'payment', amount: -50, transactionType: 'payment', merchantNormalized: 'Payment' }),
    ], accounts, categories)

    expect(result.totalSpending).toBe(50)
    expect(result.merchants.map(merchant => merchant.name)).toEqual(['Amazon'])
    expect(result.merchants[0].amountByCard).toEqual({ amex: 20, chase: 30 })
    expect(result.merchants[0].transactionCount).toBe(2)
    expect(result.merchants[0].averageTransaction).toBe(25)
    expect(result.byCardTotal).toEqual({ amex: 20, chase: 30 })
  })

  it('falls back to deterministic merchant normalization when a row has no normalized name', () => {
    const result = buildMerchantAnalytics([transaction({ merchantNormalized: '', merchantRaw: 'AMZN MKTP 123456' })], accounts, categories)
    expect(result.merchants[0].name).toBe('Amazon')
  })
})
