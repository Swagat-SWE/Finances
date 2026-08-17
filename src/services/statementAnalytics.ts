import type { Account, Category, Statement, Transaction } from '../data/models'
import { isSpending, normalizeMerchant, spendingAmount } from './statementImport'

export type StatementCategoryTotal = { id: string; name: string; color: string; amount: number; count: number }
export type StatementMerchantTotal = { name: string; amount: number; count: number }

export type StatementRecord = {
  statement: Statement
  /** Original uploaded statement id. Month slices keep this for reconciliation. */
  sourceStatementId: string
  transactions: Transaction[]
  account?: Account
  institution: string
  accountName: string
  startDate: string
  endDate: string
  monthKey: string
  year: string
  sourceType: 'CSV' | 'XLSX' | 'PDF' | 'SOURCE'
  spending: number
  merchantCount: number
  categoryCount: number
  categories: StatementCategoryTotal[]
  merchants: StatementMerchantTotal[]
}

export function statementAccountKey(record: StatementRecord) {
  return record.statement.accountId ?? record.institution.toLocaleLowerCase()
}

function validDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function sourceType(fileName: string): StatementRecord['sourceType'] {
  const extension = fileName.split('.').pop()?.toLowerCase()
  if (extension === 'pdf') return 'PDF'
  if (extension === 'xlsx' || extension === 'xls') return 'XLSX'
  if (extension === 'csv' || extension === 'tsv') return 'CSV'
  return 'SOURCE'
}

function summarizeRecord(record: StatementRecord, statementTransactions: Transaction[], categories: Category[], sliceKey?: string): StatementRecord {
  const sortedTransactions = statementTransactions.slice().sort((first, second) => second.transactionDate.localeCompare(first.transactionDate))
  const dated = sortedTransactions.map(transaction => transaction.transactionDate).filter(validDate).sort()
  const startDate = sliceKey ? (dated[0] ?? record.startDate) : record.startDate
  const endDate = sliceKey ? (dated[dated.length - 1] ?? startDate) : record.endDate
  const categoryTotals = new Map<string, StatementCategoryTotal>()
  const merchantTotals = new Map<string, StatementMerchantTotal>()
  sortedTransactions.filter(isSpending).forEach(transaction => {
    const categoryId = transaction.categoryId || 'other'
    const category = categories.find(candidate => candidate.id === categoryId)
    const categoryTotal = categoryTotals.get(categoryId) ?? { id: categoryId, name: category?.name ?? 'Other', color: category?.color ?? '#9a98a5', amount: 0, count: 0 }
    categoryTotal.amount += spendingAmount(transaction)
    categoryTotal.count += 1
    categoryTotals.set(categoryId, categoryTotal)
    const merchant = transaction.merchantNormalized?.trim() || normalizeMerchant(transaction.merchantRaw || transaction.description).name || 'Unknown merchant'
    const merchantKey = merchant.toLocaleLowerCase()
    const merchantTotal = merchantTotals.get(merchantKey) ?? { name: merchant, amount: 0, count: 0 }
    merchantTotal.amount += spendingAmount(transaction)
    merchantTotal.count += 1
    merchantTotals.set(merchantKey, merchantTotal)
  })
  const monthKey = endDate.slice(0, 7) || record.monthKey
  return {
    ...record,
    statement: sliceKey ? { ...record.statement, id: `${record.sourceStatementId}::${sliceKey}`, transactionCount: sortedTransactions.length, statementStartDate: startDate || undefined, statementEndDate: endDate || undefined } : record.statement,
    transactions: sortedTransactions,
    startDate: startDate || record.startDate,
    endDate: endDate || record.endDate,
    monthKey,
    year: monthKey.slice(0, 4),
    spending: sortedTransactions.reduce((sum, transaction) => sum + spendingAmount(transaction), 0),
    merchantCount: merchantTotals.size,
    categoryCount: categoryTotals.size,
    categories: Array.from(categoryTotals.values()).sort((first, second) => second.amount - first.amount),
    merchants: Array.from(merchantTotals.values()).sort((first, second) => second.amount - first.amount),
  }
}

