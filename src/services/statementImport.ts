import * as XLSX from 'xlsx'
import type { Account, Category, ImportResult, RawTransaction, ReviewFlag, ReviewTransaction, Statement, Transaction, TransactionType } from '../data/models'
import { inspectAndExtractPdf } from './pdfPipeline'

const aliases: Record<string, string[]> = { date: ['date', 'transaction date', 'transactiondate', 'trans date', 'trans. date'], postedDate: ['posted date', 'post date', 'posting date', 'clearing date', 'settled date'], description: ['description', 'merchant', 'transaction description', 'details', 'payee'], amount: ['amount', 'amount (usd)', 'transaction amount', 'debit', 'charge'], category: ['category', 'transaction category'], transactionType: ['type', 'transaction type', 'status'] }
const normalizeHeader = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ')
const fieldFor = (header: unknown) => { const normalized = normalizeHeader(header); const direct = Object.entries(aliases).find(([, names]) => names.includes(normalized))?.[0]; if (direct) return direct; if (/^amount\s*\(/.test(normalized)) return 'amount'; if (/^(trans\.?|transaction)\s*date$/.test(normalized)) return 'date'; if (/^(post|posted|posting|clearing|settled)\s*date$/.test(normalized)) return 'postedDate'; return undefined }

export function parseAmount(value: string | number): number | undefined { const input = String(value).trim().toUpperCase(); if (!input) return undefined; const credit = /\bCR$/.test(input); const debit = /\bDR$/.test(input); const clean = input.replace(/\b(?:CR|DR)$/, '').replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1'); const result = Number(clean); if (!Number.isFinite(result)) return undefined; return credit && result > 0 ? -result : debit && result < 0 ? -result : result }
export function parseDate(value: string): string | undefined { const input = value.trim().replace(/\./g, '/'); const numeric = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/); if (numeric) { const [, month, day, year] = numeric; return `${year.length === 2 ? `20${year}` : year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}` } const named = input.match(/^([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/i); if (named) { const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(named[1].slice(0,3).toLowerCase()); return month < 0 ? undefined : `${named[3]}-${String(month + 1).padStart(2,'0')}-${named[2].padStart(2,'0')}` } const iso = new Date(input); return Number.isNaN(iso.getTime()) ? undefined : iso.toISOString().slice(0, 10) }
export function classifyType(description: string, amount: number, rawType?: string): TransactionType { const text = `${rawType ?? ''} ${description}`.toLowerCase(); if (/payment|autopay|thank you/.test(text)) return 'payment'; if (/refund|return|reversal/.test(text)) return 'refund'; if (/interest/.test(text)) return 'interest'; if (/fee/.test(text)) return 'fee'; if (/credit/.test(text)) return 'credit'; if (/transfer/.test(text)) return 'transfer'; return 'purchase' }
export function normalizeMerchant(raw: string) { const clean = raw.trim().replace(/\s+/g, ' '); if (/dunkin|\bdd\s?#/i.test(clean)) return { name: 'Dunkin', confidence: .98 }; if (/starbucks/i.test(clean)) return { name: 'Starbucks', confidence: .98 }; if (/\bbuz\s+coffee\b/i.test(clean)) return { name: 'Buz Coffee', confidence: .97 }; if (/amzn|amazon/i.test(clean)) return { name: 'Amazon', confidence: .97 }; if (/uber/i.test(clean)) return { name: 'Uber', confidence: .98 }; if (/netflix/i.test(clean)) return { name: 'Netflix', confidence: .98 }; return { name: clean.replace(/\b\d{3,}\b/g, '').trim() || 'Unknown merchant', confidence: .6 } }
// Statement providers often encode a category hierarchy as
// "Parent - Child" (or with a colon, slash, or pipe). Keep the source value
// on each transaction, but use the parent for the dashboard filter.
function sourceCategoryParts(source?: string) {
  const value = source?.trim().replace(/\s+/g, ' ')
  if (!value) return []
  return value.split(/\s*(?:-|–|—|:|>|\/|\|)\s*/).map(part => part.trim()).filter(Boolean)
}
export function sourceCategoryGroup(source?: string) { return sourceCategoryParts(source)[0] }
export function sourceCategoryChild(source?: string) { const parts = sourceCategoryParts(source); return parts.length > 1 ? parts.slice(1).join(' - ') : undefined }
export function sourceCategoryKey(source?: string) { return sourceCategoryGroup(source)?.toLocaleLowerCase().replace(/\s+/g, ' ') }
export const sourceCategoryStandaloneKey = '__parent__'
export const normalizedGasCategoryKey = 'category:gas'
export function isGasSourceCategory(source?: string) {
  const group = sourceCategoryGroup(source)?.toLocaleLowerCase().trim()
  const child = sourceCategoryChild(source)?.toLocaleLowerCase().trim()
  return group === 'gas' || group === 'gasoline' || group === 'fuel' || child === 'gas' || child === 'gasoline' || child === 'fuel'
}
export type SourceCategoryGroup = { key: string; parent: string; children: Array<{ key: string; label: string }> }

/**
 * Build the source-provided category hierarchy from the rows that are
 * actually in scope.  Keeping this in the import domain prevents each UI
 * surface from inventing its own list of children (or hard-coding provider
 * categories).  The caller controls the scope: account, date, search, and
 * any other active filters can all be reflected by the supplied rows.
 */
export function buildSourceCategoryGroups(transactions: Transaction[]): SourceCategoryGroup[] {
  const groups = new Map<string, { parent: string; children: Map<string, string>; hasStandalone: boolean }>()
  transactions.forEach(transaction => {
    const parent = sourceCategoryGroup(transaction.sourceCategory)
    if (!parent) return
    const key = sourceCategoryKey(transaction.sourceCategory)
    if (!key) return
    const child = sourceCategoryChild(transaction.sourceCategory)
    const group = groups.get(key) ?? { parent, children: new Map<string, string>(), hasStandalone: false }
    if (child) group.children.set(child.toLocaleLowerCase().replace(/\s+/g, ' '), child)
    else group.hasStandalone = true
    groups.set(key, group)
  })
  return Array.from(groups.entries()).map(([key, group]) => {
    const children = Array.from(group.children.entries()).map(([childKey, label]) => ({ key: childKey, label }))
    if (group.hasStandalone && children.length) children.unshift({ key: sourceCategoryStandaloneKey, label: group.parent })
    return { key, parent: group.parent, children }
  }).filter(group => group.children.length > 0)
}
const groceryRetailerAliases = ['walmart', 'wal mart', 'wm supercenter', 'wm supermarket', 'wmt', 'target', 'tgt', 'aldi', 'sams club', 'costco', 'kroger', 'publix', 'whole foods', 'wholefoods', 'trader joes', 'safeway', 'albertsons', 'meijer', 'heb', 'wegmans', 'food lion', 'giant food', 'stop shop', 'sprouts', 'lidl', 'winco', 'hy vee', 'grocery outlet', 'bjs', 'ralphs', 'smiths', 'king soopers', 'fred meyer', 'harris teeter', 'marianos', 'food 4 less', 'pick n save', 'qfc', 'jewel osco', 'shaws', 'acme', 'shoprite', 'giant eagle', 'save a lot', 'winn dixie', 'market basket', 'ingles', 'fresh market', 'cub foods', 'h mart']
function isGroceryRetailer(merchant: string) { const normalized = merchant.toLowerCase().replace(/\b(?:aplpay|apple\s*pay|applepay)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); const compact = normalized.replace(/\s/g, ''); return groceryRetailerAliases.some(alias => { const normalizedAlias = alias.replace(/\s/g, ' '); const compactAlias = normalizedAlias.replace(/\s/g, ''); return new RegExp(`(^|\\s)${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'i').test(normalized) || compact.includes(compactAlias) }) }
export function categorize(merchant: string, categories: Category[], sourceCategory?: string) { const match = (id: string, subcategory: string, confidence = .96) => ({ categoryId: categories.some(c => c.id === id) ? id : categories[0].id, subcategory, confidence }); if (isGroceryRetailer(merchant)) return match('groceries', 'Retail groceries', .99); const source = sourceCategory?.trim() ?? ''; const sourceText = source.toLowerCase(); if (source) { if (/restaurant|food|bar|café|cafe|dining/.test(sourceText)) return match('food', source, .99); if (/grocery|supermarket/.test(sourceText)) return match('groceries', source, .99); if (/gasoline|\bgas\b|transport|automotive|fuel|rideshare/.test(sourceText)) return match('transport', source, .99); if (/travel|airline|hotel|entertainment/.test(sourceText)) return match(/entertainment/.test(sourceText) && !/travel/.test(sourceText) ? 'entertainment' : 'travel', source, .99); if (/merchandise|shopping|retail|clothing|hardware|internet purchase|wholesale|department store/.test(sourceText)) return match('shopping', source, .99); if (/bill|utility|phone|internet/.test(sourceText)) return match('bills', source, .99); if (/fee|interest/.test(sourceText)) return match('fees', source, .99); if (/health|pharmacy|medical/.test(sourceText)) return match('health', source, .99); if (/payment|credit|other|miscellaneous|government|education|service/.test(sourceText)) return match('other', source, .99) } if (/dunkin|starbucks|coffee/i.test(merchant)) return match('food', 'Coffee'); if (/uber|lyft/i.test(merchant)) return match('transport', 'Rideshare'); if (/netflix|spotify|hulu/i.test(merchant)) return match('entertainment', 'Streaming'); if (/amazon/i.test(merchant)) return match('shopping', 'Online'); const other = categories.find(c => c.id === 'other') ?? categories[0]; return { categoryId: other.id, subcategory: 'Uncategorized', confidence: .35 } }
// A transfer is money movement, but it is not automatically a card payment
// (for example, Amex Send's "Transfer to Card"). Keep it out of both paid and
// spending totals unless the source explicitly identifies it as a payment.
export function isPaid(transaction: Transaction) { return transaction.transactionType === 'payment' }
export function isSpending(transaction: Transaction) { return !isPaid(transaction) && transaction.transactionType !== 'transfer' && transaction.transactionType !== 'credit' && transaction.transactionType !== 'refund' }
export function spendingAmount(transaction: Transaction) { return isSpending(transaction) ? Math.abs(transaction.amount) : 0 }

function tableToRaw(rows: unknown[][], fileName: string, parser: string): RawTransaction[] { const headerIndex = rows.findIndex(row => row.filter(Boolean).map(fieldFor).filter(Boolean).length >= 2); if (headerIndex < 0) throw new Error('Ledgerly could not find a transaction table with date, description, and amount columns.'); const header = rows[headerIndex].map(fieldFor); return rows.slice(headerIndex + 1).filter(row => row.some(cell => String(cell ?? '').trim())).map(row => { const item = Object.fromEntries(header.map((key, index) => [key, row[index]])); return { rawDate: String(item.date ?? ''), rawPostedDate: item.postedDate ? String(item.postedDate) : undefined, rawDescription: String(item.description ?? item.merchant ?? ''), rawAmount: String(item.amount ?? ''), rawCategory: item.category ? String(item.category) : undefined, rawTransactionType: item.transactionType ? String(item.transactionType) : undefined, sourceFile: fileName, parser, confidence: .85 } }) }
async function rawFromFile(file: File): Promise<RawTransaction[]> { const ext = file.name.split('.').pop()?.toLowerCase(); if (ext === 'csv') { const text = await file.text(); const rows = text.split(/\r?\n/).filter(Boolean).map(line => line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(v => v.replace(/^\"|\"$/g, '').trim())); return tableToRaw(rows, file.name, 'Generic CSV'); }
  if (ext === 'xlsx' || ext === 'xls') { const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; return tableToRaw(XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as unknown[][], file.name, 'Generic spreadsheet'); }
  throw new Error('Unsupported file type. Use a CSV or XLSX statement.') }

function fingerprint(file: File) { return `${file.name.toLowerCase()}-${file.size}-${file.lastModified}` }
function detectAccount(fileName: string, institution: string | undefined, accounts: Account[]) {
  const text = `${fileName} ${institution ?? ''}`.toLowerCase()
  const aliasesByInstitution: Record<string, string[]> = { 'american express': ['amex'], apple: ['apple card'], chase: ['chase'], discover: ['discover'], 'capital one': ['capital one', 'capitalone'], ally: ['ally'] }
  return accounts.find(account => text.includes(account.institution.toLowerCase()) || (aliasesByInstitution[account.institution.toLowerCase()] ?? []).some(alias => text.includes(alias)))
}
export async function processStatement(file: File, accounts: Account[], categories: Category[], existingFingerprints: string[]): Promise<ImportResult> {
  const base: Statement = { id: crypto.randomUUID(), fileName: file.name, status: 'processing', transactionCount: 0, fileSize: file.size, fingerprint: fingerprint(file) }
  if (file.size === 0) return { statement: { ...base, status: 'failed', message: 'This file is empty.' }, transactions: [] }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!['csv','xlsx','xls','pdf'].includes(extension)) return { statement: { ...base, status: 'failed', message: 'Unsupported file type.' }, transactions: [] }
  if (existingFingerprints.includes(base.fingerprint)) return { statement: { ...base, status: 'duplicate', message: 'This file appears to have already been added.' }, transactions: [] }
  try {
    const pdf = extension === 'pdf' ? await inspectAndExtractPdf(file) : undefined
    const raw = pdf?.transactions ?? await rawFromFile(file)
    const detectedAccount = detectAccount(file.name, pdf?.inspection.institution, accounts)
    const statementDates = pdf ? { statementStartDate: pdf.inspection.statementStartDate, statementEndDate: pdf.inspection.statementEndDate } : {}
    if (pdf && pdf.inspection.pdfType === 'IMAGE_PDF') return { statement: { ...base, ...statementDates, status: 'warning', institution: pdf.inspection.institution, documentType: pdf.inspection.documentType, pdfType: pdf.inspection.pdfType, warnings: pdf.inspection.warnings, message: pdf.inspection.warnings[0] }, transactions: [] }
    if (pdf && !raw.length) return { statement: { ...base, ...statementDates, status: 'warning', institution: pdf.inspection.institution, documentType: pdf.inspection.documentType, pdfType: pdf.inspection.pdfType, warnings: ['Ledgerly found a transaction section but no complete date, description, and amount candidates.'], message: 'Transaction structure needs review; no data was imported.' }, transactions: [] }
    const resolvedDocumentType = pdf && raw.length ? 'TRANSACTION_STATEMENT' : pdf?.inspection.documentType
    const review = raw.map((item, index) => normalizeRaw({ ...item, rawAccount: detectedAccount?.id }, base.id, accounts, categories, index))
    const flags = review.flatMap(item => item.flags)
    const status = flags.length ? 'warning' : 'ready'
    return { statement: { ...base, ...statementDates, status, institution: pdf?.inspection.institution ?? detectedAccount?.institution, accountId: detectedAccount?.id, accountName: detectedAccount?.displayName, documentType: resolvedDocumentType, pdfType: pdf?.inspection.pdfType, warnings: pdf?.inspection.warnings, transactionCount: review.length, parser: raw[0]?.parser, message: flags.length ? `${review.length} transactions found; ${flags.length} item${flags.length === 1 ? '' : 's'} need review.` : `${review.length} transactions ready to import.` }, transactions: review }
  } catch (error) { return { statement: { ...base, status: 'failed', message: error instanceof Error ? error.message : 'Could not inspect this file.' }, transactions: [] } }
}

function normalizeRaw(raw: RawTransaction, statementId: string, accounts: Account[], categories: Category[], index: number): ReviewTransaction { const amount = parseAmount(raw.rawAmount); const date = parseDate(raw.rawDate); const merchant = normalizeMerchant(raw.rawDescription); const type = classifyType(raw.rawDescription, amount ?? 0, raw.rawTransactionType); const account = accounts.find(a => a.id === raw.rawAccount) ?? accounts.find(a => raw.sourceFile.toLowerCase().includes(a.institution.toLowerCase())); const normalizedAmount = account?.id === 'chase' && amount !== undefined ? -amount : amount; const cat = categorize(merchant.name, categories, raw.rawCategory); const flags: ReviewFlag[] = []; if (!date) flags.push({ field: 'date', message: 'Date could not be read.' }); if (amount === undefined) flags.push({ field: 'amount', message: 'Amount could not be read.' }); if (!account) flags.push({ field: 'account', message: 'Account needs review.' }); return { transaction: { id: crypto.randomUUID(), accountId: account?.id ?? 'unassigned', statementId, transactionDate: date ?? '', postedDate: parseDate(raw.rawPostedDate ?? ''), merchantRaw: raw.rawDescription, merchantNormalized: merchant.name, description: raw.rawDescription, amount: normalizedAmount ?? 0, currency: 'USD', categoryId: cat.categoryId, sourceCategory: raw.rawCategory, subcategory: cat.subcategory, transactionType: type, sourceFile: raw.sourceFile, sourcePage: raw.sourcePage, confidence: Math.min(raw.confidence, merchant.confidence, cat.confidence) }, flags } }
