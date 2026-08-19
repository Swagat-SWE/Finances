import { useEffect, useMemo, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownUp, ChevronDown, CircleHelp, CreditCard, FileText, Filter, LayoutGrid, Maximize2, PanelLeftClose, PanelLeftOpen, Search, Tag, TrendingUp, Upload, WalletCards, X } from 'lucide-react'
import { accounts, categories } from './data/mockData'
import type { ReviewTransaction, Statement, Transaction } from './data/models'
import ImportFlow from './components/ImportFlow'
import DateRangePicker from './components/DateRangePicker'
import FilterDropdown from './components/FilterDropdown'
import MonthlySpendingAnalytics from './components/MonthlySpendingAnalytics'
import MerchantsView from './components/MerchantsView'
import StatementsView from './components/StatementsView'
import OnboardingTour, { type TourStep } from './components/OnboardingTour'
import { buildSourceCategoryGroups, categorize, isGasSourceCategory, isPaid, isSpending, normalizeMerchant, normalizedGasCategoryKey, sourceCategoryChild, sourceCategoryGroup, sourceCategoryKey, sourceCategoryStandaloneKey, spendingAmount } from './services/statementImport'
import { isCompleteCalendarMonth } from './services/monthlyAnalytics'
import { areNumbersHidden, formatMoney, setNumbersHidden } from './utils/display'

const money = { format: formatMoney }
const nav = [{ icon: LayoutGrid, label: 'Overview', active: true }, { icon: TrendingUp, label: 'Spending' }, { icon: Tag, label: 'Categories' }, { icon: Search, label: 'Merchants' }, { icon: FileText, label: 'Statements' }]
const publicAsset = (path: string) => `${import.meta.env.BASE_URL}${path}`
const cardLogoFor = (institution: string) => {
  const name = institution.toLocaleLowerCase()
  if (name.includes('american express') || name.includes('amex')) return publicAsset('logo/Amex.png')
  if (name.includes('apple')) return publicAsset('logo/Apple.png')
  if (name.includes('capital one')) return publicAsset('logo/CapitalOne.png')
  if (name.includes('chase')) return publicAsset('logo/Chase.png')
  if (name.includes('discover')) return publicAsset('logo/Discover.png')
  if (name.includes('paypal')) return publicAsset('logo/PayPal.png')
  if (name.includes('wells fargo')) return publicAsset('logo/WellsFargo.png')
  return undefined
}

