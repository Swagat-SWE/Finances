import { useMemo, useState } from 'react'
import { ArrowUpRight, BarChart3, Store, X } from 'lucide-react'
import type { Transaction } from '../data/models'
import { getSpendingByWeekday, getTopMerchants } from '../services/monthlyAnalytics'
import { formatMoney } from '../utils/display'

const money = { format: formatMoney }

type MonthlySpendingAnalyticsProps = {
  month: string
  monthLabel: string
  transactions: Transaction[]
  onMerchantClick?: (merchant: string) => void
  onWeekdayClick?: (weekday: number) => void
  panelsOnly?: boolean
}

export function MonthlyAnalyticsHeader({ monthLabel }: { monthLabel: string }) {
  return <div className="monthly-analytics-header">
    <div><p className="eyebrow">MONTHLY ANALYTICS</p><h2>{monthLabel} spending</h2><p className="monthly-analytics-subtitle">Where and when your money went this month.</p></div>
    <span className="monthly-analytics-badge"><BarChart3 size={15}/> Monthly view</span>
  </div>
}

export default function MonthlySpendingAnalytics({ month, monthLabel, transactions, onMerchantClick, onWeekdayClick, panelsOnly = false }: MonthlySpendingAnalyticsProps) {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)
  const [showMerchantsModal, setShowMerchantsModal] = useState(false)
  const dayStats = useMemo(() => getSpendingByWeekday(transactions, month), [transactions, month])
  const merchants = useMemo(() => getTopMerchants(transactions, month, 6), [transactions, month])
  const allMerchants = useMemo(() => getTopMerchants(transactions, month), [transactions, month])
  const highestDay = dayStats.reduce((highest, day) => day.amount > highest.amount ? day : highest, dayStats[0])
  const maxDayAmount = Math.max(...dayStats.map(day => day.amount), 0)
  const maxMerchantAmount = Math.max(...merchants.map(merchant => merchant.amount), 0)
  const maxAllMerchantAmount = Math.max(...allMerchants.map(merchant => merchant.amount), 0)
  const hasSpending = maxDayAmount > 0

  const weekdayPanel = <section className="panel monthly-panel monthly-weekday-panel" data-tour="overview-weekday">
    <div className="monthly-panel-heading"><div><h2 className="monthly-panel-title">Spending by day of week</h2></div></div>
    <div className="weekday-list">{dayStats.map(day => <div key={day.key} className="weekday-row" onMouseEnter={() => setHoveredDay(day.key)} onMouseLeave={() => setHoveredDay(null)} onFocus={() => setHoveredDay(day.key)} onBlur={() => setHoveredDay(null)} onClick={() => onWeekdayClick?.(day.key)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onWeekdayClick?.(day.key) } }} tabIndex={0} aria-label={`${day.label}: ${money.format(day.amount)} spent across ${day.spendingTransactionCount} spending transactions. Click to view these transactions.`}>
      <span className="weekday-label-wrap"><span className="weekday-label">{day.label}</span></span><span className="weekday-bar-wrap">{day.key === highestDay.key && day.amount > 0 && <small className="weekday-highest-label">HIGHEST</small>}<span className="weekday-bar-track"><span className={`weekday-bar ${day.key === highestDay.key ? 'highest' : ''}`} style={{ width: `${maxDayAmount ? Math.max(day.amount / maxDayAmount * 100, day.amount ? 3 : 0) : 0}%` }}/></span></span><strong className="weekday-amount">{money.format(day.amount)}</strong>
      {hoveredDay === day.key && <span className="monthly-tooltip" role="tooltip"><strong>{day.label}</strong><span>{money.format(day.amount)} spent</span><span className="monthly-tooltip-stats"><span>• {day.transactionCount} transactions</span><span>• {day.spendingTransactionCount} spending</span></span><span className="monthly-tooltip-average">Average transaction: {money.format(day.spendingTransactionCount ? day.amount / day.spendingTransactionCount : 0)}</span></span>}
    </div>)}</div>
  </section>

  const merchantPanel = <section className="panel monthly-panel monthly-merchant-panel" data-tour="overview-top-merchants">
    <div className="monthly-panel-heading"><div><h2 className="monthly-panel-title">Top merchants</h2></div><button className="text-button" onClick={() => setShowMerchantsModal(true)}>View all</button></div>
    {merchants.length ? <div className="merchant-ranking">{merchants.map((merchant, index) => <button key={merchant.name} className="monthly-merchant-row" onClick={() => onMerchantClick?.(merchant.name)} aria-label={`${merchant.name}: ${money.format(merchant.amount)} across ${merchant.transactionCount} transactions`}><span className={`merchant-rank ${index === 0 ? 'top' : ''}`}>{index + 1}</span><span className="merchant-copy"><strong title={merchant.name}>{merchant.name}</strong><small>{merchant.transactionCount} transaction{merchant.transactionCount === 1 ? '' : 's'}</small><span className="merchant-bar-track"><span className="merchant-bar" style={{ width: `${maxMerchantAmount ? Math.max(merchant.amount / maxMerchantAmount * 100, 3) : 0}%` }}/></span></span><b>{money.format(merchant.amount)}</b><ArrowUpRight size={14} className="merchant-arrow"/></button>)}</div> : <div className="monthly-panel-empty"><span className="monthly-empty-icon"><Store size={20}/></span><strong>No spending this month</strong><p>There aren't any spending transactions in this period.</p></div>}
    {merchants.length > 0 && <p className="monthly-merchant-hint">Select a merchant to find its transactions below.</p>}
    {showMerchantsModal && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowMerchantsModal(false)}><section className="dashboard-modal monthly-merchants-modal" role="dialog" aria-modal="true" aria-labelledby="monthly-merchants-modal-title" onMouseDown={event => event.stopPropagation()}><div className="dashboard-modal-header"><div><p className="eyebrow">MERCHANTS</p><h2 id="monthly-merchants-modal-title">Top merchants</h2><p>All merchants in {monthLabel || 'this month'}.</p></div><button className="modal-close" aria-label="Close top merchants" onClick={() => setShowMerchantsModal(false)}><X size={18}/></button></div><div className="modal-merchant-list">{allMerchants.length ? allMerchants.map((merchant, index) => <button key={merchant.name} className="monthly-merchant-row modal-merchant-row" onClick={() => { onMerchantClick?.(merchant.name); setShowMerchantsModal(false) }} aria-label={`${merchant.name}: ${money.format(merchant.amount)} across ${merchant.transactionCount} transactions`}><span className={`merchant-rank ${index === 0 ? 'top' : ''}`}>{index + 1}</span><span className="merchant-copy"><strong title={merchant.name}>{merchant.name}</strong><small>{merchant.transactionCount} transaction{merchant.transactionCount === 1 ? '' : 's'}</small><span className="merchant-bar-track"><span className="merchant-bar" style={{ width: `${maxAllMerchantAmount ? Math.max(merchant.amount / maxAllMerchantAmount * 100, 3) : 0}%` }}/></span></span><b>{money.format(merchant.amount)}</b><ArrowUpRight size={14} className="merchant-arrow"/></button>) : <p className="modal-empty">No merchants are available for this month.</p>}</div></section></div>}
  </section>

  if (panelsOnly) return <>{weekdayPanel}{merchantPanel}</>

  return <section className="monthly-analytics">
    <MonthlyAnalyticsHeader monthLabel={monthLabel}/>
    {!hasSpending ? <div className="monthly-empty"><span className="monthly-empty-icon"><Store size={20}/></span><strong>No spending this month</strong><p>There aren't any spending transactions in this period.</p></div> : <div className="monthly-analytics-grid">{weekdayPanel}{merchantPanel}</div>}
  </section>
}
