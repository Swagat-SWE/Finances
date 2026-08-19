import { useEffect, useLayoutEffect, useState } from 'react'

export type TourStep = 'idle' | 'dashboard-import' | 'import-dropzone' | 'import-confirm' | 'import-dashboard'

type Props = {
  step: TourStep
  onSkip: () => void
  onBack?: () => void
  onReplay?: () => void
}

const copy: Record<Exclude<TourStep, 'idle'>, { target: string; title: string; body: string }> = {
  'dashboard-import': {
    target: 'dashboard-import',
    title: 'Start with a statement',
    body: 'Import your credit card CSV file to get clear visuals and understand your finances.',
  },
  'import-dropzone': {
    target: 'import-dropzone',
    title: 'Import your CSV file here',
    body: 'Drop a file into this area or browse your device. Your statement is processed locally.',
  },
  'import-confirm': {
    target: 'import-confirm',
    title: 'Bring it into your dashboard',
    body: 'When your file is ready, click here to begin building your spending view.',
  },
  'import-dashboard': {
    target: 'import-dashboard',
    title: 'Your dashboard is ready',
    body: 'Click here to begin the project and explore your finances.',
  },
}

type Rect = { top: number; left: number; width: number; height: number }

export default function OnboardingTour({ step, onSkip, onBack, onReplay }: Props) {
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const [placeAbove, setPlaceAbove] = useState(false)
  const [popoverHeight, setPopoverHeight] = useState(190)
  const content = step === 'idle' ? null : copy[step]

  const measure = () => {
    if (!content) {
      setTargetRect(null)
      return
    }
    const target = document.querySelector<HTMLElement>(`[data-tour="${content.target}"]`)
    if (!target) {
      setTargetRect(null)
      return
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
        {step === 'import-dropzone' && onBack ? <button type="button" className="onboarding-tour-back" onClick={onBack}>Back</button> : <button type="button" className="onboarding-tour-skip" onClick={onSkip}>Skip tour</button>}
        {step === 'import-dropzone' && onReplay && <button type="button" className="onboarding-tour-replay" onClick={onReplay}>Replay</button>}
      </div>
    </section>
  </div>
}
