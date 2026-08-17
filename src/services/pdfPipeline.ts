import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { DocumentType, PdfType, RawTransaction } from '../data/models'

export type PdfTextRow = { text: string; page: number; x?: number; y?: number; columns?: { text: string; x: number }[] }
export type PdfInspection = { pdfType: PdfType; institution?: string; documentType: DocumentType; warnings: string[]; statementStartDate?: string; statementEndDate?: string }
export type PdfExtraction = { inspection: PdfInspection; transactions: RawTransaction[] }

const datePattern = /^(?:(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})|([A-Za-z]{3,9}\.?\s+\d{1,2}(?:,?\s+\d{4})?))/
const amountPattern = /(?:\(\s*\$?\s*[\d,]+(?:\.\d{2})?\s*\)|-?\s*\$?\s*[\d,]+\.\d{2})(?:\s*(?:CR|DR))?/gi
const normalDate = (value: string) => value.trim().replace(/\./g, '/')
const dateAtStart = (text: string) => { const match = text.trim().match(datePattern); return match?.[0] ?? '' }
const stripDate = (text: string, date: string) => text.slice(date.length).trim()
const amountValue = (value: string) => value.replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1').replace(/(CR|DR)$/i, '').trim()

export function classifyDocument(text: string): DocumentType {
  const value = text.toLowerCase()
  const hasTransactionColumns = /date/.test(value) && /description/.test(value) && /amount/.test(value)
  if (hasTransactionColumns || /account activity[\s\S]{0,80}transactions/.test(value) || /american express[\s\S]{0,80}transactions/.test(value)) return 'TRANSACTION_STATEMENT'
  if (/spending by category|year[- ]to[- ]date summary|summary by category/.test(value)) return 'YEAR_TO_DATE_SUMMARY'
  if (/spending report|spending summary/.test(value)) return 'SPENDING_REPORT'
  if (/account summary|account information|minimum payment/.test(value)) return 'ACCOUNT_SUMMARY'
  return 'UNKNOWN'
}

function shouldStartSection(text: string) { return /^(payments|transactions|purchases|charges|account activity|recent transactions|transaction details|payments and credits|purchases and adjustments|activity)\b/i.test(text.trim()) }
function shouldEndSection(text: string) { return /^(account summary|interest charged|interest charges|legal|important information|total interest|minimum payment warning)\b/i.test(text.trim()) || /(?:monthly installments|installment details)/i.test(text) }
function isColumnHeader(text: string) { return /^(date|trans\.?\s*date|transaction date|posted date|post date|status)\b/i.test(text.trim()) && /description|amount/i.test(text) }
function descriptionFrom(text: string, date: string, amount: string) {
  let description = stripDate(text, date)
  description = description.replace(amountPattern, ' ').replace(/\s+/g, ' ').trim()
  description = description.replace(/\s+\$\s*$/, '').trim()
  description = description.replace(/\s+\d+(?:\.\d+)?%\s*$/, '').trim()
  return description
}
const categoryAfterAmount = (text: string, amount: string) => {
  if (!amount) return undefined
  const index = text.lastIndexOf(amount)
  if (index < 0) return undefined
  const tail = text.slice(index + amount.length).replace(/\s+/g, ' ').trim()
  return tail && !/^\d+(?:\.\d+)?%$/.test(tail) ? tail : undefined
}

