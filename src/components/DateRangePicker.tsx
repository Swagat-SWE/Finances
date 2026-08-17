import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

type DateMode = 'all' | 'custom' | string
type DateRangePickerProps = {
  dates: string[]
  months: string[]
  mode: DateMode
  start: string
  end: string
  onChange: (mode: DateMode, start?: string, end?: string) => void
  openRequest?: number
}

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const monthShortFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' })
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' })

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function toISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthDate(value: string) { return parseDate(`${value}-01`) }
function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` }
function dateRangeText(dates: string[]) { return dates.length ? `${dateFormatter.format(parseDate(dates[0]))} – ${dateFormatter.format(parseDate(dates[dates.length - 1]))}` : 'Choose a date range' }
function calendarDaysForMonth(value: string) {
  const first = monthDate(value)
  const offset = first.getDay()
  const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first.getFullYear(), first.getMonth(), index - offset + 1, 12)
    return { date, iso: toISO(date), inMonth: date.getMonth() === first.getMonth() }
  }).slice(0, Math.ceil((offset + total) / 7) * 7)
}

export default function DateRangePicker({ dates, months, mode, start, end, onChange, openRequest = 0 }: DateRangePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<'up' | 'down'>('down')
  const [panel, setPanel] = useState<'presets' | 'custom'>('presets')
  const [activeField, setActiveField] = useState<'from' | 'to'>('from')
  const [fromMonth, setFromMonth] = useState(months[0] ?? monthKey(new Date()))
  const [toMonth, setToMonth] = useState(months[1] ?? months[0] ?? monthKey(new Date()))
  const [hoverDate, setHoverDate] = useState('')

  const minDate = dates[0]
  const maxDate = dates[dates.length - 1]
  const selectedLabel = mode === 'custom' && start && end ? `${dateFormatter.format(parseDate(start))} – ${dateFormatter.format(parseDate(end))}` : mode === 'custom' ? 'Choose a date range' : mode === 'all' ? dateRangeText(dates) : monthShortFormatter.format(monthDate(mode))
  const leftMonth = months.includes(fromMonth) ? fromMonth : months[0] ?? fromMonth
  const leftIndex = Math.max(0, months.indexOf(leftMonth))
  const startBoundaryMonth = start && months.includes(monthKey(parseDate(start))) ? monthKey(parseDate(start)) : leftMonth
  const startBoundaryIndex = Math.max(0, months.indexOf(startBoundaryMonth))
  const requestedRightMonth = months.includes(toMonth) ? toMonth : months[1] ?? months[0] ?? toMonth
  const rightMonth = months.indexOf(requestedRightMonth) >= startBoundaryIndex ? requestedRightMonth : startBoundaryMonth
  const rightIndex = Math.max(startBoundaryIndex, months.indexOf(rightMonth))
  const previousFromMonth = leftIndex > 0 ? months[leftIndex - 1] : undefined
  const nextFromMonth = leftIndex >= 0 && leftIndex < months.length - 1 ? months[leftIndex + 1] : undefined
  const previousToMonth = rightIndex > startBoundaryIndex ? months[rightIndex - 1] : undefined
  const nextToMonth = rightIndex >= 0 && rightIndex < months.length - 1 ? months[rightIndex + 1] : undefined

  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => weekdayFormatter.format(new Date(2024, 0, 7 + index))), [])
  const leftCalendarDays = useMemo(() => calendarDaysForMonth(leftMonth), [leftMonth])
  const rightCalendarDays = useMemo(() => calendarDaysForMonth(rightMonth), [rightMonth])

  const monthForField = (value: string, field: 'from' | 'to') => {
    const target = monthKey(parseDate(value))
    const targetIndex = months.indexOf(target)
    return months[targetIndex] ?? target
  }

  const setCalendarMonth = (field: 'from' | 'to', month: string) => {
    if (field === 'from') {
      setFromMonth(month)
      if (months.indexOf(toMonth) < months.indexOf(month)) setToMonth(month)
    } else if (months.indexOf(month) >= startBoundaryIndex) {
      setToMonth(month)
    }
  }

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false) }
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => { document.removeEventListener('pointerdown', handlePointerDown); document.removeEventListener('keydown', handleKeyDown) }
  }, [open])

  const openPicker = () => {
    if (open) { setOpen(false); return }
    const rect = rootRef.current?.getBoundingClientRect()
    setPlacement(rect && window.innerHeight - rect.bottom < 470 && rect.top > 470 ? 'up' : 'down')
    setActiveField(mode === 'custom' && start && !end ? 'to' : 'from')
    if (mode === 'custom' && start && end) {
      setFromMonth(monthForField(start, 'from'))
      setToMonth(monthForField(end, 'to'))
    } else if (mode === 'custom' && start && !end) {
      setFromMonth(monthForField(start, 'from'))
      setToMonth(months[months.indexOf(monthForField(start, 'from')) + 1] ?? monthForField(start, 'to'))
    } else {
      const initialMonth = monthForField(start || end || minDate || leftMonth, 'from')
      setFromMonth(initialMonth)
      setToMonth(months[months.indexOf(initialMonth) + 1] ?? initialMonth)
    }
    setPanel(mode === 'custom' ? 'custom' : 'presets')
    setOpen(true)
  }

  const choosePreset = (nextMode: DateMode) => { onChange(nextMode); setHoverDate(''); setOpen(false) }
  const chooseCustom = () => {
    const field = start && !end ? 'to' : 'from'
    onChange('custom', start, end)
    setActiveField(field)
    if (start && end) {
      setFromMonth(monthForField(start, 'from'))
      setToMonth(monthForField(end, 'to'))
    } else {
      const initialMonth = monthForField(start || end || minDate || leftMonth, 'from')
      setFromMonth(initialMonth)
      setToMonth(months[months.indexOf(initialMonth) + 1] ?? initialMonth)
    }
    setPanel('custom')
    setOpen(true)
  }

  useEffect(() => {
    if (openRequest > 0) chooseCustom()
  }, [openRequest])

  const selectDate = (iso: string, field = activeField) => {
    if (iso < minDate || iso > maxDate) return
    if (field === 'from') {
      const nextEnd = end && iso <= end ? end : ''
      onChange('custom', iso, nextEnd)
      const selectedMonth = monthKey(parseDate(iso))
      setFromMonth(selectedMonth)
      if (months.indexOf(toMonth) < months.indexOf(selectedMonth)) setToMonth(selectedMonth)
      setActiveField('to')
    } else if (!start) {
      onChange('custom', iso, '')
      setFromMonth(monthKey(parseDate(iso)))
      setToMonth(monthKey(parseDate(iso)))
      setActiveField('to')
    } else if (iso < start) {
      return
    } else {
      onChange('custom', start, iso)
      setActiveField('from')
    }
  }

  const renderCalendar = (month: string, field: 'from' | 'to', calendarDays: ReturnType<typeof calendarDaysForMonth>) => (
    <div className={`calendar-surface calendar-panel calendar-panel-${field}`}>
      <div className="calendar-header">
        <button aria-label={`Previous ${field === 'from' ? 'start' : 'end'} month`} disabled={!(field === 'from' ? previousFromMonth : previousToMonth)} onClick={() => { const previous = field === 'from' ? previousFromMonth : previousToMonth; if (previous) setCalendarMonth(field, previous) }}><ChevronLeft size={17}/></button>
        <strong>{monthFormatter.format(monthDate(month))}</strong>
        <button aria-label={`Next ${field === 'from' ? 'start' : 'end'} month`} disabled={!(field === 'from' ? nextFromMonth : nextToMonth)} onClick={() => { const next = field === 'from' ? nextFromMonth : nextToMonth; if (next) setCalendarMonth(field, next) }}><ChevronRight size={17}/></button>
      </div>
      <div className="calendar-weekdays">{weekdays.map(day => <span key={day}>{day.slice(0, 2)}</span>)}</div>
      <div className="calendar-grid">{calendarDays.map(({ iso, date, inMonth }) => {
        const beforeStart = field === 'to' && (iso.slice(0, 7) < startBoundaryMonth || Boolean(start && iso < start))
        const disabled = iso < minDate || iso > maxDate || beforeStart
        const isStart = iso === start
        const isEnd = iso === end
        const inRange = Boolean(start && end && iso > start && iso < end)
        const preview = Boolean(activeField === 'to' && start && !end && hoverDate && ((iso > start && iso <= hoverDate) || (iso < start && iso >= hoverDate)))
        const today = iso === toISO(new Date())
        return <button key={iso} data-calendar-date={iso} aria-label={`Select ${dateFormatter.format(date)}`} disabled={disabled} className={`calendar-day ${inMonth ? '' : 'outside'} ${disabled ? 'disabled' : ''} ${isStart ? 'start' : ''} ${isEnd ? 'end' : ''} ${inRange ? 'in-range' : ''} ${preview ? 'preview' : ''} ${today ? 'today' : ''}`} onMouseEnter={() => setHoverDate(iso)} onClick={() => selectDate(iso, field)} onKeyDown={event => { if (event.key === 'ArrowLeft') { event.preventDefault(); moveFocus(iso, -1) } if (event.key === 'ArrowRight') { event.preventDefault(); moveFocus(iso, 1) } if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(iso, -7) } if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(iso, 7) } }}>{date.getDate()}</button>
      })}</div>
    </div>
  )

  const moveFocus = (iso: string, days: number) => {
    const date = parseDate(iso)
    date.setDate(date.getDate() + days)
    const next = document.querySelector<HTMLButtonElement>(`[data-calendar-date="${toISO(date)}"]`)
    next?.focus()
  }

  return <div className="date-range-picker" ref={rootRef}>
    <button className={`date-range-trigger ${open ? 'is-open' : ''}`} aria-expanded={open} aria-haspopup="dialog" onClick={openPicker}>
      <span className="date-range-trigger-copy"><small>Date range</small><strong>{selectedLabel}</strong></span>
      <ChevronDown size={15}/>
    </button>
    {open && panel === 'presets' && <div className={`date-range-popover ${placement}`} role="dialog" aria-label="Choose date range">
      <div className="date-range-presets"><button className={mode === 'all' ? 'active' : ''} onClick={() => choosePreset('all')}>All dates<span>{dateRangeText(dates)}</span></button>{months.map(month => <button key={month} className={mode === month ? 'active' : ''} onClick={() => choosePreset(month)}>{monthShortFormatter.format(monthDate(month))}</button>)}<button className={mode === 'custom' ? 'active' : ''} onClick={chooseCustom}>Custom range</button></div>
    </div>}
    {open && panel === 'custom' && <div className={`date-range-popover ${placement} is-custom`} role="dialog" aria-label="Choose custom date range">
      <div className="date-range-fields"><button className={`date-range-field ${activeField === 'from' ? 'active' : ''}`} onClick={() => { setActiveField('from'); setFromMonth(monthForField(start || minDate, 'from')) }}><small>FROM</small><span><CalendarDays size={15}/>{start ? dateFormatter.format(parseDate(start)) : 'Select start'}</span></button><span className="date-range-arrow">→</span><button className={`date-range-field ${activeField === 'to' ? 'active' : ''}`} onClick={() => { setActiveField('to'); setToMonth(monthForField(end || start || maxDate, 'to')) }}><small>TO</small><span><CalendarDays size={15}/>{end ? dateFormatter.format(parseDate(end)) : 'Select end'}</span></button></div>
      <div className="calendar-panels">{renderCalendar(leftMonth, 'from', leftCalendarDays)}{renderCalendar(rightMonth, 'to', rightCalendarDays)}</div>
      <div className="date-range-popover-footer"><div className="date-range-footer-actions"><button className="date-range-exit" onClick={() => choosePreset('all')}>Exit</button><button disabled={!start || !end} onClick={() => setOpen(false)}><Check size={14}/>Done</button></div></div>
    </div>}
  </div>
}
