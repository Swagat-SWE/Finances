import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type TourStep = 'idle' | 'dashboard-import' | 'import-dropzone' | 'import-confirm' | 'import-dashboard' | 'dashboard-hide-numbers' | 'dashboard-total-spending' | 'dashboard-spending-chart' | 'dashboard-spending-points' | 'dashboard-spending-card-usage' | 'dashboard-spending-card-transactions' | 'dashboard-spending-drawer-close' | 'dashboard-weekday' | 'dashboard-merchants' | 'dashboard-merchants-view-all' | 'dashboard-merchants-modal-close' | 'dashboard-categories' | 'dashboard-categories-view-all' | 'dashboard-categories-modal-close' | 'dashboard-accounts' | 'dashboard-accounts-manage' | 'dashboard-accounts-modal-close' | 'dashboard-total' | 'dashboard-category-filter' | 'dashboard-self-made-filters' | 'dashboard-category-accounts' | 'dashboard-spending-nav' | 'dashboard-spending' | 'dashboard-spending-ytd' | 'dashboard-spending-expand' | 'dashboard-spending-modal-close'

type Props = {
  step: TourStep
  onSkip: () => void
  onNext: () => void
  onBack?: () => void
  showImportNext?: boolean
}

const copy: Record<Exclude<TourStep, 'idle'>, { target: string; title: string; body: string; back?: boolean; scroll?: boolean }> = {
  'dashboard-import': {
    target: 'dashboard-import',
    title: 'Start with a statement',
    body: 'Import your credit card CSV file to get clear visuals and understand your finances.',
  },
  'import-dropzone': {
    target: 'import-dropzone',
    title: 'Import your CSV file here',
    body: 'Drop a file into this area or browse your device. Your statement is processed locally.',
    back: true,
  },
  'import-confirm': {
    target: 'import-confirm',
    title: 'Bring it into your dashboard',
    body: 'When your file is ready, click here to begin building your spending view.',
    back: true,
  },
  'import-dashboard': {
    target: 'import-dashboard',
    title: 'Your dashboard is ready',
    body: 'Click here to begin the project and explore your finances.',
    back: true,
  },
  'dashboard-hide-numbers': {
    target: 'hide-numbers',
    title: 'Keep your numbers private',
    body: 'Right now, all of your numbers are hidden. Turn off this toggle to see the actual numbers.',
  },
  'dashboard-total-spending': {
    target: 'overview-total-spending',
    title: 'Total spending',
    body: 'This is the total amount spent in your selected date range.',
  },
  'dashboard-spending-chart': {
    target: 'overview-spending-chart',
    title: 'Spending over time',
    body: 'This graph shows your spending flow across the year, rising and falling as each month changes. Hover over the graph to see the payments across all your cards during that particular month.',
    back: true,
  },
  'dashboard-spending-points': {
    target: 'overview-spending-points',
    title: 'Explore each point',
    body: 'Hover over these highlighted points to see your numbers, then click a point to see the transactions behind that period.',
    back: true,
  },
  'dashboard-spending-card-usage': {
    target: 'spending-card-usage',
    title: 'Cards used',
    body: 'Every card here is interactive. Click a card to scroll to the exact transactions that make up its total.',
    back: true,
  },
  'dashboard-spending-card-transactions': {
    target: 'spending-card-transactions',
    title: 'Exact transactions',
    body: 'This is the transaction detail for the card you selected. Use Next to return to the top of the detail panel.',
    back: true,
  },
  'dashboard-spending-drawer-close': {
    target: 'spending-drawer-close',
    title: 'Close the detail panel',
    body: 'Click the X to close the detail panel and continue the tour.',
    back: true,
  },
  'dashboard-weekday': {
    target: 'overview-weekday',
    title: 'Spending by day of week',
    body: 'See which days carry the most spending. Click any day to jump to the transactions behind it.',
    back: true,
    scroll: true,
  },
  'dashboard-merchants': {
    target: 'overview-top-merchants',
    title: 'Top merchants',
    body: 'See where you spend most often. Click any merchant to jump to its matching transactions.',
    back: true,
    scroll: true,
  },
  'dashboard-merchants-view-all': {
    target: 'overview-top-merchants-view-all',
    title: 'See every top merchant',
    body: 'Click “View all” to see all of your top merchants.',
  },
  'dashboard-merchants-modal-close': {
    target: 'overview-top-merchants-modal-close',
    title: 'Return to your dashboard',
    body: 'Click the X to close this view and continue the tour.',
  },
  'dashboard-categories': {
    target: 'overview-categories',
    title: 'Categories',
    body: 'Categories group your spending so you can quickly understand where your money is going.',
    back: true,
    scroll: true,
  },
  'dashboard-categories-view-all': {
    target: 'overview-categories-view-all',
    title: 'Explore every category',
    body: 'Click “View all” to see all of your spending categories.',
  },
  'dashboard-categories-modal-close': {
    target: 'overview-categories-modal-close',
    title: 'Return to your dashboard',
    body: 'Click the X to close this view and continue the tour.',
  },
  'dashboard-accounts': {
    target: 'overview-accounts',
    title: 'Accounts',
    body: 'These cards show which accounts are carrying your spending. Click any card to see the dashboard data and graph change for that account, or use Manage to continue.',
    back: true,
    scroll: true,
  },
  'dashboard-accounts-manage': {
    target: 'overview-accounts-manage',
    title: 'Manage your cards',
    body: 'Click Manage to delete or remove a card from your website.',
  },
  'dashboard-accounts-modal-close': {
    target: 'overview-accounts-modal-close',
    title: 'Return to your dashboard',
    body: 'Click the X to close card management and continue the tour.',
  },
  'dashboard-total': {
    target: 'overview-transaction-total',
    title: 'A total for exactly what you see',
    body: 'This total recalculates for the transactions on screen. Search for Starbucks, for example, and it updates to show your matching Starbucks spend.',
    back: true,
    scroll: true,
  },
  'dashboard-category-filter': {
    target: 'overview-category-filter',
    title: 'All Categories',
    body: 'Open Category: All Categories to filter the transactions and focus on exactly where your money went.',
    scroll: true,
  },
  'dashboard-self-made-filters': {
    target: 'overview-self-made-filters',
    title: 'Self-made filters',
    body: 'Amazon, Groceries, Gas, and Paid are self-made filters created by Swagat Karki, the product owner, to make everyday finance reviews easier.',
    scroll: true,
  },
  'dashboard-category-accounts': {
    target: 'overview-account-filter',
    title: 'All Accounts',
    body: 'All Accounts brings every card’s categories together. Choose one account to focus the category list on that card.',
    scroll: true,
  },
  'dashboard-spending-nav': {
    target: 'spending-nav-item',
    title: 'Spending',
    body: 'Spending shows the graphs for all of your cards, so you can see how and when each card was used.',
  },
  'dashboard-spending': {
    target: 'spending-view',
    title: 'Your spending flows',
    body: 'Start with the All Cards graph to compare how your cards carry spending over time. Next, we’ll show you how to explore each point.',
    scroll: true,
  },
  'dashboard-spending-ytd': {
    target: 'spending-ytd',
    title: 'Change the time period',
    body: 'Use YTD to change the time period to 6 months, 3 months, 30 days, or 7 days.',
  },
  'dashboard-spending-expand': {
    target: 'spending-expand',
    title: 'Expand a chart',
    body: 'Click the expand button to open this chart in a larger view.',
  },
  'dashboard-spending-modal-close': {
    target: 'spending-modal-close',
    title: 'Close the expanded chart',
    body: 'Click the X to close the expanded chart and continue the tour.',
  },
}

