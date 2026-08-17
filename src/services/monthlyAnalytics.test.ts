import { describe, expect, it } from 'vitest'
import type { Transaction } from '../data/models'
import { getSpendingByWeekday, getTopMerchants, isCompleteCalendarMonth } from './monthlyAnalytics'

const base: Transaction = { id: 'base', accountId: 'a', statementId: 's', transactionDate: '2026-05-01', merchantRaw: 'merchant', merchantNormalized: 'Merchant', description: 'merchant', amount: 10, currency: 'USD', categoryId: 'other', subcategory: '', transactionType: 'purchase', sourceFile: 'test.csv', confidence: 1 }

describe('monthly analytics selectors', () => {
  it('recognizes only complete calendar months', () => {
    expect(isCompleteCalendarMonth('2026-05-01', '2026-05-31')).toBe(true)
    expect(isCompleteCalendarMonth('2026-05-01', '2026-05-30')).toBe(false)
    expect(isCompleteCalendarMonth('2026-05-15', '2026-06-15')).toBe(false)
  })

  it('keeps all seven weekdays and excludes payments from spending', () => {
    const transactions: Transaction[] = [
      { ...base, id: 'monday', transactionDate: '2026-05-04', amount: 12 },
      { ...base, id: 'monday-payment', transactionDate: '2026-05-04', transactionType: 'payment', amount: 500 },
      { ...base, id: 'sunday', transactionDate: '2026-05-10', amount: 8 },
    ]
    const result = getSpendingByWeekday(transactions, '2026-05')
    expect(result).toHaveLength(7)
    expect(result.find(day => day.label === 'Monday')?.amount).toBe(12)
    expect(result.find(day => day.label === 'Monday')?.transactionCount).toBe(2)
    expect(result.find(day => day.label === 'Tuesday')?.amount).toBe(0)
  })

  it('groups top merchants using normalized names', () => {
    const transactions: Transaction[] = [
      { ...base, id: 'dunkin-1', transactionDate: '2026-05-04', merchantNormalized: 'Dunkin', amount: 12 },
      { ...base, id: 'dunkin-2', transactionDate: '2026-05-11', merchantNormalized: 'Dunkin', amount: 8 },
      { ...base, id: 'amazon', transactionDate: '2026-05-12', merchantNormalized: 'Amazon', amount: 25 },
    ]
    expect(getTopMerchants(transactions, '2026-05')).toEqual([
      { name: 'Amazon', amount: 25, transactionCount: 1 },
      { name: 'Dunkin', amount: 20, transactionCount: 2 },
    ])
  })

  it('reconciles equivalent provider merchant descriptors', () => {
    const transactions: Transaction[] = [
      { ...base, id: 'amex-buz', merchantNormalized: '', merchantRaw: 'AplPay BUZ COFFEE & DUBUQUE IA', amount: 469.75 },
      { ...base, id: 'discover-buz', merchantNormalized: '', merchantRaw: 'SQ *BUZ COFFEE & ENERG DUBUQUE IA', amount: 15 },
    ]
    expect(getTopMerchants(transactions, '2026-05')).toEqual([{ name: 'Buz Coffee', amount: 484.75, transactionCount: 2 }])
  })
})
