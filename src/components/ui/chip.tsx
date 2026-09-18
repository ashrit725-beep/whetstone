/**
 * Chip is a removable token, FilterChip is a toggle, and FilterChipLink is a
 * toggle whose state lives in the URL.
 *
 * Keyboard contract:
 *   Chip          the label is not focusable; the remove control is a real
 *                 <button> with an explicit name ("Remove Game"), reachable by
 *                 Tab and activated by Enter or Space. Removing a chip must
 *                 move focus to the next chip, or to the chip row's container
 *                 if it was the last one. The caller owns that, because only
 *                 the caller knows what is left.
 *   FilterChip    Tab reaches it, Enter and Space toggle it, `aria-pressed`
 *                 carries the state. It is never a checkbox drawn as a chip.
 *   FilterChipLink  a plain link; the browser's own semantics apply, and the
 *                 selected one carries `aria-current="true"`.
 *
 * This module carries no `'use client'` directive on purpose: the pure parts
 * (Chip without onRemove, FilterChipLink) render in Server Components, and the
 * handler parts compile into whichever client module imports them.
 *
 * Contract notes: 2px radius, 1px border in every state, never `rounded-full`
 * (§5.1). Chips are ≥44px tall from padding alone, so a chip row can sit at
 * `gap-xs` (8px) and still pass SC 2.5.8 (§0.11).
 */

import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const CHIP_TYPE = { fontVariationSettings: '"wdth" 87, "wght" 600' } as const

/* ------------------------------------------------------------------ Chip -- */

export interface ChipProps {
  children: React.ReactNode
  /** Provide to make the chip removable. Renders the only control in the chip. */
  onRemove?: () => void
  /** Full sentence for the remove control, e.g. "Remove the Game filter". */
  removeLabel?: string
  icon?: LucideIcon
  className?: string
}

export function Chip({ children, onRemove, removeLabel, icon: Icon, className }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2xs rounded-xs border border-border-control bg-surface-2 py-sm pl-sm text-xs text-text-2',
        onRemove ? 'pr-2xs' : 'pr-sm',
        className,
      )}
      style={CHIP_TYPE}
    >
      {Icon ? <Icon size={16} strokeWidth={1.5} aria-hidden="true" /> : null}
      <span>{children}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? 'Remove this filter'}
          className="tap-44 -my-3xs inline-flex items-center justify-center rounded-xs border border-transparent p-3xs text-text-3 transition-[color,background-color,border-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border-strong hover:bg-surface-3 hover:text-text-1 active:translate-y-px"
        >
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      ) : null}
    </span>
  )
}

/* ------------------------------------------------------------ FilterChip -- */

export interface FilterChipProps {
  children: React.ReactNode
  pressed: boolean
  onPressedChange: (next: boolean) => void
  /** Matching-row count. Rendered tabular so a chip row does not shuffle. */
  count?: number
  /**
   * Disabled chips stay in the tab order (`aria-disabled`) and must say why.
   * The reason is announced through `aria-describedby`, never implied by a
   * lighter colour (§5.4).
   */
  disabled?: boolean
  disabledReason?: string
  /** In flight. Keeps geometry; the chip does not resize. */
  busy?: boolean
  className?: string
  id?: string
}

export function FilterChip({
  children,
  pressed,
  onPressedChange,
  count,
  disabled = false,
  disabledReason,
  busy = false,
  className,
  id,
}: FilterChipProps) {
  const reasonId = disabled && disabledReason && id ? `${id}-reason` : undefined
  return (
    <>
      <button
        type="button"
        id={id}
        aria-pressed={pressed}
        aria-disabled={disabled || undefined}
        aria-busy={busy || undefined}
        aria-describedby={reasonId}
        onClick={() => {
          if (disabled || busy) return
          onPressedChange(!pressed)
        }}
        className={cn(
          'inline-flex items-center gap-2xs rounded-xs border px-sm py-sm text-xs whitespace-nowrap transition-[background-color,border-color,color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
          pressed
            ? 'border-accent bg-surface-3 text-text-1'
            : 'border-border-control bg-surface-2 text-text-2',
          disabled
            ? 'cursor-not-allowed border-border-hair text-text-disabled'
            : 'hover:border-border-strong hover:bg-surface-3 hover:text-text-1 active:translate-y-px',
          className,
        )}
        style={CHIP_TYPE}
      >
        {/* Selection is carried by the label state and the border, then
            confirmed by the numeral. Never by hue alone (§2.4.8). */}
        <span>{children}</span>
        {typeof count === 'number' ? (
          <span className="tnum text-text-3">{count.toLocaleString('en')}</span>
        ) : null}
      </button>
      {reasonId ? (
        <span id={reasonId} className="sr-only">
          {disabledReason}
        </span>
      ) : null}
    </>
  )
}

/* -------------------------------------------------------- FilterChipLink -- */

export interface FilterChipLinkProps {
  children: React.ReactNode
  href: string
  selected: boolean
  count?: number
  className?: string
}

/**
 * The Discover filters are URL search params read in a Server Component, so the
 * chip that sets them is a link, not a button. `aria-current` rather than
 * `aria-pressed`, because activating it navigates.
 */
export function FilterChipLink({
  children,
  href,
  selected,
  count,
  className,
}: FilterChipLinkProps) {
  return (
    <Link
      href={href}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'inline-flex items-center gap-2xs rounded-xs border px-sm py-sm text-xs whitespace-nowrap no-underline transition-[background-color,border-color,color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-border-strong hover:bg-surface-3 hover:text-text-1',
        selected
          ? 'border-accent bg-surface-3 text-text-1'
          : 'border-border-control bg-surface-2 text-text-2',
        className,
      )}
      style={CHIP_TYPE}
    >
      <span>{children}</span>
      {typeof count === 'number' ? (
        <span className="tnum text-text-3">{count.toLocaleString('en')}</span>
      ) : null}
    </Link>
  )
}
