/**
 * Badge: a non-interactive status label.
 *
 * Keyboard contract: none. A Badge is never focusable and never clickable. If a
 * user can change the thing the badge describes, that is a FilterChip or a
 * button next to the badge, not the badge itself.
 *
 * Contract notes:
 *   §2.4.8  no hue carries meaning alone, so `children` is required and is the
 *           label a greyscale screenshot has to survive on.
 *   §5.1    2px radius. `rounded-full` here would fail the gate.
 *   §5.2    1px border in every state; only the colour changes between tones.
 *   §0.16   warn is a straw icon + border + label. It is never a straw fill.
 *           The only straw fill in the product is `tone="money"`, which is
 *           legal on the reviewer marketplace and nowhere else (§2.4.10).
 */

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BadgeTone =
  | 'neutral'
  | 'accent'
  | 'positive'
  | 'critical'
  | 'warn'
  | 'money'

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'border-border-control bg-surface-2 text-text-2',
  accent: 'border-accent bg-surface-2 text-accent',
  positive: 'border-positive bg-surface-2 text-positive',
  critical: 'border-critical bg-surface-2 text-critical',
  warn: 'border-warn bg-surface-2 text-warn',
  money: 'border-straw-fill bg-straw-fill text-straw-ink',
}

export interface BadgeProps {
  children: React.ReactNode
  tone?: BadgeTone
  /** lucide-react icon, rendered at 16 / strokeWidth 1.5, decorative. */
  icon?: LucideIcon
  className?: string
}

export function Badge({ children, tone = 'neutral', icon: Icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2xs rounded-xs border px-2xs py-3xs text-xs whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
      style={{ fontVariationSettings: '"wdth" 87, "wght" 600' }}
    >
      {Icon ? <Icon size={16} strokeWidth={1.5} aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

/**
 * A count that sits beside a label ("12 replies"). Tabular so a column of them
 * does not shuffle (§3.4).
 */
export function CountBadge({
  count,
  /** Singular noun. "reply" renders "1 reply" / "12 replies". */
  noun,
  className,
}: {
  count: number
  noun: string
  className?: string
}) {
  const word = count === 1 ? noun : `${noun}s`
  return (
    <span className={cn('inline-flex items-baseline gap-2xs text-xs text-text-3', className)}>
      <span className="tnum">{count.toLocaleString('en')}</span>
      <span>{word}</span>
    </span>
  )
}
