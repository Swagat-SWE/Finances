import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type TourStep = 'idle' | 'dashboard-import' | 'import-dropzone' | 'import-confirm' | 'import-dashboard' | 'dashboard-hide-numbers' | 'dashboard-total-spending' | 'dashboard-spending-chart' | 'dashboard-weekday' | 'dashboard-merchants' | 'dashboard-categories' | 'dashboard-accounts' | 'dashboard-total'

type Props = {
  step: TourStep
  onSkip: () => void
  onNext: () => void
  onBack?: () => void
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
    body: 'This is the total amount spent in your selected date range. Scroll down to keep exploring your dashboard.',
  },
  'dashboard-spending-chart': {
    target: 'overview-spending-chart',
    title: 'Spending over time',
    body: 'This graph shows your spending flow across the year, rising and falling as each month changes.',
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
  'dashboard-categories': {
    target: 'overview-categories',
    title: 'Categories',
    body: 'Categories group your spending so you can quickly understand where your money is going.',
    back: true,
    scroll: true,
  },
  'dashboard-accounts': {
    target: 'overview-accounts',
    title: 'Accounts',
    body: 'Accounts show which cards are carrying your spending and let you focus on one card at a time.',
    back: true,
    scroll: true,
  },
  'dashboard-total': {
    target: 'overview-transaction-total',
    title: 'A total for exactly what you see',
    body: 'This total recalculates for the transactions on screen. Search for Starbucks, for example, and it updates to show your matching Starbucks spend.',
    back: true,
    scroll: true,
  },
}

type Rect = { top: number; left: number; width: number; height: number }

const fallbackTargets: Record<string, () => HTMLElement | null> = {
  'overview-categories': () => Array.from(document.querySelectorAll<HTMLElement>('.analytics-four-grid > section')).find(section => section.querySelector('h2')?.textContent?.trim() === 'Categories') ?? null,
  'overview-accounts': () => Array.from(document.querySelectorAll<HTMLElement>('.analytics-four-grid > section')).find(section => section.querySelector('h2')?.textContent?.trim() === 'Accounts') ?? null,
}

export default function OnboardingTour({ step, onSkip, onNext, onBack }: Props) {
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
  const showNext = isDashboardStep && step !== 'dashboard-import'
  const showBack = !isDashboardStep && step !== 'dashboard-import' && Boolean(onBack)
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
        {showNext ? <button type="button" className="onboarding-tour-next" onClick={onNext}>Next</button> : showBack ? <button type="button" className="onboarding-tour-back" onClick={onBack}>Back</button> : <span aria-hidden="true"/>}
        <button type="button" className="onboarding-tour-skip onboarding-tour-right-action" onClick={onSkip}>Skip tour</button>
      </div>
    </section>
  </div>
}