type Rect = { top: number; left: number; width: number; height: number }

const fallbackTargets: Record<string, () => HTMLElement | null> = {
  'overview-categories': () => Array.from(document.querySelectorAll<HTMLElement>('.analytics-four-grid > section')).find(section => section.querySelector('h2')?.textContent?.trim() === 'Categories') ?? null,
  'overview-accounts': () => Array.from(document.querySelectorAll<HTMLElement>('.analytics-four-grid > section')).find(section => section.querySelector('h2')?.textContent?.trim() === 'Accounts') ?? null,
  'overview-top-merchants-view-all': () => document.querySelector<HTMLElement>('.monthly-merchant-panel .monthly-panel-heading .text-button'),
  'overview-categories-view-all': () => Array.from(document.querySelectorAll<HTMLElement>('.analytics-four-grid > section')).find(section => section.querySelector('h2')?.textContent?.trim() === 'Categories')?.querySelector<HTMLElement>('.text-button') ?? null,
  'overview-accounts-manage': () => Array.from(document.querySelectorAll<HTMLElement>('.analytics-four-grid > section')).find(section => section.querySelector('h2')?.textContent?.trim() === 'Accounts')?.querySelector<HTMLElement>('.text-button') ?? null,
  'overview-top-merchants-modal-close': () => document.querySelector<HTMLElement>('.monthly-merchants-modal .modal-close'),
  'overview-categories-modal-close': () => document.querySelector<HTMLElement>('.modal-backdrop .dashboard-modal .modal-close'),
  'overview-accounts-modal-close': () => document.querySelector<HTMLElement>('.modal-backdrop .dashboard-modal .modal-close'),
  'overview-category-filter': () => document.querySelector<HTMLElement>('.filters .filter-dropdown-wide .filter-dropdown-trigger'),
  'overview-category-filter-popover': () => document.querySelector<HTMLElement>('.filters .filter-dropdown-wide .filter-dropdown-popover'),
  'overview-account-filter': () => document.querySelector<HTMLElement>('.filters .filter-dropdown:not(.filter-dropdown-wide) .filter-dropdown-trigger'),
  'spending-nav-item': () => Array.from(document.querySelectorAll<HTMLElement>('.nav-item')).find(item => item.textContent?.trim() === 'Spending') ?? null,
  'spending-view': () => document.querySelector<HTMLElement>('.spending-view-header'),
  'spending-ytd': () => document.querySelector<HTMLElement>('.spending-flow-card-combined .spending-flow-total'),
  'spending-expand': () => document.querySelector<HTMLElement>('.spending-flow-card-combined .spending-flow-expand'),
  'spending-modal-close': () => document.querySelector<HTMLElement>('.spending-flow-modal-close'),
  'overview-spending-points': () => document.querySelector<HTMLElement>('.overview-spending-chart .chart-wrap') ?? document.querySelector<HTMLElement>('.spending-flow-card-combined .spending-flow-chart'),
  'spending-card-usage': () => document.querySelector<HTMLElement>('.chart-point-drawer-card-section'),
  'spending-card-transactions': () => document.querySelector<HTMLElement>('.chart-point-drawer-transactions-section'),
  'spending-drawer-close': () => document.querySelector<HTMLElement>('.chart-point-drawer .modal-close'),
}

