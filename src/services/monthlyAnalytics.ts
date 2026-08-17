import type { Transaction } from '../data/models'
import { isSpending, normalizeMerchant, spendingAmount } from './statementImport'

export type WeekdaySpending = {
  key: number
  label: string
  amount: number
  transactionCount: number
  spendingTransactionCount: number
}

export type MerchantSpending = {
  name: string
  amount: number
  transactionCount: number
}

const weekdays = [
  { key: 1, label: 'Monday' },
  { key: 2, label: 'Tuesday' },
  { key: 3, label: 'Wednesday' },
  { key: 4, label: 'Thursday' },
  { key: 5, label: 'Friday' },
  { key: 6, label: 'Saturday' },
  { key: 0, label: 'Sunday' },
]

function monthTransactions(transactions: Transaction[], month: string) {
  return transactions.filter(transaction => transaction.transactionDate.startsWith(month))
}

export function isCompleteCalendarMonth(start?: string, end?: string) {
  if (!start || !end) return false
  const match = start.match(/^(\d{4})-(\d{2})-01$/)
  if (!match) return false
  const [, year, month] = match
  const lastDay = new Date(Number(year), Number(month), 0).getDate()
  return end === `${year}-${month}-${String(lastDay).padStart(2, '0')}`
}

export function getSpendingByWeekday(transactions: Transaction[], month: string): WeekdaySpending[] {
  const monthly = monthTransactions(transactions, month)
  return weekdays.map(({ key, label }) => {
    const dayTransactions = monthly.filter(transaction => {
      const date = new Date(`${transaction.transactionDate}T12:00:00`)
      return !Number.isNaN(date.getTime()) && date.getDay() === key
    })
    const spending = dayTransactions.filter(isSpending)
    return {
      key,
      label,
      amount: spending.reduce((sum, transaction) => sum + spendingAmount(transaction), 0),
      transactionCount: dayTransactions.length,
      spendingTransactionCount: spending.length,
    }
  })
}

export function getTopMerchants(transactions: Transaction[], month: string, limit?: number): MerchantSpending[] {
  const totals = new Map<string, MerchantSpending>()
  monthTransactions(transactions, month).filter(isSpending).forEach(transaction => {
    const fallback = normalizeMerchant(transaction.merchantRaw || transaction.description).name
    const name = transaction.merchantNormalized?.trim() || fallback || 'Unknown merchant'
    const existing = totals.get(name) ?? { name, amount: 0, transactionCount: 0 }
    existing.amount += spendingAmount(transaction)
    existing.transactionCount += 1
    totals.set(name, existing)
  })
  const ranked = Array.from(totals.values()).sort((a, b) => b.amount - a.amount || b.transactionCount - a.transactionCount)
  return typeof limit === 'number' ? ranked.slice(0, limit) : ranked
}
