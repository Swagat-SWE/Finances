import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type FilterDropdownOption = { value: string; label: string; group?: string }

type FilterDropdownProps = {
  icon?: LucideIcon
  label: string
  value: string
  options: FilterDropdownOption[]
  onChange: (value: string) => void
  wide?: boolean
  compact?: boolean
  hideLabel?: boolean
  tourTarget?: string
}

export default function FilterDropdown({ label, value, options, onChange, wide = false, compact = false, hideLabel = false, tourTarget }: FilterDropdownProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [open, setOpen] = useState(false)
  const [placement, setPlacement] = useState<'up' | 'down'>('down')
  const selected = options.find(option => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      optionRefs.current[value]?.scrollIntoView({ block: 'center' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const choose = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
  }

  const compactWidth = compact ? `${Math.max(84, (selected?.label?.length ?? 3) * 8.5 + 42)}px` : undefined
  const compactStyle = compact ? { width: compactWidth } as CSSProperties : undefined
  const groupedOptions = options.reduce<Array<{ name?: string; items: FilterDropdownOption[] }>>((groups, option) => {
    const previous = groups[groups.length - 1]
    if (previous && previous.name === option.group) previous.items.push(option)
    else groups.push({ name: option.group, items: [option] })
    return groups
  }, [])
  const toggle = () => {
    if (open) {
      setOpen(false)
      return
    }
    const rect = rootRef.current?.getBoundingClientRect()
    setPlacement(rect && window.innerHeight - rect.bottom < 310 && rect.top > 310 ? 'up' : 'down')
    setOpen(true)
  }

  return <div className={`filter-dropdown ${wide ? 'filter-dropdown-wide' : ''} ${compact ? 'filter-dropdown-compact' : ''}`} style={compactStyle} ref={rootRef}>
    <button data-tour={tourTarget} className={`filter-dropdown-trigger ${open ? 'is-open' : ''} ${placement}`} aria-expanded={open} aria-haspopup="listbox" onClick={toggle}>
      <span className="filter-dropdown-copy">{!hideLabel && <span className="filter-dropdown-label">{label}:</span>}<strong>{selected?.label ?? 'All'}</strong></span>
      <ChevronDown size={14}/>
    </button>
    {open && <div className={`filter-dropdown-popover ${placement}`} role="listbox" aria-label={label}>
      {groupedOptions.map((group, groupIndex) => {
        const isSelfMade = group.name === 'SELF-MADE FILTERS'
        const groupTourTarget = isSelfMade ? 'overview-self-made-filters' : undefined
        return <div className="filter-dropdown-group" data-tour={groupTourTarget} key={`${group.name ?? 'ungrouped'}-${groupIndex}`}>
          {group.name && <div className={`filter-dropdown-group-label ${groupIndex > 0 ? 'with-divider' : ''}`} role="presentation">{group.name}</div>}
          {group.items.map(option => <button key={option.value} ref={node => { optionRefs.current[option.value] = node }} role="option" aria-selected={option.value === value} className={option.value === value ? 'active' : ''} onClick={() => choose(option.value)}><span>{option.label}</span>{option.value === value && <Check size={14}/>}</button>)}
        </div>
      })}
    </div>}
  </div>
}
