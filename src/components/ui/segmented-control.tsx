'use client'

/**
 * SegmentedControl
 *
 * Radio group semantics with a roving tabindex, so the whole control is a single
 * tab stop and the arrows do the choosing.
 *
 * Keyboard contract
 *   Tab / Shift+Tab        enter and leave the group. Focus lands on the selected
 *                          segment; every other segment carries tabindex -1.
 *   ArrowRight / ArrowDown next enabled segment, wrapping, selecting as it moves.
 *   ArrowLeft / ArrowUp    previous enabled segment, wrapping.
 *   Home / End             first and last enabled segment.
 *   Space / Enter          select the focused segment (native button activation).
 *   Disabled segments are skipped by the arrows and cannot be activated.
 *
 * The indicator is a single absolutely positioned box that moves by
 * transform: translateX over 180ms with the entrance easing. Nothing animates
 * width, so there is no layout work per frame; the global reduced-motion reset
 * collapses the transition to a jump.
 *
 * Selection is carried by three things at once, never by hue alone: the moved
 * indicator (one surface step), the label stepping from text-2 to text-1, and
 * aria-checked.
 */

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { FieldHelper } from './field'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Pass a lucide icon at size 16, strokeWidth 1.5. */
  iconLeading?: ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string> {
  /** Rendered visibly above the control and used as the group name. */
  label: string
  /**
   * Keeps the label as the group's accessible name but hides it from view, for
   * a control whose purpose is already stated by the field label above it.
   */
  labelHidden?: boolean
  options: readonly SegmentedOption<T>[]
  value: T
  onValueChange: (value: T) => void
  /** Posts the current value with the surrounding form. */
  name?: string
  fullWidth?: boolean
  /** Renders a geometry matched skeleton in place of the segments. */
  loading?: boolean
  loadingLabel?: string
  disabled?: boolean
  disabledReason?: string
  error?: string | null
  className?: string
}

export function SegmentedControl<T extends string>({
  label,
  labelHidden = false,
  options,
  value,
  onValueChange,
  name,
  fullWidth = false,
  loading = false,
  loadingLabel = 'Loading the options.',
  disabled = false,
  disabledReason,
  error,
  className,
}: SegmentedControlProps<T>) {
  const reactId = useId()
  const labelId = `${reactId}-label`
  const errorId = error ? `${reactId}-error` : undefined
  const reasonId = disabled && disabledReason ? `${reactId}-reason` : undefined
  const describedBy = [errorId, reasonId].filter(Boolean).join(' ') || undefined

  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const count = options.length
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const { key } = event
    const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 0
    if (step === 0 && key !== 'Home' && key !== 'End') return
    event.preventDefault()

    const enabled = options
      .map((option, index) => ({ option, index }))
      .filter((entry) => !entry.option.disabled)
    if (enabled.length === 0) return

    let target: { option: SegmentedOption<T>; index: number } | undefined
    if (key === 'Home') {
      target = enabled[0]
    } else if (key === 'End') {
      target = enabled[enabled.length - 1]
    } else {
      const at = enabled.findIndex((entry) => entry.option.value === value)
      target = enabled[(at + step + enabled.length) % enabled.length]
    }
    if (!target) return

    onValueChange(target.option.value)
    refs.current[target.index]?.focus()
  }

  const shellClasses = cn(
    'relative inline-grid h-11 rounded-sm border bg-surface-1 p-3xs',
    disabled ? 'cursor-not-allowed border-border-control' : error ? 'border-critical' : 'border-border-control',
    fullWidth && 'w-full',
  )

  return (
    <div className={cn('flex flex-col gap-2xs', className)}>
      <p className={cn('font-ui text-base text-text-1', labelHidden && 'sr-only')} id={labelId}>
        {label}
      </p>

      {loading ? (
        <div
          aria-busy="true"
          aria-live="polite"
          className={cn(shellClasses, 'border-border-hair bg-surface-2')}
          style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
        >
          <span className="sr-only">{loadingLabel}</span>
        </div>
      ) : (
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error) || undefined}
          aria-disabled={disabled || undefined}
          onKeyDown={move}
          className={shellClasses}
          style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
        >
          {/* 4px is the two 2px p-3xs edges the track loses to padding. */}
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-y-3xs left-3xs rounded-xs border',
              disabled ? 'border-border-hair bg-surface-2' : 'border-border-control bg-surface-3',
              'transition-transform duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
            )}
            style={{
              width: `calc((100% - 4px) / ${count})`,
              transform: `translateX(${activeIndex * 100}%)`,
            }}
          />

          {options.map((option, index) => {
            const selected = option.value === value
            const inert = disabled || Boolean(option.disabled)
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={inert || undefined}
                tabIndex={selected ? 0 : -1}
                ref={(node) => {
                  refs.current[index] = node
                }}
                onClick={() => {
                  if (inert) return
                  onValueChange(option.value)
                }}
                className={cn(
                  'relative flex min-w-0 items-center justify-center gap-2xs rounded-xs px-sm font-ui text-sm whitespace-nowrap',
                  'transition-[color,background-color] duration-[80ms] ease-[cubic-bezier(0.4,0,1,1)]',
                  inert
                    ? 'cursor-not-allowed text-text-disabled'
                    : selected
                      ? 'text-text-1'
                      : 'text-text-2 hover:bg-surface-2 hover:text-text-1 hover:duration-[120ms] hover:ease-[cubic-bezier(0.16,1,0.3,1)]',
                )}
              >
                {option.iconLeading ? (
                  <span aria-hidden="true" className="shrink-0">
                    {option.iconLeading}
                  </span>
                ) : null}
                <span className="truncate">{option.label}</span>
              </button>
            )
          })}
        </div>
      )}

      {name ? <input type="hidden" name={name} value={value} /> : null}

      <FieldHelper
        errorId={errorId}
        error={error}
        reasonId={reasonId}
        reason={reasonId ? disabledReason : undefined}
      />
    </div>
  )
}

export default SegmentedControl