export function buildStatementRecords(statements: Statement[], transactions: Transaction[], accounts: Account[], categories: Category[]): StatementRecord[] {
  const transactionsByStatement = new Map<string, Transaction[]>()
  transactions.forEach(transaction => {
    const list = transactionsByStatement.get(transaction.statementId) ?? []
    list.push(transaction)
    transactionsByStatement.set(transaction.statementId, list)
  })
  return statements.filter(statement => statement.status !== 'duplicate').map(statement => {
    const statementTransactions = (transactionsByStatement.get(statement.id) ?? []).slice().sort((first, second) => second.transactionDate.localeCompare(first.transactionDate))
    const dated = statementTransactions.map(transaction => transaction.transactionDate).filter(validDate).sort()
    const startDate = validDate(statement.statementStartDate) ? statement.statementStartDate : dated[0] ?? ''
    const endDate = validDate(statement.statementEndDate) ? statement.statementEndDate : dated[dated.length - 1] ?? startDate
    const account = accounts.find(candidate => candidate.id === statement.accountId) ?? accounts.find(candidate => candidate.institution === statement.institution)
    // Archive a multi-month/YTD statement under its latest covered month so
    // the newest period appears first, while the full period remains visible
    // in the row and detail view.
    const monthKey = endDate.slice(0, 7) || startDate.slice(0, 7)
    const baseRecord: StatementRecord = {
      statement,
      sourceStatementId: statement.id,
      transactions: statementTransactions,
      account,
      institution: statement.institution ?? account?.institution ?? 'Unknown institution',
      accountName: statement.accountName ?? account?.displayName ?? statement.institution ?? 'Unknown account',
      startDate,
      endDate,
      monthKey,
      year: monthKey.slice(0, 4),
      sourceType: sourceType(statement.fileName),
      spending: statementTransactions.reduce((sum, transaction) => sum + spendingAmount(transaction), 0),
      merchantCount: 0,
      categoryCount: 0,
      categories: [],
      merchants: [],
    }
    return summarizeRecord(baseRecord, statementTransactions, categories)
  }).sort((first, second) => second.startDate.localeCompare(first.startDate) || second.statement.id.localeCompare(first.statement.id))
}

/**
 * A year-to-date upload is one source document, but users still need to open
 * January, February, March, etc. independently from the archive. Split only
 * when real transaction dates prove that the source spans multiple months;
 * never invent an empty month or a synthetic transaction.
 */
export function expandStatementRecords(records: StatementRecord[], categories: Category[]): StatementRecord[] {
  return records.flatMap(record => {
    const months = Array.from(new Set(record.transactions.map(transaction => transaction.transactionDate.slice(0, 7)).filter(month => /^\d{4}-\d{2}$/.test(month))))
    if (months.length <= 1) return [record]
    return months.sort().map(month => summarizeRecord(record, record.transactions.filter(transaction => transaction.transactionDate.startsWith(month)), categories, month))
  }).sort((first, second) => second.startDate.localeCompare(first.startDate) || second.statement.id.localeCompare(first.statement.id))
}

export function previousStatement(current: StatementRecord, records: StatementRecord[]) {
  return records.filter(record => statementAccountKey(record) === statementAccountKey(current) && record.startDate < current.startDate).sort((first, second) => second.startDate.localeCompare(first.startDate))[0]
}

export function nextStatement(current: StatementRecord, records: StatementRecord[]) {
  return records.filter(record => statementAccountKey(record) === statementAccountKey(current) && record.startDate > current.startDate).sort((first, second) => first.startDate.localeCompare(second.startDate))[0]
}

export function statementPeriodLabel(record: StatementRecord) {
  if (!record.startDate) return 'Date unavailable'
  const format = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return record.startDate === record.endDate ? format(record.startDate) : `${format(record.startDate)} – ${format(record.endDate)}`
}
