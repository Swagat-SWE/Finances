import type { Account, Category, Transaction } from '../data/models'
import { isSpending, normalizeMerchant, spendingAmount } from './statementImport'

export type MerchantAggregate = {
  id: string
  name: string
  categoryId: string
  category: string
  categoryColor: string
  total: number
  transactionCount: number
  averageTransaction: number
  cardsUsed: number
  amountByCard: Record<string, number>
  countByCard: Record<string, number>
  firstTransactionDate: string
  lastTransactionDate: string
  transactions: Transaction[]
}

export type MerchantAnalytics = {
  merchants: MerchantAggregate[]
  totalSpending: number
  topFiveTotal: number
  topTenTotal: number
  byCardTotal: Record<string, number>
}

export function buildMerchantAnalytics(transactions: Transaction[], accounts: Account[], categories: Category[]): MerchantAnalytics {
  const grouped = new Map<string, MerchantAggregate>()
  const byCardTotal: Record<string, number> = {}
  for (const transaction of transactions) {
    if (!isSpending(transaction)) continue
    const normalized = transaction.merchantNormalized?.trim() || normalizeMerchant(transaction.merchantRaw || transaction.description).name
    const name = normalized || 'Unknown merchant'
    const id = name.toLocaleLowerCase()
    const category = categories.find(candidate => candidate.id === transaction.categoryId)
    const amount = spendingAmount(transaction)
    const current = grouped.get(id) ?? {
      id, name, categoryId: transaction.categoryId, category: category?.name ?? 'Other', categoryColor: category?.color ?? '#9a98a5',
      total: 0, transactionCount: 0, averageTransaction: 0, cardsUsed: 0, amountByCard: {}, countByCard: {}, firstTransactionDate: transaction.transactionDate, lastTransactionDate: transaction.transactionDate, transactions: [],
    }
    current.total += amount
    current.transactionCount += 1
    current.amountByCard[transaction.accountId] = (current.amountByCard[transaction.accountId] ?? 0) + amount
    current.countByCard[transaction.accountId] = (current.countByCard[transaction.accountId] ?? 0) + 1
    current.firstTransactionDate = !current.firstTransactionDate || transaction.transactionDate < current.firstTransactionDate ? transaction.transactionDate : current.firstTransactionDate
    current.lastTransactionDate = transaction.transactionDate > current.lastTransactionDate ? transaction.transactionDate : current.lastTransactionDate
    current.transactions.push(transaction)
    current.cardsUsed = Object.keys(current.amountByCard).length
    current.averageTransaction = current.total / current.transactionCount
    grouped.set(id, current)
    byCardTotal[transaction.accountId] = (byCardTotal[transaction.accountId] ?? 0) + amount
  }
  const merchants = Array.from(grouped.values()).sort((first, second) => second.total - first.total || second.transactionCount - first.transactionCount)
  const totalSpending = merchants.reduce((sum, merchant) => sum + merchant.total, 0)
  return { merchants, totalSpending, topFiveTotal: merchants.slice(0, 5).reduce((sum, merchant) => sum + merchant.total, 0), topTenTotal: merchants.slice(0, 10).reduce((sum, merchant) => sum + merchant.total, 0), byCardTotal }
}

export function merchantTimeSeries(merchant: MerchantAggregate) {
  const values = new Map<string, number>()
  merchant.transactions.forEach(transaction => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction.transactionDate)) return
    const month = transaction.transactionDate.slice(0, 7)
    values.set(month, (values.get(month) ?? 0) + spendingAmount(transaction))
  })
  return Array.from(values, ([key, amount]) => ({ key, label: new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(`${key}-01T12:00:00`)), amount })).sort((first, second) => first.key.localeCompare(second.key))
}

export function merchantAccountName(accountId: string, accounts: Account[]) { return accounts.find(account => account.id === accountId)?.institution ?? 'Unknown account' }