export default function OnboardingTour({ step, onSkip, onNext, onBack, showImportNext = false }: Props) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const [placeAbove, setPlaceAbove] = useState(false)
  const [popoverHeight, setPopoverHeight] = useState(190)
  const scrolledStepRef = useRef<TourStep | null>(null)
  const content = step === 'idle' ? null : copy[step]

  const measure = () => {
    if (!content) {
      setTargetRect(null)
      return
    }
    const target = document.querySelector<HTMLElement>(`[data-tour="${content.target}"]`) ?? fallbackTargets[content.target]?.() ?? (content.target === 'overview-transaction-total' ? document.querySelector<HTMLElement>('.transaction-total-row') : null)
    if (!target) {
      setTargetRect(null)
      return
    }
    if (content.scroll && scrolledStepRef.current !== step) {
      scrolledStepRef.current = step
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    // The spending-points step should visually call out the plotted points,
    // not the entire chart card. Recharts renders each dot as an SVG element;
    // use their combined bounds so the tour focus spans every point while
    // still leaving the chart itself clickable.
    if (content.target === 'overview-spending-points') {
      const dots = Array.from(document.querySelectorAll<SVGElement>('.overview-spending-chart .recharts-dot, .overview-spending-chart .recharts-area-dot, .spending-flow-card-combined .recharts-dot, .spending-flow-card-combined .recharts-area-dot'))
      if (dots.length) {
        const bounds = dots.reduce((acc, dot) => {
          const dotRect = dot.getBoundingClientRect()
          return {
            top: Math.min(acc.top, dotRect.top),
            left: Math.min(acc.left, dotRect.left),
            right: Math.max(acc.right, dotRect.right),
            bottom: Math.max(acc.bottom, dotRect.bottom),
          }
        }, { top: Infinity, left: Infinity, right: -Infinity, bottom: -Infinity })
        const center = (bounds.top + bounds.bottom) / 2
        const height = Math.max(42, bounds.bottom - bounds.top + 24)
        const rect = { top: center - height / 2, left: bounds.left - 8, width: bounds.right - bounds.left + 16, height }
        setTargetRect(rect)
        setPlaceAbove(rect.top + rect.height + popoverHeight + 22 > window.innerHeight)
        return
      }
    }
    const rect = target.getBoundingClientRect()
    setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
    setPlaceAbove(rect.bottom + popoverHeight + 22 > window.innerHeight)
  }

  useLayoutEffect(() => {
    measure()
    // Import completion is intentionally animated, so the final button may
    // enter the DOM a couple of seconds after the step changes. Keep looking
    // briefly until the real target exists instead of positioning a phantom.
    const retry = window.setInterval(measure, 120)
    return () => window.clearInterval(retry)
  }, [step, popoverHeight])

  useEffect(() => {
    if (!content) return
    const handleViewportChange = () => measure()
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)
    return () => {
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [step, popoverHeight])

  if (!content || !targetRect) return null

  const popoverWidth = Math.min(360, window.innerWidth - 32)
  const targetCenter = targetRect.left + targetRect.width / 2
  const popoverLeft = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, targetCenter - popoverWidth / 2))
  const popoverTop = placeAbove ? targetRect.top - popoverHeight - 18 : targetRect.top + targetRect.height + 18
  const focusTop = Math.max(0, targetRect.top - 7)
  const focusLeft = Math.max(0, targetRect.left - 7)
  const focusRight = Math.min(window.innerWidth, targetRect.left + targetRect.width + 7)
  const focusBottom = Math.min(window.innerHeight, targetRect.top + targetRect.height + 7)
  const isDashboardStep = step.startsWith('dashboard-')
  const showNext = isDashboardStep || step === 'import-dropzone'
  const showBack = step !== 'dashboard-import' && step !== 'dashboard-hide-numbers' && Boolean(onBack)
  return <div className="onboarding-tour" role="presentation">
    <div className="onboarding-tour-scrim-panel" aria-hidden="true" style={{ top: 0, left: 0, right: 0, height: focusTop }}/>
    <div className="onboarding-tour-scrim-panel" aria-hidden="true" style={{ top: focusTop, left: 0, width: focusLeft, height: focusBottom - focusTop }}/>
    <div className="onboarding-tour-scrim-panel" aria-hidden="true" style={{ top: focusTop, left: focusRight, right: 0, height: focusBottom - focusTop }}/>
    <div className="onboarding-tour-scrim-panel" aria-hidden="true" style={{ top: focusBottom, left: 0, right: 0, bottom: 0 }}/>
    <div className="onboarding-tour-focus" aria-hidden="true" style={{ top: targetRect.top - 7, left: targetRect.left - 7, width: targetRect.width + 14, height: targetRect.height + 14 }}/>
    <section className={`onboarding-tour-popover ${placeAbove ? 'above' : 'below'}`} role="dialog" aria-label="Quick tour" ref={element => { if (element) setPopoverHeight(element.offsetHeight) }} style={{ top: Math.max(16, popoverTop), left: popoverLeft, width: popoverWidth }}>
      <span className="onboarding-tour-arrow" aria-hidden="true"/>
      <p className="eyebrow">QUICK TOUR</p>
      <h2>{content.title}</h2>
      <p>{content.body}</p>
      <div className="onboarding-tour-actions">
        <span className="onboarding-tour-left-actions">
          {showBack && <button type="button" className="onboarding-tour-back" onClick={onBack}>Back</button>}
          {showNext && <button type="button" className="onboarding-tour-next" onClick={onNext}>Next</button>}
          {!showBack && !showNext && <span aria-hidden="true"/>}
        </span>
        <button type="button" className="onboarding-tour-skip onboarding-tour-right-action" onClick={onSkip}>Skip tour</button>
      </div>
    </section>
  </div>
}
