'use client'

/**
 * The composer's grit selector. Split out of `./grit` because it is the only
 * member of the family that needs client state: a roving tabindex over five
 * cells. Everything visual it uses comes back across the boundary from the
 * server-safe module, so the hatch itself is still rendered once, not shipped.
 *
 * Keyboard contract: ArrowLeft/Right and ArrowUp/Down move and select (a
 * radiogroup selects on focus), Home/End jump to the ends, Tab enters at the
 * selected cell and leaves the group. A hidden input carries the value so the
 * composer still posts with JavaScript disabled.
 */

import { useRef } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GRIT_STEPS, GRIT_NUMERAL_STYLE, GritHatch, gritLabel, type GritValue } from './grit'

/* -------------------------------------------------------------- the scale -- */

export interface GritScaleProps {
  /** The selected grit, or null before the author has answered. */
  value: GritValue | null
  onChange: (next: GritValue) => void
  /** Posted with the form, so the composer works with JavaScript disabled. */
  name: string
  /** Visible question. Rendered by the caller; pass its id here. */
  labelledBy?: string
  /** Fallback name when there is no visible label to point at. */
  label?: string
  describedBy?: string
  disabled?: boolean
  disabledReason?: string
  className?: string
}

/**
 * The composer's selector: five cells, each showing its hatch, its numeral and
 * its stage. Selection follows focus, as in any radiogroup, and the selected
 * cell is marked by a check glyph as well as by the accent edge, so the state
 * survives a greyscale screenshot (§2.4.8).
 */
export function GritScale({
  value,
  onChange,
  name,
  labelledBy,
  label,
  describedBy,
  disabled = false,
  disabledReason,
  className,
}: GritScaleProps) {
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedIndex = GRIT_STEPS.findIndex((s) => s.value === value)
  const rovingIndex = selectedIndex >= 0 ? selectedIndex : 0
  const reasonId = disabled && disabledReason ? `${name}-grit-reason` : undefined

  function move(to: number) {
    if (disabled) return
    const count = GRIT_STEPS.length
    const next = ((to % count) + count) % count
    const step = GRIT_STEPS[next]
    if (!step) return
    onChange(step.value)
    cellRefs.current[next]?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        move(rovingIndex + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        move(rovingIndex - 1)
        break
      case 'Home':
        event.preventDefault()
        move(0)
        break
      case 'End':
        event.preventDefault()
        move(GRIT_STEPS.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div className={cn('flex flex-col gap-2xs', className)}>
      {/* The real value, so the Server Action receives it without JavaScript. */}
      <input type="hidden" name={name} value={value === null ? '' : String(value)} readOnly />

      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : (label ?? 'Grit index')}
        aria-describedby={describedBy ?? reasonId}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        className="grid grid-cols-1 gap-2xs sm:grid-cols-5"
      >
        {GRIT_STEPS.map((step, index) => {
          const checked = step.value === value
          return (
            <button
              key={step.key}
              ref={(node) => {
                cellRefs.current[index] = node
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={disabled || undefined}
              tabIndex={index === rovingIndex ? 0 : -1}
              onClick={() => {
                if (disabled) return
                onChange(step.value)
              }}
              className={cn(
                'flex min-h-2xl flex-col items-start gap-2xs rounded-xs border p-xs text-left transition-[background-color,border-color,color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                checked
                  ? 'border-accent bg-surface-3 text-text-1'
                  : 'border-border-control bg-surface-2 text-text-2',
                disabled
                  ? 'cursor-not-allowed border-border-hair text-text-disabled'
                  : 'hover:border-border-strong hover:bg-surface-3 hover:text-text-1 active:translate-y-px',
              )}
            >
              <span
                aria-hidden="true"
                className="block h-md w-full shrink-0 overflow-hidden rounded-none bg-surface-0"
              >
                <GritHatch value={step.value} />
              </span>
              <span className="flex w-full items-center gap-2xs">
                <span className="text-md text-text-1" style={GRIT_NUMERAL_STYLE}>
                  {step.value}
                </span>
                {checked ? (
                  <Check size={16} strokeWidth={1.5} aria-hidden="true" className="text-accent" />
                ) : null}
              </span>
              <span className="text-xs break-words">{step.label}</span>
            </button>
          )
        })}
      </div>

      {reasonId ? (
        <p id={reasonId} className="measure-ui text-xs text-text-3">
          {disabledReason}
        </p>
      ) : null}
    </div>
  )
}
