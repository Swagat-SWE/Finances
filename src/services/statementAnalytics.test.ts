import { describe, expect, it } from 'vitest'
import type { Statement, Transaction } from '../data/models'
import { accounts, categories } from '../data/mockData'
import { buildStatementRecords, expandStatementRecords, nextStatement, previousStatement } from './statementAnalytics'

const statement = (overrides: Partial<Statement>): Statement => ({
  id: 'statement-1', fileName: 'statement.csv', institution: 'Chase', accountId: 'chase', accountName: 'Chase', status: 'imported', transactionCount: 2, fileSize: 10, fingerprint: 'fixture', ...overrides,
})
const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 'transaction-1', accountId: 'chase', statementId: 'statement-1', transactionDate: '2026-02-14', merchantRaw: 'Merchant', merchantNormalized: 'Merchant', description: 'Merchant', amount: 42, currency: 'USD', categoryId: 'shopping', subcategory: 'Online', transactionType: 'purchase', sourceFile: 'statement.csv', confidence: 1, ...overrides,
})

describe('statement archive analytics', () => {
  it('scopes totals and category/merchant summaries to each statement', () => {
    const records = buildStatementRecords([
      statement({ id: 'jan', fileName: 'jan.csv', statementStartDate: '2026-01-01', statementEndDate: '2026-01-31' }),
      statement({ id: 'feb', fileName: 'feb.csv', statementStartDate: '2026-02-01', statementEndDate: '2026-02-28' }),
    ], [
      transaction({ id: 'jan-purchase', statementId: 'jan', transactionDate: '2026-01-12', amount: 20 }),
      transaction({ id: 'jan-payment', statementId: 'jan', transactionDate: '2026-01-20', amount: -100, transactionType: 'payment' }),
      transaction({ id: 'feb-purchase', statementId: 'feb', transactionDate: '2026-02-14', amount: 42 }),
    ], accounts, categories)

    const feb = records.find(record => record.statement.id === 'feb')!
    const jan = records.find(record => record.statement.id === 'jan')!
    expect(feb.spending).toBe(42)
    expect(feb.transactions).toHaveLength(1)
    expect(feb.merchants[0]).toMatchObject({ name: 'Merchant', amount: 42, count: 1 })
    expect(jan.spending).toBe(20)
    expect(jan.transactions).toHaveLength(2)
  })

  it('uses the latest covered month for a multi-month statement and navigates within a card', () => {
    const records = buildStatementRecords([
      statement({ id: 'ytd', fileName: 'ytd.csv', statementStartDate: '2026-01-01', statementEndDate: '2026-08-15' }),
      statement({ id: 'later', fileName: 'later.csv', statementStartDate: '2026-09-01', statementEndDate: '2026-09-30' }),
    ], [transaction({ statementId: 'ytd', transactionDate: '2026-08-15' }), transaction({ id: 'later-tx', statementId: 'later', transactionDate: '2026-09-05' })], accounts, categories)
    const ytd = records.find(record => record.statement.id === 'ytd')!
    const later = records.find(record => record.statement.id === 'later')!
    expect(ytd.monthKey).toBe('2026-08')
    expect(previousStatement(later, records)?.statement.id).toBe('ytd')
    expect(nextStatement(ytd, records)?.statement.id).toBe('later')
  })

  it('splits a multi-month source into month-scoped archive entries without inventing rows', () => {
    const source = statement({ id: 'source-ytd', fileName: 'ytd.csv' })
    const baseRecords = buildStatementRecords([source], [
      transaction({ id: 'jan-row', statementId: source.id, transactionDate: '2026-01-12', amount: 10 }),
      transaction({ id: 'feb-row', statementId: source.id, transactionDate: '2026-02-12', amount: 20 }),
    ], accounts, categories)
    const monthRecords = expandStatementRecords(baseRecords, categories)
    expect(monthRecords.map(record => record.monthKey)).toEqual(['2026-02', '2026-01'])
    expect(monthRecords.map(record => record.transactions.length)).toEqual([1, 1])
    expect(monthRecords.every(record => record.sourceStatementId === source.id)).toBe(true)
  })
})
