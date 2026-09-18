/**
 * Stat: one measured figure, with its label, its change and its caveat.
 *
 * Keyboard contract: none. A Stat is read, not operated. If a figure links
 * somewhere, the link goes in `hint`, as a real <a>, and the figure stays text.
 *
 * Contract notes:
 *   §0.10  numbers render final on first paint. There is no count-up here and
 *          there must not be one anywhere: a counter is both a 1.2s animation
 *          against a 400ms ceiling and a named generated-dashboard tell.
 *   §2.4.8 a delta's direction is an arrow glyph plus words. Colour is optional
 *          and never the only carrier, because up is not always good.
 *   §5.4   loading reserves the figure's width so the row does not jump, and
 *          an empty figure is an en dash with a sentence saying why.
 *   §7.1.6 every figure rendered here must come from a real row.
 */

import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DeltaDirection = 'up' | 'down' | 'flat'
export type DeltaTone = 'neutral' | 'positive' | 'critical'

const DELTA_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus } as const
const DELTA_WORD = { up: 'up', down: 'down', flat: 'unchanged' } as const
const DELTA_TONE_CLASS: Record<DeltaTone, string> = {
  neutral: 'text-text-2',
  positive: 'text-positive',
  critical: 'text-critical',
}

export interface StatProps {
  label: string
  /** Pre-formatted. Pass null when there is genuinely nothing to show. */
  value?: string | number | null
  /** The change, in words the caller owns: "12 since Monday". */
  delta?: string
  deltaDirection?: DeltaDirection
  deltaTone?: DeltaTone
  /** Caveat, source, or the reason the figure is empty. */
  hint?: ReactNode
  loading?: boolean
  /** Characters of figure width to hold while loading. Default 4. */
  width?: number
  className?: string
}

export function Stat({
  label,
  value = null,
  delta,
  deltaDirection = 'flat',
  deltaTone = 'neutral',
  hint,
  loading = false,
  width = 4,
  className,
}: StatProps) {
  const DeltaIcon = DELTA_ICON[deltaDirection]
  const isEmpty = !loading && (value === null || value === '')

  return (
    <div className={cn('flex flex-col gap-3xs', className)} aria-busy={loading || undefined}>
      <dt className="text-xs text-text-3">{label}</dt>
      <dd className="flex flex-col gap-3xs">
        {loading ? (
          <>
            <span className="sr-only">Loading {label}…</span>
            <span
              aria-hidden="true"
              className="block h-lg rounded-xs bg-surface-2"
              style={{ inlineSize: `${String(width)}ch` }}
            />
          </>
        ) : isEmpty ? (
          <span className="text-lg text-text-3" style={{ inlineSize: `${String(width)}ch` }}>
            <span aria-hidden="true">–</span>
            <span className="sr-only">No value yet</span>
          </span>
        ) : (
          <span className="tnum text-lg text-text-1">{value}</span>
        )}

        {delta && !loading && !isEmpty ? (
          <span className={cn('flex items-center gap-2xs text-xs', DELTA_TONE_CLASS[deltaTone])}>
            <DeltaIcon size={16} strokeWidth={1.5} aria-hidden="true" />
            {/* The word is the meaning; the arrow and the colour only repeat it. */}
            <span className="sr-only">{DELTA_WORD[deltaDirection]} </span>
            <span className="tnum">{delta}</span>
          </span>
        ) : null}

        {hint ? <span className="measure-ui text-xs text-text-3">{hint}</span> : null}
      </dd>
    </div>
  )
}

export interface StatGroupProps {
  children: ReactNode
  /** Names the set for assistive tech, e.g. "Inbox this week". */
  label?: string
  className?: string
}

/** Stats are metadata, so they live in a <dl>, never in a row of tiles. */
export function StatGroup({ children, label, className }: StatGroupProps) {
  return (
    <dl aria-label={label} className={cn('grid gap-lg sm:grid-cols-2 md:grid-cols-4', className)}>
      {children}
    </dl>
  )
}