export function detectPdfCandidates(rows: PdfTextRow[], fileName: string): RawTransaction[] {
  const candidates: RawTransaction[] = []
  const hasSectionMarkers = rows.some(row => shouldStartSection(row.text))
  let active = false
  let current: { date: string; posted?: string; description: string; amount: string; page: number; category?: string } | undefined
  const flush = () => {
    if (!current || !current.date || !current.amount || !current.description) { current = undefined; return }
    candidates.push({ rawDate: current.date, rawPostedDate: current.posted, rawDescription: current.description, rawAmount: current.amount, rawCategory: current.category, sourceFile: fileName, sourcePage: current.page, parser: 'PDF layout/text extraction', confidence: .9 })
    current = undefined
  }
  for (const row of rows) {
    const text = row.text.replace(/\s+/g, ' ').trim()
    if (!text) continue
    if (shouldStartSection(text)) { active = true; continue }
    if (shouldEndSection(text)) { flush(); active = false; continue }
    if (isColumnHeader(text)) { flush(); continue }
    const date = dateAtStart(text)
    const amounts = text.match(amountPattern) ?? []
    const amount = amounts.length ? amounts[amounts.length - 1] : ''
    const startsTransaction = Boolean(date) && (active || !hasSectionMarkers)
    if (startsTransaction) {
      flush()
      let remainder = stripDate(text, date)
      let posted: string | undefined
      const secondDate = dateAtStart(remainder)
      if (secondDate) { posted = secondDate; remainder = stripDate(remainder, secondDate) }
      const category = categoryAfterAmount(text, amount)
      const parsedDescription = descriptionFrom(`${date} ${remainder}`, date, amount)
      const cleanDescription = (category ? parsedDescription.slice(0, parsedDescription.lastIndexOf(category)).trim() : parsedDescription).replace(/\s+\$\s*$/, '').trim()
      current = { date: normalDate(date), posted, description: cleanDescription, amount, category, page: row.page }
      continue
    }
    if (current && active) {
      if (/^(total|page \d|apple card customer|statement|if you have an iphone)/i.test(text)) { flush(); active = false; continue }
      const continuation = descriptionFrom(text, '', amount)
      if (continuation) current.description = `${current.description} ${continuation}`.replace(/\s+/g, ' ').trim()
      if (amount && !current.amount) { current.amount = amount; flush() }
    }
  }
  flush()
  return candidates
}

async function extractRows(file: File): Promise<{ rows: PdfTextRow[]; text: string; pdfType: PdfType }> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const pdf = await loadingTask.promise
  const rows: PdfTextRow[] = []
  let textLength = 0
  let textPages = 0
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const grouped: { text: string; x: number; y: number; parts: { text: string; x: number }[] }[] = []
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const transform = 'transform' in item ? item.transform : [1, 0, 0, 1, 0, 0]
      const x = Number(transform[4] ?? 0); const y = Number(transform[5] ?? 0)
      let line = grouped.find(entry => Math.abs(entry.y - y) <= 3)
      if (!line) { line = { text: '', x, y, parts: [] }; grouped.push(line) }
      line.parts.push({ text: item.str.trim(), x })
      line.x = Math.min(line.x, x)
      textLength += item.str.length
    }
    if (grouped.length) textPages += 1
    grouped.sort((a, b) => b.y - a.y || a.x - b.x)
    rows.push(...grouped.map(line => { line.parts.sort((a, b) => a.x - b.x); line.text = line.parts.map(part => part.text).join(' '); return { text: line.text, page: pageNumber, x: line.x, y: line.y, columns: line.parts } }))
  }
  return { rows, text: rows.map(row => row.text).join('\n'), pdfType: !textLength ? 'IMAGE_PDF' : textPages < pdf.numPages ? 'HYBRID_PDF' : 'TEXT_PDF' }
}

export async function inspectAndExtractPdf(file: File): Promise<PdfExtraction> {
  const extracted = await extractRows(file)
  const text = extracted.text
  const lowerText = text.toLowerCase()
  const institution = /apple card|goldman sachs/.test(lowerText) ? 'Apple' : /american express|blue cash everyday/.test(lowerText) ? 'American Express' : /discover/.test(lowerText) ? 'Discover' : /\bchase\b/.test(lowerText) ? 'Chase' : undefined
  const documentType = classifyDocument(text)
  const warnings: string[] = []
  if (extracted.pdfType === 'IMAGE_PDF') warnings.push('This statement appears to be image-based. OCR is required to extract transactions.')
  if (!text.trim()) warnings.push('No selectable text was found in this PDF.')
  const period = text.match(/Statement\s+([A-Za-z]{3,9}\s+\d{1,2})\s*[—-]\s*([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i)
  const transactions = extracted.pdfType === 'IMAGE_PDF' ? [] : detectPdfCandidates(extracted.rows, file.name)
  if (!transactions.length && documentType === 'TRANSACTION_STATEMENT') warnings.push('Ledgerly found a transaction statement but could not reconstruct its rows.')
  return { inspection: { pdfType: extracted.pdfType, institution, documentType, warnings, statementStartDate: period?.[1], statementEndDate: period?.[2] }, transactions }
}