function parseISODate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function toISODate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function shiftDate(value: string, days: number) {
  const date = parseISODate(value)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

function shiftMonth(value: string, months: number) {
  const date = parseISODate(`${value}-01`)
  date.setMonth(date.getMonth() + months)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthKeyFromDate(value: string) { return value.slice(0, 7) }

type SpendingChartPoint = { key: string; label: string; amount: number; byAccount: Record<string, number> }
type SpendingChartTooltipProps = { active?: boolean; payload?: Array<{ payload?: SpendingChartPoint }>; label?: string | number; accountIds: string[] }

const formatCurrency = (value: number) => money.format(value)
const formatCount = (value: number) => Math.round(value).toLocaleString('en-US')
const normalizeFirstName = (value: string) => {
  const trimmed = value.trim()
  return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}` : ''
}

function AnimatedNumber({ value, formatter, className, once = false }: { value: number; formatter: (value: number) => string; className?: string; once?: boolean }) {
  const [displayed, setDisplayed] = useState(0)
  const displayedRef = useRef(0)
  const hasAnimatedRef = useRef(false)
  const numbersHidden = areNumbersHidden()

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0
    if (numbersHidden) {
      displayedRef.current = 0
      hasAnimatedRef.current = false
      setDisplayed(0)
      return
    }
    if (once && hasAnimatedRef.current) {
      displayedRef.current = target
      setDisplayed(target)
      return
    }
    // The dashboard mounts before the first import and initially renders
    // zeroes. Keep the one-time animation available for the first real data
    // snapshot instead of consuming it on that empty state.
    if (once && target === 0 && displayedRef.current === 0) {
      setDisplayed(0)
      return
    }
    const reducedMotion = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
    if (reducedMotion || Math.abs(target - displayedRef.current) < 0.005) {
      hasAnimatedRef.current = true
      displayedRef.current = target
      setDisplayed(target)
      return
    }
    const from = displayedRef.current
    const startedAt = performance.now()
    const duration = once ? 900 : 420
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = from + (target - from) * eased
      displayedRef.current = next
      setDisplayed(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
      else {
        hasAnimatedRef.current = true
        displayedRef.current = target
        setDisplayed(target)
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, once, numbersHidden])

  return <strong className={`animated-number ${className ?? ''}`}>{formatter(displayed)}</strong>
}

function AnimatedMoney({ value, className, once = false }: { value: number; className?: string; once?: boolean }) {
  return <AnimatedNumber value={value} formatter={formatCurrency} className={className} once={once}/>
}

function SpendingChartTooltip({ active, payload, label, accountIds }: SpendingChartTooltipProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  const chartAccounts = accountIds.map(id => accounts.find(account => account.id === id)).filter((account): account is (typeof accounts)[number] => Boolean(account))
  return <div className="spending-chart-tooltip">
    <div className="spending-chart-tooltip-period">{point.label || label}</div>
    <div className="spending-chart-tooltip-accounts">
      {chartAccounts.map(account => <div className="spending-chart-tooltip-account" key={account.id}><span>{account.institution}</span><AnimatedMoney value={point.byAccount[account.id] ?? 0}/></div>)}
    </div>
    <div className="spending-chart-tooltip-total"><span>Total <i aria-hidden="true">··</i></span><AnimatedMoney value={point.amount}/></div>
  </div>
}

type SpendingFlowPoint = { key: string; label: string; values: Record<string, number> }
type SpendingFlowAccount = (typeof accounts)[number]
type SpendingFlowRange = 'YTD' | '6M' | '3M' | '30D' | '7D'
const spendingFlowRanges: Array<{ value: SpendingFlowRange; label: string }> = [
  { value: 'YTD', label: 'YTD' },
  { value: '6M', label: '6 months' },
  { value: '3M', label: '3 months' },
  { value: '30D', label: '30 days' },
  { value: '7D', label: '7 days' },
]

function buildSpendingFlowData(spending: Transaction[], accountList: SpendingFlowAccount[], latestDate: string, range: SpendingFlowRange) {
  if (!latestDate) return []
  const latestMonth = latestDate.slice(0, 7)
  const daily = range === '30D' || range === '7D'
  const start = range === 'YTD'
    ? `${latestDate.slice(0, 4)}-01-01`
    : daily
      ? shiftDate(latestDate, range === '7D' ? -6 : -29)
      : `${shiftMonth(latestMonth, range === '6M' ? -5 : -2)}-01`
  const end = latestDate
  const keys: string[] = []
  if (daily) {
    for (let date = start; date <= end; date = shiftDate(date, 1)) keys.push(date)
  } else {
    for (let month = start.slice(0, 7); month <= end.slice(0, 7); month = shiftMonth(month, 1)) keys.push(month)
  }
  return keys.map(key => {
    const values: Record<string, number> = {}
    for (const account of accountList) values[account.id] = spending.filter(transaction => transaction.accountId === account.id && (daily ? transaction.transactionDate === key : transaction.transactionDate.startsWith(key))).reduce((sum, transaction) => sum + spendingAmount(transaction), 0)
    return { key, label: daily ? parseISODate(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : parseISODate(`${key}-01`).toLocaleDateString('en-US', { month: 'short' }), values }
  })
}

function SpendingFlowChart({ title, accountList, data, transactions, range, onRangeChange, onExpand, onPointClick, expanded = false, combined = false }: { title: string; accountList: SpendingFlowAccount[]; data: SpendingFlowPoint[]; transactions: Transaction[]; range: SpendingFlowRange; onRangeChange: (range: SpendingFlowRange) => void; onExpand?: () => void; onPointClick?: (point: SpendingChartPoint) => void; expanded?: boolean; combined?: boolean }) {
  const chartData = data.map(point => ({ key: point.key, label: point.label, ...point.values }))
  const total = accountList.reduce((sum, account) => sum + data.reduce((accountTotal, point) => accountTotal + (point.values[account.id] ?? 0), 0), 0)
  const visibleKeys = new Set(data.map(point => point.key))
  const metricTransactions = transactions.filter(transaction => visibleKeys.has(transaction.transactionDate) || visibleKeys.has(transaction.transactionDate.slice(0, 7)))
  const average = metricTransactions.length ? total / metricTransactions.length : 0
  const cardsUsed = new Set(metricTransactions.map(transaction => transaction.accountId)).size
  const formatAxisValue = (value: number) => {
    const amount = Math.round(Number(value))
    if (areNumbersHidden()) return '$••••••'
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(amount >= 10000000 ? 0 : 1).replace(/\.0$/, '')}m`
    if (amount >= 1000) return `$${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`
    return `$${amount.toLocaleString('en-US')}`
  }
  const gradientId = `spending-flow-${combined ? 'combined' : accountList[0]?.id ?? 'empty'}`
  const headerAccount = !combined ? accountList[0] : undefined
  const logo = headerAccount ? cardLogoFor(headerAccount.institution) : undefined
  return <section className={`spending-flow-card ${combined ? 'spending-flow-card-combined' : ''}`}>
    <div className="spending-flow-card-header">
      <div className="spending-flow-title">{logo && <span className={`spending-flow-logo spending-flow-logo-${headerAccount?.id ?? 'card'}`}><img src={logo} alt={`${headerAccount?.institution ?? 'Card'} logo`}/></span>}<h2>{title}</h2></div>
      <div className="spending-flow-card-actions"><div className="spending-flow-total"><FilterDropdown label="Range" hideLabel compact value={range} options={spendingFlowRanges} onChange={value => onRangeChange(value as SpendingFlowRange)}/></div>{onExpand && !expanded && <button className="spending-flow-expand" type="button" aria-label={`Expand ${title} chart`} title="Expand chart" onClick={onExpand}><Maximize2 size={15}/></button>}</div>
    </div>
    <div className="spending-flow-metrics"><div><small>Total spending</small><strong className="amount-positive">{money.format(total)}</strong></div><div><small>Transactions</small><strong>{metricTransactions.length}</strong></div><div><small>Average</small><strong className="amount-positive">{money.format(average)}</strong></div><div><small>Cards used</small><strong>{cardsUsed}</strong></div></div>
    {chartData.length ? <div className="spending-flow-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }} onClick={state => { const chartState = state as unknown as { activeTooltipIndex?: number | string; activeLabel?: string | number }; const index = typeof chartState.activeTooltipIndex === 'number' ? chartState.activeTooltipIndex : Number(chartState.activeTooltipIndex); const sourcePoint = Number.isInteger(index) && index >= 0 ? data[index] : data.find(candidate => candidate.label === String(chartState.activeLabel)); if (sourcePoint) { const byAccount = sourcePoint.values; onPointClick?.({ key: sourcePoint.key, label: sourcePoint.label, amount: Object.values(byAccount).reduce((sum, value) => sum + value, 0), byAccount }) } }}>
      <defs>{accountList.map(account => <linearGradient key={account.id} id={`${gradientId}-${account.id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={account.color} stopOpacity={combined ? .13 : .22}/><stop offset="100%" stopColor={account.color} stopOpacity="0"/></linearGradient>)}</defs>
      <CartesianGrid vertical={false} stroke="#efeff4" strokeDasharray="3 5"/>
      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#8e8d9d', fontSize: 11 }}/>
      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#aaa8b4', fontSize: 10 }} tickFormatter={formatAxisValue} width={54} domain={[0, 'auto']} tickCount={5}/>
      <Tooltip formatter={(value, name) => [money.format(Number(value)), accountList.find(account => account.id === name)?.institution ?? name]} labelFormatter={label => String(label)} contentStyle={{ borderRadius: 10, border: '1px solid #e8e7ef', boxShadow: '0 8px 24px rgba(43,40,74,.1)', fontSize: 12 }} />
      {combined && <Legend verticalAlign="top" align="right" iconType="circle" iconSize={7} wrapperStyle={{ paddingBottom: 8, fontSize: 11, color: '#777584' }} formatter={value => accountList.find(account => account.id === value)?.institution ?? value}/>} 
      {accountList.map(account => <Area key={account.id} type="monotone" dataKey={account.id} name={account.id} stroke={account.color} strokeWidth={2.5} fill={`url(#${gradientId}-${account.id})`} dot={{ r: combined ? 2.5 : 3, fill: account.color, stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 5, fill: account.color, stroke: '#fff', strokeWidth: 2 }} connectNulls/>) }
    </AreaChart></ResponsiveContainer></div> : <div className="spending-flow-empty">No spending data in this year yet.</div>}
  </section>
}

function SpendingView({ transactions, availableAccounts }: { transactions: Transaction[]; availableAccounts: SpendingFlowAccount[] }) {
  const spending = transactions.filter(isSpending).filter(transaction => /^\d{4}-\d{2}-\d{2}$/.test(transaction.transactionDate))
  const latestDate = spending.reduce((latest, transaction) => transaction.transactionDate > latest ? transaction.transactionDate : latest, '')
  const [flowRanges, setFlowRanges] = useState<Record<string, SpendingFlowRange>>({})
  const [selectedFlowPoint, setSelectedFlowPoint] = useState<{ point: SpendingChartPoint; transactions: Transaction[]; accountIds: string[] } | null>(null)
  const cardsWithData = availableAccounts.filter(account => spending.some(transaction => transaction.accountId === account.id))
  const [expandedFlowKey, setExpandedFlowKey] = useState<string | null>(null)
  const rangeFor = (key: string) => flowRanges[key] ?? 'YTD'
  const updateRange = (key: string, range: SpendingFlowRange) => { setSelectedFlowPoint(null); setFlowRanges(current => ({ ...current, [key]: range })) }
  const flowDataFor = (accountList: SpendingFlowAccount[], range: SpendingFlowRange) => buildSpendingFlowData(spending, accountList, latestDate, range)
  const expandedAccounts = expandedFlowKey === 'all' ? cardsWithData : cardsWithData.filter(account => account.id === expandedFlowKey)
  const expandedTitle = expandedFlowKey === 'all' ? 'All cards' : expandedAccounts[0]?.displayName ?? ''
  const expandedRange = expandedFlowKey ? rangeFor(expandedFlowKey) : 'YTD'
  const openFlowPoint = (point: SpendingChartPoint, accountIds: string[]) => {
    const pointTransactions = spending.filter(transaction => accountIds.includes(transaction.accountId) && (point.key.length === 7 ? transaction.transactionDate.startsWith(point.key) : transaction.transactionDate === point.key)).sort((first, second) => second.transactionDate.localeCompare(first.transactionDate))
    setSelectedFlowPoint({ point, transactions: pointTransactions, accountIds })
  }
  useEffect(() => {
    if (!expandedFlowKey) return
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpandedFlowKey(null) }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [expandedFlowKey])
  useEffect(() => {
    if (!selectedFlowPoint) return
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedFlowPoint(null) }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedFlowPoint])
  const totalSpending = spending.reduce((sum, transaction) => sum + spendingAmount(transaction), 0)
  const averageTransaction = spending.length ? totalSpending / spending.length : 0
  const cardSpendingAmounts = cardsWithData.map(account => spending.filter(transaction => transaction.accountId === account.id).reduce((sum, transaction) => sum + spendingAmount(transaction), 0))
  const largestCardSpending = Math.max(...cardSpendingAmounts, 0)
  return <div className="spending-view"><header className="spending-view-header"><div><h1>Spending</h1><p className="subhead">Follow how each card is carrying your spending this year.</p></div></header>{cardsWithData.length ? <><section className="spending-summary"><div className="spending-summary-kpis"><div><small>Total spending</small><strong className="amount-positive">{money.format(totalSpending)}</strong></div><div><small>Transactions</small><strong>{spending.length}</strong></div><div><small>Average transaction</small><strong className="amount-positive">{money.format(averageTransaction)}</strong></div><div><small>Cards used</small><strong>{cardsWithData.length}</strong></div></div><div className="spending-card-usage"><div className="spending-card-usage-heading"><span>Card usage</span><small>{cardsWithData.length} card{cardsWithData.length === 1 ? '' : 's'} in view</small></div><div className="spending-card-usage-list">{cardsWithData.map(account => { const accountTransactions = spending.filter(transaction => transaction.accountId === account.id); const amount = accountTransactions.reduce((sum, transaction) => sum + spendingAmount(transaction), 0); const logo = cardLogoFor(account.institution); return <div className="spending-card-usage-item" key={account.id}>{logo && <img src={logo} alt=""/>}<span><strong>{account.institution}</strong><small>{accountTransactions.length} transaction{accountTransactions.length === 1 ? '' : 's'}</small></span><b className="amount-positive">{money.format(amount)}</b><i><span style={{ width: `${largestCardSpending ? amount / largestCardSpending * 100 : 0}%`, background: account.color }}/></i></div>})}</div></div></section><SpendingFlowChart title="All cards" accountList={cardsWithData} data={flowDataFor(cardsWithData, rangeFor('all'))} transactions={spending} range={rangeFor('all')} onRangeChange={range => updateRange('all', range)} onPointClick={point => openFlowPoint(point, cardsWithData.map(account => account.id))} onExpand={() => setExpandedFlowKey('all')} combined/><div className="spending-flow-grid">{cardsWithData.map(account => { const range = rangeFor(account.id); return <SpendingFlowChart key={account.id} title={account.displayName} accountList={[account]} data={flowDataFor([account], range)} transactions={spending.filter(transaction => transaction.accountId === account.id)} range={range} onRangeChange={nextRange => updateRange(account.id, nextRange)} onPointClick={point => openFlowPoint(point, [account.id])} onExpand={() => setExpandedFlowKey(account.id)}/> })}</div>{expandedFlowKey && expandedAccounts.length > 0 && <div className="spending-flow-modal-backdrop" role="presentation" onMouseDown={() => setExpandedFlowKey(null)}><section className="spending-flow-modal" role="dialog" aria-modal="true" aria-label={`${expandedTitle} spending chart`} onMouseDown={event => event.stopPropagation()}><button className="spending-flow-modal-close" type="button" aria-label="Close expanded chart" onClick={() => setExpandedFlowKey(null)}><X size={18}/></button><SpendingFlowChart title={expandedTitle} accountList={expandedAccounts} data={flowDataFor(expandedAccounts, expandedRange)} transactions={spending.filter(transaction => expandedAccounts.some(account => account.id === transaction.accountId))} range={expandedRange} onRangeChange={range => updateRange(expandedFlowKey, range)} onPointClick={point => openFlowPoint(point, expandedAccounts.map(account => account.id))} expanded combined={expandedFlowKey === 'all'}/></section></div>}{selectedFlowPoint && <ChartPointDrawer point={selectedFlowPoint.point} transactions={selectedFlowPoint.transactions} accountIds={selectedFlowPoint.accountIds} onClose={() => setSelectedFlowPoint(null)}/>}</> : <section className="empty-dashboard"><span className="upload-orb"><TrendingUp size={24}/></span><h2>Your card flows will appear here.</h2><p>Import statements with dated spending transactions to see year-to-date activity by card.</p></section>}</div>
}

type CategoryCardAmount = { amount: number; count: number }
type CategoryAnalyticsRow = { key: string; label: string; color: string; total: number; count: number; byCard: Record<string, CategoryCardAmount> }

function rgbaColor(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3 ? normalized.split('').map(part => part + part).join('') : normalized
  const red = Number.parseInt(value.slice(0, 2), 16) || 100
  const green = Number.parseInt(value.slice(2, 4), 16) || 100
  const blue = Number.parseInt(value.slice(4, 6), 16) || 100
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

type CategoriesViewProps = {
  transactions: Transaction[]
  availableAccounts: SpendingFlowAccount[]
  dates: string[]
  months: string[]
  mode: string
  start: string
  end: string
  openRequest: number
  onDateChange: (mode: string, start?: string, end?: string) => void
  onImport: () => void
}

function CategoriesView({ transactions, availableAccounts, dates, months, mode, start, end, openRequest, onDateChange, onImport }: CategoriesViewProps) {
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [selectedCategoryPoint, setSelectedCategoryPoint] = useState<{ point: SpendingChartPoint; transactions: Transaction[]; accountIds: string[]; description: string } | null>(null)
  const spending = useMemo(() => transactions.filter(isSpending), [transactions])
  const categoryKeyForTransaction = (transaction: Transaction) => {
    const sourceLabel = sourceCategoryGroup(transaction.sourceCategory)
    const useSourceLabel = transaction.categoryId === 'other' && Boolean(sourceLabel) && sourceLabel!.toLocaleLowerCase() !== 'other'
    return useSourceLabel ? `source:${sourceCategoryKey(sourceLabel)}` : (transaction.categoryId || 'other')
  }
  const categoryRows = useMemo<CategoryAnalyticsRow[]>(() => {
    const grouped = new Map<string, CategoryAnalyticsRow>()
    for (const transaction of spending) {
      const category = categories.find(candidate => candidate.id === transaction.categoryId)
      // Some providers (notably Apple Card) put the useful category in the
      // source column as values such as Debit or Installment. The normalizer
      // quite deliberately maps unknown labels to the safe `Other` bucket,
      // but the categories page should not erase that provider information.
      // Keep the existing normalized category for known groups and split only
      // rows that would otherwise collapse into Other.
      const sourceLabel = sourceCategoryGroup(transaction.sourceCategory)
      const useSourceLabel = transaction.categoryId === 'other' && Boolean(sourceLabel) && sourceLabel!.toLocaleLowerCase() !== 'other'
      const key = categoryKeyForTransaction(transaction)
      const label = useSourceLabel ? sourceLabel! : (category?.name ?? 'Other')
      const current = grouped.get(key) ?? { key, label, color: category?.color ?? '#9a98a5', total: 0, count: 0, byCard: {} }
      const amount = spendingAmount(transaction)
      current.total += amount
      current.count += 1
      current.byCard[transaction.accountId] = current.byCard[transaction.accountId] ?? { amount: 0, count: 0 }
      current.byCard[transaction.accountId].amount += amount
      current.byCard[transaction.accountId].count += 1
      grouped.set(key, current)
    }
    return Array.from(grouped.values()).filter(row => row.total > 0).sort((first, second) => second.total - first.total)
  }, [spending])
  // Payment and credit rows remain excluded from spending totals, but they are
  // still real source categories. Keep their labels visible in each card so a
  // user can understand the complete Apple/Discover/etc. statement taxonomy
  // without accidentally counting those rows as spending.
  const excludedSourceCategoriesByCard = useMemo(() => {
    const grouped: Record<string, Map<string, number>> = {}
    for (const transaction of transactions) {
      if (isSpending(transaction)) continue
      const label = sourceCategoryGroup(transaction.sourceCategory)
      if (!label) continue
      const account = grouped[transaction.accountId] ?? new Map<string, number>()
      account.set(label, (account.get(label) ?? 0) + 1)
      grouped[transaction.accountId] = account
    }
    return grouped
  }, [transactions])
  const viewAccounts = useMemo(() => availableAccounts.filter(account => spending.some(transaction => transaction.accountId === account.id)), [availableAccounts, spending])
  const totalSpending = categoryRows.reduce((sum, row) => sum + row.total, 0)
  const largestCategory = categoryRows[0]?.total ?? 0
  const selectedCategory = categoryRows.find(row => row.key === selectedCategoryKey)
  const cardTotals = useMemo(() => Object.fromEntries(viewAccounts.map(account => [account.id, spending.filter(transaction => transaction.accountId === account.id).reduce((sum, transaction) => sum + spendingAmount(transaction), 0)])), [spending, viewAccounts])
  const openCategoryDetails = (row: CategoryAnalyticsRow, accountIds: string[]) => {
    const matchingTransactions = spending.filter(transaction => accountIds.includes(transaction.accountId) && categoryKeyForTransaction(transaction) === row.key).sort((first, second) => second.transactionDate.localeCompare(first.transactionDate))
    const byAccount = Object.fromEntries(accountIds.map(accountId => [accountId, matchingTransactions.filter(transaction => transaction.accountId === accountId).reduce((sum, transaction) => sum + spendingAmount(transaction), 0)]))
    const accountLabel = accountIds.length === 1 ? accounts.find(account => account.id === accountIds[0])?.institution : 'All cards'
    setSelectedCategoryPoint({ point: { key: `category:${row.key}`, label: accountLabel ? `${accountLabel} · ${row.label}` : row.label, amount: matchingTransactions.reduce((sum, transaction) => sum + spendingAmount(transaction), 0), byAccount }, transactions: matchingTransactions, accountIds, description: `${matchingTransactions.length} spending transaction${matchingTransactions.length === 1 ? '' : 's'} in this category.` })
  }

  return <div className="categories-view">
    <header className="categories-view-header"><div><h1>Categories</h1><p className="subhead">See where your spending is going across your cards.</p></div><div className="header-actions">{dates.length > 0 && <DateRangePicker dates={dates} months={months} mode={mode} start={start} end={end} openRequest={openRequest} onChange={onDateChange}/>}<button className="import-button" onClick={onImport}><Upload size={17}/>Import statements</button></div></header>
    {!spending.length ? <section className="empty-dashboard categories-empty"><span className="upload-orb"><Tag size={24}/></span><h2>No category data yet.</h2><p>Import a statement to see where your spending is going.</p><button className="import-button" onClick={onImport}>Import statements</button></section> : <>
      <section className="categories-heatmap-card"><div className="categories-section-header"><div><h2>Category by card</h2><p>See which card drives each category.</p></div></div><div className="categories-heatmap-scroll"><table className="categories-heatmap"><thead><tr><th>Category</th>{viewAccounts.map(account => <th key={account.id} title={account.displayName}><span className="categories-heatmap-card-name">{cardLogoFor(account.institution) && <img src={cardLogoFor(account.institution)} alt=""/>}{account.institution}</span></th>)}</tr></thead><tbody>{categoryRows.map(row => <tr key={row.key}><th scope="row">{row.label}</th>{viewAccounts.map(account => { const cell = row.byCard[account.id]; const amount = cell?.amount ?? 0; const intensity = cardTotals[account.id] ? .08 + Math.min(.38, amount / cardTotals[account.id] * .38) : 0; return <td key={account.id}><button className={`categories-heatmap-cell ${amount ? '' : 'empty'}`} style={amount ? { background: rgbaColor(account.color, intensity) } : undefined} onClick={() => { setSelectedCategoryKey(row.key); setSelectedCardId(account.id); if (amount) openCategoryDetails(row, [account.id]) }} title={`${account.institution} · ${row.label}: ${money.format(amount)}${cell ? ` · ${cell.count} transactions` : ''}`} aria-label={`${account.institution}, ${row.label}, ${amount ? money.format(amount) : 'no spending'}`}>{amount ? money.format(amount) : '—'}</button></td>})}</tr>)}</tbody></table></div></section>
      <div className="categories-card-grid">{viewAccounts.map(account => { const rows = categoryRows.filter(row => (row.byCard[account.id]?.amount ?? 0) > 0).sort((first, second) => (second.byCard[account.id]?.amount ?? 0) - (first.byCard[account.id]?.amount ?? 0)); const excluded = Array.from(excludedSourceCategoriesByCard[account.id]?.entries() ?? []).sort(([first], [second]) => first.localeCompare(second)); const total = cardTotals[account.id] ?? 0; const max = rows[0]?.byCard[account.id]?.amount ?? 0; const logo = cardLogoFor(account.institution); return <section className={`category-card-breakdown ${selectedCardId === account.id ? 'selected' : ''}`} key={account.id}><header><div className="category-card-identity"><span className="category-card-logo" style={{ background: logo ? '#fff' : account.color }}>{logo ? <img src={logo} alt={`${account.institution} logo`}/> : account.institution.slice(0, 1)}</span><div><h3>{account.displayName}</h3><small>{account.institution} · •••• {account.lastFour}</small></div></div><strong>{money.format(total)}</strong></header><p className="category-card-subtitle">Category breakdown</p><div className="category-card-list">{rows.map(row => { const amount = row.byCard[account.id].amount; return <button key={row.key} className="category-card-row" onClick={() => { setSelectedCategoryKey(row.key); setSelectedCardId(account.id); openCategoryDetails(row, [account.id]) }} title={`${row.label}: ${money.format(amount)} · ${row.byCard[account.id].count} transactions`}><span>{row.label}</span><b>{money.format(amount)}</b><i><span style={{ width: `${max ? Math.max(4, amount / max * 100) : 0}%`, background: row.color }}/></i></button>})}{excluded.map(([label, count]) => <div className="category-card-row category-card-row-muted" key={`excluded-${label}`} title={`${label}: ${count} non-spending transaction${count === 1 ? '' : 's'} excluded from spending totals`}><span>{label}</span><b>Excluded</b><small>{count} non-spending transaction{count === 1 ? '' : 's'}</small></div>)}</div></section>})}</div>
      {selectedCategory && <section className="categories-selection"><div><p className="eyebrow">SELECTED CATEGORY</p><h3>{selectedCategory.label}</h3><p>{selectedCategory.count} transactions · {Math.round(selectedCategory.total / totalSpending * 100)}% of spending</p></div><strong>{money.format(selectedCategory.total)}</strong><div className="categories-selection-cards">{viewAccounts.filter(account => (selectedCategory.byCard[account.id]?.amount ?? 0) > 0).map(account => <span key={account.id}><i style={{ background: account.color }}/>{account.institution}<strong>{money.format(selectedCategory.byCard[account.id].amount)}</strong></span>)}</div></section>}
      <section className="categories-primary-card">
        <div className="categories-section-header"><div><p className="eyebrow">OVERVIEW</p><h2>Category spending</h2><p>Across all cards in the selected range.</p></div><strong>{money.format(totalSpending)}</strong></div>
        <div className="categories-bar-list" role="list">{categoryRows.map(row => <button key={row.key} className={`categories-bar-row ${selectedCategoryKey === row.key ? 'selected' : ''}`} onClick={() => { setSelectedCategoryKey(current => current === row.key ? null : row.key); setSelectedCardId(null); openCategoryDetails(row, viewAccounts.map(account => account.id)) }} aria-pressed={selectedCategoryKey === row.key} title={`${row.label}: ${money.format(row.total)} across ${row.count} transactions`}><div className="categories-bar-label"><span>{row.label}</span><strong>{money.format(row.total)}</strong></div><div className="categories-bar-track"><div className="categories-bar-stack" style={{ width: `${largestCategory ? Math.max(2, row.total / largestCategory * 100) : 0}%` }}>{viewAccounts.map(account => { const amount = row.byCard[account.id]?.amount ?? 0; return amount > 0 ? <span key={account.id} style={{ width: `${amount / row.total * 100}%`, background: account.color }} aria-label={`${account.institution}: ${money.format(amount)}`}/> : null })}</div></div><small>{Math.round(row.total / totalSpending * 100)}% · {row.count} transactions</small></button>)}</div>
        <div className="categories-card-legend">{viewAccounts.map(account => <span key={account.id}><i style={{ background: account.color }}/>{account.institution}</span>)}</div>
      </section>
    </>}
    {selectedCategoryPoint && <ChartPointDrawer point={selectedCategoryPoint.point} transactions={selectedCategoryPoint.transactions} accountIds={selectedCategoryPoint.accountIds} description={selectedCategoryPoint.description} onClose={() => setSelectedCategoryPoint(null)}/>} 
  </div>
}

function ChartPointDrawer({ point, transactions, accountIds, onClose, description }: { point: SpendingChartPoint; transactions: Transaction[]; accountIds: string[]; onClose: () => void; description?: string }) {
  const groups = accountIds.map(accountId => ({
    accountId,
    account: accounts.find(account => account.id === accountId),
    transactions: transactions.filter(transaction => transaction.accountId === accountId),
  })).filter(group => group.transactions.length)
  const total = transactions.reduce((sum, transaction) => sum + spendingAmount(transaction), 0)
  const average = transactions.length ? total / transactions.length : 0
  const cardRows = groups.map(group => ({ id: group.accountId, account: group.account, amount: group.transactions.reduce((sum, transaction) => sum + spendingAmount(transaction), 0), count: group.transactions.length, transactions: group.transactions })).sort((first, second) => second.amount - first.amount)
  const primary = cardRows[0]
  return <div className="chart-point-drawer-backdrop" role="presentation" onMouseDown={onClose}>
    <aside className="chart-point-drawer" role="dialog" aria-modal="true" aria-labelledby="chart-point-drawer-title" onMouseDown={event => event.stopPropagation()}>
      <header className="chart-point-drawer-header"><div><p className="eyebrow">SPENDING DETAILS</p><h2 id="chart-point-drawer-title">{point.label}</h2></div><button className="modal-close" aria-label="Close spending details" onClick={onClose}><X size={18}/></button></header>
      <div className="chart-point-drawer-kpis"><div><small>Total spending</small><strong className="amount-positive">{money.format(total)}</strong></div><div><small>Transactions</small><strong>{transactions.length}</strong></div><div><small>Average</small><strong className="amount-positive">{money.format(average)}</strong></div><div><small>Cards used</small><strong>{groups.length}</strong></div></div>
      {cardRows.length > 1 && <section className="merchant-detail-section chart-point-drawer-card-section"><div className="merchant-detail-section-heading"><h3>Card usage</h3><small>{cardRows.length} cards in this period</small></div><div className="merchant-detail-card-usage">{cardRows.map(row => { const logo = row.account ? cardLogoFor(row.account.institution) : undefined; return <button className="merchant-detail-card-row" type="button" key={row.id} onClick={() => document.getElementById(`spending-transactions-${row.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} aria-label={`Show ${row.account?.institution ?? 'Unassigned'} transactions`}><span className="merchant-detail-card-title">{logo && <img src={logo} alt=""/>}<span><strong>{row.account?.institution ?? 'Unassigned'}</strong><small>{row.count} transaction{row.count === 1 ? '' : 's'}</small></span></span><b className={row.amount < 0 ? 'amount-negative' : 'amount-positive'}>{money.format(row.amount)}</b><i><span style={{ width: `${primary?.amount ? Math.max(3, row.amount / primary.amount * 100) : 0}%` }}/></i></button>})}</div></section>}
      <section className="merchant-detail-section chart-point-drawer-transactions-section"><div className="merchant-detail-section-heading"><h3>Transactions</h3><small>{transactions.length} shown</small></div><div className="chart-point-drawer-transaction-groups">{cardRows.map(row => { const logo = row.account ? cardLogoFor(row.account.institution) : undefined; return <section className="chart-point-drawer-transaction-group" id={`spending-transactions-${row.id}`} key={`transactions-${row.id}`}><div className="chart-point-drawer-transaction-group-heading"><div className="merchant-detail-card-title">{logo && <img src={logo} alt=""/>}<span><strong>{row.account?.institution ?? 'Unassigned'}</strong><small>{row.count} transaction{row.count === 1 ? '' : 's'}</small></span></div><b className={row.amount < 0 ? 'amount-negative' : 'amount-positive'}>{money.format(row.amount)}</b></div><div className="merchant-detail-transactions">{row.transactions.slice().sort((first, second) => second.transactionDate.localeCompare(first.transactionDate)).map(transaction => { const category = categories.find(candidate => candidate.id === transaction.categoryId); return <div className="merchant-detail-transaction" key={transaction.id}><div><strong>{transaction.merchantNormalized || transaction.description}</strong><small>{transaction.transactionDate || 'Date unavailable'} · {transaction.sourceCategory || category?.name || 'Uncategorized'}</small></div><b className={spendingAmount(transaction) < 0 ? 'amount-negative' : 'amount-positive'}>{money.format(spendingAmount(transaction))}</b></div>})}</div></section>})}</div></section>
    </aside>
  </div>
}

export default function App() {
  const [query, setQuery] = useState('')
  const [transactionDateDescending, setTransactionDateDescending] = useState(true)
  const [weekdayFilter, setWeekdayFilter] = useState<number | null>(null)
  const [category, setCategory] = useState('all')
  const [account, setAccount] = useState('all')
  const [period, setPeriod] = useState('YTD')
  const [datePickerOpenRequest, setDatePickerOpenRequest] = useState(0)
  const [chartTooltipVisible, setChartTooltipVisible] = useState(false)
  const [selectedChartPoint, setSelectedChartPoint] = useState<SpendingChartPoint | null>(null)
  const chartWrapRef = useRef<HTMLDivElement>(null)
  const [showCategoriesModal, setShowCategoriesModal] = useState(false)
  const [showManageModal, setShowManageModal] = useState(false)
  const [pendingDeletedAccounts, setPendingDeletedAccounts] = useState<string[]>([])
  const [activeNav, setActiveNav] = useState('Overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [hideNumbers, setHideNumbers] = useState(areNumbersHidden)
  const [view, setView] = useState<'dashboard' | 'import'>('dashboard')
  const [userName, setUserName] = useState('')
  const [introSplashVisible, setIntroSplashVisible] = useState(true)
  const [namePromptOpen, setNamePromptOpen] = useState(true)
  const [tourStep, setTourStep] = useState<TourStep>('idle')
  const [showDataBanner, setShowDataBanner] = useState(true)
  const [dateFilter, setDateFilter] = useState('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [openCategoryMenu, setOpenCategoryMenu] = useState(false)
  const [categoryMenuPlacement, setCategoryMenuPlacement] = useState<'up' | 'down'>('down')
  const [sourceChildFilter, setSourceChildFilter] = useState<{ parent: string; child: string } | null>(null)
  const [importedTransactions, setImportedTransactions] = useState<Transaction[]>([])
  const [importedStatements, setImportedStatements] = useState<Statement[]>([])
  // The dashboard is a single-page shell, so browser scroll position would
  // otherwise survive navigation between Overview, Categories, and the other
  // views. Returning to Categories halfway down the previous document makes
  // its header look clipped even though the render itself is valid.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    setSelectedChartPoint(null)
  }, [activeNav, view])
  useEffect(() => {
    const timer = window.setTimeout(() => setIntroSplashVisible(false), 5300)
    return () => window.clearTimeout(timer)
  }, [])
  useEffect(() => {
    if (!selectedChartPoint) return
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedChartPoint(null) }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedChartPoint])
  // Re-apply the current categorization rules to transactions already held in
  // the browser. Imports are kept in state as a snapshot, so a rule update
  // (for example, recognizing WALMART.COM or TARGET STORE as groceries) would
  // otherwise leave an existing session showing the old category forever.
  const dataset = useMemo(() => importedTransactions.map(transaction => {
    const merchant = normalizeMerchant(transaction.merchantRaw || transaction.description)
    const resolved = categorize(merchant.name, categories, transaction.sourceCategory)
    return {
      ...transaction,
      merchantNormalized: merchant.name,
      categoryId: resolved.categoryId,
      subcategory: resolved.subcategory,
    }
  }), [importedTransactions])
  const availableMonths = useMemo(() => Array.from(new Set(dataset.map(transaction => transaction.transactionDate.slice(0, 7)).filter(month => /^\d{4}-\d{2}$/.test(month)))).sort(), [dataset])
  const availableDates = useMemo(() => Array.from(new Set(dataset.map(transaction => transaction.transactionDate).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)))).sort(), [dataset])
  const dateDataset = useMemo(() => {
    if (dateFilter === 'all') return dataset
    if (dateFilter === 'custom') return dataset.filter(transaction => (!customStart || transaction.transactionDate >= customStart) && (!customEnd || transaction.transactionDate <= customEnd))
    return dataset.filter(transaction => transaction.transactionDate.startsWith(dateFilter))
  }, [dataset, dateFilter, customStart, customEnd])
  const activeAccountIds = new Set(dataset.map(t => t.accountId).filter(id => id !== 'unassigned'))
  const availableAccounts = accounts.filter(a => activeAccountIds.has(a.id))
  // Account selection scopes every downstream view, including the category
  // options. This prevents categories from another card appearing in the
  // dropdown after a user selects a specific account.
  const accountDataset = useMemo(() => account === 'all' ? dateDataset : dateDataset.filter(t => t.accountId === account), [dateDataset, account])
  const hasPaidTransactions = accountDataset.some(isPaid)
  const spendingTransactions = useMemo(() => accountDataset.filter(isSpending), [accountDataset])
  const selectedCategoryScope = category.match(/^account:([^|]+)\|(.*)$/)
  const selectedCategoryBase = selectedCategoryScope?.[2] ?? category
  const selectedSourceCategoryKey = selectedCategoryBase.startsWith('source:') ? selectedCategoryBase.slice('source:'.length) : undefined
  const categoryMatchesWithoutChild = (transaction: Transaction, selected: string) => {
    const scoped = selected.match(/^account:([^|]+)\|(.*)$/)
    if (scoped) {
      if (transaction.accountId !== scoped[1]) return false
      selected = scoped[2]
    }
    if (selected === 'all') return true
    if (selected === 'self:amazon') return /amazon/i.test(`${transaction.merchantNormalized} ${transaction.description}`) && isSpending(transaction)
    if (selected === 'self:groceries') return transaction.categoryId === 'groceries'
    if (selected === 'self:gas') return isGasSourceCategory(transaction.sourceCategory) || /gas|gasoline|fuel/i.test(transaction.subcategory ?? '')
    if (selected === 'paid') return isPaid(transaction)
    if (selected === 'transactions') return !isPaid(transaction)
    if (isGasSourceCategory(transaction.sourceCategory)) return selected === normalizedGasCategoryKey
    // Preserve a provider's own grocery subcategory (for example Amex's
    // "Merchandise & Supplies - Groceries"). Only suppress the source parent
    // when our merchant rule created a grocery classification from a source
    // label that was not itself grocery-related (for example WALMART in
    // Shopping).
    const sourceIsGrocery = /grocery|supermarket/i.test(transaction.sourceCategory ?? '')
    const source = transaction.categoryId === 'groceries' && !sourceIsGrocery ? undefined : transaction.sourceCategory
    const sourceKey = sourceCategoryKey(source)
    return selected === (sourceKey ? `source:${sourceKey}` : `category:${transaction.categoryId}`)
  }
  // The subcategory menu is derived from the same rows the transaction table
  // can currently show (account/date/category/search/weekday scope). It is
  // intentionally built without the already-selected child filter so sibling
  // options remain available when the user opens the menu again.
  const visibleSourceCategoryRows = useMemo(() => accountDataset
    .filter(transaction => categoryMatchesWithoutChild(transaction, category))
    .filter(transaction => weekdayFilter === null || (transaction.transactionDate && new Date(`${transaction.transactionDate}T12:00:00`).getDay() === weekdayFilter))
    .filter(transaction => `${transaction.merchantNormalized} ${transaction.description}`.toLowerCase().includes(query.toLowerCase())), [accountDataset, category, query, weekdayFilter])
  const sourceCategoryChildren = useMemo(() => buildSourceCategoryGroups(visibleSourceCategoryRows), [visibleSourceCategoryRows])
  const activeSourceCategoryGroup = selectedSourceCategoryKey ? sourceCategoryChildren.find(group => group.key === selectedSourceCategoryKey) : undefined
  const showSourceSubcategoryMenu = Boolean(activeSourceCategoryGroup && activeSourceCategoryGroup.children.length > 1)
  useEffect(() => {
    if (!sourceChildFilter) return
    const group = sourceCategoryChildren.find(candidate => candidate.key === sourceChildFilter.parent)
    if (!group || !group.children.some(child => child.key === sourceChildFilter.child)) setSourceChildFilter(null)
  }, [sourceCategoryChildren, sourceChildFilter])
  const categoryOptionFor = (t: Transaction) => {
    const fallback = categories.find(c => c.id === t.categoryId)
    if (isGasSourceCategory(t.sourceCategory)) {
      const value = normalizedGasCategoryKey
      const transport = categories.find(c => c.id === 'transport')
      return { value, label: 'Gas', color: transport?.color ?? fallback?.color ?? '#5a9fc5' }
    }
    // Explicit grocery overrides are normalized into Ledgerly's Groceries
    // bucket even when the source file called them Shopping/Merchandise.
    const sourceIsGrocery = /grocery|supermarket/i.test(t.sourceCategory ?? '')
    const overridden = t.categoryId === 'groceries' && !sourceIsGrocery
    const source = overridden ? undefined : sourceCategoryGroup(t.sourceCategory)
    const sourceKey = sourceCategoryKey(source)
    const value = sourceKey ? `source:${sourceKey}` : `category:${t.categoryId}`
    return { value, label: source ?? fallback?.name ?? 'Other', color: fallback?.color ?? '#9a98a5' }
  }
  const categoryOptions = Array.from(new Map(accountDataset.map(t => {
    const option = categoryOptionFor(t)
    return [option.value, option]
  })).values())
  const cardCategoryDropdownOptions = availableAccounts.flatMap(card => {
    const options = Array.from(new Map(accountDataset.filter(t => t.accountId === card.id).map(t => {
      const option = categoryOptionFor(t)
      return [option.value, option]
    })).values())
    return options.map(option => ({ ...option, value: `account:${card.id}|${option.value}`, group: card.institution }))
  })
  const categoryDropdownOptions = [
    { value: 'all', label: 'All Categories', group: 'CREDIT CARD FILTERS' },
    { value: 'self:amazon', label: 'Amazon', group: 'SELF-MADE FILTERS' },
    { value: 'self:groceries', label: 'Groceries', group: 'SELF-MADE FILTERS' },
    { value: 'self:gas', label: 'Gas', group: 'SELF-MADE FILTERS' },
    { value: 'paid', label: 'Paid', group: 'SELF-MADE FILTERS' },
    ...cardCategoryDropdownOptions,
  ]
  const categoryMatches = (transaction: Transaction, selected: string) => {
    if (sourceChildFilter) {
      const parent = sourceCategoryKey(transaction.sourceCategory)
      const rawChild = sourceCategoryChild(transaction.sourceCategory)
      const child = rawChild?.toLocaleLowerCase().replace(/\s+/g, ' ')
      const childMatches = sourceChildFilter.child === sourceCategoryStandaloneKey ? !rawChild : child === sourceChildFilter.child
      if (parent !== sourceChildFilter.parent || !childMatches) return false
    }
    return categoryMatchesWithoutChild(transaction, selected)
  }
  const selectCategory = (value: string) => { setCategory(value); setSourceChildFilter(null); setOpenCategoryMenu(false) }
  const selectAccount = (value: string) => { setAccount(current => current === value && value !== 'all' ? 'all' : value); setSourceChildFilter(null); setOpenCategoryMenu(false) }
  useEffect(() => { if (!['all', 'paid', 'self:amazon', 'self:groceries', 'self:gas'].includes(category) && !categoryOptions.some(option => option.value === category) && !categoryDropdownOptions.some(option => option.value === category)) setCategory('all'); if (category === 'paid' && !hasPaidTransactions) setCategory('all'); if (category === 'transactions') setCategory('all'); if (account !== 'all' && !availableAccounts.some(a => a.id === account)) setAccount('all') }, [category, account, categoryOptions, categoryDropdownOptions, availableAccounts, hasPaidTransactions])
  useEffect(() => { if (dateFilter !== 'all' && dateFilter !== 'custom' && !availableMonths.includes(dateFilter)) setDateFilter('all'); if (dateFilter === 'custom' && !availableDates.length) setDateFilter('all') }, [dateFilter, availableMonths, availableDates])
  useEffect(() => {
    if (!showCategoriesModal && !showManageModal) return
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setShowCategoriesModal(false); setShowManageModal(false) } }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showCategoriesModal, showManageModal])
  const allSpendingTransactions = dateDataset.filter(isSpending)
  const chartSourceTransactions = useMemo(() => spendingTransactions.filter(transaction => /^\d{4}-\d{2}-\d{2}$/.test(transaction.transactionDate)), [spendingTransactions])
  const chartRange = useMemo(() => {
    if (!chartSourceTransactions.length) return null
    const latest = chartSourceTransactions.reduce((value, transaction) => transaction.transactionDate > value ? transaction.transactionDate : value, chartSourceTransactions[0].transactionDate)
    if (period === 'Custom') return customStart && customEnd ? { start: customStart, end: customEnd } : null
    const start = period === '7D' ? shiftDate(latest, -6) : period === '30D' ? shiftDate(latest, -29) : period === '3M' ? shiftMonth(latest.slice(0, 7), -2) + latest.slice(7) : period === '6M' ? shiftMonth(latest.slice(0, 7), -5) + latest.slice(7) : `${latest.slice(0, 4)}-01-01`
    return { start, end: latest }
  }, [chartSourceTransactions, customStart, customEnd, period])
  const chartTransactions = useMemo(() => chartRange ? chartSourceTransactions.filter(transaction => transaction.transactionDate >= chartRange.start && transaction.transactionDate <= chartRange.end) : [], [chartRange, chartSourceTransactions])
  useEffect(() => { setSelectedChartPoint(null) }, [period, dateFilter, customStart, customEnd])
  const chartUsesDailyPoints = useMemo(() => {
    if (!chartRange) return false
    const start = parseISODate(chartRange.start).getTime()
    const end = parseISODate(chartRange.end).getTime()
    const days = Math.round((end - start) / 86400000) + 1
    return period === '7D' || period === '30D' || (period === 'Custom' && days <= 45)
  }, [chartRange, period])
  const selectedChartTransactions = useMemo(() => {
    if (!selectedChartPoint) return []
    return chartTransactions.filter(transaction => chartUsesDailyPoints ? transaction.transactionDate === selectedChartPoint.key : transaction.transactionDate.startsWith(selectedChartPoint.key)).sort((first, second) => second.transactionDate.localeCompare(first.transactionDate))
  }, [chartTransactions, chartUsesDailyPoints, selectedChartPoint])
  const chartAccountIds = useMemo(() => Array.from(new Set(chartSourceTransactions.map(transaction => transaction.accountId))), [chartSourceTransactions])
  const chartData = useMemo<SpendingChartPoint[]>(() => {
    if (!chartRange) return []
    const totals = new Map<string, { amount: number; byAccount: Record<string, number> }>()
    const addTransaction = (key: string, transaction: Transaction) => {
      const current = totals.get(key) ?? { amount: 0, byAccount: {} }
      const amount = spendingAmount(transaction)
      current.amount += amount
      current.byAccount[transaction.accountId] = (current.byAccount[transaction.accountId] ?? 0) + amount
      totals.set(key, current)
    }
    if (chartUsesDailyPoints) {
      for (let date = chartRange.start; date <= chartRange.end; date = shiftDate(date, 1)) totals.set(date, { amount: 0, byAccount: {} })
      chartTransactions.forEach(transaction => addTransaction(transaction.transactionDate, transaction))
      return Array.from(totals, ([key, value]) => ({ key, label: parseISODate(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), ...value }))
    }
    for (let month = monthKeyFromDate(chartRange.start); month <= monthKeyFromDate(chartRange.end); month = shiftMonth(month, 1)) totals.set(month, { amount: 0, byAccount: {} })
    chartTransactions.forEach(transaction => addTransaction(monthKeyFromDate(transaction.transactionDate), transaction))
    return Array.from(totals, ([key, value]) => ({ key, label: parseISODate(`${key}-01`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), ...value }))
  }, [chartRange, chartTransactions, chartUsesDailyPoints])
  const chartTotal = useMemo(() => chartTransactions.reduce((sum, transaction) => sum + spendingAmount(transaction), 0), [chartTransactions])
  const filtered = useMemo(() => accountDataset
    .filter(t => categoryMatches(t, category) && (weekdayFilter === null || (t.transactionDate && new Date(`${t.transactionDate}T12:00:00`).getDay() === weekdayFilter)) && `${t.merchantNormalized} ${t.description}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      const compareDates = (first: string | null | undefined, second: string | null | undefined) => {
        if (!first && !second) return 0
        if (!first) return 1
        if (!second) return -1
        return transactionDateDescending ? second.localeCompare(first) : first.localeCompare(second)
      }
      const dateOrder = compareDates(a.transactionDate, b.transactionDate)
      if (dateOrder) return dateOrder
      return compareDates(a.postedDate, b.postedDate)
    }), [accountDataset, query, category, categoryOptions, weekdayFilter, sourceChildFilter, transactionDateDescending])
  // The default all-transactions view and the self-made transactions-only
  // view are spending summaries. Specific category filters remain ledger
  // views and preserve source signs so credits, payments, and adjustments
  // subtract naturally within that category.
  const visibleTransactionTotal = useMemo(() => filtered.reduce((sum, transaction) => sum + (category === 'all' || category === 'transactions' ? spendingAmount(transaction) : transaction.amount), 0), [filtered, category])
  const categoryTotals = categoryOptions.map(option => ({ ...option, amount: spendingTransactions.filter(t => categoryMatches(t, option.value)).reduce((a, t) => a + spendingAmount(t), 0) })).filter(c => c.amount).sort((a,b) => b.amount-a.amount)
  const monthlyAnalyticsMonth = /^\d{4}-\d{2}$/.test(dateFilter) ? dateFilter : dateFilter === 'custom' && isCompleteCalendarMonth(customStart, customEnd) ? customStart.slice(0, 7) : undefined
  const monthlyAnalyticsLabel = monthlyAnalyticsMonth ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(`${monthlyAnalyticsMonth}-01T12:00:00`)) : ''
  // Keep the card breakdown stable while the selected account scopes the
  // rest of the dashboard. This lets users switch accounts without losing
  // the other cards from view.
  const cards = availableAccounts.map(a => ({ ...a, amount: allSpendingTransactions.filter(t => t.accountId === a.id).reduce((sum, t) => sum + spendingAmount(t), 0) })).sort((a,b) => b.amount-a.amount)
  const total = categoryTotals.reduce((sum, c) => sum + c.amount, 0)
  const finishImport = (review: ReviewTransaction[], statements: Statement[]) => { setImportedTransactions(current => [...current, ...review.map(r => r.transaction)]); setImportedStatements(current => [...current, ...statements]); setDateFilter('all'); setCustomStart(''); setCustomEnd(''); setShowDataBanner(true) }
  // The tour is intentionally session-scoped. A refresh starts a fresh visit,
  // so newcomers can see the guidance again while Skip still dismisses it for
  // the current page session.
  const skipImportTour = () => setTourStep('idle')
  const skipDashboardTour = () => setTourStep('idle')
  const beginTourIfNeeded = () => setTourStep('dashboard-import')
  const finishTour = skipImportTour
  const dashboardTourBack = () => {
    const previousStep: Partial<Record<TourStep, TourStep>> = {
      'dashboard-spending-chart': 'dashboard-total-spending',
      'dashboard-weekday': 'dashboard-spending-chart',
      'dashboard-merchants': 'dashboard-weekday',
      'dashboard-categories': 'dashboard-merchants',
      'dashboard-accounts': 'dashboard-categories',
      'dashboard-total': 'dashboard-accounts',
    }
    const previous = previousStep[tourStep]
    if (previous) setTourStep(previous)
  }
  const dashboardTourNext = () => {
    if (tourStep === 'dashboard-import') { setView('import'); setTourStep('import-dropzone'); return }
    const nextStep: Partial<Record<TourStep, TourStep>> = {
      'dashboard-hide-numbers': 'dashboard-total-spending',
      'dashboard-total-spending': 'dashboard-spending-chart',
      'dashboard-spending-chart': 'dashboard-weekday',
      'dashboard-weekday': 'dashboard-merchants',
      'dashboard-merchants': 'dashboard-categories',
      'dashboard-categories': 'dashboard-accounts',
      'dashboard-accounts': 'dashboard-total',
    }
    const next = nextStep[tourStep]
    if (next) setTourStep(next)
    else if (tourStep === 'dashboard-total') skipDashboardTour()
  }
  const deleteAccount = (accountId: string) => {
    const statementIds = new Set(importedTransactions.filter(transaction => transaction.accountId === accountId).map(transaction => transaction.statementId))
    setImportedTransactions(current => current.filter(transaction => transaction.accountId !== accountId))
    setImportedStatements(current => current.filter(statement => statement.accountId !== accountId && !statementIds.has(statement.id)))
    if (account === accountId) setAccount('all')
  }
  const openManageModal = () => { setPendingDeletedAccounts([]); setShowManageModal(true) }
  const stageAccountDelete = (accountId: string) => setPendingDeletedAccounts(current => current.includes(accountId) ? current : [...current, accountId])
  const saveAccountChanges = () => { pendingDeletedAccounts.forEach(deleteAccount); setPendingDeletedAccounts([]); setShowManageModal(false) }
  const selectChartPeriod = (next: string) => {
    setPeriod(next)
    if (next === 'Custom') {
      if (dateFilter !== 'custom') { setDateFilter('custom'); setCustomStart(''); setCustomEnd('') }
      setDatePickerOpenRequest(request => request + 1)
    }
  }
  if (view === 'import') return <><ImportFlow accounts={accounts} categories={categories} importedStatements={importedStatements} tourStep={tourStep} onTourStep={setTourStep} onTourSkip={skipImportTour} onTourFinish={finishTour} onTourBack={() => { setView('dashboard'); setTourStep('dashboard-import') }} onBack={() => setView('dashboard')} onComplete={finishImport}/></>
  return <div className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}><div className="brand"><span className="brand-mark brand-logo"><img src={publicAsset('logo/Logo.png')} alt="Finances logo"/></span><span className="brand-name">Finances</span><button className="sidebar-toggle" type="button" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-pressed={sidebarCollapsed} onClick={() => setSidebarCollapsed(current => !current)}>{sidebarCollapsed ? <PanelLeftOpen size={17}/> : <PanelLeftClose size={17}/>}</button></div><nav>{nav.map(item => <button key={item.label} title={sidebarCollapsed ? item.label : undefined} onClick={() => setActiveNav(item.label)} className={`nav-item ${activeNav === item.label ? 'active' : ''}`}><item.icon size={18}/><span>{item.label}</span></button>)}</nav><div className="sidebar-hide-numbers"><span className="sidebar-hide-numbers-label">Hide numbers</span><button data-tour="hide-numbers" type="button" className={`privacy-toggle ${hideNumbers ? 'on' : ''}`} role="switch" aria-checked={hideNumbers} aria-label={`${hideNumbers ? 'Disable' : 'Enable'} hiding financial amounts`} onClick={() => setHideNumbers(current => { const next = !current; setNumbersHidden(next); return next })}><span/></button></div></aside>
    <main>{activeNav === 'Categories' ? <CategoriesView transactions={accountDataset} availableAccounts={availableAccounts} dates={availableDates} months={availableMonths} mode={dateFilter} start={customStart} end={customEnd} openRequest={datePickerOpenRequest} onDateChange={(mode, start, end) => { setDateFilter(mode); if (mode === 'custom') { setCustomStart(start ?? ''); setCustomEnd(end ?? '') } else { setCustomStart(''); setCustomEnd('') } }} onImport={() => setView('import')}/> : activeNav === 'Spending' ? <SpendingView transactions={dataset} availableAccounts={availableAccounts}/> : activeNav === 'Merchants' ? <MerchantsView transactions={accountDataset.filter(transaction => categoryMatches(transaction, category))} availableAccounts={availableAccounts} dates={availableDates} months={availableMonths} mode={dateFilter} start={customStart} end={customEnd} openRequest={datePickerOpenRequest} onDateChange={(mode, start, end) => { setDateFilter(mode); if (mode === 'custom') { setCustomStart(start ?? ''); setCustomEnd(end ?? '') } else { setCustomStart(''); setCustomEnd('') } }} onImport={() => setView('import')}/> : activeNav === 'Statements' ? <StatementsView statements={importedStatements} transactions={dataset} accounts={accounts} categories={categories} onImport={() => setView('import')}/> : <><header><div><h1>Hello, {userName || 'there'}</h1><p className="subhead">A calm view of where your money is going.</p></div><div className="header-actions">{availableDates.length > 0 && <DateRangePicker dates={availableDates} months={availableMonths} mode={dateFilter} start={customStart} end={customEnd} openRequest={datePickerOpenRequest} onChange={(mode, start, end) => { setDateFilter(mode); if (mode === 'custom') { setCustomStart(start ?? ''); setCustomEnd(end ?? '') } else { setCustomStart(''); setCustomEnd('') } }}/>}<button className="import-button" data-tour="dashboard-import" onClick={() => { setView('import'); if (tourStep === 'dashboard-import') setTourStep('import-dropzone') }}><Upload size={17}/>Import statements</button></div></header>
      {showDataBanner && <div className={`data-banner ${importedStatements.length ? 'imported' : ''}`}><span>{importedStatements.length ? `${importedStatements.length} imported statement${importedStatements.length === 1 ? '' : 's'}` : 'No statements imported yet'}</span><button className="dismiss-banner" aria-label="Dismiss banner" onClick={() => setShowDataBanner(false)}><X size={15}/></button></div>}
      {!dataset.length ? <section className="empty-dashboard"><span className="upload-orb"><Upload size={24}/></span><h2>Your spending story starts here.</h2><p>Import your credit card or bank statements to see everything in one place.</p><button className="import-button" onClick={() => setView('import')}>Import statements</button></section> : <>{monthlyAnalyticsMonth ? <section className="overview-spending-chart overview-month-kpis"><div className="spending-flow-metrics overview-chart-kpis"><div data-tour="overview-total-spending"><small>Total spending</small><AnimatedMoney value={total}/></div><div className="overview-kpi-count"><small>Transactions</small><AnimatedNumber value={accountDataset.length} formatter={formatCount}/></div><div><small>Average transaction</small><AnimatedMoney value={spendingTransactions.length ? total / spendingTransactions.length : 0}/></div><div className="overview-kpi-count"><small>Active cards</small><AnimatedNumber value={new Set(accountDataset.map(t=>t.accountId).filter(id=>id!=='unassigned')).size} formatter={formatCount}/></div></div></section> : <section className="chart-card overview-spending-chart" data-tour="overview-spending-chart"><div className="overview-chart-controls"><div className="segmented">{['7D','30D','3M','6M','YTD','Custom'].map(p => <button key={p} onClick={() => selectChartPeriod(p)} className={period === p ? 'selected' : ''}>{p}</button>)}</div></div><div className="spending-flow-metrics overview-chart-kpis"><div data-tour="overview-total-spending"><small>Total spending</small><AnimatedMoney value={chartTotal}/></div><div className="overview-kpi-count"><small>Transactions</small><AnimatedNumber value={chartTransactions.length} formatter={formatCount}/></div><div><small>Average transaction</small><AnimatedMoney value={chartTransactions.length ? chartTotal / chartTransactions.length : 0}/></div><div className="overview-kpi-count"><small>Active cards</small><AnimatedNumber value={new Set(chartTransactions.map(t=>t.accountId).filter(id=>id!=='unassigned')).size} formatter={formatCount}/></div></div><div className="chart-wrap" ref={chartWrapRef}><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{left: -25,right: 5,top: 10,bottom: 0}} onMouseMove={(state, event) => { const rect = chartWrapRef.current?.getBoundingClientRect(); const pointX = state.activeCoordinate?.x; if (!rect || typeof pointX !== 'number' || !state.isTooltipActive) { setChartTooltipVisible(false); return } setChartTooltipVisible(Math.abs(event.clientX - rect.left - pointX) <= 14) }} onMouseLeave={() => setChartTooltipVisible(false)} onClick={state => { const chartState = state as unknown as { activeTooltipIndex?: number | string; activeLabel?: string }; const index = typeof chartState.activeTooltipIndex === 'number' ? chartState.activeTooltipIndex : Number(chartState.activeTooltipIndex); const point = Number.isInteger(index) && index >= 0 ? chartData[index] : chartData.find(candidate => candidate.label === String(chartState.activeLabel)); if (point) setSelectedChartPoint(point) }}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5763d7" stopOpacity=".2"/><stop offset="100%" stopColor="#5763d7" stopOpacity="0"/></linearGradient></defs><XAxis dataKey="label" interval="preserveStartEnd" axisLine={false} tickLine={false} tick={{fill:'#8e8d9d',fontSize:12}}/><Tooltip active={chartTooltipVisible} cursor={{stroke: '#cfd3fb', strokeWidth: 1, strokeDasharray: '3 4'}} content={<SpendingChartTooltip accountIds={chartAccountIds}/>} isAnimationActive={false}/><Area type="monotone" dataKey="amount" stroke="#5763d7" strokeWidth={2.5} fill="url(#fill)" dot={{r: 3, fill: '#5763d7', stroke: '#fff', strokeWidth: 2}} activeDot={{r: 5, fill: '#5763d7', stroke: '#fff', strokeWidth: 2}}/></AreaChart></ResponsiveContainer></div></section>}
      <div className="grid-two analytics-four-grid"><MonthlySpendingAnalytics panelsOnly month={monthlyAnalyticsMonth ?? ''} monthLabel={monthlyAnalyticsLabel} transactions={accountDataset} onMerchantClick={merchant => { setQuery(merchant); window.requestAnimationFrame(() => document.querySelector('.transactions')?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }} onWeekdayClick={weekday => { setWeekdayFilter(current => current === weekday ? null : weekday); window.requestAnimationFrame(() => document.querySelector('.transactions')?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }}/><section className="panel"><div className="section-head compact"><div><h2 className="dashboard-section-title">Categories</h2></div><button className="text-button" onClick={() => setShowCategoriesModal(true)}>View all</button></div><div className="category-list">{categoryTotals.slice(0,5).map(c => <button key={c.value} onClick={() => selectCategory(c.value)} className="category-row"><span className="category-dot" style={{background:c.color}}/><span className="category-name">{c.label}</span><span className="category-amount">{money.format(c.amount)}</span><span className="category-pct">{Math.round(c.amount/total*100)}%</span></button>)}</div></section><section className="panel"><div className="section-head compact"><div><h2 className="dashboard-section-title">Accounts</h2></div><button className="text-button" onClick={openManageModal}>Manage</button></div><div className="cards-list">{cards.slice(0,4).map(card => { const logo = cardLogoFor(card.institution); return <button key={card.id} className={`card-row ${account === card.id ? 'selected' : ''}`} aria-pressed={account === card.id} onClick={() => selectAccount(card.id)}><span className="mini-card" style={{background:logo ? '#fff' : card.color}}>{logo ? <img src={logo} alt={`${card.institution} logo`}/> : card.institution.slice(0,1)}</span><span><strong>{card.displayName}</strong><small>•••• {card.lastFour}</small></span><b>{money.format(card.amount)}</b></button>})}</div></section></div>
      <section className="transactions panel"><div className="section-head"><div><h2 className="dashboard-section-title">Recent transactions</h2></div><button className="text-button">View all transactions</button></div><div className="transaction-total-row" aria-live="polite"><div className="transaction-total-label"><span className="eyebrow">TOTAL</span><span className="transaction-total-dots" aria-hidden="true">··</span></div><strong className={visibleTransactionTotal < 0 ? 'amount-negative' : 'amount-positive'}>{money.format(visibleTransactionTotal)}</strong></div><div className="filters"><label className="search-field"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search transactions"/></label><FilterDropdown icon={Filter} label="Category" value={category} wide options={categoryDropdownOptions} onChange={selectCategory}/><FilterDropdown icon={CreditCard} label="Account" value={account} options={[{ value: 'all', label: 'All Accounts' }, ...availableAccounts.map(a => ({ value: a.id, label: a.displayName }))]} onChange={selectAccount}/></div><div className="table"><div className="table-head"><span className="transaction-date-header"><span>Date</span><button className="transaction-date-sort" type="button" aria-label={transactionDateDescending ? 'Sort oldest transactions first' : 'Sort newest transactions first'} aria-pressed={!transactionDateDescending} onClick={() => setTransactionDateDescending(current => !current)}><ArrowDownUp size={14}/></button></span><span>Merchant</span><span className="category-header-cell">Category{showSourceSubcategoryMenu && <><button className="category-header-toggle" aria-label="Show category subcategories" aria-expanded={openCategoryMenu} onClick={event => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); const spaceBelow = window.innerHeight - rect.bottom; const spaceAbove = rect.top; setCategoryMenuPlacement(spaceBelow < 280 && spaceAbove > spaceBelow ? 'up' : 'down'); setOpenCategoryMenu(open => !open) }}><ChevronDown size={12}/></button>{openCategoryMenu && activeSourceCategoryGroup && <div className={`category-header-menu ${categoryMenuPlacement}`} onClick={event => event.stopPropagation()}><small className="category-menu-heading">{activeSourceCategoryGroup.parent}</small><button className="category-subcategory-option" onClick={() => { setSourceChildFilter(null); setOpenCategoryMenu(false) }}>All subcategories</button>{activeSourceCategoryGroup.children.map(child => <button className="category-subcategory-option" key={`${activeSourceCategoryGroup.key}-${child.key}`} onClick={() => { setSourceChildFilter({ parent: activeSourceCategoryGroup.key, child: child.key }); setOpenCategoryMenu(false) }}>{child.label}</button>)}</div>}</>}</span><span>Card</span><span>Amount</span></div>{filtered.map(t => { const a=accounts.find(a=>a.id===t.accountId); const c=categories.find(c=>c.id===t.categoryId)!; const sourceIsGrocery = /grocery|supermarket/i.test(t.sourceCategory ?? ''); const displayCategory = t.categoryId === 'groceries' && !sourceIsGrocery ? c.name : (t.sourceCategory ?? c.name); return <div className="table-row" key={t.id}><span>{t.transactionDate ? new Date(`${t.transactionDate}T12:00`).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'Needs review'}</span><strong>{t.merchantNormalized}<small>{t.description}</small></strong><span><i style={{background:c.color}}/> {displayCategory}</span><span>{a?.displayName ?? 'Unassigned'}<small>{a ? `•••• ${a.lastFour}` : 'Needs review'}</small></span><b className={t.amount < 0 ? 'amount-negative' : 'amount-positive'}>{money.format(t.amount)}</b></div>})}</div>{!filtered.length && <div className="empty"><CircleHelp size={20}/>No transactions match these filters.</div>}</section></>}
      {showCategoriesModal && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowCategoriesModal(false)}><section className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="categories-modal-title" onMouseDown={event => event.stopPropagation()}><div className="dashboard-modal-header"><div><p className="eyebrow">CATEGORIES</p><h2 id="categories-modal-title">Where it went</h2><p>All spending categories in the current view.</p></div><button className="modal-close" aria-label="Close categories" onClick={() => setShowCategoriesModal(false)}><X size={18}/></button></div><div className="modal-category-list">{categoryTotals.length ? categoryTotals.map(c => <button key={c.value} className="modal-category-row" onClick={() => { selectCategory(c.value); setShowCategoriesModal(false) }}><span className="category-dot" style={{background:c.color}}/><span className="category-name">{c.label}</span><span className="category-amount">{money.format(c.amount)}</span><span className="category-pct">{Math.round(c.amount / total * 100)}%</span></button>) : <p className="modal-empty">No spending categories are available for this view.</p>}</div></section></div>}
      {showManageModal && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowManageModal(false)}><section className="dashboard-modal" role="dialog" aria-modal="true" aria-labelledby="manage-modal-title" onMouseDown={event => event.stopPropagation()}><div className="dashboard-modal-header"><div><p className="eyebrow">ACCOUNTS</p><h2 id="manage-modal-title">Manage cards</h2><p>Remove a card and its transactions from the current workspace.</p></div><button className="modal-close" aria-label="Close card management" onClick={() => setShowManageModal(false)}><X size={18}/></button></div><div className="modal-account-list">{availableAccounts.filter(card => !pendingDeletedAccounts.includes(card.id)).length ? availableAccounts.filter(card => !pendingDeletedAccounts.includes(card.id)).map(card => { const logo = cardLogoFor(card.institution); return <div className="modal-account-row" key={card.id}><span className="mini-card" style={{background:logo ? '#fff' : card.color}}>{logo ? <img src={logo} alt={`${card.institution} logo`}/> : card.institution.slice(0,1)}</span><span><strong>{card.displayName}</strong><small>{card.institution} · •••• {card.lastFour}</small></span><button className="modal-delete-button" onClick={() => stageAccountDelete(card.id)}>Delete</button></div> }) : <p className="modal-empty">No cards are available in this workspace.</p>}</div><div className="modal-actions"><button className="modal-save-button" onClick={saveAccountChanges} disabled={!pendingDeletedAccounts.length}>Save</button></div></section></div>}
      {namePromptOpen && !introSplashVisible && <div className="modal-backdrop name-prompt-backdrop" role="presentation"><section className="dashboard-modal name-prompt-modal" role="dialog" aria-modal="true" aria-labelledby="name-prompt-title" onMouseDown={event => event.stopPropagation()}><div className="dashboard-modal-header"><div><p className="eyebrow">WELCOME</p><h2 id="name-prompt-title">Hey, what’s your first name?</h2><p>We’ll use it to personalize your dashboard.</p></div></div><form className="name-prompt-form" onSubmit={event => { event.preventDefault(); const normalized = normalizeFirstName(userName); if (normalized) { setUserName(normalized); setNamePromptOpen(false); beginTourIfNeeded() } }}><label htmlFor="first-name">First name</label><input id="first-name" value={userName} onChange={event => setUserName(normalizeFirstName(event.target.value))} placeholder="Your first name" autoFocus/><button className="import-button" type="submit" disabled={!userName.trim()}>Continue</button></form></section></div>}
      {selectedChartPoint && <ChartPointDrawer point={selectedChartPoint} transactions={selectedChartTransactions} accountIds={chartAccountIds} onClose={() => setSelectedChartPoint(null)}/>} 
    </>}
    </main>
    {introSplashVisible && <div className="intro-splash" role="status" aria-live="polite"><div className="intro-splash-content"><h1 className="intro-splash-heading" aria-label="Let's make you aware of your finance">{"Let's make you aware of your finance".split(' ').map((word, wordIndex, words) => <span className="intro-splash-word" key={`${word}-${wordIndex}`} aria-hidden="true">{Array.from(word).map((character, index) => <span key={`${word}-${index}`} aria-hidden="true" style={{ animationDelay: `${(wordIndex * 8 + index) * 32}ms` }}>{character}</span>)}{wordIndex < words.length - 1 ? '\u00a0' : ''}</span>)}</h1><p className="intro-splash-signature" aria-label="Project by Swagat Karki">{"Project by Swagat Karki".split(' ').map((word, wordIndex, words) => <span className="intro-splash-word" key={`${word}-${wordIndex}`} aria-hidden="true">{Array.from(word).map((character, index) => <span key={`${word}-${index}`} aria-hidden="true" style={{ animationDelay: `${1.55 + (wordIndex * 8 + index) * 32 / 1000}s` }}>{character}</span>)}{wordIndex < words.length - 1 ? '\u00a0' : ''}</span>)}</p></div></div>}
    <OnboardingTour step={tourStep} onSkip={skipDashboardTour} onNext={dashboardTourNext} onBack={dashboardTourBack}/>
  </div>
}

function Kpi({ label, value, note, trend, format }: { label:string; value:number; note:string; trend?:string; format:'currency'|'count' }) { return <article className="kpi"><p>{label}</p><h3>{format === 'currency' ? <AnimatedMoney value={value} once/> : <AnimatedNumber value={value} formatter={formatCount} once/>}</h3><small>{trend && <em>↑ {trend}</em>}{note}</small></article> }
