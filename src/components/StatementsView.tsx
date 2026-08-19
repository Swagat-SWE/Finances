import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, ExternalLink, FileText, Search, X } from 'lucide-react'
import type { Account, Category, Statement, Transaction } from '../data/models'
import { cardLogoFor } from '../utils/cardLogo'
import { buildStatementRecords, expandStatementRecords, nextStatement, previousStatement, statementPeriodLabel, type StatementRecord } from '../services/statementAnalytics'
import { spendingAmount } from '../services/statementImport'
import { formatMoney } from '../utils/display'

const money = { format: formatMoney }

type Props = { statements: Statement[]; transactions: Transaction[]; accounts: Account[]; categories: Category[]; onImport: () => void }
type ArchiveMode = 'month' | 'card'

function formatMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return 'Unknown period'
  return new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDate(value: string) {
  if (!value) return 'Date unavailable'
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function sourceLabel(record: StatementRecord) {
  return record.sourceType === 'SOURCE' ? 'Imported source' : `Imported ${record.sourceType}`
}

function StatementRow({ record, onClick }: { record: StatementRecord; onClick: () => void }) {
  const logo = cardLogoFor(record.institution)
  return <button className="statement-row" onClick={onClick} aria-label={`Open ${record.institution} ${formatMonth(record.monthKey)} statement`}><span className="statement-card-logo">{logo ? <img src={logo} alt=""/> : <FileText size={19}/>}</span><span className="statement-row-identity"><strong>{record.institution}</strong><small>{record.accountName}{record.account?.lastFour ? ` · •••• ${record.account.lastFour}` : ''}</small></span><span className="statement-row-period"><strong>{statementPeriodLabel(record)}</strong><small>{record.transactions.length} transaction{record.transactions.length === 1 ? '' : 's'} · {sourceLabel(record)}</small></span><span className="statement-row-total"><strong className="amount-positive">{money.format(record.spending)}</strong><small>{record.merchantCount} merchant{record.merchantCount === 1 ? '' : 's'}</small></span><span className={`statement-status ${record.statement.status}`}>{record.statement.status === 'imported' ? 'Imported' : record.statement.status === 'warning' ? 'Partial' : record.statement.status}</span><ArrowRight size={16}/></button>
}

function StatementCoverage({ records, year }: { records: StatementRecord[]; year: string }) {
  const months = Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`)
  const cards = Array.from(new Map(records.map(record => [record.statement.accountId ?? record.institution, record])).values()).sort((first, second) => first.institution.localeCompare(second.institution))
  const available = new Set(records.map(record => `${record.statement.accountId ?? record.institution}|${record.monthKey}`))
  return <section className="statements-coverage-card"><div className="statements-section-heading"><div><p className="eyebrow">COVERAGE</p><h2>Statement coverage</h2></div><small>{records.length} month-card view{records.length === 1 ? '' : 's'} in {year}</small></div><div className="statements-coverage-grid"><div className="coverage-month-labels"><span className="coverage-label-spacer"/>{months.map(month => <span key={month}>{new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short' })}</span>)}</div>{cards.map(card => { const cardKey = card.statement.accountId ?? card.institution; return <div className="coverage-row" key={cardKey}><strong>{card.institution}</strong><div>{months.map(month => <span className={available.has(`${cardKey}|${month}`) ? 'available' : 'missing'} key={month} title={`${card.institution} · ${formatMonth(month)} · ${available.has(`${cardKey}|${month}`) ? 'Available' : 'Not available'}`}>{available.has(`${cardKey}|${month}`) ? '✓' : '—'}</span>)}</div></div>})}</div></section>
}

function StatementDetail({ record, records, accounts, onBack, onSelect, onImport }: { record: StatementRecord; records: StatementRecord[]; accounts: Account[]; onBack: () => void; onSelect: (record: StatementRecord) => void; onImport: () => void }) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [merchantFilter, setMerchantFilter] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const prior = previousStatement(record, records)
  const next = nextStatement(record, records)
  const filteredTransactions = record.transactions.filter(transaction => (!categoryFilter || transaction.categoryId === categoryFilter) && (!merchantFilter || (transaction.merchantNormalized || transaction.merchantRaw).toLocaleLowerCase() === merchantFilter.toLocaleLowerCase()) && `${transaction.merchantNormalized} ${transaction.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const comparison = prior ? record.spending - prior.spending : 0
  const logo = cardLogoFor(record.institution)
  const openOriginal = () => {
    if (!record.statement.sourceFile) return
    const url = URL.createObjectURL(record.statement.sourceFile)
    const extension = record.sourceType.toLowerCase()
    if (extension === 'csv' || extension === 'xlsx') {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = record.statement.fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  const insight = record.categories[0] ? `${record.categories[0].name} was your largest category this statement.` : record.merchants[0] ? `${record.merchants[0].name} was your largest merchant this statement.` : ''
  return <div className="statements-view statement-detail-view"><header className="statements-detail-header"><button className="back-button statement-back-button" onClick={onBack}><ArrowLeft size={16}/>Back to Statements</button><div className="statement-detail-header-main"><div className="statement-detail-logo">{logo ? <img src={logo} alt={`${record.institution} logo`}/> : <FileText size={23}/>}</div><div><h1>{record.accountName}</h1><p className="subhead">{statementPeriodLabel(record)}</p></div></div><div className="statement-detail-navigation"><button disabled={!prior} onClick={() => prior && onSelect(prior)}><ArrowLeft size={14}/>Previous</button><button disabled={!next} onClick={() => next && onSelect(next)}>Next<ArrowRight size={14}/></button></div></header>
    <section className="statement-kpis"><div><strong className="amount-positive">{money.format(record.spending)}</strong><small>Total spending</small></div><div><strong>{record.transactions.length}</strong><small>Transactions</small></div><div><strong>{record.merchantCount}</strong><small>Merchants</small></div><div><strong>{record.categoryCount}</strong><small>Categories</small></div></section>
    <div className="statement-detail-grid"><section className="statement-detail-panel"><div className="statements-section-heading"><div><p className="eyebrow">LEDGERLY ANALYSIS</p><h2>Statement summary</h2></div></div><div className="statement-category-list">{record.categories.length ? record.categories.map(category => <button key={category.id} className={`statement-category-row ${categoryFilter === category.id ? 'selected' : ''}`} onClick={() => { setCategoryFilter(current => current === category.id ? null : category.id); setMerchantFilter(null) }}><span><strong>{category.name}</strong><small>{category.count} transaction{category.count === 1 ? '' : 's'}</small></span><b className="amount-positive">{money.format(category.amount)}</b><i><span style={{ width: `${record.categories[0]?.amount ? category.amount / record.categories[0].amount * 100 : 0}%`, background: category.color }}/></i></button>) : <p className="statement-muted">No spending categories were detected.</p>}</div></section><section className="statement-detail-panel"><div className="statements-section-heading"><div><p className="eyebrow">MERCHANTS</p><h2>Top merchants</h2></div></div><div className="statement-merchant-list">{record.merchants.length ? record.merchants.slice(0, 6).map(merchant => <button key={merchant.name} className={`statement-merchant-row ${merchantFilter?.toLocaleLowerCase() === merchant.name.toLocaleLowerCase() ? 'selected' : ''}`} onClick={() => { setMerchantFilter(current => current?.toLocaleLowerCase() === merchant.name.toLocaleLowerCase() ? null : merchant.name); setCategoryFilter(null) }}><span><strong>{merchant.name}</strong><small>{merchant.count} transaction{merchant.count === 1 ? '' : 's'}</small></span><b className="amount-positive">{money.format(merchant.amount)}</b></button>) : <p className="statement-muted">No spending merchants were detected.</p>}</div></section></div>
    {prior && <section className="statement-comparison"><div><p className="eyebrow">COMPARED WITH {formatMonth(prior.monthKey).toUpperCase()}</p><h2>{comparison >= 0 ? `${money.format(comparison)} more spending` : `${money.format(Math.abs(comparison))} less spending`}</h2><p>{record.transactions.length - prior.transactions.length >= 0 ? `${record.transactions.length - prior.transactions.length} more` : `${Math.abs(record.transactions.length - prior.transactions.length)} fewer`} transactions than the previous statement.</p></div><strong className={comparison >= 0 ? 'amount-negative' : 'amount-positive'}>{comparison >= 0 ? '↑' : '↓'} {prior.spending ? `${Math.abs(comparison / prior.spending * 100).toFixed(1)}%` : '—'}</strong></section>}
    {insight && <section className="statement-insight"><p className="eyebrow">STATEMENT INSIGHT</p><p>{insight}</p></section>}
    <section className="statement-transactions-panel"><div className="statements-section-heading"><div><p className="eyebrow">TRANSACTIONS</p><h2>Statement transactions</h2><small>{filteredTransactions.length} shown · {statementPeriodLabel(record)}</small></div><label className="statement-search"><Search size={15}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search this statement"/></label></div>{(categoryFilter || merchantFilter) && <div className="statement-active-filter"><span>Filtered to {categoryFilter ? record.categories.find(category => category.id === categoryFilter)?.name : merchantFilter}</span><button aria-label="Clear statement filter" onClick={() => { setCategoryFilter(null); setMerchantFilter(null) }}><X size={14}/></button></div>}<div className="table statement-table"><div className="table-head"><span>Date</span><span>Merchant</span><span>Category</span><span>Card</span><span>Amount</span></div>{filteredTransactions.map(transaction => <div className="table-row" key={transaction.id}><span>{transaction.transactionDate ? formatDate(transaction.transactionDate) : 'Date unavailable'}</span><strong>{transaction.merchantNormalized || transaction.description}<small>{transaction.description}</small></strong><span>{transaction.sourceCategory || record.categories.find(category => category.id === transaction.categoryId)?.name || 'Other'}</span><span>{record.institution}</span><b className={transaction.amount < 0 ? 'amount-negative' : 'amount-positive'}>{money.format(transaction.amount)}</b></div>)}{!filteredTransactions.length && <div className="statement-muted statement-no-transactions">No transactions match this statement filter.</div>}</div></section>
    <section className="statement-source-panel"><div><p className="eyebrow">SOURCE DOCUMENT</p><h2>{record.statement.fileName}</h2><p>{record.institution} · {formatMonth(record.monthKey)} · {sourceLabel(record)}</p></div><div><span className={`statement-status ${record.statement.status}`}>{record.statement.status === 'imported' ? 'Imported' : record.statement.status}</span><button className="import-button" disabled={!record.statement.sourceFile} onClick={openOriginal}><ExternalLink size={15}/>{record.sourceType === 'PDF' ? 'View Original Statement' : 'Download Original Source'}</button>{!record.statement.sourceFile && <small className="statement-source-note">Original file is not available in this session.</small>}</div></section>
    <div className="statement-detail-footer"><button className="secondary-button" onClick={onBack}><ArrowLeft size={15}/>Back to Statements</button><button className="text-button" onClick={onImport}>Import another statement</button></div>
  </div>
}

export default function StatementsView({ statements, transactions, accounts, categories, onImport }: Props) {
  const records = useMemo(() => expandStatementRecords(buildStatementRecords(statements, transactions, accounts, categories), categories), [statements, transactions, accounts, categories])
  const years = useMemo(() => Array.from(new Set(records.map(record => record.year).filter(Boolean))).sort((first, second) => second.localeCompare(first)), [records])
  const [selectedYear, setSelectedYear] = useState('')
  const [mode, setMode] = useState<ArchiveMode>('month')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  useEffect(() => { if (!years.includes(selectedYear)) setSelectedYear(years[0] ?? '') }, [years, selectedYear])
  const yearRecords = records.filter(record => record.year === selectedYear && `${record.institution} ${record.accountName} ${record.statement.fileName} ${formatMonth(record.monthKey)}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
  const selectedRecord = selectedId ? records.find(record => record.statement.id === selectedId) : undefined
  if (selectedRecord) return <StatementDetail record={selectedRecord} records={records} accounts={accounts} onBack={() => setSelectedId(null)} onSelect={record => setSelectedId(record.statement.id)} onImport={onImport}/>
  if (!records.length) return <div className="statements-view"><header className="statements-page-header"><div><h1>Statements</h1><p className="subhead">Your monthly statements, organized across all your cards.</p></div><button className="import-button" onClick={onImport}>Import statement</button></header><section className="empty-dashboard statements-empty"><span className="upload-orb"><FileText size={24}/></span><h2>No statements yet.</h2><p>Import a bank or credit card statement to organize your financial history here.</p><button className="import-button" onClick={onImport}>Import statement</button></section></div>
  const months = new Set(yearRecords.map(record => record.monthKey))
  const cards = new Set(yearRecords.map(record => record.statement.accountId ?? record.institution))
  const sourceStatements = new Set(yearRecords.map(record => record.sourceStatementId))
  const groupedByMonth = Array.from(new Set(yearRecords.map(record => record.monthKey))).sort((first, second) => second.localeCompare(first))
  const groupedByCard = Array.from(new Set(yearRecords.map(record => record.statement.accountId ?? record.institution))).sort((first, second) => first.localeCompare(second))
  return <div className="statements-view"><header className="statements-page-header"><div><h1>Statements</h1><p className="subhead">Your monthly statements, organized across all your cards.</p></div><div className="statements-header-actions"><label className="statement-year-select"><span>Year</span><select value={selectedYear} onChange={event => setSelectedYear(event.target.value)} aria-label="Statement year">{years.map(year => <option key={year}>{year}</option>)}</select><ChevronDown size={14}/></label><button className="import-button" onClick={onImport}>Import statement</button></div></header><section className="statements-coverage-summary"><div><p className="eyebrow">STATEMENT COVERAGE</p><strong>{months.size} month{months.size === 1 ? '' : 's'} available · {cards.size} card{cards.size === 1 ? '' : 's'} · {sourceStatements.size} source statement{sourceStatements.size === 1 ? '' : 's'}</strong></div><label className="statement-search archive-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search statements"/></label></section><StatementCoverage records={yearRecords} year={selectedYear}/><div className="statements-archive-toolbar"><div className="statements-view-toggle"><button className={mode === 'month' ? 'selected' : ''} onClick={() => setMode('month')}>By Month</button><button className={mode === 'card' ? 'selected' : ''} onClick={() => setMode('card')}>By Card</button></div><span>{yearRecords.length} monthly card view{yearRecords.length === 1 ? '' : 's'}</span></div>{mode === 'month' ? <div className="statement-month-list">{groupedByMonth.map(month => <section className="statement-month-section" key={month}><div className="statement-month-heading"><div><h2>{formatMonth(month)}</h2><p>{yearRecords.filter(record => record.monthKey === month).length} card statement{yearRecords.filter(record => record.monthKey === month).length === 1 ? '' : 's'}</p></div><CalendarDays size={18}/></div><div className="statement-row-list">{yearRecords.filter(record => record.monthKey === month).map(record => <StatementRow key={record.statement.id} record={record} onClick={() => setSelectedId(record.statement.id)}/>)}</div></section>)}{!groupedByMonth.length && <div className="statement-muted statement-no-results">No statements match your search.</div>}</div> : <div className="statement-card-list">{groupedByCard.map(cardKey => { const cardRecords = yearRecords.filter(record => (record.statement.accountId ?? record.institution) === cardKey).sort((first, second) => second.startDate.localeCompare(first.startDate)); const first = cardRecords[0]; return <section className="statement-card-section" key={cardKey}><div className="statement-card-section-heading"><span className="statement-card-logo">{first && cardLogoFor(first.institution) ? <img src={cardLogoFor(first.institution)!} alt=""/> : <FileText size={19}/>}</span><div><h2>{first?.institution ?? cardKey}</h2><p>{first?.accountName ?? 'Account'} · {cardRecords.length} month{cardRecords.length === 1 ? '' : 's'}</p></div></div><div className="statement-row-list">{cardRecords.map(record => <StatementRow key={record.statement.id} record={record} onClick={() => setSelectedId(record.statement.id)}/>)}</div></section>})}</div>}</div>
}
